import React, { useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

interface OcclusionTestOptimizedProps {
  /** Position of the occluder plane */
  occluderPosition?: [number, number, number];
  /** Position of the target sphere */
  targetPosition?: [number, number, number];
  /** Size of the occluder plane */
  occluderSize?: [number, number];
  /** Radius of the target sphere */
  targetRadius?: number;
  /** Whether to show debug info */
  showDebug?: boolean;
  /** Callback when occlusion state changes */
  onOcclusionChange?: (isOccluded: boolean, percentage: number) => void;
  /** Test frequency in frames (default: 10 = every 10th frame) */
  testFrequency?: number;
  /** Number of test points (default: 8 for performance) */
  testPointCount?: number;
}

// Optimized helper function - fewer points, faster generation
function generateOptimizedSpherePoints(
  center: THREE.Vector3,
  radius: number,
  count: number
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];

  // Use a simpler distribution for better performance
  for (let i = 0; i < count; i++) {
    const phi = Math.acos(1 - (2 * i) / count); // Uniform distribution
    const theta = Math.PI * (1 + Math.sqrt(5)) * i; // Golden angle

    const x = Math.cos(theta) * Math.sin(phi);
    const y = Math.cos(phi);
    const z = Math.sin(theta) * Math.sin(phi);

    points.push(
      new THREE.Vector3(
        center.x + x * radius,
        center.y + y * radius,
        center.z + z * radius
      )
    );
  }

  return points;
}

export const OcclusionTestOptimized: React.FC<OcclusionTestOptimizedProps> = ({
  occluderPosition = [0, 0, 0],
  targetPosition = [0, 0, -3],
  occluderSize = [6, 6],
  targetRadius = 0.5,
  showDebug = true,
  onOcclusionChange,
  testFrequency = 10, // Test every 10 frames by default
  testPointCount = 8, // Only 8 points for maximum performance
}) => {
  const { camera } = useThree();
  const occluderRef = useRef<THREE.Mesh>(null);
  const targetRef = useRef<THREE.Mesh>(null);
  const [isOccluded, setIsOccluded] = useState(false);
  const [occlusionPercentage, setOcclusionPercentage] = useState(0);
  const raycaster = useRef(new THREE.Raycaster());
  const frameCountRef = useRef(0);

  useFrame(() => {
    if (!occluderRef.current || !targetRef.current) return;

    // Only test every N frames for performance
    frameCountRef.current++;
    if (frameCountRef.current % testFrequency !== 0) return;

    // Get target position in world space
    const targetWorldPos = new THREE.Vector3();
    targetRef.current.getWorldPosition(targetWorldPos);

    // Test fewer points for better performance
    const testPoints = generateOptimizedSpherePoints(
      targetWorldPos,
      targetRadius,
      testPointCount
    );
    let visiblePoints = 0;
    let totalPoints = testPoints.length;

    testPoints.forEach((point) => {
      // Direction from camera to test point
      const direction = new THREE.Vector3()
        .subVectors(point, camera.position)
        .normalize();

      raycaster.current.set(camera.position, direction);
      raycaster.current.far = camera.position.distanceTo(point) + 0.1;

      // Check intersections with occluder
      const intersects = raycaster.current.intersectObject(
        occluderRef.current!,
        true
      );

      // If no intersection or intersection is behind the test point, it's visible
      if (intersects.length === 0) {
        visiblePoints++;
      } else {
        const intersectDist = intersects[0].distance;
        const pointDist = camera.position.distanceTo(point);

        // Point is visible if intersection is further than the point
        if (intersectDist > pointDist - 0.01) {
          visiblePoints++;
        }
      }
    });

    const visibilityRatio = visiblePoints / totalPoints;
    const occlusionRatio = 1 - visibilityRatio;

    const newPercentage = Math.round(occlusionRatio * 100);
    const newIsOccluded = occlusionRatio >= 0.95; // Slightly lower threshold for fewer points

    // Only update state if values changed significantly
    if (Math.abs(newPercentage - occlusionPercentage) > 5) {
      setOcclusionPercentage(newPercentage);
    }

    if (newIsOccluded !== isOccluded) {
      setIsOccluded(newIsOccluded);
    }

    // Call callback if provided (but not every frame)
    if (
      onOcclusionChange &&
      (Math.abs(newPercentage - occlusionPercentage) > 5 ||
        newIsOccluded !== isOccluded)
    ) {
      onOcclusionChange(newIsOccluded, newPercentage);
    }
  });

  return (
    <group>
      {/* Occluder Plane */}
      <mesh ref={occluderRef} position={occluderPosition} rotation={[0, 0, 0]}>
        <planeGeometry args={occluderSize} />
        <meshBasicMaterial
          color={isOccluded ? "#00ff00" : "#ff0000"}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Target Sphere */}
      <mesh ref={targetRef} position={targetPosition}>
        <sphereGeometry args={[targetRadius, 16, 16]} />
        <meshStandardMaterial
          color={isOccluded ? "#ff0000" : "#00ff00"}
          emissive={isOccluded ? "#660000" : "#006600"}
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Debug Info - Only show if enabled */}
      {showDebug && (
        <Html
          position={[
            targetPosition[0],
            targetPosition[1] + 2,
            targetPosition[2],
          ]}
        >
          <div
            style={{
              background: "rgba(0,0,0,0.8)",
              color: "white",
              padding: "6px 10px",
              borderRadius: "4px",
              fontFamily: "monospace",
              fontSize: "11px",
              whiteSpace: "nowrap",
              border: `2px solid ${isOccluded ? "#ff4444" : "#44ff44"}`,
            }}
          >
            <div>Optimized Occlusion</div>
            <div>Points: {testPointCount}</div>
            <div>Freq: 1/{testFrequency}</div>
            <div>Occlusion: {occlusionPercentage}%</div>
            <div style={{ color: isOccluded ? "#ff4444" : "#44ff44" }}>
              {isOccluded ? "OCCLUDED" : "VISIBLE"}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};
