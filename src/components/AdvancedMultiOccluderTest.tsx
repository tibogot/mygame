import React, { useRef, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useControls } from "leva";
import * as THREE from "three";

interface OccluderPlane {
  id: string;
  position: [number, number, number];
  size: [number, number];
  color: string;
  rotation: [number, number, number];
  enabled: boolean;
}

interface AdvancedMultiOccluderTestProps {
  /** Position of the target sphere */
  targetPosition?: [number, number, number];
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

export const AdvancedMultiOccluderTest: React.FC<
  AdvancedMultiOccluderTestProps
> = ({
  targetPosition = [0, 0, -5],
  targetRadius = 0.5,
  showDebug = true,
  onOcclusionChange,
}) => {
  const { camera } = useThree();
  const targetRef = useRef<THREE.Mesh>(null);
  const occluderRefs = useRef<{ [key: string]: THREE.Mesh | null }>({});
  const [isOccluded, setIsOccluded] = useState(false);
  const [occlusionPercentage, setOcclusionPercentage] = useState(0);
  const raycaster = useRef(new THREE.Raycaster());

  // Leva controls for each occluder
  const occluder1Controls = useControls("🔴 Occluder 1", {
    enabled: { value: true, label: "Enabled" },
    position: { value: { x: 0, y: 0, z: 0 }, label: "Position" },
    size: { value: { x: 6, y: 6 }, label: "Size" },
    rotation: { value: { x: 0, y: 0, z: 0 }, label: "Rotation" },
    color: { value: "#ff0000", label: "Color" },
  });

  const occluder2Controls = useControls("🟢 Occluder 2", {
    enabled: { value: true, label: "Enabled" },
    position: { value: { x: 2, y: 1, z: -1 }, label: "Position" },
    size: { value: { x: 4, y: 4 }, label: "Size" },
    rotation: { value: { x: 0, y: 45, z: 0 }, label: "Rotation" },
    color: { value: "#00ff00", label: "Color" },
  });

  const occluder3Controls = useControls("🔵 Occluder 3", {
    enabled: { value: true, label: "Enabled" },
    position: { value: { x: -2, y: -1, z: 1 }, label: "Position" },
    size: { value: { x: 5, y: 5 }, label: "Size" },
    rotation: { value: { x: 0, y: -30, z: 0 }, label: "Rotation" },
    color: { value: "#0000ff", label: "Color" },
  });

  // Convert degrees to radians for rotation
  const occluders: OccluderPlane[] = [
    {
      id: "occluder-1",
      enabled: occluder1Controls.enabled,
      position: [
        occluder1Controls.position.x,
        occluder1Controls.position.y,
        occluder1Controls.position.z,
      ],
      size: [occluder1Controls.size.x, occluder1Controls.size.y],
      color: occluder1Controls.color,
      rotation: [
        (occluder1Controls.rotation.x * Math.PI) / 180,
        (occluder1Controls.rotation.y * Math.PI) / 180,
        (occluder1Controls.rotation.z * Math.PI) / 180,
      ],
    },
    {
      id: "occluder-2",
      enabled: occluder2Controls.enabled,
      position: [
        occluder2Controls.position.x,
        occluder2Controls.position.y,
        occluder2Controls.position.z,
      ],
      size: [occluder2Controls.size.x, occluder2Controls.size.y],
      color: occluder2Controls.color,
      rotation: [
        (occluder2Controls.rotation.x * Math.PI) / 180,
        (occluder2Controls.rotation.y * Math.PI) / 180,
        (occluder2Controls.rotation.z * Math.PI) / 180,
      ],
    },
    {
      id: "occluder-3",
      enabled: occluder3Controls.enabled,
      position: [
        occluder3Controls.position.x,
        occluder3Controls.position.y,
        occluder3Controls.position.z,
      ],
      size: [occluder3Controls.size.x, occluder3Controls.size.y],
      color: occluder3Controls.color,
      rotation: [
        (occluder3Controls.rotation.x * Math.PI) / 180,
        (occluder3Controls.rotation.y * Math.PI) / 180,
        (occluder3Controls.rotation.z * Math.PI) / 180,
      ],
    },
  ];

  const frameCountRef = useRef(0);

  useFrame(() => {
    if (!targetRef.current) return;

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

      // Check intersections with ALL enabled occluders
      const allIntersects: THREE.Intersection[] = [];

      occluders.forEach((occluder) => {
        if (!occluder.enabled) return;

        const occluderMesh = occluderRefs.current[occluder.id];
        if (occluderMesh) {
          const intersects = raycaster.current.intersectObject(
            occluderMesh,
            true
          );
          allIntersects.push(...intersects);
        }
      });

      // Sort intersections by distance
      allIntersects.sort((a, b) => a.distance - b.distance);

      // If no intersection or first intersection is behind the test point, it's visible
      if (allIntersects.length === 0) {
        visiblePoints++;
      } else {
        const firstIntersectDist = allIntersects[0].distance;
        const pointDist = camera.position.distanceTo(point);

        // Point is visible if intersection is further than the point
        if (firstIntersectDist > pointDist - 0.01) {
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

  const enabledOccluders = occluders.filter((o) => o.enabled);

  return (
    <group>
      {/* Target Sphere */}
      <mesh ref={targetRef} position={targetPosition}>
        <sphereGeometry args={[targetRadius, 32, 32]} />
        <meshStandardMaterial
          color={isOccluded ? "#ff0000" : "#00ff00"}
          emissive={isOccluded ? "#660000" : "#006600"}
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Occluder Planes */}
      {occluders.map((occluder) => (
        <mesh
          key={occluder.id}
          ref={(ref) => {
            occluderRefs.current[occluder.id] = ref;
          }}
          position={occluder.position}
          rotation={occluder.rotation}
          visible={occluder.enabled}
        >
          <planeGeometry args={occluder.size} />
          <meshBasicMaterial
            color={occluder.color}
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

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
            <div>Advanced Multi-Occluder</div>
            <div>Active: {enabledOccluders.length}/3</div>
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
