import React, { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { N8AOPostPass } from "n8ao";
import {
  EffectComposer as VanillaComposer,
  RenderPass,
  EffectPass,
} from "postprocessing";
import { SMAAEffect, SMAAPreset } from "postprocessing";
import { useControls } from "leva";
import * as THREE from "three";

/**
 * N8AO Ambient Occlusion Effect for Map5
 *
 * Advanced screen-space ambient occlusion with:
 * - Quality presets (Performance to Ultra)
 * - Half-resolution mode for 2-4x performance boost
 * - Customizable radius, falloff, intensity
 * - Display modes for debugging
 * - SMAA anti-aliasing
 */
export const N8AOEffect = () => {
  const { scene, camera, gl, size, set } = useThree();
  const composerRef = useRef(null);
  const n8aoPassRef = useRef(null);
  const originalRenderRef = useRef(null);

  const {
    enabled,
    aoRadius,
    distanceFalloff,
    intensity,
    aoColor,
    halfRes,
    qualityMode,
    displayMode,
    gammaCorrection,
  } = useControls("N8AO Ambient Occlusion (Map5)", {
    enabled: {
      value: false,
      label: "✨ Enable N8AO",
    },
    aoRadius: {
      value: 2.0,
      min: 0.1,
      max: 10.0,
      step: 0.1,
      label: "AO Radius (world units)",
    },
    distanceFalloff: {
      value: 1.0,
      min: 0.1,
      max: 5.0,
      step: 0.1,
      label: "Distance Falloff",
    },
    intensity: {
      value: 3.0,
      min: 1.0,
      max: 10.0,
      step: 0.5,
      label: "Intensity",
    },
    aoColor: {
      value: "#000000",
      label: "AO Color",
    },
    halfRes: {
      value: true,
      label: "📊 Half Resolution (2-4x faster)",
    },
    qualityMode: {
      value: "Low",
      options: ["Performance", "Low", "Medium", "High", "Ultra"],
      label: "Quality Preset",
    },
    displayMode: {
      value: "Combined",
      options: ["Combined", "AO", "No AO", "Split", "Split AO"],
      label: "Display Mode (debug)",
    },
    gammaCorrection: {
      value: false,
      label: "Gamma Correction",
    },
  });

  // Create composer and passes - only on mount/unmount or when enabled changes
  useEffect(() => {
    if (!enabled) {
      if (composerRef.current) {
        console.log("🧹 Disabling N8AO...");
        composerRef.current.dispose();
        composerRef.current = null;
        n8aoPassRef.current = null;
      }
      return;
    }

    // Avoid creating if already exists
    if (composerRef.current) {
      console.log("⚠️ N8AO already initialized");
      return;
    }

    console.log("🎨 Setting up N8AO post-processing...");

    try {
      // Create EffectComposer from postprocessing (not @react-three/postprocessing)
      const composer = new VanillaComposer(gl, {
        frameBufferType: THREE.HalfFloatType,
        depthBuffer: true,
        stencilBuffer: false,
      });

      // Add RenderPass first (required by N8AO docs)
      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

      // Create and add N8AOPostPass
      const n8aoPass = new N8AOPostPass(scene, camera, size.width, size.height);

      // Configure N8AO with current values
      n8aoPass.configuration.aoRadius = aoRadius;
      n8aoPass.configuration.distanceFalloff = distanceFalloff;
      n8aoPass.configuration.intensity = intensity;
      n8aoPass.configuration.color = new THREE.Color(aoColor);
      n8aoPass.configuration.halfRes = halfRes;
      n8aoPass.configuration.gammaCorrection = gammaCorrection;

      // Set quality mode
      n8aoPass.setQualityMode(qualityMode);

      // Set display mode
      n8aoPass.setDisplayMode(displayMode);

      composer.addPass(n8aoPass);

      // Add SMAA for anti-aliasing
      const smaaEffect = new SMAAEffect({ preset: SMAAPreset.ULTRA });
      const smaaPass = new EffectPass(camera, smaaEffect);
      composer.addPass(smaaPass);

      composerRef.current = composer;
      n8aoPassRef.current = n8aoPass;

      console.log("✅ N8AO ready!");
    } catch (error) {
      console.error("❌ N8AO setup failed:", error);
    }

    return () => {
      console.log("🧹 Cleaning up N8AO...");
      if (composerRef.current) {
        composerRef.current.dispose();
        composerRef.current = null;
        n8aoPassRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]); // Only recreate when enabled toggles

  // Update N8AO configuration
  useEffect(() => {
    if (!n8aoPassRef.current || !enabled) return;

    n8aoPassRef.current.configuration.aoRadius = aoRadius;
    n8aoPassRef.current.configuration.distanceFalloff = distanceFalloff;
    n8aoPassRef.current.configuration.intensity = intensity;
    n8aoPassRef.current.configuration.color.set(aoColor);
  }, [enabled, aoRadius, distanceFalloff, intensity, aoColor]);

  // Update performance settings
  useEffect(() => {
    if (!n8aoPassRef.current || !enabled) return;

    n8aoPassRef.current.configuration.halfRes = halfRes;
    n8aoPassRef.current.configuration.gammaCorrection = gammaCorrection;
  }, [enabled, halfRes, gammaCorrection]);

  // Update quality mode
  useEffect(() => {
    if (!n8aoPassRef.current || !enabled) return;

    n8aoPassRef.current.setQualityMode(qualityMode);
  }, [enabled, qualityMode]);

  // Update display mode
  useEffect(() => {
    if (!n8aoPassRef.current || !enabled) return;

    n8aoPassRef.current.setDisplayMode(displayMode);
  }, [enabled, displayMode]);

  // Handle resize
  useEffect(() => {
    if (!composerRef.current || !enabled) return;

    composerRef.current.setSize(size.width, size.height);
  }, [enabled, size.width, size.height]);

  // Override R3F's render with composer
  useFrame((state, delta) => {
    if (!composerRef.current || !enabled) return false;

    try {
      // Use composer to render instead of default
      composerRef.current.render(delta);
      // Must return false to allow frame to complete
      return false;
    } catch (error) {
      console.error("N8AO render error:", error);
      return false;
    }
  }, 999); // Very high priority to render last

  return null;
};

export default N8AOEffect;
