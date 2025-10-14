import React, { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

interface WaterShaderDebugProps {
  position?: [number, number, number];
  size?: [number, number];
  version?: number; // 1, 2, 3, 4 to test different features
}

export const WaterShaderDebug: React.FC<WaterShaderDebugProps> = ({
  position = [0, -0.5, 0],
  size = [50, 50],
  version = 1,
}) => {
  const { camera } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);

  const material = useMemo(() => {
    // Version 1: MINIMAL (like Test - should work)
    let fragmentShader = `
precision mediump float;

uniform float time;
varying vec3 vWorldPos;

void main() {
  float wave = sin(vWorldPos.x * 0.5 + time) * 0.5 + 0.5;
  vec3 waterColor = vec3(0.1, 0.3 + wave * 0.2, 0.6);
  gl_FragColor = vec4(waterColor, 0.85);
}
`;

    // Version 2: Add hash function
    if (version >= 2) {
      fragmentShader = `
precision mediump float;

uniform float time;
varying vec3 vWorldPos;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  float h = hash(vWorldPos.xz);
  vec3 waterColor = vec3(0.1, 0.3 + h * 0.2, 0.6);
  gl_FragColor = vec4(waterColor, 0.85);
}
`;
    }

    // Version 3: Add noise function
    if (version >= 3) {
      fragmentShader = `
precision mediump float;

uniform float time;
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
  float n = noise(vWorldPos.xz * 0.1 + time * 0.5);
  vec3 waterColor = vec3(0.1, 0.3 + n * 0.2, 0.6);
  gl_FragColor = vec4(waterColor, 0.85);
}
`;
    }

    // Version 4: Use Three.js built-in cameraPosition (don't declare it!)
    if (version >= 4) {
      fragmentShader = `
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
  // DEBUG: Visualize cameraPosition to see if it's working
  vec3 camDist = cameraPosition - vWorldPos;
  float distToCam = length(camDist);
  
  // Color based on distance - should change as you move camera
  vec3 debugColor = vec3(
    fract(distToCam * 0.1), 
    0.5, 
    fract(distToCam * 0.05)
  );
  
  gl_FragColor = vec4(debugColor, 0.85);
}
`;
    }

    const vertexShader = `
precision highp float;

varying vec3 vWorldPos;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPosition.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

    console.log(`🌊 Water Debug Version ${version} - Creating material`);
    console.log("Fragment shader:", fragmentShader);

    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        // cameraPosition is built-in - don't add it!
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, [version]);

  useFrame((state, delta) => {
    if (material) {
      material.uniforms.time.value += delta;
      // cameraPosition is built-in - Three.js updates it automatically!
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
