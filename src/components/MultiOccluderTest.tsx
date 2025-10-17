import React, { useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

interface OccluderPlane {
  id: string;
  position: [number, number, number];
  size: [number, number];
  color: string;
  rotation: [number, number, number];
}

interface MultiOccluderTestProps {
  /** Position of the target sphere */
  targetPosition?: [number, number, number];
  /** Radius of the target sphere */
  targetRadius?: number;
  /** Whether to show debug info */
  showDebug?: boolean;
  /** Callback when occlusion state changes */
  onOcclusionChange?: (isOccluded: boolean, percentage: number) => void;
  /** Array of occluder planes */
  occluders: OccluderPlane[];
  /** Whether to show occluder planes */
  showOccluders?: boolean;
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

export const MultiOccluderTest: React.FC<MultiOccluderTestProps> = ({
  targetPosition = [0, 0, -3],
  targetRadius = 0.5,
  showDebug = true,
  onOcclusionChange,
  occluders = [],
  showOccluders = true,
}) => {
  const { camera } = useThree();
  const targetRef = useRef<THREE.Mesh>(null);
  const occluderRefs = useRef<{ [key: string]: THREE.Mesh | null }>({});
  const [isOccluded, setIsOccluded] = useState(false);
  const [occlusionPercentage, setOcclusionPercentage] = useState(0);
  const raycaster = useRef(new THREE.Raycaster());

  const frameCountRef = useRef(0);

  useFrame(() => {
    if (!targetRef.current || occluders.length === 0) return;

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

      // Check intersections with ALL occluders
      const allIntersects: THREE.Intersection[] = [];

      occluders.forEach((occluder) => {
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
      {showOccluders &&
        occluders.map((occluder) => (
          <mesh
            key={occluder.id}
            ref={(ref) => {
              occluderRefs.current[occluder.id] = ref;
            }}
            position={occluder.position}
            rotation={occluder.rotation}
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
            <div>Multi-Occluder Test</div>
            <div>Occluders: {occluders.length}</div>
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

// Predefined occluder configurations
export const createDefaultOccluders = (): OccluderPlane[] => [
  {
    id: "occluder-1",
    position: [0, 0, 0],
    size: [6, 6],
    color: "#ff0000", // Red
    rotation: [0, 0, 0],
  },
  {
    id: "occluder-2",
    position: [2, 1, -1],
    size: [4, 4],
    color: "#00ff00", // Green
    rotation: [0, Math.PI / 4, 0],
  },
  {
    id: "occluder-3",
    position: [-2, -1, 1],
    size: [5, 5],
    color: "#0000ff", // Blue
    rotation: [0, -Math.PI / 6, 0],
  },
];

// Hook for managing occluders
export const useMultiOccluderTest = () => {
  const [occluders, setOccluders] = useState<OccluderPlane[]>(
    createDefaultOccluders()
  );
  const [isOccluded, setIsOccluded] = useState(false);
  const [occlusionPercentage, setOcclusionPercentage] = useState(0);

  const addOccluder = (occluder: Omit<OccluderPlane, "id">) => {
    const newOccluder: OccluderPlane = {
      ...occluder,
      id: `occluder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    setOccluders((prev) => [...prev, newOccluder]);
  };

  const removeOccluder = (id: string) => {
    setOccluders((prev) => prev.filter((o) => o.id !== id));
  };

  const updateOccluder = (id: string, updates: Partial<OccluderPlane>) => {
    setOccluders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...updates } : o))
    );
  };

  const clearOccluders = () => {
    setOccluders([]);
  };

  const resetToDefaults = () => {
    setOccluders(createDefaultOccluders());
  };

  const handleOcclusionChange = (occluded: boolean, percentage: number) => {
    setIsOccluded(occluded);
    setOcclusionPercentage(percentage);
  };

  return {
    occluders,
    isOccluded,
    occlusionPercentage,
    addOccluder,
    removeOccluder,
    updateOccluder,
    clearOccluders,
    resetToDefaults,
    handleOcclusionChange,
  };
};
