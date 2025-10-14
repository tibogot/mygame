import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface WaterShaderSimpleProps {
  position?: [number, number, number];
  size?: [number, number];
}

export const WaterShaderSimple: React.FC<WaterShaderSimpleProps> = ({
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
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

    const fragmentShader = `
precision mediump float;

uniform float time;
// cameraPosition is a built-in Three.js uniform - don't declare it!
varying vec3 vWorldPos;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  
  vec2 uv = vWorldPos.xz * 0.1;
  float n1 = noise(uv + time * 0.5);
  float n2 = noise(uv * 2.0 - time * 0.3);
  float n3 = noise(uv * 4.0 + time * 0.7);
  
  vec3 waterNormal = normalize(vec3((n1 - 0.5) * 0.4, 1.0, (n2 - 0.5) * 0.4));
  float fresnel = pow(1.0 - max(dot(waterNormal, viewDir), 0.0), 2.0);
  
  vec3 deepWater = vec3(0.0, 0.2, 0.4);
  vec3 shallowWater = vec3(0.0, 0.5, 0.7);
  vec3 waterColor = mix(deepWater, shallowWater, n3);
  
  vec3 skyColor = vec3(0.5 + viewDir.y * 0.3, 0.7, 1.0);
  
  vec3 finalColor = mix(waterColor, skyColor, fresnel * 0.6);
  finalColor = mix(finalColor, vec3(0.7, 0.9, 1.0), n3 * fresnel * 0.2);
  
  gl_FragColor = vec4(finalColor, 0.85);
}
`;

    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        // cameraPosition is built-in - Three.js provides it automatically!
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, []);

  useFrame((state, delta) => {
    if (material) {
      material.uniforms.time.value += delta;
      // cameraPosition is updated automatically by Three.js!
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
