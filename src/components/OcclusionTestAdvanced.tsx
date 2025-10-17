import React, { useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

interface OcclusionTestAdvancedProps {
  /** The target object to test occlusion for */
  targetObject?: THREE.Object3D;
  /** Array of objects that can occlude the target */
  occluders?: THREE.Object3D[];
  /** Position to test from (defaults to camera position) */
  testPosition?: THREE.Vector3;
  /** Number of test points to sample */
  testPointCount?: number;
  /** Occlusion threshold (0-1, default 0.99) */
  occlusionThreshold?: number;
  /** Whether to show debug info */
  showDebug?: boolean;
  /** Callback when occlusion state changes */
  onOcclusionChange?: (
    isOccluded: boolean,
    percentage: number,
    visiblePoints: number,
    totalPoints: number
  ) => void;
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

// Helper function to get bounding sphere of an object
function getObjectBoundingSphere(object: THREE.Object3D): THREE.Sphere {
  const box = new THREE.Box3().setFromObject(object);
  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);
  return sphere;
}

export const OcclusionTestAdvanced: React.FC<OcclusionTestAdvancedProps> = ({
  targetObject,
  occluders = [],
  testPosition,
  testPointCount = 26,
  occlusionThreshold = 0.99,
  showDebug = true,
  onOcclusionChange,
}) => {
  const { camera } = useThree();
  const [isOccluded, setIsOccluded] = useState(false);
  const [occlusionPercentage, setOcclusionPercentage] = useState(0);
  const [visiblePoints, setVisiblePoints] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const raycaster = useRef(new THREE.Raycaster());

  useFrame(() => {
    if (!targetObject || occluders.length === 0) return;

    // Get test position (camera or provided position)
    const fromPosition = testPosition || camera.position;

    // Get target bounding sphere
    const targetSphere = getObjectBoundingSphere(targetObject);

    // Get target position in world space
    const targetWorldPos = new THREE.Vector3();
    targetObject.getWorldPosition(targetWorldPos);

    // Test multiple points on the target sphere
    const testPoints = generateSpherePoints(
      targetWorldPos,
      targetSphere.radius,
      testPointCount
    );
    let visibleCount = 0;
    const totalCount = testPoints.length;

    testPoints.forEach((point) => {
      // Direction from test position to test point
      const direction = new THREE.Vector3()
        .subVectors(point, fromPosition)
        .normalize();

      raycaster.current.set(fromPosition, direction);
      raycaster.current.far = fromPosition.distanceTo(point) + 0.1;

      // Check intersections with all occluders
      const allIntersects: THREE.Intersection[] = [];
      occluders.forEach((occluder) => {
        const intersects = raycaster.current.intersectObject(occluder, true);
        allIntersects.push(...intersects);
      });

      // Sort intersections by distance
      allIntersects.sort((a, b) => a.distance - b.distance);

      // If no intersection or first intersection is behind the test point, it's visible
      if (allIntersects.length === 0) {
        visibleCount++;
      } else {
        const firstIntersectDist = allIntersects[0].distance;
        const pointDist = fromPosition.distanceTo(point);

        // Point is visible if intersection is further than the point
        if (firstIntersectDist > pointDist - 0.01) {
          visibleCount++;
        }
      }
    });

    const visibilityRatio = visibleCount / totalCount;
    const occlusionRatio = 1 - visibilityRatio;

    const newPercentage = Math.round(occlusionRatio * 100);
    const newIsOccluded = occlusionRatio >= occlusionThreshold;

    // Update state if values changed
    if (newPercentage !== occlusionPercentage) {
      setOcclusionPercentage(newPercentage);
    }

    if (newIsOccluded !== isOccluded) {
      setIsOccluded(newIsOccluded);
    }

    if (visibleCount !== visiblePoints) {
      setVisiblePoints(visibleCount);
    }

    if (totalCount !== totalPoints) {
      setTotalPoints(totalCount);
    }

    // Call callback if provided
    if (
      onOcclusionChange &&
      (newPercentage !== occlusionPercentage ||
        newIsOccluded !== isOccluded ||
        visibleCount !== visiblePoints ||
        totalCount !== totalPoints)
    ) {
      onOcclusionChange(newIsOccluded, newPercentage, visibleCount, totalCount);
    }
  });

  if (!showDebug) return null;

  return (
    <Html position={targetObject ? targetObject.position : [0, 0, 0]}>
      <div
        style={{
          background: "rgba(0,0,0,0.9)",
          color: "white",
          padding: "10px 15px",
          borderRadius: "6px",
          fontFamily: "monospace",
          fontSize: "11px",
          whiteSpace: "nowrap",
          border: `2px solid ${isOccluded ? "#ff4444" : "#44ff44"}`,
          minWidth: "200px",
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
          Advanced Occlusion Test
        </div>
        <div>
          Points: {visiblePoints}/{totalPoints}
        </div>
        <div>Occlusion: {occlusionPercentage}%</div>
        <div style={{ color: isOccluded ? "#ff4444" : "#44ff44" }}>
          Status: {isOccluded ? "OCCLUDED" : "VISIBLE"}
        </div>
        <div style={{ fontSize: "10px", marginTop: "5px", opacity: 0.7 }}>
          Threshold: {Math.round(occlusionThreshold * 100)}%
        </div>
      </div>
    </Html>
  );
};

// Hook for easy integration with your existing objects
export const useOcclusionTest = (
  targetObject: THREE.Object3D | null,
  occluders: THREE.Object3D[] = [],
  options: {
    testPointCount?: number;
    occlusionThreshold?: number;
    testPosition?: THREE.Vector3;
  } = {}
) => {
  const [isOccluded, setIsOccluded] = useState(false);
  const [occlusionPercentage, setOcclusionPercentage] = useState(0);

  const handleOcclusionChange = (
    occluded: boolean,
    percentage: number,
    visiblePoints: number,
    totalPoints: number
  ) => {
    setIsOccluded(occluded);
    setOcclusionPercentage(percentage);

    // You can add your game logic here
    if (targetObject) {
      // Example: Hide object when fully occluded
      targetObject.visible = !occluded;
    }
  };

  return {
    isOccluded,
    occlusionPercentage,
    OcclusionTestComponent: targetObject ? (
      <OcclusionTestAdvanced
        targetObject={targetObject}
        occluders={occluders}
        onOcclusionChange={handleOcclusionChange}
        showDebug={false}
        {...options}
      />
    ) : null,
  };
};
