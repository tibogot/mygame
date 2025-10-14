import React, { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useControls } from "leva";

interface WaterShaderQuickGrassProps {
  position?: [number, number, number];
  size?: [number, number];
}

export const WaterShaderQuickGrass: React.FC<WaterShaderQuickGrassProps> = ({
  position = [0, -0.5, 0],
  size = [50, 50],
}) => {
  const { gl, scene, camera } = useThree();
  const waterRef = useRef<THREE.Mesh>(null);

  const {
    enableSSR,
    waveScale,
    waveSpeed,
    fresnelPower,
    reflectionStrength,
    waterDeepColor,
    waterShallowColor,
    foamIntensity,
  } = useControls("🌊 Quick_Grass Water (Map5)", {
    enableSSR: {
      value: true,
      label: "🔮 Enable Screen-Space Reflections",
    },
    waveScale: {
      value: 0.8,
      min: 0.1,
      max: 3.0,
      step: 0.1,
      label: "🌊 Wave Scale (Higher = Bigger Waves)",
    },
    waveSpeed: {
      value: 0.3,
      min: 0.05,
      max: 2.0,
      step: 0.05,
      label: "⚡ Wave Speed (Slower = More Realistic)",
    },
    fresnelPower: {
      value: 2.0,
      min: 0.5,
      max: 5.0,
      step: 0.5,
      label: "💎 Fresnel Power",
    },
    reflectionStrength: {
      value: 0.8,
      min: 0.0,
      max: 1.0,
      step: 0.1,
      label: "🪞 Reflection Strength",
    },
    waterDeepColor: {
      value: "#001a33",
      label: "🌊 Deep Water Color",
    },
    waterShallowColor: {
      value: "#0066aa",
      label: "💧 Shallow Water Color",
    },
    foamIntensity: {
      value: 0.5,
      min: 0.0,
      max: 1.0,
      step: 0.1,
      label: "🫧 Foam Intensity",
    },
  });

  // Render targets for SSR
  const renderTargets = useMemo(() => {
    const sceneRT = new THREE.WebGLRenderTarget(
      window.innerWidth,
      window.innerHeight,
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        depthBuffer: true,
        depthTexture: new THREE.DepthTexture(
          window.innerWidth,
          window.innerHeight
        ),
      }
    );

    return { sceneRT };
  }, []);

  // Water shader - CREATE FIRST
  const material = useMemo(() => {
    const vertexShader = `
precision highp float;

varying vec3 vWorldPos;
varying vec3 vViewPos;
varying vec3 vNormal;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  vViewPos = (viewMatrix * worldPos).xyz;
  vNormal = normalize(normalMatrix * normal);
  
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

    const fragmentShader = `
precision mediump float;

uniform sampler2D sceneTexture;
uniform sampler2D depthTexture;
uniform vec2 resolution;
uniform float time;
uniform float waveScale;
uniform float waveSpeed;
uniform float fresnelPower;
uniform float reflectionStrength;
uniform vec3 waterDeepColor;
uniform vec3 waterShallowColor;
uniform float foamIntensity;
uniform float enableSSR;
uniform float cameraNear;
uniform float cameraFar;
uniform mat4 customProjectionMatrix;
uniform mat4 customViewMatrix;
// Built-in Three.js uniforms (only in VERTEX shader):
// - mat4 projectionMatrix (vertex only!)
// - mat4 viewMatrix (vertex only!)
// - mat4 modelMatrix
// - mat4 modelViewMatrix
// - mat3 normalMatrix
// - vec3 cameraPosition (available in fragment!)

varying vec3 vWorldPos;
varying vec3 vViewPos;
varying vec3 vNormal;

// Working noise functions
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

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

// Multi-octave FBM for realistic waves
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

// Get water normal from FBM - ANIMATED and VISIBLE
vec3 getWaterNormal(vec3 pos, float time, float scale, float speed) {
  vec2 uv = pos.xz * scale;
  
  // Multiple noise layers for complex wave patterns - MOVING IN DIFFERENT DIRECTIONS
  float offset = 0.005;
  
  // Layer 1: Large waves moving RIGHT
  vec2 uv1 = uv * 0.5 + vec2(time * speed * 2.0, time * speed * 0.5);
  float h1 = fbm(uv1, 3);
  float h1x = fbm(uv1 + vec2(offset, 0.0), 3);
  float h1z = fbm(uv1 + vec2(0.0, offset), 3);
  
  // Layer 2: Medium waves moving DIAGONAL  
  vec2 uv2 = uv * 1.5 + vec2(-time * speed * 1.5, time * speed * 1.8);
  float h2 = fbm(uv2, 3);
  float h2x = fbm(uv2 + vec2(offset, 0.0), 3);
  float h2z = fbm(uv2 + vec2(0.0, offset), 3);
  
  // Layer 3: Small ripples moving FAST
  vec2 uv3 = uv * 4.0 + vec2(time * speed * 3.0, -time * speed * 2.5);
  float h3 = fbm(uv3, 2);
  float h3x = fbm(uv3 + vec2(offset, 0.0), 2);
  float h3z = fbm(uv3 + vec2(0.0, offset), 2);
  
  // Combine heights
  float h = h1 * 0.6 + h2 * 0.3 + h3 * 0.1;
  float hx = h1x * 0.6 + h2x * 0.3 + h3x * 0.1;
  float hz = h1z * 0.6 + h2z * 0.3 + h3z * 0.1;
  
  // Calculate derivatives
  float dx = (hx - h) / offset;
  float dz = (hz - h) / offset;
  
  // Create normal with VERY STRONG distortion for visible waves!
  return normalize(vec3(-dx * 5.0, 1.0, -dz * 5.0));
}

// Sky color gradient
vec3 getSkyColor(vec3 dir) {
  float t = max(dir.y, 0.0);
  vec3 skyTop = vec3(0.5, 0.7, 1.0);
  vec3 skyHorizon = vec3(0.7, 0.8, 0.95);
  
  // Add sun direction
  vec3 sunDir = normalize(vec3(-1.0, 0.45, 1.0));
  float sun = pow(max(dot(dir, sunDir), 0.0), 256.0);
  
  vec3 skyColor = mix(skyHorizon, skyTop, pow(t, 0.6));
  skyColor += vec3(1.0, 0.9, 0.7) * sun;
  
  return skyColor;
}

// View-space to screen-space
vec2 viewToScreen(vec3 viewPos) {
  vec4 clipPos = customProjectionMatrix * vec4(viewPos, 1.0);
  vec3 ndcPos = clipPos.xyz / clipPos.w;
  return ndcPos.xy * 0.5 + 0.5;
}

// Simple screen-space ray tracing
vec4 traceScreenSpace(vec3 rayViewOrigin, vec3 rayViewDir, int maxSteps) {
  vec3 rayPos = rayViewOrigin;
  float stepSize = 0.1;
  
  for(int i = 0; i < 32; i++) {
    if(i >= maxSteps) break;
    
    rayPos += rayViewDir * stepSize;
    stepSize *= 1.5; // Exponential steps (like Quick_Grass!)
    
    vec2 screenUV = viewToScreen(rayPos);
    
    // Check bounds
    if(screenUV.x < 0.0 || screenUV.x > 1.0 || screenUV.y < 0.0 || screenUV.y > 1.0) {
      break;
    }
    
    // Sample scene color
    vec3 hitColor = texture2D(sceneTexture, screenUV).rgb;
    
    // Simple hit test - if we see any color, we hit something
    if(length(hitColor) > 0.01) {
      return vec4(hitColor, 1.0);
    }
  }
  
  return vec4(0.0, 0.0, 0.0, 0.0);
}

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  
  // Get animated water normal - STRONG for visible waves
  vec3 waterNormal = getWaterNormal(vWorldPos, time, waveScale, waveSpeed);
  
  // Fresnel effect
  float fresnel = pow(1.0 - max(dot(waterNormal, viewDir), 0.0), fresnelPower);
  
  // Reflection direction
  vec3 reflectDir = reflect(-viewDir, waterNormal);
  
  // Refraction direction (for underwater distortion)
  vec3 refractDir = refract(-viewDir, waterNormal, 1.0 / 1.33);
  
  // Sky reflection (fallback)
  vec3 skyColor = getSkyColor(reflectDir);
  
  // Screen-space coordinates with REFRACTION DISTORTION
  vec2 screenUV = gl_FragCoord.xy / resolution;
  
  // Add distortion based on water normal
  vec2 distortion = hash23(vec3(vWorldPos.xz, time)).xy * 0.02;
  distortion += waterNormal.xz * 0.05; // Use wave normal for distortion!
  screenUV += distortion;
  
  // Screen-space reflection
  vec3 reflectedColor = skyColor;
  
  if(enableSSR > 0.5) {
    vec3 reflectViewDir = normalize((customViewMatrix * vec4(reflectDir, 0.0)).xyz);
    vec4 ssrResult = traceScreenSpace(vViewPos, reflectViewDir, 24);
    
    if(ssrResult.w > 0.5) {
      reflectedColor = ssrResult.rgb;
    }
  }
  
  // Sample scene with refraction distortion
  vec3 refractedColor = texture2D(sceneTexture, screenUV).rgb;
  
  // Water base color with ANIMATED wave-based variation
  vec2 waveUV = vWorldPos.xz * waveScale + vec2(time * waveSpeed * 1.5, time * waveSpeed * 0.8);
  float waveHeight = fbm(waveUV, 4);
  vec3 waterColor = mix(waterDeepColor, waterShallowColor, waveHeight);
  
  // Add ANIMATED color variation from noise
  vec2 colorUV = vWorldPos.xz * 0.15 + vec2(time * 0.2, -time * 0.15);
  float colorNoise = fbm(colorUV, 3);
  waterColor += vec3(colorNoise - 0.5) * 0.2;
  
  // Foam on wave peaks - ANIMATED and MORE VISIBLE
  vec2 foamUV = vWorldPos.xz * 2.0 + vec2(time * 1.0, time * 0.7);
  float foamNoise = fbm(foamUV, 4);
  float foam = smoothstep(0.5, 0.8, foamNoise) * foamIntensity;
  foam += smoothstep(0.65, 0.95, waveHeight) * foamIntensity * 0.6; // Foam on high waves
  vec3 foamColor = vec3(1.0);
  
  // Mix refraction (underwater view) with water color
  vec3 underwaterColor = mix(refractedColor, waterColor, 0.6);
  
  // Mix underwater with reflection based on fresnel
  vec3 finalColor = mix(underwaterColor, reflectedColor, fresnel * reflectionStrength);
  
  // Add foam on top
  finalColor = mix(finalColor, foamColor, foam);
  
  // Add specular highlights on wave peaks
  vec3 H = normalize(reflectDir + viewDir);
  float spec = pow(max(dot(waterNormal, H), 0.0), 128.0);
  finalColor += vec3(1.0) * spec * 0.3;
  
  gl_FragColor = vec4(finalColor, 0.92);
}
`;

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        sceneTexture: { value: null },
        depthTexture: { value: null },
        resolution: {
          value: new THREE.Vector2(window.innerWidth, window.innerHeight),
        },
        time: { value: 0 },
        waveScale: { value: waveScale },
        waveSpeed: { value: waveSpeed },
        fresnelPower: { value: fresnelPower },
        reflectionStrength: { value: reflectionStrength },
        waterDeepColor: { value: new THREE.Color(waterDeepColor) },
        waterShallowColor: { value: new THREE.Color(waterShallowColor) },
        foamIntensity: { value: foamIntensity },
        enableSSR: { value: enableSSR ? 1.0 : 0.0 },
        cameraNear: { value: camera.near },
        cameraFar: { value: camera.far },
        customProjectionMatrix: { value: camera.projectionMatrix },
        customViewMatrix: { value: camera.matrixWorldInverse },
        // cameraPosition is built-in (fragment shader only!)
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    return mat;
  }, []);

  // Handle window resize - AFTER material creation
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      renderTargets.sceneRT.setSize(width, height);
      material.uniforms.resolution.value.set(width, height);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [renderTargets, material]);

  // Update uniforms from controls
  useEffect(() => {
    material.uniforms.waveScale.value = waveScale;
    material.uniforms.waveSpeed.value = waveSpeed;
    material.uniforms.fresnelPower.value = fresnelPower;
    material.uniforms.reflectionStrength.value = reflectionStrength;
    material.uniforms.waterDeepColor.value.set(waterDeepColor);
    material.uniforms.waterShallowColor.value.set(waterShallowColor);
    material.uniforms.foamIntensity.value = foamIntensity;
    material.uniforms.enableSSR.value = enableSSR ? 1.0 : 0.0;
  }, [
    material,
    waveScale,
    waveSpeed,
    fresnelPower,
    reflectionStrength,
    waterDeepColor,
    waterShallowColor,
    foamIntensity,
    enableSSR,
  ]);

  // Render loop - two-pass rendering
  useFrame((state, delta) => {
    if (!waterRef.current) return;

    // Update time - USE MATERIAL DIRECTLY
    material.uniforms.time.value += delta;

    // Update matrices (needed in fragment shader for SSR)
    material.uniforms.customProjectionMatrix.value.copy(
      camera.projectionMatrix
    );
    material.uniforms.customViewMatrix.value.copy(camera.matrixWorldInverse);

    if (enableSSR) {
      // Hide water
      waterRef.current.visible = false;

      // Render scene to texture
      const currentRT = gl.getRenderTarget();
      gl.setRenderTarget(renderTargets.sceneRT);
      gl.clear();
      gl.render(scene, camera);

      // Update water material with scene texture
      material.uniforms.sceneTexture.value = renderTargets.sceneRT.texture;
      material.uniforms.depthTexture.value = renderTargets.sceneRT.depthTexture;

      // Show water and render final
      waterRef.current.visible = true;
      gl.setRenderTarget(currentRT);
    }
  });

  return (
    <mesh
      ref={waterRef}
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
      material={material}
    >
      <planeGeometry args={size} />
    </mesh>
  );
};
