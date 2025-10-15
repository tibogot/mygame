import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useControls, folder } from "leva";
import * as THREE from "three";

/**
 * 🌊 Flowing River Component
 *
 * Realistic river with:
 * - Flowing water animation (directional flow)
 * - Reflections and refractions
 * - Foam on edges
 * - Adjustable flow speed and direction
 * - Follows terrain valley
 *
 * Based on Three.js Water shader principles
 */

interface FlowingRiverProps {
  terrainMesh?: THREE.Mesh | null;
  position?: [number, number, number];
  size?: [number, number]; // [width, length]
}

export const FlowingRiver: React.FC<FlowingRiverProps> = ({
  terrainMesh,
  position = [0, 2, 0], // Higher so you can see it
  size = [200, 200], // Full terrain size for now
}) => {
  const waterRef = useRef<THREE.Mesh>(null);

  // River controls
  const {
    enabled,
    riverWidth,
    riverLength,
    waterHeight,
    flowSpeed,
    flowDirection,
    waveHeight,
    waveFrequency,
    waterColor,
    waterOpacity,
    reflectionStrength,
    foamAmount,
  } = useControls("🏛️ OBJECTS", {
    flowingRiver: folder(
      {
        enabled: {
          value: false,
          label: "🌊 Enable River",
        },
        riverWidth: {
          value: size[0],
          min: 5,
          max: 300,
          step: 5,
          label: "River Width",
        },
        riverLength: {
          value: size[1],
          min: 50,
          max: 300,
          step: 10,
          label: "River Length",
        },
        waterHeight: {
          value: position[1],
          min: -15,
          max: 10,
          step: 0.1,
          label: "Water Surface Y (height)",
        },
        flowSpeed: {
          value: 0.3,
          min: 0,
          max: 2,
          step: 0.05,
          label: "⚡ Flow Speed",
        },
        flowDirection: {
          value: 0,
          min: 0,
          max: 360,
          step: 15,
          label: "🧭 Flow Direction (degrees)",
        },
        waveHeight: {
          value: 0.25,
          min: 0,
          max: 2,
          step: 0.05,
          label: "🌊 Wave Height",
        },
        waveFrequency: {
          value: 4.0,
          min: 1,
          max: 10,
          step: 0.5,
          label: "🌊 Wave Frequency",
        },
        waterColor: {
          value: "#1a5f7a",
          label: "💧 Water Color",
        },
        waterOpacity: {
          value: 0.85,
          min: 0.3,
          max: 1,
          step: 0.05,
          label: "Transparency",
        },
        reflectionStrength: {
          value: 0.6,
          min: 0,
          max: 1,
          step: 0.1,
          label: "🪞 Reflection Strength",
        },
        foamAmount: {
          value: 0.3,
          min: 0,
          max: 1,
          step: 0.1,
          label: "🫧 Foam Amount (edges)",
        },
      },
      { collapsed: true }
    ),
  });

  // Create river geometry (rotated to be horizontal)
  const riverGeometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(riverWidth, riverLength, 40, 100);
    geometry.rotateX(-Math.PI / 2); // Make horizontal
    return geometry;
  }, [riverWidth, riverLength]);

  // Water shader material
  const waterMaterial = useMemo(() => {
    const vertexShader = `
precision highp float;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vWaveIntensity;

uniform float time;
uniform float flowSpeed;
uniform float flowDirection;
uniform float waveHeight;
uniform float waveFrequency;

// Simple noise function
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  
  float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
  float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
  float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vUv = uv;
  
  // Flow direction vector
  vec2 flowDir = vec2(sin(flowDirection), cos(flowDirection));
  
  // Animated position along flow direction
  vec2 flowUV = uv + flowDir * time * flowSpeed;
  
  // Create waves using noise
  float wave1 = noise(flowUV * waveFrequency) * 2.0 - 1.0;
  float wave2 = noise(flowUV * waveFrequency * 1.5 + vec2(100.0, 100.0)) * 2.0 - 1.0;
  
  // Combine waves
  float waveDisplacement = (wave1 + wave2 * 0.5) * waveHeight;
  
  // Apply wave to vertex position
  vec3 pos = position;
  pos.y += waveDisplacement;
  
  // Store wave intensity for fragment shader
  vWaveIntensity = abs(waveDisplacement);
  
  // Calculate wave normals by sampling nearby points (finite difference method)
  float delta = 0.01;
  
  // Sample wave height at offset positions to get gradient
  float waveRight = (noise((flowUV + vec2(delta, 0.0)) * waveFrequency) * 2.0 - 1.0 +
                     noise((flowUV + vec2(delta, 0.0)) * waveFrequency * 1.5 + vec2(100.0, 100.0)) * 2.0 - 1.0 * 0.5) * waveHeight;
  float waveForward = (noise((flowUV + vec2(0.0, delta)) * waveFrequency) * 2.0 - 1.0 +
                       noise((flowUV + vec2(0.0, delta)) * waveFrequency * 1.5 + vec2(100.0, 100.0)) * 2.0 - 1.0 * 0.5) * waveHeight;
  
  // Calculate tangent vectors
  vec3 tangent = normalize(vec3(delta, waveRight - waveDisplacement, 0.0));
  vec3 bitangent = normalize(vec3(0.0, waveForward - waveDisplacement, delta));
  
  // Perturbed normal from wave slope
  vec3 perturbedNormal = normalize(cross(tangent, bitangent));
  
  // Transform to world space
  vNormal = normalize(normalMatrix * perturbedNormal);
  
  // World position
  vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
  vWorldPosition = worldPosition.xyz;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

    const fragmentShader = `
precision highp float;

uniform float time;
uniform float flowSpeed;
uniform float flowDirection;
uniform vec3 waterColor;
uniform float reflectionStrength;
uniform float foamAmount;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vWaveIntensity;

// Noise function for foam
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  
  float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
  float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
  float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  // Calculate view direction
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  
  // Sun light direction (adjust to match your scene's sun)
  vec3 lightDirection = normalize(vec3(1.0, 2.0, 1.0));
  
  // Diffuse lighting from wave normals
  float diffuse = max(dot(vNormal, lightDirection), 0.0);
  
  // Specular highlights (shininess) - THIS MAKES IT LOOK WET!
  vec3 halfVector = normalize(lightDirection + viewDirection);
  float specular = pow(max(dot(vNormal, halfVector), 0.0), 128.0);
  
  // Fresnel effect (more reflection at grazing angles)
  float fresnel = pow(1.0 - max(dot(viewDirection, vNormal), 0.0), 3.0);
  
  // Flow direction for animated foam and ripples
  vec2 flowDir = vec2(sin(flowDirection), cos(flowDirection));
  vec2 flowUV = vUv + flowDir * time * flowSpeed;
  
  // Add smaller ripples for texture
  float ripple1 = noise(flowUV * 30.0) * 0.5 + 0.5;
  float ripple2 = noise(flowUV * 50.0 - time) * 0.5 + 0.5;
  float ripples = ripple1 * ripple2;
  
  // Foam on edges (based on UV distance from center)
  float edgeDistance = min(vUv.x, 1.0 - vUv.x) * 2.0;
  float foam = noise(flowUV * 20.0) * (1.0 - edgeDistance) * foamAmount;
  foam += noise(flowUV * 40.0 + vec2(time * 2.0, 0.0)) * 0.3 * foamAmount;
  foam = clamp(foam, 0.0, 1.0);
  
  // Base water color - darker in shadows, lighter in highlights
  vec3 deepWater = waterColor * 0.4;
  vec3 shallowWater = waterColor * 1.0;
  
  // Mix based on lighting
  vec3 waterBase = mix(deepWater, shallowWater, diffuse * 0.7 + 0.3);
  
  // Add ripple variation
  waterBase *= (0.9 + ripples * 0.2);
  
  // Sky reflection based on Fresnel
  vec3 skyColor = vec3(0.7, 0.85, 1.0);
  vec3 reflectedColor = mix(waterBase, skyColor, fresnel * reflectionStrength);
  
  // Add specular highlights (makes it shiny and wet!)
  vec3 specularColor = vec3(1.0, 1.0, 1.0) * specular * 0.8;
  reflectedColor += specularColor;
  
  // Add foam
  vec3 foamColor = vec3(1.0, 1.0, 1.0);
  vec3 finalColor = mix(reflectedColor, foamColor, foam);
  
  // Enhance overall brightness
  finalColor *= 1.2;
  
  gl_FragColor = vec4(finalColor, 1.0);
}
`;

    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        flowSpeed: { value: flowSpeed },
        flowDirection: { value: (flowDirection * Math.PI) / 180 },
        waveHeight: { value: waveHeight },
        waveFrequency: { value: waveFrequency },
        waterColor: { value: new THREE.Color(waterColor) },
        reflectionStrength: { value: reflectionStrength },
        foamAmount: { value: foamAmount },
      },
      vertexShader,
      fragmentShader,
      transparent: false,
      side: THREE.DoubleSide,
    });
  }, [
    flowSpeed,
    flowDirection,
    waveHeight,
    waveFrequency,
    waterColor,
    reflectionStrength,
    foamAmount,
  ]);

  // Update uniforms every frame
  useFrame((state, delta) => {
    if (waterMaterial) {
      waterMaterial.uniforms.time.value += delta;
      waterMaterial.uniforms.flowSpeed.value = flowSpeed;
      waterMaterial.uniforms.flowDirection.value =
        (flowDirection * Math.PI) / 180;
      waterMaterial.uniforms.waveHeight.value = waveHeight;
      waterMaterial.uniforms.waveFrequency.value = waveFrequency;
      waterMaterial.uniforms.waterColor.value.set(waterColor);
      waterMaterial.uniforms.reflectionStrength.value = reflectionStrength;
      waterMaterial.uniforms.foamAmount.value = foamAmount;
    }
  });

  if (!enabled) return null;

  return (
    <mesh
      ref={waterRef}
      position={[position[0], waterHeight, position[2]]}
      geometry={riverGeometry}
      receiveShadow
      renderOrder={1}
    >
      <primitive object={waterMaterial} attach="material" />
    </mesh>
  );
};
