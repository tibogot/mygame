import React from "react";
import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";

interface WedgeSlopeProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  friction?: number;
  color?: string;
  width?: number;
  height?: number;
  depth?: number;
}

export const WedgeSlope: React.FC<WedgeSlopeProps> = ({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  friction = 1,
  color = "#ffff00",
  width = 8,
  height = 3,
  depth = 4,
}) => {
  return (
    <RigidBody
      type="fixed"
      colliders="hull"
      position={position}
      rotation={rotation}
      friction={friction}
    >
      <mesh castShadow receiveShadow>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={6}
            array={
              new Float32Array([
                // Bottom rectangle (4 vertices)
                0,
                0,
                0, // vertex 0: bottom-left-front
                width,
                0,
                0, // vertex 1: bottom-right-front
                width,
                0,
                depth, // vertex 2: bottom-right-back
                0,
                0,
                depth, // vertex 3: bottom-left-back

                // Top edge (2 vertices - the slope goes from bottom to top)
                0,
                height,
                0, // vertex 4: top-left-front
                0,
                height,
                depth, // vertex 5: top-left-back
              ])
            }
            itemSize={3}
          />
          <bufferAttribute
            attach="index"
            count={24}
            array={
              new Uint16Array([
                // Bottom face
                0, 1, 2, 0, 2, 3,

                // Front triangular face
                0, 4, 1,

                // Back triangular face
                3, 2, 5,

                // Left rectangular face
                0, 3, 5, 0, 5, 4,

                // Sloped face (right side)
                1, 4, 5, 1, 5, 2,
              ])
            }
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-normal"
            count={6}
            array={
              new Float32Array([
                // Bottom face normals
                0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
                // Top edge normals
                0, 1, 0, 0, 1, 0,
              ])
            }
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-uv"
            count={6}
            array={
              new Float32Array([
                // Bottom face UVs
                0, 0, 1, 0, 1, 1, 0, 1,
                // Top edge UVs
                0, 0, 1, 1,
              ])
            }
            itemSize={2}
          />
        </bufferGeometry>
        <meshStandardMaterial color={color} />
      </mesh>
    </RigidBody>
  );
};
