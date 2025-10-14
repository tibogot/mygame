import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { MeshBVH, StaticGeometryGenerator } from "three-mesh-bvh";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useThree } from "@react-three/fiber";

interface BVHColliderProps {
  onColliderReady?: (collider: THREE.Mesh) => void;
}

export const BVHCollider = ({ onColliderReady }: BVHColliderProps) => {
  const { scene } = useThree();
  const colliderRef = useRef<THREE.Mesh | null>(null);

  useEffect(() => {
    console.log("🔨 Building BVH Collider from scene...");

    // Collect all static meshes from the scene
    const staticMeshes: THREE.Mesh[] = [];

    scene.traverse((child) => {
      // Skip InstancedMesh (like leaves)
      if (child instanceof THREE.InstancedMesh) {
        return;
      }

      // Skip SkinnedMesh (character meshes)
      if ((child as any).isSkinnedMesh) {
        return;
      }

      if (child instanceof THREE.Mesh) {
        // Skip meshes with custom instanced attributes (leaves)
        if (
          child.geometry?.attributes?.aScale ||
          child.geometry?.attributes?.aLeafId
        ) {
          return;
        }

        // Collect collidable meshes
        if (child.geometry) {
          staticMeshes.push(child);
        }
      }
    });

    console.log(`Found ${staticMeshes.length} static meshes for collision`);

    if (staticMeshes.length === 0) {
      console.warn("No static meshes found for BVH collider!");
      return;
    }

    // Extract and transform geometries
    const visualGeometries: THREE.BufferGeometry[] = [];

    staticMeshes.forEach((mesh) => {
      if (!mesh.geometry) return;

      // Skip InstancedMesh2 trees - they have their own BVH!
      if (mesh.isInstancedMesh) {
        return; // Skip instanced meshes
      }

      let geom = mesh.geometry.clone();

      // Transform to world space
      geom.applyMatrix4(mesh.matrixWorld);

      // Normalize geometry attributes to ensure compatibility
      // Remove index if it exists (not all geometries have it)
      if (geom.index) {
        geom = geom.toNonIndexed();
      }

      visualGeometries.push(geom);
    });

    // Merge all geometries
    let colliderGeometry;
    try {
      colliderGeometry = BufferGeometryUtils.mergeGeometries(
        visualGeometries,
        false
      );
    } catch (error) {
      console.error("Failed to merge geometries:", error);
      return;
    }

    if (!colliderGeometry) {
      console.error("Failed to merge geometries!");
      return;
    }

    const colliderMesh = new THREE.Mesh(colliderGeometry);
    const environment = new THREE.Group();
    environment.add(colliderMesh);

    // Generate optimized BVH
    const staticGenerator = new StaticGeometryGenerator(environment);
    staticGenerator.attributes = ["position"]; // Only need positions

    const mergedGeometry = staticGenerator.generate();
    mergedGeometry.boundsTree = new MeshBVH(mergedGeometry);

    // Create final collider mesh
    const collider = new THREE.Mesh(
      mergedGeometry,
      new THREE.MeshBasicMaterial({
        wireframe: true,
        opacity: 0.1,
        transparent: true,
        color: "green",
      })
    );

    colliderRef.current = collider;

    console.log("✅ BVH Collider built successfully!");
    console.log(
      "  - Triangles:",
      mergedGeometry.index ? mergedGeometry.index.count / 3 : 0
    );
    console.log("  - BVH ready:", !!mergedGeometry.boundsTree);

    if (onColliderReady) {
      onColliderReady(collider);
    }

    // Cleanup geometries
    visualGeometries.forEach((geom) => geom.dispose());

    return () => {
      mergedGeometry.dispose();
      colliderGeometry.dispose();
    };
  }, [scene, onColliderReady]);

  // Don't render anything (collision is invisible)
  return null;
};
