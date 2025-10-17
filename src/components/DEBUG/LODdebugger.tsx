import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Detailed } from "@react-three/drei";

export default function LODDebugger({ position = [0, 2, 0], scale = 1 }) {
  const groupRef = useRef();

  // Rotate the torus knot slowly for better visualization
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
      groupRef.current.rotation.x += delta * 0.1;
    }
  });

  return (
    <group ref={groupRef} position={position} scale={scale}>
      <Detailed distances={[0, 10, 30, 60]}>
        {/* LOD 0 - Highest Detail - RED */}
        <mesh>
          <torusKnotGeometry args={[1, 0.3, 100, 16]} />
          <meshStandardMaterial
            color="#ff0000"
            roughness={0.3}
            metalness={0.6}
          />
        </mesh>

        {/* LOD 1 - Medium Detail - GREEN */}
        <mesh>
          <torusKnotGeometry args={[1, 0.3, 50, 8]} />
          <meshStandardMaterial
            color="#00ff00"
            roughness={0.3}
            metalness={0.6}
          />
        </mesh>

        {/* LOD 2 - Low Detail - BLUE */}
        <mesh>
          <torusKnotGeometry args={[1, 0.3, 20, 6]} />
          <meshStandardMaterial
            color="#0000ff"
            roughness={0.3}
            metalness={0.6}
          />
        </mesh>

        {/* LOD 3 - Lowest Detail - YELLOW */}
        <mesh>
          <torusKnotGeometry args={[1, 0.3, 10, 4]} />
          <meshStandardMaterial
            color="#ffff00"
            roughness={0.3}
            metalness={0.6}
          />
        </mesh>
      </Detailed>
    </group>
  );
}
