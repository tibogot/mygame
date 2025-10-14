import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ============================================================================
// SHADER CODE - EXACT PORT FROM QUICK_GRASS
// ============================================================================

// Common utility functions
const commonGLSL = /* glsl */ `
float saturate(float x) {
  return clamp(x, 0.0, 1.0);
}

vec2 saturate2(vec2 x) {
  return clamp(x, vec2(0.0), vec2(1.0));
}

vec3 saturate3(vec3 x) {
  return clamp(x, vec3(0.0), vec3(1.0));
}

float linearstep(float minValue, float maxValue, float v) {
  return clamp((v - minValue) / (maxValue - minValue), 0.0, 1.0);
}

float inverseLerp(float minValue, float maxValue, float v) {
  return (v - minValue) / (maxValue - minValue);
}

float inverseLerpSat(float minValue, float maxValue, float v) {
  return saturate((v - minValue) / (maxValue - minValue));
}

float remap(float v, float inMin, float inMax, float outMin, float outMax) {
  float t = inverseLerp(inMin, inMax, v);
  return mix(outMin, outMax, t);
}

float easeOut(float x, float t) {
  return 1.0 - pow(1.0 - x, t);
}

float easeIn(float x, float t) {
  return pow(x, t);
}
`;

// Noise functions - WebGL 1.0 compatible (no uint types)
const noiseGLSL = /* glsl */ `
// Simple hash functions using float operations
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash23(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}

float noise13(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f*f*(3.0-2.0*f);

  float result = mix(mix(mix( hash13(i+vec3(0.0, 0.0, 0.0)), 
                      hash13(i+vec3(1.0, 0.0, 0.0)),f.x),
                 mix( hash13(i+vec3(0.0, 1.0, 0.0)), 
                      hash13(i+vec3(1.0, 1.0, 0.0)),f.x),f.y),
             mix(mix( hash13(i+vec3(0.0, 0.0, 1.0)), 
                      hash13(i+vec3(1.0, 0.0, 1.0)),f.x),
                 mix( hash13(i+vec3(0.0, 1.0, 1.0)), 
                      hash13(i+vec3(1.0, 1.0, 1.0)),f.x),f.y),f.z);
  return result * 2.0 - 1.0;
}

vec2 noise23(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f*f*(3.0-2.0*f);

  vec2 result = mix(mix(mix( hash23(i+vec3(0.0, 0.0, 0.0)), 
                      hash23(i+vec3(1.0, 0.0, 0.0)),f.x),
                 mix( hash23(i+vec3(0.0, 1.0, 0.0)), 
                      hash23(i+vec3(1.0, 1.0, 0.0)),f.x),f.y),
             mix(mix( hash23(i+vec3(0.0, 0.0, 1.0)), 
                      hash23(i+vec3(1.0, 0.0, 1.0)),f.x),
                 mix( hash23(i+vec3(0.0, 1.0, 1.0)), 
                      hash23(i+vec3(1.0, 1.0, 1.0)),f.x),f.y),f.z);
  return result * 2.0 - 1.0;
}

// Simplified FBM using our working noise function
vec4 FBM_D_1_4(in vec3 x, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  vec3 derivatives = vec3(0.0);
  
  for(int i = 0; i < 4; i++) {
    if (i >= octaves) break;
    
    // Use simple noise instead of noised_1_3
    float n = noise13(x);
    value += n * amplitude;
    
    // Approximate derivatives
    float dx = noise13(x + vec3(0.01, 0.0, 0.0)) - n;
    float dy = noise13(x + vec3(0.0, 0.01, 0.0)) - n;
    float dz = noise13(x + vec3(0.0, 0.0, 0.01)) - n;
    derivatives += vec3(dx, dy, dz) * amplitude;
    
    amplitude *= 0.5;
    x *= 2.0;
  }
  
  return vec4(value, derivatives);
}
`;

// OKLab color space
const oklabGLSL = /* glsl */ `
const mat3 kLMStoCONE = mat3(
    4.0767245293, -1.2681437731, -0.0041119885,
    -3.3072168827, 2.6093323231, -0.7034763098,
    0.2307590544, -0.3411344290,  1.7068625689);

const mat3 kCONEtoLMS = mat3(
    0.4121656120, 0.2118591070, 0.0883097947,
    0.5362752080, 0.6807189584, 0.2818474174,
    0.0514575653, 0.1074065790, 0.6302613616);

vec3 rgbToOklab(vec3 c) {
  vec3 lms = kCONEtoLMS * c;
  return sign(lms)*pow(abs(lms), vec3(0.3333333333333));
}

vec3 oklabToRGB(vec3 c) {
  vec3 lms = c;
  return kLMStoCONE * (lms * lms * lms);
}

vec3 col3(vec3 v) {
  return rgbToOklab(v);
}
`;

