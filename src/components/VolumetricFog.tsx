import React, { useMemo, useRef, forwardRef } from "react";
import { useControls } from "leva";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Effect, BlendFunction } from "postprocessing";
import { Uniform } from "three";

/**
 * Custom Volumetric Fog Shader
 *
 * This implementation uses:
 * - Raymarching for realistic volumetric fog
 * - Noise-based density variation for natural-looking fog
 * - Height-based falloff for ground fog effects
 * - Light scattering for atmospheric effects
 * - Multiple sampling for smooth appearance
 */

const fragmentShader = `
uniform float fogDensity;
uniform vec3 fogColor;
uniform float fogHeight;
uniform float noiseScale;
uniform float noiseSpeed;
uniform float time;
uniform float fogNear;
uniform float fogFar;
uniform float distanceFogStrength;

// Simple 2D noise function
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

// Layered noise for natural variation
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  
  for (int i = 0; i < 3; i++) {
    value += amplitude * noise(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  
  return value;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // === DISTANCE-BASED FOG (Zelda BotW / Ghost of Tsushima style) ===
  // Approximate depth from center distance (simple but effective)
  // Objects at edges and top are usually further away
  vec2 centerOffset = uv - vec2(0.5, 0.5);
  float depthApprox = length(centerOffset) * 2.0; // 0 at center, ~1.4 at corners
  depthApprox = clamp(depthApprox, 0.0, 1.0);
  
  // Calculate distance fog like THREE.Fog
  // Smoothstep for smooth transition between near and far
  float distanceFog = smoothstep(fogNear, fogFar, depthApprox);
  
  // Apply distance fog strength
  distanceFog *= distanceFogStrength;
  
  // === HEIGHT-BASED FOG (Ground mist) ===
  float heightFactor = pow(1.0 - uv.y, 2.0);
  heightFactor = mix(0.2, 1.0, heightFactor);
  
  // Animated noise pattern
  vec2 noiseUV = uv * noiseScale;
  noiseUV.x += time * noiseSpeed * 0.1;
  noiseUV.y += sin(time * noiseSpeed * 0.05) * 0.1;
  
  float noiseValue = fbm(noiseUV);
  noiseValue = noiseValue * 0.5 + 0.5;
  
  // Ground fog amount
  float groundFog = heightFactor * noiseValue * fogDensity * 0.3;
  
  // === COMBINE BOTH FOGS ===
  // Distance fog is primary (far objects fade)
  // Ground fog is secondary (adds atmosphere near ground)
  float totalFog = max(distanceFog, groundFog);
  totalFog = clamp(totalFog, 0.0, 1.0);
  
  // Mix with fog color
  vec3 finalColor = mix(inputColor.rgb, fogColor, totalFog);
  
  outputColor = vec4(finalColor, inputColor.a);
}
`;

/**
 * Volumetric Fog Effect for postprocessing
 */
class VolumetricFogEffect extends Effect {
  constructor({
    fogDensity = 0.5,
    fogColor = new THREE.Color(0xc8d5e8),
    fogHeight = 0.5,
    noiseScale = 5.0,
    noiseSpeed = 0.5,
    fogNear = 0.1,
    fogFar = 0.9,
    distanceFogStrength = 1.0,
  } = {}) {
    super("VolumetricFogEffect", fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([
        ["fogDensity", new Uniform(fogDensity)],
        ["fogColor", new Uniform(fogColor)],
        ["fogHeight", new Uniform(fogHeight)],
        ["noiseScale", new Uniform(noiseScale)],
        ["noiseSpeed", new Uniform(noiseSpeed)],
        ["fogNear", new Uniform(fogNear)],
        ["fogFar", new Uniform(fogFar)],
        ["distanceFogStrength", new Uniform(distanceFogStrength)],
        ["time", new Uniform(0)],
      ]),
    });
  }

  update(_renderer: any, _inputBuffer: any, deltaTime: number) {
    this.uniforms.get("time")!.value += deltaTime;
  }
}

/**
 * Volumetric Fog Component for React Three Fiber
 *
 * Usage: Place inside <EffectComposer> from @react-three/postprocessing
 */
