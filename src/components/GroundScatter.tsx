/*
 * GroundScatter Component
 *
 * Spreads objects (plants, rocks, etc.) across a surface using BatchedMesh with LODs
 * for optimal performance. Based on the technique from:
 * https://discourse.threejs.org/t/spreading-stuff-on-the-floor/67735
 */

import React, { useEffect, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useControls, button } from "leva";
import * as THREE from "three";
import {
  extendBatchedMeshPrototype,
  createRadixSort,
  getBatchedMeshLODCount,
} from "@three.ez/batched-mesh-extensions";
import {
  performanceRangeLOD,
  simplifyGeometriesByErrorLOD,
} from "@three.ez/simplify-geometry";

// Activate the BatchedMesh extensions
extendBatchedMeshPrototype();

interface GroundScatterProps {
  surfaceRef: React.RefObject<THREE.Mesh>;
  enabled?: boolean;
}

/**
 * Utility: Get a random point on the surface of a geometry
 */
function randomPointInGeometry(geom: THREE.BufferGeometry): THREE.Vector3 {
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

  // Interpolate point
  return new THREE.Vector3(
    a.x * u + b.x * v + c.x * w,
    a.y * u + b.y * v + c.y * w,
    a.z * u + b.z * v + c.z * w
  );
}

/**
 * Create a BatchedMesh with LOD geometries
 */
async function createDebriBatchMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  count: number,
  castShadow: boolean
): Promise<THREE.BatchedMesh> {
  // DON'T multiply by count! Just use single geometry size!
  const vertexCount = geometry.attributes.position.count;
  const indexCount = geometry.index ? geometry.index.count : vertexCount;

  console.log(`  📊 Geometry: ${vertexCount} verts, ${indexCount} indices`);

  const batchedMesh = new THREE.BatchedMesh(
    count,
    vertexCount,
    indexCount,
    material
  );

  batchedMesh.customSort = createRadixSort(batchedMesh as THREE.BatchedMesh);
  batchedMesh.castShadow = castShadow;
  batchedMesh.receiveShadow = true;

  // Add geometry once (no LODs for now)
  const geometryId = batchedMesh.addGeometry(geometry);

  // Create instances
  for (let j = 0; j < count; j++) {
    batchedMesh.addInstance(geometryId);
  }

  return batchedMesh;
}

/**
 * Spread instances in a BOUNDED AREA - Direct placement!
 */
function spreadOverSurface(
  batch: THREE.BatchedMesh,
  surface: THREE.Mesh,
  minScale = 0.5,
  maxScale = 2.0,
  areaSize = 100
) {
  const m = new THREE.Matrix4();
  const surfaceY = surface.position.y;

  console.log(
    `  🎯 Placing ${batch.instanceCount} in ${areaSize}×${areaSize} area`
  );

  for (let i = 0; i < batch.instanceCount; i++) {
    // Direct random position in bounded area
    const x = (Math.random() - 0.5) * areaSize;
    const z = (Math.random() - 0.5) * areaSize;
    const y = surfaceY;

    m.makeRotationY(Math.PI * 2 * Math.random());
    m.setPosition(x, y, z);

    const s = minScale + Math.random() * (maxScale - minScale);
    m.scale(new THREE.Vector3(s, s, s));

    batch.setMatrixAt(i, m);
  }

  console.log(`  ✅ All ${batch.instanceCount} instances placed!`);
  batch.computeBVH(THREE.WebGLCoordinateSystem);
}

