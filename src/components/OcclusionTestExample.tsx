import React, { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  OcclusionTestAdvanced,
  useOcclusionTest,
} from "./OcclusionTestAdvanced";

/**
 * Example component showing how to integrate occlusion culling with your existing Map5 objects
 * This demonstrates testing a tree against terrain occlusion
 */
export const OcclusionTestExample: React.FC = () => {
  const treeRef = useRef<THREE.Mesh>(null);
  const terrainRef = useRef<THREE.Mesh>(null);

  // Test tree occlusion against terrain
  const { isOccluded, occlusionPercentage, OcclusionTestComponent } =
    useOcclusionTest(
      treeRef.current,
      terrainRef.current ? [terrainRef.current] : [],
      {
        testPointCount: 32, // More points for accuracy
        occlusionThreshold: 0.95, // 95% occluded = fully occluded
      }
    );

  // Example: Log occlusion changes
  useEffect(() => {
    if (isOccluded) {
      console.log(`Tree is fully occluded (${occlusionPercentage}%)`);
    }
  }, [isOccluded, occlusionPercentage]);

  return (
    <group>
      {/* Example tree that will be tested for occlusion */}
      <mesh ref={treeRef} position={[5, 2, -10]}>
        <cylinderGeometry args={[0.2, 0.4, 4]} />
        <meshStandardMaterial color="#228B22" />
      </mesh>

      {/* Example terrain that can occlude the tree */}
      <mesh ref={terrainRef} position={[0, 0, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* The occlusion test component */}
      {OcclusionTestComponent}

      {/* Visual indicator */}
      <Html position={[0, 5, 0]}>
        <div
          style={{
            background: "rgba(0,0,0,0.8)",
            color: "white",
            padding: "10px",
            borderRadius: "5px",
            fontFamily: "monospace",
            textAlign: "center",
          }}
        >
          <div>Occlusion Test Example</div>
          <div style={{ color: isOccluded ? "#ff4444" : "#44ff44" }}>
            Tree: {isOccluded ? "OCCLUDED" : "VISIBLE"} ({occlusionPercentage}%)
          </div>
        </div>
      </Html>
    </group>
  );
};

/**
 * Integration example for your Map5 - testing multiple objects
 */
export const Map5OcclusionIntegration: React.FC<{
  terrainMesh?: THREE.Mesh;
  mountainObjects?: THREE.Object3D[];
}> = ({ terrainMesh, mountainObjects = [] }) => {
  const testObjectRef = useRef<THREE.Mesh>(null);

  // Create occluders array from terrain and mountains
  const occluders = [...(terrainMesh ? [terrainMesh] : []), ...mountainObjects];

  const { isOccluded, occlusionPercentage } = useOcclusionTest(
    testObjectRef.current,
    occluders,
    {
      testPointCount: 20, // Balanced for performance
      occlusionThreshold: 0.98, // Very strict occlusion
    }
  );

  return (
    <group>
      {/* Test object that will be culled when occluded */}
      <mesh ref={testObjectRef} position={[10, 3, -15]}>
        <boxGeometry args={[1, 2, 1]} />
        <meshStandardMaterial
          color={isOccluded ? "#666666" : "#00ff00"}
          transparent
          opacity={isOccluded ? 0.3 : 1.0}
        />
      </mesh>

      {/* Debug info */}
      <Html position={[10, 5, -15]}>
        <div
          style={{
            background: "rgba(0,0,0,0.9)",
            color: "white",
            padding: "8px",
            borderRadius: "4px",
            fontFamily: "monospace",
            fontSize: "12px",
            border: `2px solid ${isOccluded ? "#ff4444" : "#44ff44"}`,
          }}
        >
          <div>Occlusion: {occlusionPercentage}%</div>
          <div style={{ color: isOccluded ? "#ff4444" : "#44ff44" }}>
            {isOccluded ? "OCCLUDED" : "VISIBLE"}
          </div>
        </div>
      </Html>
    </group>
  );
};
