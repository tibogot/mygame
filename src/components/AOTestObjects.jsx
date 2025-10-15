import React from "react";
import { RigidBody } from "@react-three/rapier";
import { useControls, folder } from "leva";

/**
 * Test objects to demonstrate Ambient Occlusion
 *
 * AO is most visible:
 * - In corners and crevices
 * - Where objects touch the ground
 * - Between objects that are close together
 * - In recessed areas
 */
export const AOTestObjects = () => {
  const { showTestObjects } = useControls("🔍 DEBUG", {
    ssaoTestObjects: folder(
      {
        showTestObjects: {
          value: false,
          label: "🎲 Show AO Test Objects",
        },
      },
      { collapsed: true }
    ),
  });

  if (!showTestObjects) return null;

  return (
    <group position={[10, 0, 0]}>
      {/* Label */}
      <mesh position={[0, 5, 0]}>
        <boxGeometry args={[8, 0.5, 0.5]} />
        <meshStandardMaterial
          color="#ff00ff"
          emissive="#ff00ff"
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Ground platform to show contact shadows */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, 0, 0]} receiveShadow>
          <boxGeometry args={[8, 0.5, 8]} />
          <meshStandardMaterial color="#888888" />
        </mesh>
      </RigidBody>

      {/* Sphere on ground - shows contact AO at base */}
      <RigidBody type="fixed" colliders="ball">
        <mesh position={[-2, 1.5, 0]} castShadow receiveShadow>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial color="#ff6b6b" roughness={0.7} />
        </mesh>
      </RigidBody>

      {/* Cube on ground - shows corner AO */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[2, 1, 0]} castShadow receiveShadow>
          <boxGeometry args={[2, 2, 2]} />
          <meshStandardMaterial color="#4ecdc4" roughness={0.7} />
        </mesh>
      </RigidBody>

      {/* Two cubes close together - shows occlusion between objects */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[-2, 1, -3]} castShadow receiveShadow>
          <boxGeometry args={[1.5, 2, 1.5]} />
          <meshStandardMaterial color="#95e1d3" roughness={0.7} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[-0.5, 1, -3]} castShadow receiveShadow>
          <boxGeometry args={[1.5, 2, 1.5]} />
          <meshStandardMaterial color="#f38181" roughness={0.7} />
        </mesh>
      </RigidBody>

      {/* Cylinder - shows AO in circular crevices */}
      <RigidBody type="fixed" colliders="hull">
        <mesh
          position={[2, 1.5, -3]}
          rotation={[0, 0, 0]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[0.8, 0.8, 3, 32]} />
          <meshStandardMaterial color="#ffd93d" roughness={0.7} />
        </mesh>
      </RigidBody>

      {/* Torus - shows AO in complex geometry */}
      <RigidBody type="fixed" colliders="hull">
        <mesh
          position={[0, 2, 3]}
          rotation={[Math.PI / 4, 0, 0]}
          castShadow
          receiveShadow
        >
          <torusGeometry args={[1, 0.4, 16, 32]} />
          <meshStandardMaterial color="#a8d8ea" roughness={0.7} />
        </mesh>
      </RigidBody>

      {/* Small sphere in corner - maximum AO */}
      <RigidBody type="fixed" colliders="ball">
        <mesh position={[-3.5, 0.5, -3.5]} castShadow receiveShadow>
          <sphereGeometry args={[0.4, 16, 16]} />
          <meshStandardMaterial color="#ffffff" roughness={0.8} />
        </mesh>
      </RigidBody>
    </group>
  );
};

export default AOTestObjects;