export const GroundScatter = ({
  surfaceRef,
  enabled = true,
}: GroundScatterProps) => {
  const { scene } = useThree();
  const batchedMeshesRef = useRef<THREE.BatchedMesh[]>([]);
  const isInitialized = useRef(false);

  // Load the optimized models
  // Using Suspense-safe loading to avoid texture errors
  const plant1 = useGLTF("/models/plant1-transformed.glb");
  const arbre = useGLTF("/models/arbre-transformed.glb");

  // Clean up invalid textures immediately after load
  useEffect(() => {
    const cleanMaterials = (scene: THREE.Group) => {
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];

          materials.forEach((mat) => {
            if (mat instanceof THREE.MeshStandardMaterial) {
              // Remove ALL texture references to prevent WebGL errors
              mat.map = null;
              mat.normalMap = null;
              mat.roughnessMap = null;
              mat.metalnessMap = null;
              mat.aoMap = null;
              mat.emissiveMap = null;
              mat.bumpMap = null;
              mat.displacementMap = null;
              mat.alphaMap = null;
              mat.needsUpdate = true;
            }
          });
        }
      });
    };

    try {
      cleanMaterials(plant1.scene);
      cleanMaterials(arbre.scene);
      console.log("🧹 Cleaned all textures from loaded models");
    } catch (error) {
      console.warn("⚠️  Error cleaning textures:", error);
    }
  }, [plant1, arbre]);

  // Production config - REDUCED for close placement!
  const [regenerateTrigger, setRegenerateTrigger] = React.useState(0);

  // CONFIG: Using bounded area - adjust and refresh browser
  const scatterConfig = {
    plantCount: 100, // Moderate count for testing
    treeCount: 0, // Trees disabled (too heavy - 132K verts!)
    plantMinScale: 0.5,
    plantMaxScale: 1.5,
    treeMinScale: 1.0,
    treeMaxScale: 2.0,
    spreadRadius: 200,
    enableTransparency: true,
    alphaTestValue: 0.5,
    doubleSided: true,
  };

  useEffect(() => {
    console.log("🔍 GroundScatter useEffect called:", {
      enabled,
      hasSurface: !!surfaceRef.current,
      isInitialized: isInitialized.current,
    });

    if (!enabled || !surfaceRef.current || isInitialized.current) {
      console.log("⏭️  Skipping initialization");
      return;
    }

    const surface = surfaceRef.current;
    isInitialized.current = true;

    console.log(
      "🚀 Ground Scatter: Initializing (SHOULD ONLY SEE THIS ONCE!)..."
    );

    // Helper function to find FIRST mesh only - following article exactly
    const findFirstMesh = (scene: THREE.Group): THREE.Mesh | null => {
      let foundMesh: THREE.Mesh | null = null;
      scene.traverse((child) => {
        if (!foundMesh && child instanceof THREE.Mesh && child.geometry) {
          foundMesh = child;
        }
      });
      return foundMesh;
    };

    // Find first mesh in loaded models - DON'T merge, just use first mesh
    const plantMesh = findFirstMesh(plant1.scene);
    const arbreMesh = findFirstMesh(arbre.scene);

    console.log("🌿 Ground Scatter - Models loaded:");
    console.log("  Plant mesh:", plantMesh ? "✅ Found" : "❌ Not found");
    console.log("  Tree mesh:", arbreMesh ? "✅ Found" : "❌ Not found");

    // Configuration for each object type
    const objectsToSpread = [
      {
        name: "plant",
        mesh: plantMesh,
        count: scatterConfig.plantCount,
        castShadow: false,
        minScale: scatterConfig.plantMinScale,
        maxScale: scatterConfig.plantMaxScale,
        areaSize: 60, // 60×60 area around player
      },
      {
        name: "tree",
        mesh: arbreMesh,
        count: scatterConfig.treeCount,
        castShadow: true,
        minScale: scatterConfig.treeMinScale,
        maxScale: scatterConfig.treeMaxScale,
        areaSize: 40, // 40×40 area (disabled anyway - count is 0)
      },
    ];

    // Ensure surface world matrix is updated
    surface.updateMatrixWorld(true);

    console.log("📍 Surface info:");
    console.log("  Position:", surface.position);
    console.log("  Rotation:", surface.rotation);
    console.log("  Scale:", surface.scale);

    // Create and spread each object type
    const createBatches = async () => {
      for (const obj of objectsToSpread) {
        if (!obj.mesh || !obj.mesh.geometry) {
          console.warn(`❌ Mesh not found for ${obj.name}`);
          continue;
        }

        // Clone and scale geometry - following article exactly
        const geometry = obj.mesh.geometry.clone();
        const scale = obj.mesh.scale.x;
        geometry.scale(scale, scale, scale);

        // Create BRAND NEW material - completely fresh, no texture issues!
        const material = new THREE.MeshStandardMaterial({
          color: obj.name === "plant" ? 0x55aa33 : 0x8b4513, // Bright green or brown
          roughness: 0.7,
          metalness: 0.0,
          transparent: scatterConfig.enableTransparency,
          alphaTest: scatterConfig.enableTransparency
            ? scatterConfig.alphaTestValue
            : 0,
          side: scatterConfig.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
          // Explicitly no textures
          map: null,
          normalMap: null,
          roughnessMap: null,
          metalnessMap: null,
        });

        console.log(
          `  🎨 Created fresh material (color: ${
            obj.name === "plant" ? "green" : "brown"
          })`
        );

        try {
          console.log(`🔧 Creating BatchedMesh for ${obj.name}...`);
          const startTime = performance.now();

          const batchedMesh = await createDebriBatchMesh(
            geometry,
            material,
            obj.count,
            obj.castShadow
          );
          const createTime = performance.now();
          console.log(
            `  ⏱️  BatchedMesh created in ${(createTime - startTime).toFixed(
              2
            )}ms`
          );

          // Spread the instances
          spreadOverSurface(
            batchedMesh,
            surface,
            obj.minScale,
            obj.maxScale,
            obj.areaSize
          );
          const spreadTime = performance.now();
          console.log(
            `  ⏱️  Instances spread in ${(spreadTime - createTime).toFixed(
              2
            )}ms`
          );

          // Add to scene
          scene.add(batchedMesh);
          batchedMeshesRef.current.push(batchedMesh);

          console.log(
            `✅ ${obj.name} scattered: ${obj.count} instances (Total: ${(
              spreadTime - startTime
            ).toFixed(2)}ms)`
          );
        } catch (error) {
          console.error(`❌ Error creating batch for ${obj.name}:`, error);
        }
      }
    };

    createBatches();

    // Cleanup
    return () => {
      batchedMeshesRef.current.forEach((mesh) => {
        scene.remove(mesh);
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      });
      batchedMeshesRef.current = [];
      isInitialized.current = false;
    };
  }, [enabled, surfaceRef, scene, plant1, arbre, regenerateTrigger]); // Only regenerate when button is clicked!

  // This component doesn't render anything directly
  return null;
};

// Preload the models
useGLTF.preload("/models/plant1-transformed.glb");
useGLTF.preload("/models/arbre-transformed.glb");
