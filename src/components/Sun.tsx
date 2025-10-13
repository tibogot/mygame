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
    useControls("☀️ Sun Mesh (Map5)", {
      enabled: {
        value: true,
        label: "✨ Enable Sun Mesh (Required for God Rays!)",
      },
      sunSize: {
        value: 8,
        min: 0.5,
        max: 30,
        step: 0.5,
        label: "☀️ Sun Size (Bigger = More Visible)",
      },
      sunColor: {
        value: "#ffffff",
        label: "🎨 Sun Color (White = Natural Sun)",
      },
      sunIntensity: {
        value: 2.0,
        min: 0.0,
        max: 10.0,
        step: 0.5,
        label: "💡 Sun Brightness (For Bloom Glow)",
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
      <sphereGeometry args={[sunSize, 32, 32]} />
      <meshBasicMaterial
        color={new THREE.Color(sunColor).multiplyScalar(sunIntensity)}
        toneMapped={false}
        transparent={false}
        depthWrite={false}
        depthTest={false}
      />
      {/* Point light for scene lighting (optional glow) */}
      {sunIntensity > 0 && (
        <pointLight
          color={sunColor}
          intensity={sunIntensity * 5}
          distance={200}
          decay={2}
        />
      )}
    </mesh>
  );
});

Sun.displayName = "Sun";

export default Sun;