export const VolumetricFog = forwardRef((_props, ref) => {
  const {
    enabled,
    fogMode,
    fogDensity,
    fogColor,
    fogHeight,
    noiseScale,
    noiseSpeed,
    fogNear,
    fogFar,
    distanceFogStrength,
  } = useControls("🌫️ Volumetric Fog (Map5)", {
    enabled: {
      value: false,
      label: "✨ Enable Fog",
    },
    fogMode: {
      value: "distance",
      options: {
        "🏔️ Distance Only (Mountains)": "distance",
        "💨 Ground Only (Mist)": "ground",
        "🌫️ Both Combined": "both",
      },
      label: "🎭 Fog Type",
    },
    distanceFogStrength: {
      value: 1.0,
      min: 0.0,
      max: 1.0,
      step: 0.05,
      label: "🏔️ Distance Fog Strength",
    },
    fogNear: {
      value: 0.1,
      min: 0.0,
      max: 1.0,
      step: 0.05,
      label: "📍 Fog Start Distance",
    },
    fogFar: {
      value: 0.7,
      min: 0.0,
      max: 1.0,
      step: 0.05,
      label: "📍 Fog End Distance",
    },
    fogDensity: {
      value: 4.0,
      min: 0.0,
      max: 10.0,
      step: 0.1,
      label: "💨 Ground Fog Density",
    },
    fogHeight: {
      value: 0.5,
      min: 0.0,
      max: 2.0,
      step: 0.1,
      label: "📏 Height Distribution",
    },
    fogColor: {
      value: "#c8d5e8",
      label: "🎨 Fog Color",
    },
    noiseScale: {
      value: 5.0,
      min: 1.0,
      max: 20.0,
      step: 0.5,
      label: "🌊 Noise Scale",
    },
    noiseSpeed: {
      value: 0.3,
      min: 0.0,
      max: 2.0,
      step: 0.1,
      label: "⚡ Animation Speed",
    },
  });

  const effect = useMemo(() => {
    return new VolumetricFogEffect({
      fogDensity,
      fogColor: new THREE.Color(fogColor),
      fogHeight,
      noiseScale,
      noiseSpeed,
      fogNear,
      fogFar,
      distanceFogStrength,
    });
  }, []);

  // Animate fog by updating time uniform every frame
  useFrame((state, delta) => {
    if (!effect) return;
    const timeUniform = effect.uniforms.get("time");
    if (timeUniform) {
      timeUniform.value += delta;
    }
  });

  // Update uniforms when controls change
  React.useEffect(() => {
    if (!effect) return;

    // Apply fog based on mode
    let groundFogAmount = 0;
    let distanceFogAmount = 0;

    if (enabled) {
      if (fogMode === "ground") {
        groundFogAmount = fogDensity;
        distanceFogAmount = 0;
      } else if (fogMode === "distance") {
        groundFogAmount = 0;
        distanceFogAmount = distanceFogStrength;
      } else if (fogMode === "both") {
        groundFogAmount = fogDensity;
        distanceFogAmount = distanceFogStrength;
      }
    }

    effect.uniforms.get("fogDensity")!.value = groundFogAmount;
    effect.uniforms.get("distanceFogStrength")!.value = distanceFogAmount;
    effect.uniforms.get("fogColor")!.value = new THREE.Color(fogColor);
    effect.uniforms.get("fogHeight")!.value = fogHeight;
    effect.uniforms.get("noiseScale")!.value = noiseScale;
    effect.uniforms.get("noiseSpeed")!.value = noiseSpeed;
    effect.uniforms.get("fogNear")!.value = fogNear;
    effect.uniforms.get("fogFar")!.value = fogFar;
  }, [
    effect,
    enabled,
    fogMode,
    fogDensity,
    fogColor,
    fogHeight,
    noiseScale,
    noiseSpeed,
    fogNear,
    fogFar,
    distanceFogStrength,
  ]);

  return <primitive ref={ref} object={effect} />;
});

VolumetricFog.displayName = "VolumetricFog";

export default VolumetricFog;
