import React, { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { useControls, folder } from "leva";
import * as THREE from "three";

/**
 * 🌫️ ATMOSPHERIC FOG - Realistic exponential fog (FogExp2)
 *
 * Exactly like the octahedral-impostor demo!
 *
 * Key Features:
 * - Uses real GPU depth buffer (not fake UV-based depth)
 * - Truly transparent - distant objects fade naturally
 * - Zero post-processing overhead
 * - Exponential falloff for realistic atmosphere
 * - Works on ALL materials automatically
 *
 * vs VolumetricFog:
 * - 10x simpler code
 * - More performant (no post-processing pass)
 * - More realistic (real depth, not screen position)
 * - Actually see-through (exponential, not hard cutoff)
 */

interface AtmosphericFogProps {
  color?: string;
  density?: number;
}

export const AtmosphericFog: React.FC<AtmosphericFogProps> = ({
  color: defaultColor,
  density: defaultDensity,
}) => {
  const { scene } = useThree();

  const { enabled, fogColor, fogDensity } = useControls("🌤️ AMBIENCE", {
    atmosphericFog: folder(
      {
        enabled: {
          value: false,
          label: "Enable Fog",
        },
        fogColor: {
          value: defaultColor || "#87ceeb",
          label: "Fog Color (match sky!)",
        },
        fogDensity: {
          value: defaultDensity || 0.0012,
          min: 0.0001,
          max: 0.01,
          step: 0.0001,
          label: "Fog Density (0.0012 = demo)",
        },
      },
      { collapsed: true }
    ),
  });

  useEffect(() => {
    if (enabled) {
      // Create exponential fog (exactly like demo!)
      const fog = new THREE.FogExp2(fogColor, fogDensity);
      scene.fog = fog;
    } else {
      // Disable fog
      scene.fog = null;
    }

    // Cleanup
    return () => {
      scene.fog = null;
    };
  }, [enabled, fogColor, fogDensity, scene]);

  return null; // This component just manages scene.fog
};

export default AtmosphericFog;
