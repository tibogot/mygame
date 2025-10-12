import { useTexture } from "@react-three/drei";
import { RigidBody } from "@react-three/rapier";
import { useControls } from "leva";
import React, { forwardRef, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import CustomShaderMaterial from "three-custom-shader-material";

interface PlaneMapProps {
  size?: number;
  position?: [number, number, number];
  color?: string;
  onMeshReady?: (mesh: THREE.Mesh) => void;
}

export const PlaneMap = ({
  size = 2000,
  position = [0, 0, 0],
  color = "#6b8e23",
  onMeshReady,
}: PlaneMapProps) => {
  const {
    useGridTexture,
    gradientIntensity,
    enableReflections,
    tileRoughness,
    tileMetalness,
  } = useControls("Ground Plane", {
    useGridTexture: { value: true, label: "Use Grid Texture" },
    gradientIntensity: {
      value: 0.5,
      min: 0,
      max: 1,
      step: 0.1,
      label: "Gradient Variation",
    },
    enableReflections: {
      value: false,
      label: "Enable Reflections (Kitchen Tile)",
    },
    tileRoughness: {
      value: 0.2,
      min: 0,
      max: 1,
      step: 0.05,
      label: "Roughness",
      render: (get) => get("Ground Plane.enableReflections"),
    },
    tileMetalness: {
      value: 0.0,
      min: 0,
      max: 1,
      step: 0.05,
      label: "Metalness",
      render: (get) => get("Ground Plane.enableReflections"),
    },
  });

  // Load textures
  const whiteSquareTexture = useTexture("/textures/whitesquare.png");
  const gridTexture = useTexture("/textures/grid.png");

  // Configure textures
  whiteSquareTexture.wrapS = whiteSquareTexture.wrapT = THREE.RepeatWrapping;
  whiteSquareTexture.repeat.set(10, 10); // Always 10x10 pattern
  whiteSquareTexture.anisotropy = 16;

  gridTexture.wrapS = gridTexture.wrapT = THREE.RepeatWrapping;
  gridTexture.repeat.set(10, 10); // Same as white square
  gridTexture.anisotropy = 16;

  // Memoize uniforms to prevent rebuilding
  const uniforms = useMemo(
    () => ({
      gridTexture: { value: gridTexture },
      gradientIntensity: { value: gradientIntensity },
    }),
    [gridTexture, gradientIntensity]
  );

  const materialRef = useRef<any>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  // Notify parent when mesh is ready
  useEffect(() => {
    if (meshRef.current && onMeshReady) {
      onMeshReady(meshRef.current);
    }
  }, [onMeshReady]);

  return (
    <RigidBody type="fixed" colliders="cuboid" friction={2}>
      {/* Grid plane with physics */}
      {useGridTexture && (
        <mesh
          ref={meshRef}
          receiveShadow
          castShadow={false}
          position={position}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[size, size]} />
          <CustomShaderMaterial
            ref={materialRef}
            baseMaterial={THREE.MeshStandardMaterial}
            vertexShader={`
              varying vec3 vWorldPos;
              void main() {
                vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
              }
            `}
            fragmentShader={`
              uniform sampler2D gridTexture;
              uniform float gradientIntensity;
              varying vec3 vWorldPos;
              
              float hash12(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
              }
              
              float remap(float value, float oldMin, float oldMax, float newMin, float newMax) {
                return newMin + (value - oldMin) * (newMax - newMin) / (oldMax - oldMin);
              }
              
              void main() {
                // Sample grid texture at different scales like SimonDev
                float grid1 = texture2D(gridTexture, vWorldPos.xz * 0.125).r;
                float grid2 = texture2D(gridTexture, vWorldPos.xz * 1.25).r;
                
                // Generate hash for variation
                float gridHash1 = hash12(floor(vWorldPos.xz * 1.25));
                
                // Apply gradient intensity to the variation amount
                float variationAmount = gradientIntensity * 0.2;
                
                // Create grid color with variations (slightly brighter for reflective tiles)
                vec3 gridColour = mix(
                  vec3(0.45 + remap(gridHash1, 0.0, 1.0, -variationAmount, variationAmount)), 
                  vec3(0.08), 
                  grid2
                );
                gridColour = mix(gridColour, vec3(0.0), grid1);
                
                // Set the diffuse color (preserves lighting and shadows)
                csm_DiffuseColor = vec4(gridColour, 1.0);
              }
            `}
            uniforms={uniforms}
            roughness={enableReflections ? tileRoughness : 1.0}
            metalness={enableReflections ? tileMetalness : 0.0}
            envMapIntensity={enableReflections ? 1.5 : 0.0}
          />
        </mesh>
      )}
    </RigidBody>
  );
};
