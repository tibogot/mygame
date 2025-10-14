import React, { useEffect, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";
import {
  extendBatchedMeshPrototype,
  createRadixSort,
  getBatchedMeshLODCount,
} from "@three.ez/batched-mesh-extensions";
import {
  performanceRangeLOD,
  simplifyGeometriesByErrorLOD,
} from "@three.ez/simplify-geometry";

// Activate BatchedMesh extensions
extendBatchedMeshPrototype();

// Setup DRACOLoader for compressed models (singleton)
let dracoLoader: DRACOLoader | null = null;
function getDRACOLoader() {
  if (!dracoLoader) {
    dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(
      "https://www.gstatic.com/draco/versioned/decoders/1.5.6/"
    );
  }
  return dracoLoader;
}

/**
 * GROUND SCATTER SYSTEM
 * Spreads grass, flowers, stones randomly on the ground surface
 * Using BatchedMesh with LOD for maximum performance!
 */

interface ScatterAsset {
  modelPath: string;
  count: number;
  scaleRange?: [number, number];
  castShadow?: boolean;
  scaleMultiplier?: number;
  yOffset?: number; // Manual Y offset to adjust floating/buried objects
}

interface GroundScatterBatchedProps {
  surfaceMesh: THREE.Mesh | null;
  assets: ScatterAsset[];
}

/**
 * Get random point on the surface of a geometry
 * EXACT implementation from the article!
 */
function randomPointInGeometry(
  geom: THREE.BufferGeometry,
  mesh: THREE.Mesh
): THREE.Vector3 {
  const posAttr = geom.attributes.position as THREE.BufferAttribute;
  const index = geom.index ? geom.index.array : undefined;

  // Pick random triangle
  const triCount = index ? index.length / 3 : posAttr.count / 3;
  const triIndex = Math.floor(Math.random() * triCount);

  const getVertex = (i: number, target: THREE.Vector3) => {
    const idx = index ? index[i] : i;
    target.fromBufferAttribute(posAttr, idx);
    return target;
  };

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();

  getVertex(triIndex * 3 + 0, a);
  getVertex(triIndex * 3 + 1, b);
  getVertex(triIndex * 3 + 2, c);

  // Random barycentric coords
  let u = Math.random();
  let v = Math.random();
  if (u + v > 1) {
    u = 1 - u;
    v = 1 - v;
  }
  const w = 1 - u - v;

  // Interpolate point (EXACT from article)
  const point = new THREE.Vector3(
    a.x * u + b.x * v + c.x * w,
    a.y * u + b.y * v + c.y * w,
    a.z * u + b.z * v + c.z * w
  );

  // Transform to world space
  point.applyMatrix4(mesh.matrixWorld);

  return point;
}

/**
 * Create BatchedMesh with LOD levels
 */
async function createBatchedMeshWithLOD(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  count: number,
  castShadow: boolean
): Promise<THREE.BatchedMesh> {
  console.log(`   Creating LOD geometries (async)...`);

  // Create 5 LOD levels using simplification
  const geometriesLODArray = await simplifyGeometriesByErrorLOD(
    [geometry],
    4,
    performanceRangeLOD
  );

  const { vertexCount, indexCount, LODIndexCount } =
    getBatchedMeshLODCount(geometriesLODArray);

  console.log(
    `   LOD levels: ${geometriesLODArray[0].length}, vertices: ${vertexCount}, indices: ${indexCount}`
  );

  const batchedMesh = new THREE.BatchedMesh(
    count,
    vertexCount,
    indexCount,
    material
  );
  batchedMesh.customSort = createRadixSort(batchedMesh as THREE.BatchedMesh);
  batchedMesh.castShadow = castShadow;
  batchedMesh.receiveShadow = true;

  // Add geometries to the batch + their LODs
  for (let i = 0; i < geometriesLODArray.length; i++) {
    const geometryLOD = geometriesLODArray[i];
    const geometryId = batchedMesh.addGeometry(
      geometryLOD[0],
      -1,
      LODIndexCount[i]
    );

    // Add LOD levels (switches based on screen size)
    batchedMesh.addGeometryLOD(geometryId, geometryLOD[1], 0.1);
    batchedMesh.addGeometryLOD(geometryId, geometryLOD[2], 0.05);
    batchedMesh.addGeometryLOD(geometryId, geometryLOD[3], 0.01);
    batchedMesh.addGeometryLOD(geometryId, geometryLOD[4], 0.001);
  }

  // Create instances
  for (let j = 0; j < count; j++) {
    batchedMesh.addInstance(0);
  }

  console.log(
    `   ✅ BatchedMesh created with ${count} instances + 5 LOD levels`
  );

  return batchedMesh;
}

/**
 * Spread batch instances over the surface
 * Following the article EXACTLY!
 */
function spreadOverSurface(
  batch: THREE.BatchedMesh,
  surface: THREE.Mesh,
  scaleRange: [number, number],
  yOffset: number = 0
) {
  const m = new THREE.Matrix4(); // Reusable

  console.log(`   Spreading ${batch.maxInstanceCount} instances on surface...`);
  if (yOffset !== 0) {
    console.log(`   ⬆️ Applying Y offset: ${yOffset.toFixed(3)}`);
  }

  for (let i = 0; i < batch.maxInstanceCount; i++) {
    batch.getMatrixAt(i, m);

    // Random Y rotation (from article)
    m.makeRotationY(Math.PI * 2 * Math.random());

    // Position on the surface (from article)
    const point = randomPointInGeometry(surface.geometry, surface);

    // Apply Y offset (for fixing floating/buried objects)
    point.y += yOffset;

    m.setPosition(point);

    // Random scale (from article)
    const s = scaleRange[0] + Math.random() * (scaleRange[1] - scaleRange[0]);
    m.scale(new THREE.Vector3(s, s, s));

    if (i === 0) {
      console.log(
        `   📏 First instance at: (${point.x.toFixed(2)}, ${point.y.toFixed(
          2
        )}, ${point.z.toFixed(2)})`
      );
      console.log(`   📏 First instance scale: ${s.toFixed(3)}`);
    }

    batch.setMatrixAt(i, m);
  }

  // Compute BVH for frustum culling (from article)
  (batch as any).computeBoundsTree?.();
  (batch as any).computeBVH?.(THREE.WebGLCoordinateSystem);

  console.log(`   ✅ Instances spread on surface with BVH`);
}

export const GroundScatterBatched: React.FC<GroundScatterBatchedProps> = ({
  surfaceMesh,
  assets,
}) => {
  const { scene: threeScene } = useThree();
  const batchedMeshesRef = useRef<THREE.BatchedMesh[]>([]);

  useEffect(() => {
    if (!surfaceMesh) {
      console.log("⏳ Waiting for surface mesh...");
      return;
    }

    console.log(
      `🌿 Creating ground scatter for ${assets.length} asset types...`
    );

    const loadedMeshes: THREE.BatchedMesh[] = [];

    // Load and process each asset
    Promise.all(
      assets.map(async (asset) => {
        console.log(`\n🌿 Loading ${asset.modelPath}...`);

        // Load the model with Draco support
        const loader = new GLTFLoader();
        loader.setDRACOLoader(getDRACOLoader());

        const gltf = await new Promise<any>((resolve, reject) => {
          loader.load(
            asset.modelPath,
            (gltf) => resolve(gltf),
            undefined,
            (error) => reject(error)
          );
        });

        // Find ALL meshes in the model (handles multi-mesh models like flowers)
        const sourceMeshes: THREE.Mesh[] = [];
        gltf.scene.traverse((child: THREE.Object3D) => {
          if ((child as THREE.Mesh).isMesh) {
            sourceMeshes.push(child as THREE.Mesh);
          }
        });

        if (sourceMeshes.length === 0) {
          console.error(`❌ No meshes found in ${asset.modelPath}`);
          return null;
        }

        console.log(`   ✅ Found ${sourceMeshes.length} mesh(es) in model`);

        // MERGE all geometries into ONE (keeps trunk + petals together!)
        const geometriesToMerge: THREE.BufferGeometry[] = [];
        let mergedMaterial: THREE.Material | null = null;
        let hasTransparent = false;

        sourceMeshes.forEach((mesh) => {
          const geom = mesh.geometry.clone();

          // Apply the mesh's WORLD transform to bake in all transforms (scale, rotation, position)
          // This is KEY - it bakes the scale={100} from the component into the geometry!
          mesh.updateWorldMatrix(true, false);
          geom.applyMatrix4(mesh.matrixWorld);

          geometriesToMerge.push(geom);

          // Check if any mesh is transparent
          const mat = mesh.material as THREE.Material;
          if (mat.transparent || mat.opacity < 1) {
            hasTransparent = true;
          }

          // Use first material
          if (!mergedMaterial) {
            mergedMaterial = mat.clone();
          }
        });

        const mergedGeometry = BufferGeometryUtils.mergeGeometries(
          geometriesToMerge,
          false
        );

        if (!mergedGeometry || !mergedMaterial) {
          console.error(`❌ Failed to merge geometries for ${asset.modelPath}`);
          return null;
        }

        // CRITICAL: Move geometry so its BOTTOM is at Y=0 (sits on ground!)
        mergedGeometry.computeBoundingBox();
        const bbox = mergedGeometry.boundingBox!;
        const size = new THREE.Vector3();
        bbox.getSize(size);

        // Move geometry UP so bottom sits at Y=0
        const yOffset = -bbox.min.y; // If min.y is -69, offset is +69
        mergedGeometry.translate(0, yOffset, 0);

        console.log(
          `   🔗 Merged ${sourceMeshes.length} meshes into ONE (trunk + petals together!)`
        );
        console.log(
          `   Total vertices: ${mergedGeometry.attributes.position.count}`
        );
        console.log(
          `   📏 Model size: ${size.x.toFixed(2)} × ${size.y.toFixed(
            2
          )} × ${size.z.toFixed(2)}`
        );
        console.log(
          `   📐 Bottom was at Y=${bbox.min.y.toFixed(
            2
          )}, moved UP by ${yOffset.toFixed(2)} → now at Y=0`
        );
        console.log(`   Creating ${asset.count} instances...`);

        // Handle transparency and alpha for realistic shadows
        if (hasTransparent) {
          console.log(
            `   🌸 Has transparent parts - configuring for realistic shadows`
          );
          (mergedMaterial as any).side = THREE.DoubleSide;
          (mergedMaterial as any).transparent = true;
          (mergedMaterial as any).alphaTest = 0.5; // Critical for shadow cutouts!
          console.log(
            `   ✂️ Alpha test enabled - shadows will respect transparency`
          );
        }

        // Also check if material has a texture with alpha channel
        if ((mergedMaterial as any).map) {
          console.log(
            `   🖼️ Material has texture - enabling alpha test for shadows`
          );
          (mergedMaterial as any).alphaTest = 0.5;
        }

        // Create single BatchedMesh with merged geometry
        const batchedMesh = await createBatchedMeshWithLOD(
          mergedGeometry,
          mergedMaterial,
          asset.count,
          asset.castShadow || false
        );

        // Apply per-asset scale multiplier
        const finalScaleRange: [number, number] = [
          (asset.scaleRange?.[0] || 0.5) * (asset.scaleMultiplier || 1),
          (asset.scaleRange?.[1] || 1.5) * (asset.scaleMultiplier || 1),
        ];

        console.log(
          `   📏 Final scale range: ${finalScaleRange[0].toFixed(
            3
          )} - ${finalScaleRange[1].toFixed(3)}`
        );

        // Spread instances on the surface
        spreadOverSurface(
          batchedMesh,
          surfaceMesh,
          finalScaleRange,
          asset.yOffset || 0
        );

        return batchedMesh;
      })
    ).then((meshes) => {
      // Add all batched meshes to scene
      meshes.forEach((mesh) => {
        if (mesh) {
          threeScene.add(mesh);
          loadedMeshes.push(mesh);
        }
      });

      batchedMeshesRef.current = loadedMeshes;

      console.log(`\n✅ Ground scatter complete!`);
      console.log(`   Total batched meshes: ${loadedMeshes.length}`);
      console.log(
        `   Total instances: ${loadedMeshes.reduce(
          (sum, m) => sum + m.maxInstanceCount,
          0
        )}`
      );
      console.log(`   Draw calls: ${loadedMeshes.length}`);
      console.log(`   LOD: ✅ ENABLED (5 levels per asset)`);
      console.log(`   BVH: ✅ ENABLED for frustum culling`);
    });

    // Cleanup
    return () => {
      batchedMeshesRef.current.forEach((mesh) => {
        threeScene.remove(mesh);
        mesh.dispose();
      });
      batchedMeshesRef.current = [];
    };
  }, [surfaceMesh, assets, threeScene]);

  return null;
};

export default GroundScatterBatched;
