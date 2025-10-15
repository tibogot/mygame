import React, { useRef, Suspense } from "react";
import {
  EffectComposer,
  SSAO,
  SMAA,
  N8AO,
  GodRays,
  Bloom,
} from "@react-three/postprocessing";
import { BlendFunction, KernelSize, SMAAPreset } from "postprocessing";
import { useControls, folder } from "leva";
import { Sun } from "./Sun.tsx";
import { RainEffectPostprocessing } from "./RainEffectPostprocessing.tsx";

/**
 * Post-Processing Effects for Map5
 *
 * Includes:
 * - N8AO (Advanced Ambient Occlusion)
 * - Volumetric Fog (Raymarched)
 * - God Rays (Volumetric Light)
 * - SMAA anti-aliasing
 */
export const SSAOEffect = () => {
  const sunRef = useRef();

  const {
    enablePostProcessing,
    enabled,
    aoRadius,
    distanceFalloff,
    intensity,
    color,
    aoSamples,
    denoiseSamples,
    denoiseRadius,
    halfRes,
    godRaysEnabled,
    samples,
    density,
    decay,
    weight,
    exposure,
    clampMax,
    blur,
    enableBloom,
    bloomIntensity,
    bloomLuminanceThreshold,
    bloomLuminanceSmoothing,
    bloomMipmapBlur,
    enableRainPP,
    rainIntensityPP,
    dropletIntensityPP,
    rainSpeedPP,
    antiAliasingMode,
    smaaPreset,
  } = useControls("🎬 POST PROCESSING", {
    masterToggle: folder(
      {
        enablePostProcessing: {
          value: false,
          label: "✨ Enable Post-Processing",
        },
      },
      { collapsed: true }
    ),
    n8ao: folder(
      {
        enabled: {
          value: false,
          label: "✨ Enable N8AO",
        },
        aoRadius: {
          value: 2.0,
          min: 0.1,
          max: 50.0,
          step: 0.5,
          label: "📏 AO Radius (world units)",
        },
        distanceFalloff: {
          value: 1.0,
          min: 0.1,
          max: 5.0,
          step: 0.1,
          label: "📉 Distance Falloff",
        },
        intensity: {
          value: 5.0,
          min: 0.0,
          max: 20.0,
          step: 0.5,
          label: "💪 Intensity (darkness)",
        },
        color: {
          value: "#000000",
          label: "🎨 AO Color",
        },
        aoSamples: {
          value: 16,
          min: 4,
          max: 64,
          step: 1,
          label: "🎯 AO Samples (quality)",
        },
        denoiseSamples: {
          value: 4,
          min: 1,
          max: 16,
          step: 1,
          label: "🔧 Denoise Samples",
        },
        denoiseRadius: {
          value: 6,
          min: 1,
          max: 24,
          step: 1,
          label: "🔄 Denoise Radius",
        },
        halfRes: {
          value: false,
          label: "📊 Half Resolution (breaks HDRI!)",
        },
      },
      { collapsed: true }
    ),
    godRays: folder(
      {
        godRaysEnabled: {
          value: false,
          label: "✨ Enable God Rays (Volumetric Light Shafts)",
        },
        samples: {
          value: 60,
          min: 15,
          max: 100,
          step: 5,
          label: "🎯 Samples (Quality) - Higher = Better",
        },
        density: {
          value: 0.96,
          min: 0.5,
          max: 1.0,
          step: 0.01,
          label: "💨 Density (Higher = More Visible)",
        },
        decay: {
          value: 0.9,
          min: 0.5,
          max: 1.0,
          step: 0.01,
          label: "📉 Decay (Lower = Longer Rays)",
        },
        weight: {
          value: 0.4,
          min: 0.0,
          max: 1.0,
          step: 0.01,
          label: "⚖️ Weight (Strength)",
        },
        exposure: {
          value: 0.6,
          min: 0.0,
          max: 1.0,
          step: 0.01,
          label: "💡 Exposure (Brightness)",
        },
        clampMax: {
          value: 1.0,
          min: 0.1,
          max: 2.0,
          step: 0.05,
          label: "🔆 Max Brightness",
        },
        blur: {
          value: true,
          label: "🌀 Blur (Smoothing)",
        },
      },
      { collapsed: true }
    ),
    bloom: folder(
      {
        enableBloom: {
          value: false,
          label: "🌟 Enable Bloom (Sun + Bright Objects Glow)",
        },
        bloomIntensity: {
          value: 1.5,
          min: 0.0,
          max: 5.0,
          step: 0.1,
          label: "💡 Bloom Intensity (Glow Strength)",
        },
        bloomLuminanceThreshold: {
          value: 0.8,
          min: 0.0,
          max: 1.0,
          step: 0.05,
          label: "🌟 Luminance Threshold (What Glows)",
        },
        bloomLuminanceSmoothing: {
          value: 0.3,
          min: 0.0,
          max: 1.0,
          step: 0.05,
          label: "🌊 Smoothing (Glow Softness)",
        },
        bloomMipmapBlur: {
          value: true,
          label: "🌀 Mipmap Blur (Better Quality)",
        },
      },
      { collapsed: true }
    ),
    rainPP: folder(
      {
        enableRainPP: {
          value: false,
          label: "💧 Enable Rain (Post-Processing)",
        },
        rainIntensityPP: {
          value: 1.0,
          min: 0.0,
          max: 3.0,
          step: 0.1,
          label: "Rain Streaks",
        },
        dropletIntensityPP: {
          value: 1.0,
          min: 0.0,
          max: 2.0,
          step: 0.1,
          label: "Droplet Refraction",
        },
        rainSpeedPP: {
          value: 2.0,
          min: 0.5,
          max: 5.0,
          step: 0.5,
          label: "Rain Speed",
        },
      },
      { collapsed: true }
    ),
    antiAliasing: folder(
      {
        antiAliasingMode: {
          value: "msaa",
          options: {
            "None (Jagged)": "none",
            "MSAA (Default)": "msaa",
            "SMAA (Shader-based)": "smaa",
          },
          label: "AA Mode",
        },
        smaaPreset: {
          value: "high",
          options: ["low", "medium", "high", "ultra"],
          label: "SMAA Quality",
          render: (get) =>
            get("🎬 POST PROCESSING.antiAliasing.antiAliasingMode") === "smaa",
        },
      },
      { collapsed: true }
    ),
  });

  // Map preset string to SMAAPreset enum
  const smaaPresetMap = {
    low: SMAAPreset.LOW,
    medium: SMAAPreset.MEDIUM,
    high: SMAAPreset.HIGH,
    ultra: SMAAPreset.ULTRA,
  };

  // Determine multisampling setting
  const multisampling =
    antiAliasingMode === "smaa" ? 0 : antiAliasingMode === "msaa" ? 8 : 0;

  // Only render post-processing if master toggle is enabled
  if (!enablePostProcessing) {
    return (
      <>
        {/* Sun mesh for GodRays origin (can still be enabled separately) */}
        <Sun ref={sunRef} />
      </>
    );
  }

  return (
    <>
      {/* Sun mesh for GodRays origin */}
      <Sun ref={sunRef} />

      <Suspense fallback={null}>
        <EffectComposer multisampling={multisampling}>
          {/* N8AO - Advanced ambient occlusion (works with R3F!) */}
          {enabled && (
            <N8AO
              aoRadius={aoRadius}
              distanceFalloff={distanceFalloff}
              intensity={intensity}
              color={color}
              aoSamples={aoSamples}
              denoiseSamples={denoiseSamples}
              denoiseRadius={denoiseRadius}
              halfRes={halfRes}
            />
          )}

          {/* Bloom - Makes bright objects glow (sun, specular highlights, etc.) */}
          {enableBloom && (
            <Bloom
              intensity={bloomIntensity}
              luminanceThreshold={bloomLuminanceThreshold}
              luminanceSmoothing={bloomLuminanceSmoothing}
              mipmapBlur={bloomMipmapBlur}
              blendFunction={BlendFunction.SCREEN}
            />
          )}

          {/* GodRays - Known issue: causes white screen */}
          {/* The white screen happens because GodRays needs depth buffer access */}
          {/* which conflicts with custom depth materials (like grass shadows) */}
          {false && godRaysEnabled && sunRef.current && (
            <GodRays
              sun={sunRef.current}
              blendFunction={BlendFunction.SCREEN}
              samples={samples}
              density={density}
              decay={decay}
              weight={weight}
              exposure={exposure}
              clampMax={clampMax}
              kernelSize={KernelSize.SMALL}
              blur={blur}
            />
          )}

          {/* Rain Effect with Refraction - Realistic water appearance */}
          {enableRainPP && (
            <RainEffectPostprocessing
              rainIntensity={rainIntensityPP}
              dropletIntensity={dropletIntensityPP}
              rainSpeed={rainSpeedPP}
            />
          )}

          {/* SMAA Anti-Aliasing - Shader-based AA */}
          {antiAliasingMode === "smaa" && (
            <SMAA preset={smaaPresetMap[smaaPreset]} />
          )}
        </EffectComposer>
      </Suspense>
    </>
  );
};

export default SSAOEffect;
