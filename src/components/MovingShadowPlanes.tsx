import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useControls } from "leva";
import * as THREE from "three";

/**
 * MovingShadowPlanes Component
 *
 * Creates floating horizontal planes that move across the scene,
 * casting moving shadows (like clouds). Very lightweight and simple.
 *
 * Perfect for:
 * - Atmospheric depth
 * - Dynamic shadows
 * - Placeholder for cloud system
 */

interface MovingShadowPlanesProps {
  characterPosition?: THREE.Vector3;
}

export const MovingShadowPlanes: React.FC<MovingShadowPlanesProps> = ({
  characterPosition,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const planesRef = useRef<
    Array<{ mesh: THREE.Mesh; speed: THREE.Vector2; offset: THREE.Vector2 }>
  >([]);

  const {
    enabled,
    planeCount,
    planeSize,
    planeHeight,
    moveSpeed,
    moveRange,
    planeOpacity,
    planeColor,
    followPlayer,
  } = useControls("☁️ Moving Shadow Planes (Map5)", {
    enabled: {
      value: false,
      label: "✨ Enable Shadow Planes (Cloud Placeholders)",
    },
    planeCount: {
      value: 8,
      min: 1,
      max: 20,
      step: 1,
      label: "☁️ Plane Count (More = More Shadows)",
    },
    planeSize: {
      value: 20,
      min: 5,
      max: 50,
      step: 5,
      label: "📏 Plane Size (Diameter)",
    },
    planeHeight: {
      value: 7,
      min: 3,
      max: 15,
      step: 0.5,
      label: "📍 Height Above Ground (6-8m = Natural)",
    },
    moveSpeed: {
      value: 0.5,
      min: 0.1,
      max: 3.0,
      step: 0.1,
      label: "💨 Movement Speed (Like Wind)",
    },
    moveRange: {
      value: 50,
      min: 20,
      max: 100,
      step: 10,
      label: "🗺️ Movement Range (How Far They Travel)",
    },
    planeOpacity: {
      value: 0.0,
      min: 0.0,
      max: 1.0,
      step: 0.05,
      label: "👁️ Plane Opacity (0=Invisible, 1=Visible)",
    },
    planeColor: {
      value: "#808080",
      label: "🎨 Plane Color (If Visible)",
    },
    followPlayer: {
      value: true,
      label: "🏃 Follow Player (Shadows Always Nearby)",
    },
  });

  // Initialize planes once when enabled
  React.useEffect(() => {
    if (!enabled || !groupRef.current) {
      planesRef.current = [];
      return;
    }

    // Clear existing planes
    while (groupRef.current.children.length > 0) {
      groupRef.current.remove(groupRef.current.children[0]);
    }
    planesRef.current = [];

    // Create new planes
    for (let i = 0; i < planeCount; i++) {
      const geometry = new THREE.CircleGeometry(planeSize / 2, 32);
      const material = new THREE.MeshBasicMaterial({
        color: planeColor,
        transparent: true,
        opacity: planeOpacity,
        side: THREE.DoubleSide,
        depthWrite: false, // Don't block depth (for transparency)
      });

      const mesh = new THREE.Mesh(geometry, material);

      // Random initial position
      const angle = (i / planeCount) * Math.PI * 2;
      const distance = Math.random() * moveRange * 0.5;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;

      mesh.position.set(x, planeHeight, z);
      mesh.rotation.x = -Math.PI / 2; // Horizontal (parallel to ground)

      // Shadow settings
      mesh.castShadow = true;
      mesh.receiveShadow = false; // They're in the air, don't receive shadows

      groupRef.current.add(mesh);

      // Store movement data
      const speedX = (Math.random() - 0.5) * 2; // Random direction
      const speedZ = (Math.random() - 0.5) * 2;
      const offsetX = Math.random() * 1000; // Random offset for varied movement
      const offsetZ = Math.random() * 1000;

      planesRef.current.push({
        mesh,
        speed: new THREE.Vector2(speedX, speedZ),
        offset: new THREE.Vector2(offsetX, offsetZ),
      });
    }

    console.log(
      `☁️ Created ${planeCount} moving shadow planes at ${planeHeight}m height`
    );
  }, [enabled, planeCount, planeSize, planeHeight, planeColor, planeOpacity]);

  // Animate planes
  useFrame((state) => {
    if (!enabled || planesRef.current.length === 0) return;

    const time = state.clock.elapsedTime;
    const playerX = followPlayer && characterPosition ? characterPosition.x : 0;
    const playerZ = followPlayer && characterPosition ? characterPosition.z : 0;

    planesRef.current.forEach((planeData) => {
      // Smooth circular/wave motion using sine waves
      const x =
        Math.sin(time * moveSpeed * 0.3 + planeData.offset.x) * moveRange * 0.5;
      const z =
        Math.cos(time * moveSpeed * 0.25 + planeData.offset.y) *
        moveRange *
        0.5;

      // Add directional drift (like wind)
      const driftX =
        ((time * moveSpeed * planeData.speed.x * 0.5) % moveRange) -
        moveRange * 0.5;
      const driftZ =
        ((time * moveSpeed * planeData.speed.y * 0.5) % moveRange) -
        moveRange * 0.5;

      if (followPlayer) {
        // Follow player (shadows stay near character)
        planeData.mesh.position.x = playerX + x + driftX * 0.3;
        planeData.mesh.position.z = playerZ + z + driftZ * 0.3;
      } else {
        // Fixed position, just drift
        planeData.mesh.position.x = x + driftX;
        planeData.mesh.position.z = z + driftZ;
      }

      planeData.mesh.position.y = planeHeight;
    });
  });

  // Update material properties when controls change
  React.useEffect(() => {
    planesRef.current.forEach((planeData) => {
      if (planeData.mesh.material instanceof THREE.MeshBasicMaterial) {
        planeData.mesh.material.opacity = planeOpacity;
        planeData.mesh.material.color.set(planeColor);
        planeData.mesh.material.needsUpdate = true;
      }
    });
  }, [planeOpacity, planeColor]);

  if (!enabled) return null;

  return <group ref={groupRef} />;
};

export default MovingShadowPlanes;