// Sky calculation
const skyGLSL = /* glsl */ `
vec3 SKY_lighterBlue = vec3(0.39, 0.57, 0.86) * 0.25;
vec3 SKY_midBlue = vec3(0.1, 0.11, 0.1) * 0.5;
vec3 SKY_darkerBlue = vec3(0.0);
vec3 SKY_SUN_COLOUR = vec3(0.5);
vec3 SKY_SUN_GLOW_COLOUR = vec3(0.15, 0.2, 0.25);
float SKY_POWER = 16.0;
float SUN_POWER = 128.0;
float SKY_DARK_POWER = 2.0;
vec3 SUN_DIR = vec3(-1.0, 0.45, 1.0);

vec3 CalculateSkyLighting(vec3 viewDir, vec3 normalDir) {
  vec3 lighterBlue = col3(SKY_lighterBlue);
  vec3 midBlue = col3(SKY_midBlue);
  vec3 darkerBlue = col3(SKY_darkerBlue);

  vec3 SUN_COLOUR = col3(SKY_SUN_COLOUR);
  vec3 SUN_GLOW_COLOUR = col3(SKY_SUN_GLOW_COLOUR);

  float viewDirY = linearstep(-0.01, 1.0, viewDir.y);

  float skyGradientMixFactor = saturate(viewDirY);
  vec3 skyGradient = mix(darkerBlue, lighterBlue, exp(-sqrt(saturate(viewDirY)) * 2.0));

  vec3 sunDir = normalize(SUN_DIR);
  float mu = 1.0 - saturate(dot(viewDir, sunDir));

  vec3 colour = skyGradient + SUN_GLOW_COLOUR * saturate(exp(-sqrt(mu) * 10.0)) * 0.75;
  colour += SUN_COLOUR * smoothstep(0.9997, 0.9998, 1.0 - mu);

  colour = oklabToRGB(colour);

  return colour;
}
`;

// Water vertex shader
const waterVertexShader = /* glsl */ `
precision highp float;

varying vec3 vViewPosition;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  
  vViewPosition = -mvPosition.xyz;
  vWorldNormal = (modelMatrix * vec4(normal, 0.0)).xyz;
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
}
`;

// Water fragment shader - Simplified Full version (no screen-space reflections yet)
const waterFragmentShader = /* glsl */ `
precision mediump float;

${commonGLSL}
${noiseGLSL}
${oklabGLSL}
${skyGLSL}

uniform float time;
// cameraPosition is a built-in Three.js uniform - don't declare it!

varying vec3 vViewPosition;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

vec3 WaterNormal2(vec3 pos, float falloff) {
  vec3 noiseNormal = FBM_D_1_4(vec3(pos.xz * 0.4, time * 0.8), 4).yzw;
  return normalize(vec3(0.0, 1.0, 0.0) + noiseNormal * 0.5 * falloff);
}

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPos);

  float waterNormalFalloff = pow(saturate(dot(vec3(0.0, 1.0, 0.0), viewDir)), 2.0);
  vec3 waterNormal = WaterNormal2(vWorldPos, waterNormalFalloff);

  float fresnel = pow(saturate(dot(waterNormal, viewDir)), 1.0);

  vec3 reflectedDir = reflect(-viewDir, waterNormal);
  
  // Sky reflection
  vec3 tracedSky = CalculateSkyLighting(reflectedDir, viewDir);

  // Water colors - deep blue to cyan
  vec3 deepWater = vec3(0.0, 0.2, 0.4);
  vec3 shallowWater = vec3(0.0, 0.5, 0.7);
  vec3 waterColour = mix(deepWater, shallowWater, fresnel);
  
  // Foam at edges using noise
  float foamNoise = noise13(vec3(vWorldPos.xz * 10.0, time * 2.0));
  float foam = remap(foamNoise, -1.0, 1.0, 0.0, 1.0);
  vec3 foamColor = vec3(1.0);
  
  // Mix water with foam
  waterColour = mix(waterColour, foamColor, foam * 0.1);

  // Final color mixing
  vec3 outgoingLight = mix(tracedSky, waterColour, fresnel);

  gl_FragColor = vec4(outgoingLight, 0.85);
}
`;

// No longer using drei's shaderMaterial - using THREE.ShaderMaterial directly in component

// Depth texture pass - combines color and depth
const depthPassVertexShader = /* glsl */ `
precision highp float;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const depthPassFragmentShader = /* glsl */ `
precision mediump float;

uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform float cameraNear;
uniform float cameraFar;

varying vec2 vUv;

float perspectiveDepthToViewZ(float depth, float near, float far) {
  return (near * far) / ((far - near) * depth - far);
}

float readDepth(sampler2D depthSampler, vec2 coord) {
  float fragCoordZ = texture2D(depthSampler, coord).x;
  float viewZ = perspectiveDepthToViewZ(fragCoordZ, cameraNear, cameraFar);
  return viewZ;
}

void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  float depth = -readDepth(tDepth, vUv);
  gl_FragColor = vec4(color.rgb, depth);
}
`;

// ============================================================================
// WATER COMPONENT
// ============================================================================

interface WaterShaderProps {
  position?: [number, number, number];
  size?: [number, number];
}

export const WaterShader: React.FC<WaterShaderProps> = ({
  position = [0, -0.5, 0],
  size = [50, 50],
}) => {
  const meshRef = useRef<THREE.Mesh>(null);

  // Create material directly with THREE.ShaderMaterial
  const material = useMemo(() => {
    console.log("🌊 Full Water Shader - Vertex:", waterVertexShader);
    console.log("🌊 Full Water Shader - Fragment:", waterFragmentShader);

    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        // cameraPosition is built-in - Three.js provides it automatically!
      },
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, []);

  // Animation
  useFrame((state, delta) => {
    if (!material) return;

    material.uniforms.time.value += delta;
    // cameraPosition is updated automatically by Three.js!
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
