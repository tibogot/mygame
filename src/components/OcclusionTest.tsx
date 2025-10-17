import React, { useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

interface OcclusionTestProps {
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
}

// Helper function to generate test points on a sphere using Fibonacci sphere algorithm
function generateSpherePoints(
  center: THREE.Vector3,
  radius: number,
  count: number
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = phi * i;

    const x = Math.cos(theta) * radiusAtY;
    const z = Math.sin(theta) * radiusAtY;

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

export const OcclusionTest: React.FC<OcclusionTestProps> = ({
  occluderPosition = [0, 0, 0],
  targetPosition = [0, 0, -3],
  occluderSize = [6, 6],
  targetRadius = 0.5,
  showDebug = true,
  onOcclusionChange,
}) => {
  const { camera, scene } = useThree();
  const occluderRef = useRef<THREE.Mesh>(null);
  const targetRef = useRef<THREE.Mesh>(null);
  const [isOccluded, setIsOccluded] = useState(false);
  const [occlusionPercentage, setOcclusionPercentage] = useState(0);
  const raycaster = useRef(new THREE.Raycaster());

  const frameCountRef = useRef(0);

  useFrame(() => {
    if (!occluderRef.current || !targetRef.current) return;

    // Only test every 5 frames to improve performance
    frameCountRef.current++;
    if (frameCountRef.current % 5 !== 0) return;

    // Get target position in world space
    const targetWorldPos = new THREE.Vector3();
    targetRef.current.getWorldPosition(targetWorldPos);

    // Test multiple points on the target sphere (reduced from 26 to 12 for performance)
    const testPoints = generateSpherePoints(targetWorldPos, targetRadius, 12);
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
    const newIsOccluded = occlusionRatio >= 0.99; // 99% threshold for "fully occluded"

    // Only update state if values changed to avoid unnecessary re-renders
    if (newPercentage !== occlusionPercentage) {
      setOcclusionPercentage(newPercentage);
    }

    if (newIsOccluded !== isOccluded) {
      setIsOccluded(newIsOccluded);
    }

    // Call callback if provided
    if (
      onOcclusionChange &&
      (newPercentage !== occlusionPercentage || newIsOccluded !== isOccluded)
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
        <sphereGeometry args={[targetRadius, 32, 32]} />
        <meshStandardMaterial
          color={isOccluded ? "#ff0000" : "#00ff00"}
          emissive={isOccluded ? "#660000" : "#006600"}
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Debug Info */}
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
              padding: "8px 12px",
              borderRadius: "4px",
              fontFamily: "monospace",
              fontSize: "12px",
              whiteSpace: "nowrap",
              border: `2px solid ${isOccluded ? "#ff4444" : "#44ff44"}`,
            }}
          >
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

// Convenience component for testing multiple occlusion scenarios
export const OcclusionTestSuite: React.FC = () => {
  return (
    <group>
      {/* Test 1: Basic occlusion */}
      <OcclusionTest
        occluderPosition={[0, 0, 0]}
        targetPosition={[0, 0, -3]}
        showDebug={true}
      />

      {/* Test 2: Angled occlusion */}
      <OcclusionTest
        occluderPosition={[5, 1, -2]}
        targetPosition={[5, 1, -5]}
        occluderSize={[4, 4]}
        showDebug={true}
      />

      {/* Test 3: Large occluder */}
      <OcclusionTest
        occluderPosition={[-5, 0, 0]}
        targetPosition={[-5, 0, -4]}
        occluderSize={[8, 8]}
        targetRadius={0.8}
        showDebug={true}
      />
    </group>
  );
};
