import React from "react";
import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { MeshTransmissionMaterial } from "@react-three/drei";

export const SpheresMaterials = () => {
  const sphereRadius = 0.8;
  const spacing = 2.5;
  const baseX = -20;
  const baseZ = -10;
  const height = 1;

  return (
    <group>
      {/* 1. EMISSIVE SPHERE - Glowing light */}
      <RigidBody
        type="dynamic"
        colliders="ball"
        position={[baseX, height, baseZ]}
        mass={1}
        friction={0.5}
        restitution={0.3}
        linearDamping={0.5}
        angularDamping={0.5}
      >
        <mesh castShadow>
          <sphereGeometry args={[sphereRadius, 32, 32]} />
          <meshStandardMaterial
            color="#ff6600"
            emissive="#ff6600"
            emissiveIntensity={2}
            roughness={0.2}
            metalness={0.1}
          />
        </mesh>
        {/* Point light inside for actual lighting */}
        <pointLight intensity={3} distance={5} color="#ff6600" />
      </RigidBody>

      {/* 2. GLASS SPHERE - Transparent with refraction */}
      <RigidBody
        type="dynamic"
        colliders="ball"
        position={[baseX + spacing, height, baseZ]}
        mass={1}
        friction={0.5}
        restitution={0.3}
        linearDamping={0.5}
        angularDamping={0.5}
      >
        <mesh castShadow>
          <sphereGeometry args={[sphereRadius, 32, 32]} />
          <meshPhysicalMaterial
            color="#ffffff"
            transparent={true}
            opacity={0.3}
            transmission={0.95}
            thickness={0.5}
            roughness={0.05}
            metalness={0.0}
            clearcoat={1.0}
            clearcoatRoughness={0.1}
            ior={1.5}
          />
        </mesh>
      </RigidBody>

      {/* 3. SUBSURFACE SCATTERING - Translucent like wax/skin */}
      <RigidBody
        type="dynamic"
        colliders="ball"
        position={[baseX + spacing * 2, height, baseZ]}
        mass={1}
        friction={0.5}
        restitution={0.3}
        linearDamping={0.5}
        angularDamping={0.5}
      >
        <mesh castShadow>
          <sphereGeometry args={[sphereRadius, 32, 32]} />
          <meshPhysicalMaterial
            color="#ffccaa"
            roughness={0.4}
            metalness={0.0}
            transmission={0.3}
            thickness={2.0}
            ior={1.4}
            sheen={0.5}
            sheenColor="#ffddcc"
          />
        </mesh>
      </RigidBody>

      {/* 4. METALLIC CHROME - Mirror-like metal */}
      <RigidBody
        type="dynamic"
        colliders="ball"
        position={[baseX + spacing * 3, height, baseZ]}
        mass={1}
        friction={0.5}
        restitution={0.3}
        linearDamping={0.5}
        angularDamping={0.5}
      >
        <mesh castShadow>
          <sphereGeometry args={[sphereRadius, 32, 32]} />
          <meshStandardMaterial
            color="#ffffff"
            roughness={0.1}
            metalness={1.0}
            envMapIntensity={1.5}
          />
        </mesh>
      </RigidBody>

      {/* 5. IRIDESCENT - Rainbow shimmer effect */}
      <RigidBody
        type="dynamic"
        colliders="ball"
        position={[baseX + spacing * 4, height, baseZ]}
        mass={1}
        friction={0.5}
        restitution={0.3}
        linearDamping={0.5}
        angularDamping={0.5}
      >
        <mesh castShadow>
          <sphereGeometry args={[sphereRadius, 32, 32]} />
          <meshPhysicalMaterial
            color="#ffffff"
            roughness={0.2}
            metalness={0.8}
            iridescence={1.0}
            iridescenceIOR={1.5}
            clearcoat={1.0}
            clearcoatRoughness={0.1}
          />
        </mesh>
      </RigidBody>

      {/* 6. HOLOGRAPHIC - Translucent with color shift */}
      <RigidBody
        type="dynamic"
        colliders="ball"
        position={[baseX + spacing * 5, height, baseZ]}
        mass={1}
        friction={0.5}
        restitution={0.3}
        linearDamping={0.5}
        angularDamping={0.5}
      >
        <mesh castShadow>
          <sphereGeometry args={[sphereRadius, 32, 32]} />
          <meshPhysicalMaterial
            color="#00ffff"
            transparent={true}
            opacity={0.6}
            transmission={0.5}
            thickness={1.0}
            roughness={0.1}
            metalness={0.5}
            emissive="#0088ff"
            emissiveIntensity={0.3}
            clearcoat={1.0}
          />
        </mesh>
      </RigidBody>

      {/* 7. MATCAP/TOON - Stylized shading */}
      <RigidBody
        type="dynamic"
        colliders="ball"
        position={[baseX + spacing * 6, height, baseZ]}
        mass={1}
        friction={0.5}
        restitution={0.3}
        linearDamping={0.5}
        angularDamping={0.5}
      >
        <mesh castShadow>
          <sphereGeometry args={[sphereRadius, 32, 32]} />
          <meshToonMaterial color="#ff00ff" gradientMap={null} />
        </mesh>
      </RigidBody>
    </group>
  );
};
