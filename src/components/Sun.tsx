import React, { useRef, forwardRef } from "react";
import { useControls } from "leva";
import * as THREE from "three";

/**
 * Sun Mesh for GodRays Effect
 *
 * This is a visual sun that serves as the origin point for god rays.
 * It's positioned to match your directional light.
 */
export const Sun = forwardRef<THREE.Mesh>((props, ref) => {
  const { enabled, sunSize, sunColor, sunIntensity, sunX, sunY, sunZ } =
    useControls("☀️ GodRays (Map5)", {
      enabled: {
        value: false,
        label: "✨ Enable Sun Mesh",
      },
      sunSize: {
        value: 3,
        min: 0.5,
        max: 20,
        step: 0.5,
        label: "☀️ Sun Size",
      },
      sunColor: {
        value: "#fff5e6",
        label: "🎨 Sun Color",
      },
      sunIntensity: {
        value: 0.5,
        min: 0.0,
        max: 5.0,
        step: 0.1,
        label: "💡 Glow Intensity",
      },
      sunX: {
        value: -30,
        min: -100,
        max: 100,
        step: 1,
        label: "📍 Position X",
      },
      sunY: {
        value: 60,
        min: 10,
        max: 100,
        step: 1,
        label: "📍 Position Y",
      },
      sunZ: {
        value: 40,
        min: -100,
        max: 100,
        step: 1,
        label: "📍 Position Z",
      },
    });

  if (!enabled) return null;

  return (
    <mesh ref={ref} position={[sunX, sunY, sunZ]} renderOrder={999}>
      <sphereGeometry args={[sunSize, 16, 16]} />
      <meshBasicMaterial
        color={sunColor}
        toneMapped={false}
        transparent={true}
        opacity={0.8}
        depthWrite={false}
        depthTest={false}
      />
      {/* Optional glow effect */}
      {sunIntensity > 0 && (
        <pointLight
          color={sunColor}
          intensity={sunIntensity}
          distance={100}
          decay={2}
        />
      )}
    </mesh>
  );
});

Sun.displayName = "Sun";

export default Sun;
