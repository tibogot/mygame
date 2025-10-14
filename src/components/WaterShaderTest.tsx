import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface WaterShaderTestProps {
  position?: [number, number, number];
  size?: [number, number];
}

export const WaterShaderTest: React.FC<WaterShaderTestProps> = ({
  position = [0, -0.5, 0],
  size = [50, 50],
}) => {
  const meshRef = useRef<THREE.Mesh>(null);

  // Create material directly with THREE.ShaderMaterial
  const material = useMemo(() => {
    const vertexShader = `
precision highp float;

varying vec3 vWorldPos;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPosition.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

    const fragmentShader = `
precision mediump float;

uniform float time;
varying vec3 vWorldPos;

void main() {
  // Animated water waves - multiple frequencies for realism
  float wave1 = sin(vWorldPos.x * 0.3 + time * 1.0) * 0.5 + 0.5;
  float wave2 = sin(vWorldPos.z * 0.4 + time * 0.7) * 0.5 + 0.5;
  float wave3 = sin((vWorldPos.x + vWorldPos.z) * 0.2 + time * 1.5) * 0.5 + 0.5;
  
  // Combine waves
  float waveMix = (wave1 + wave2 + wave3) / 3.0;
  
  // Water colors - deep ocean blue to bright cyan
  vec3 deepWater = vec3(0.0, 0.2, 0.4);    // Dark blue
  vec3 midWater = vec3(0.0, 0.5, 0.7);     // Cyan
  vec3 highlights = vec3(0.4, 0.8, 1.0);   // Light cyan highlights
  
  // Mix colors based on wave pattern
  vec3 waterColor = mix(deepWater, midWater, waveMix);
  waterColor = mix(waterColor, highlights, wave3 * 0.4);
  
  gl_FragColor = vec4(waterColor, 0.85);
}
`;

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        // cameraPosition is a built-in Three.js uniform
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    return mat;
  }, []);

  useFrame((state, delta) => {
    if (material) {
      material.uniforms.time.value += delta;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
      material={material}
    >
      <planeGeometry args={size} />
    </mesh>
  );
};
