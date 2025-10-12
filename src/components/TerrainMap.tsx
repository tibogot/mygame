import React, { useEffect, useMemo, useRef } from "react";
import { useTexture } from "@react-three/drei";
import { RigidBody } from "@react-three/rapier";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";

interface TerrainMapProps {
  size?: number;
  position?: [number, number, number];
  heightScale?: number;
  heightOffset?: number;
  onMeshReady?: (mesh: THREE.Mesh) => void;
}

export const TerrainMap = ({
  size = 2000, // Default to Quick_Grass size
  position = [0, -0.5, 0],
  heightScale = 75, // Quick_Grass TERRAIN_HEIGHT
  heightOffset = 50, // Quick_Grass TERRAIN_OFFSET
  onMeshReady,
}: TerrainMapProps) => {
  const meshRef = useRef<THREE.Mesh>(null);

  // Load terrain heightmap
  const terrainTexture = useTexture("/textures/terrain.png");

  // Create terrain geometry with displacement from heightmap
  const terrainGeometry = useMemo(() => {
    // High resolution plane (256x256 segments for smooth terrain)
    const geometry = new THREE.PlaneGeometry(size, size, 256, 256);

    // Get image data from texture to read pixel values
    const canvas = document.createElement("canvas");
    const img = terrainTexture.image;
    canvas.width = img.width;
    canvas.height = img.height;
    const context = canvas.getContext("2d");
    if (!context) return geometry;

    context.drawImage(img, 0, 0);
    const imageData = context.getImageData(0, 0, img.width, img.height);

    // Displace vertices based on heightmap (RED channel)
    const positions = geometry.attributes.position;
    const uvs = geometry.attributes.uv;

    for (let i = 0; i < positions.count; i++) {
      const u = uvs.getX(i);
      const v = 1.0 - uvs.getY(i); // Flip V

      // Get pixel position in image
      const x = Math.floor(u * (img.width - 1));
      const y = Math.floor(v * (img.height - 1));
      const pixelIndex = (x + y * img.width) * 4;

      // Read RED channel (0-255) for height
      const heightValue = imageData.data[pixelIndex] / 255.0;

      // Apply height with scale and offset
      const height = heightValue * heightScale - heightOffset;

      // Set Z position (will be Y after rotation)
      positions.setZ(i, height);
    }

    // Recompute normals for proper lighting
    geometry.computeVertexNormals();

    return geometry;
  }, [terrainTexture, size, heightScale, heightOffset]);

  // Notify parent when mesh is ready
  useEffect(() => {
    if (meshRef.current && onMeshReady) {
      onMeshReady(meshRef.current);
    }
  }, [onMeshReady]);

  return (
    <RigidBody type="fixed" colliders="trimesh">
      <mesh
        ref={meshRef}
        geometry={terrainGeometry}
        position={position}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        castShadow={false}
      >
        <meshStandardMaterial color="#6b8e23" roughness={1.0} metalness={0.0} />
      </mesh>
    </RigidBody>
  );
};
