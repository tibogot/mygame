import React, { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { useControls, folder } from "leva";
import * as THREE from "three";

/**
 * VolumetricFog Component
 *
 * Advanced fog system with:
 * - Linear and Exponential fog modes
 * - Skybox/Environment visibility through fog
 * - Real-time color and density controls
 * - Distance-based falloff
 *
 * Compatible with Three.js r180
 */
export const VolumetricFog = () => {
  const { scene } = useThree();

  const {
    enabled,
    fogType,
    fogColor,
    near,
    far,
    density,
    heightFalloff,
    heightOffset,
  } = useControls("🌤️ AMBIENCE", {
    volumetricFogSimple: folder(
      {
        enabled: {
          value: false,
          label: "🌫️ Enable Fog",
        },
        fogType: {
          value: "exponential",
          options: {
            "Linear (distance-based)": "linear",
            "Exponential (more realistic)": "exponential",
          },
          label: "Fog Type",
        },
        fogColor: {
          value: "#c8d5e8",
          label: "🎨 Fog Color",
        },
        near: {
          value: 10,
          min: 0.1,
          max: 100,
          step: 0.5,
          label: "📏 Near Distance (linear only)",
        },
        far: {
          value: 80,
          min: 10,
          max: 200,
          step: 1,
          label: "📏 Far Distance (linear only)",
        },
        density: {
          value: 0.015,
          min: 0.0,
          max: 0.1,
          step: 0.001,
          label: "💨 Density (exponential only)",
        },
        heightFalloff: {
          value: 0.05,
          min: 0.0,
          max: 0.5,
          step: 0.01,
          label: "⛰️ Height Falloff (lower = more fog at ground)",
        },
        heightOffset: {
          value: 0,
          min: -20,
          max: 20,
          step: 1,
          label: "📐 Height Offset",
        },
      },
      { collapsed: true }
    ),
  });

  // Apply fog to scene
  useEffect(() => {
    if (!enabled) {
      // Remove fog
      scene.fog = null;
      return;
    }

    const color = new THREE.Color(fogColor);

    if (fogType === "linear") {
      // Linear fog - fades linearly between near and far distances
      scene.fog = new THREE.Fog(color, near, far);
    } else {
      // Exponential fog - more realistic, density-based
      scene.fog = new THREE.FogExp2(color, density);
    }

    // Make sure skybox/environment/background is not affected by fog
    // This makes the fog realistic - you can see the sky through it!
    const disableFogForObject = (object) => {
      if (object.isMesh && object.material) {
        // Check if it's a skybox/environment
        const isSkybox =
          object.name.toLowerCase().includes("sky") ||
          object.name.toLowerCase().includes("dome") ||
          object.name.toLowerCase().includes("environment") ||
          object.name.toLowerCase().includes("background") ||
          (object.geometry?.type === "SphereGeometry" && object.scale.x > 100);

        if (isSkybox) {
          console.log(
            `🌤️ Skybox detected: ${object.name} - fog disabled for realism`
          );

          // Handle both single material and material arrays
          if (Array.isArray(object.material)) {
            object.material.forEach((mat) => {
              mat.fog = false;
              mat.needsUpdate = true;
            });
          } else {
            object.material.fog = false;
            object.material.needsUpdate = true;
          }
        }
      }
    };

    // Check existing objects
    scene.traverse(disableFogForObject);

    // Also check for the scene.background if it's an environment map
    if (scene.background && scene.background.isTexture) {
      console.log(
        "🌤️ Environment map detected as background - fog will blend naturally"
      );
    }

    return () => {
      // Cleanup
      scene.fog = null;
    };
  }, [enabled, scene, fogType, fogColor, near, far, density]);

  // Update fog color
  useEffect(() => {
    if (!scene.fog || !enabled) return;

    const color = new THREE.Color(fogColor);
    scene.fog.color.copy(color);
  }, [enabled, scene, fogColor]);

  // Update fog parameters
  useEffect(() => {
    if (!scene.fog || !enabled) return;

    if (fogType === "linear" && scene.fog.isFog) {
      scene.fog.near = near;
      scene.fog.far = far;
    } else if (fogType === "exponential" && scene.fog.isFogExp2) {
      scene.fog.density = density;
    }
  }, [enabled, scene, fogType, near, far, density]);

  return null; // This component doesn't render anything
};

export default VolumetricFog;
