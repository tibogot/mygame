import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface WaterShaderFullProps {
  position?: [number, number, number];
  size?: [number, number];
}

export const WaterShaderFull: React.FC<WaterShaderFullProps> = ({
  position = [0, -0.5, 0],
  size = [50, 50],
}) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const material = useMemo(() => {
    const vertexShader = `
precision highp float;

varying vec3 vWorldPos;
varying vec3 vViewPos;
varying vec3 vNormal;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPosition.xyz;
  vViewPos = (viewMatrix * worldPosition).xyz;
  vNormal = normalize(normalMatrix * normal);
  
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

    const fragmentShader = `
precision mediump float;

uniform float time;
// cameraPosition is built-in
varying vec3 vWorldPos;
varying vec3 vViewPos;
varying vec3 vNormal;

// Hash and noise functions (proven to work)
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

// Multi-octave noise for better water detail
float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  
  for(int i = 0; i < 8; i++) {
    if(i >= octaves) break;
    value += noise(p * frequency) * amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  
  return value;
}

// Sky color based on direction
vec3 getSkyColor(vec3 dir) {
  float t = max(dir.y, 0.0);
  vec3 skyTop = vec3(0.4, 0.6, 1.0);
  vec3 skyHorizon = vec3(0.7, 0.8, 0.9);
  return mix(skyHorizon, skyTop, pow(t, 0.7));
}

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  
  // Multi-layer animated water normal
  vec2 uv1 = vWorldPos.xz * 0.04;
  vec2 uv2 = vWorldPos.xz * 0.08;
  vec2 uv3 = vWorldPos.xz * 0.16;
  
  float n1 = fbm(uv1 + time * 0.02, 4);
  float n2 = fbm(uv2 - time * 0.03, 3);
  float n3 = fbm(uv3 + time * 0.05, 2);
  
  // Create water normal from multiple noise layers
  vec3 waterNormal = normalize(vec3(
    (n1 - 0.5) * 0.3 + (n2 - 0.5) * 0.15,
    1.0,
    (n2 - 0.5) * 0.3 + (n3 - 0.5) * 0.15
  ));
  
  // Fresnel effect - more reflective at grazing angles
  float fresnel = pow(1.0 - max(dot(waterNormal, viewDir), 0.0), 2.5);
  
  // Reflected direction for sky reflection
  vec3 reflectDir = reflect(-viewDir, waterNormal);
  vec3 skyReflection = getSkyColor(reflectDir);
  
  // Water body color - deeper blue where viewed straight down
  vec3 deepWater = vec3(0.0, 0.15, 0.35);
  vec3 shallowWater = vec3(0.0, 0.45, 0.65);
  float depthFactor = 1.0 - fresnel;
  vec3 waterBody = mix(shallowWater, deepWater, depthFactor * depthFactor);
  
  // Add color variation from noise
  waterBody += vec3(n3 - 0.5) * 0.1;
  
  // Mix water color with sky reflection
  vec3 finalColor = mix(waterBody, skyReflection, fresnel * 0.7);
  
  // Add foam/highlights on wave peaks
  float foamNoise = fbm(vWorldPos.xz * 0.2 + time * 0.1, 3);
  float foam = smoothstep(0.65, 0.75, foamNoise) * smoothstep(0.3, 0.5, n1);
  vec3 foamColor = vec3(0.9, 0.95, 1.0);
  finalColor = mix(finalColor, foamColor, foam * 0.4);
  
  // Add subtle caustic-like effect
  float caustic = fbm(vWorldPos.xz * 0.5 + time * 0.15, 2);
  finalColor += vec3(0.1, 0.3, 0.4) * caustic * 0.15;
  
  // Depth-based transparency (more opaque at peaks, more transparent in valleys)
  float alpha = 0.75 + foam * 0.2 + n1 * 0.05;
  
  gl_FragColor = vec4(finalColor, alpha);
}
`;

    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        // cameraPosition is built-in!
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
