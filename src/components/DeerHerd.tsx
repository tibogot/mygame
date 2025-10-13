import React, { useRef, useEffect, useState } from "react";
import { useControls } from "leva";
import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Deer } from "./Deer";
import * as THREE from "three";

/**
 * DeerHerd Component
 *
 * Creates multiple AI-controlled deer that walk, eat, and idle independently.
 * Each deer has its own AI state, position, and animation.
 *
 * Perfect for creating a living, populated world!
 */

type AnimationName = "Idle" | "Idle_2" | "Walk" | "Eating";
type AIState = "idle" | "walking" | "eating";

interface DeerInstance {
  id: number;
  groupRef: React.RefObject<THREE.Group>;
  aiState: AIState;
  position: THREE.Vector3;
  rotation: number;
  targetRotation: number;
  stateTimer: number;
  nextStateChange: number;
  speed: THREE.Vector2; // Random walk speed variation
}

export const DeerHerd: React.FC = () => {
  const [deerInstances, setDeerInstances] = useState<DeerInstance[]>([]);
  const { animations } = useGLTF("/models/Deer.gltf");

  const {
    enabled,
    deerCount,
    enableAI,
    walkSpeed,
    rotationSpeed,
    minStateDuration,
    maxStateDuration,
    mapBoundary,
    spawnRadius,
    deerScale,
    castShadow,
    receiveShadow,
  } = useControls("🦌 Deer Herd (Map5)", {
    enabled: {
      value: false,
      label: "✨ Enable Deer Herd",
    },
    deerCount: {
      value: 5,
      min: 1,
      max: 20,
      step: 1,
      label: "🦌 Deer Count (1-20)",
    },
    enableAI: {
      value: true,
      label: "🤖 Enable AI (Auto Behavior)",
    },
    walkSpeed: {
      value: 1.0,
      min: 0.1,
      max: 3.0,
      step: 0.1,
      label: "🚶 Walk Speed",
    },
    rotationSpeed: {
      value: 2.0,
      min: 0.5,
      max: 5.0,
      step: 0.5,
      label: "🔄 Rotation Speed",
    },
    minStateDuration: {
      value: 3,
      min: 1,
      max: 10,
      step: 1,
      label: "⏱️ Min Behavior Duration (sec)",
    },
    maxStateDuration: {
      value: 8,
      min: 3,
      max: 20,
      step: 1,
      label: "⏱️ Max Behavior Duration (sec)",
    },
    mapBoundary: {
      value: 40,
      min: 10,
      max: 100,
      step: 5,
      label: "🗺️ Map Boundary",
    },
    spawnRadius: {
      value: 25,
      min: 5,
      max: 50,
      step: 5,
      label: "📍 Spawn Radius (Initial Spread)",
    },
    deerScale: {
      value: 0.5,
      min: 0.2,
      max: 2.0,
      step: 0.1,
      label: "📏 Deer Scale",
    },
    castShadow: {
      value: true,
      label: "🌑 Cast Shadow",
    },
    receiveShadow: {
      value: true,
      label: "🌑 Receive Shadow",
    },
  });

  // Initialize deer instances when count changes
  useEffect(() => {
    if (!enabled) {
      setDeerInstances([]);
      return;
    }

    const newInstances: DeerInstance[] = [];

    for (let i = 0; i < deerCount; i++) {
      // Random position within spawn radius
      const angle = (i / deerCount) * Math.PI * 2 + Math.random() * 0.5;
      const distance = spawnRadius * (0.5 + Math.random() * 0.5);
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;

      newInstances.push({
        id: i,
        groupRef: React.createRef<THREE.Group>(),
        aiState: Math.random() > 0.5 ? "idle" : "eating", // Start with idle or eating
        position: new THREE.Vector3(x, 0, z),
        rotation: Math.random() * Math.PI * 2,
        targetRotation: Math.random() * Math.PI * 2,
        stateTimer: Math.random() * 3, // Offset timers
        nextStateChange:
          minStateDuration +
          Math.random() * (maxStateDuration - minStateDuration),
        speed: new THREE.Vector2(
          0.8 + Math.random() * 0.4, // Speed variation (0.8x - 1.2x)
          0.8 + Math.random() * 0.4
        ),
      });
    }

    setDeerInstances(newInstances);
    console.log(`🦌 Spawned ${deerCount} deer in herd`);
  }, [enabled, deerCount, spawnRadius, minStateDuration, maxStateDuration]);

  // AI update for all deer
  useFrame((state, delta) => {
    if (!enabled || !enableAI || deerInstances.length === 0) return;

    setDeerInstances((instances) =>
      instances.map((deer) => {
        let newDeer = { ...deer };

        // Update state timer
        newDeer.stateTimer += delta;

        // Check if it's time to change state
        if (newDeer.stateTimer >= newDeer.nextStateChange) {
          // Pick random new state
          const states: AIState[] = ["idle", "walking", "eating"];
          const currentIndex = states.indexOf(newDeer.aiState);
          const availableStates = states.filter((_, i) => i !== currentIndex);
          const newState =
            availableStates[Math.floor(Math.random() * availableStates.length)];

          newDeer.aiState = newState;
          newDeer.stateTimer = 0;
          newDeer.nextStateChange =
            minStateDuration +
            Math.random() * (maxStateDuration - minStateDuration);

          // If entering walking state, pick random direction
          if (newState === "walking") {
            newDeer.targetRotation = Math.random() * Math.PI * 2;
          }
        }

        // WALKING behavior
        if (newDeer.aiState === "walking") {
          // Smooth rotation toward target
          const rotDiff = newDeer.targetRotation - newDeer.rotation;
          const rotStep = rotationSpeed * delta;

          if (Math.abs(rotDiff) > 0.01) {
            let normalizedDiff = rotDiff;
            while (normalizedDiff > Math.PI) normalizedDiff -= Math.PI * 2;
            while (normalizedDiff < -Math.PI) normalizedDiff += Math.PI * 2;

            const rotChange =
              Math.sign(normalizedDiff) *
              Math.min(Math.abs(normalizedDiff), rotStep);
            newDeer.rotation += rotChange;
          }

          // Move forward with individual speed variation
          const moveAmount = walkSpeed * deer.speed.x * delta;
          const newX =
            newDeer.position.x + Math.sin(newDeer.rotation) * moveAmount;
          const newZ =
            newDeer.position.z + Math.cos(newDeer.rotation) * moveAmount;

          // Boundary checking
          if (Math.abs(newX) > mapBoundary || Math.abs(newZ) > mapBoundary) {
            newDeer.targetRotation = newDeer.rotation + Math.PI;
          } else {
            newDeer.position = new THREE.Vector3(newX, 0, newZ);
          }
        }

        return newDeer;
      })
    );
  });

  if (!enabled) return null;

  return (
    <>
      {deerInstances.map((deer) => (
        <DeerWithAnimation
          key={deer.id}
          deer={deer}
          animations={animations}
          deerScale={deerScale}
          castShadow={castShadow}
          receiveShadow={receiveShadow}
          enableAI={enableAI}
        />
      ))}
    </>
  );
};

// Individual deer component with animation
const DeerWithAnimation: React.FC<{
  deer: DeerInstance;
  animations: THREE.AnimationClip[];
  deerScale: number;
  castShadow: boolean;
  receiveShadow: boolean;
  enableAI: boolean;
}> = ({ deer, animations, deerScale, castShadow, receiveShadow, enableAI }) => {
  const { actions } = useAnimations(animations, deer.groupRef);

  // Play animation based on AI state
  useEffect(() => {
    if (!enableAI || !actions) return;

    let animationName: AnimationName;

    switch (deer.aiState) {
      case "walking":
        animationName = "Walk";
        break;
      case "eating":
        animationName = "Eating";
        break;
      case "idle":
      default:
        animationName = "Idle_2";
        break;
    }

    // Stop all animations
    Object.values(actions).forEach((action) => {
      action?.stop();
    });

    // Play selected animation
    const selectedAction = actions[animationName];
    if (selectedAction) {
      selectedAction.reset();
      selectedAction.fadeIn(0.3);
      selectedAction.play();
    }

    return () => {
      selectedAction?.fadeOut(0.3);
    };
  }, [deer.aiState, actions, enableAI]);

  return (
    <Deer
      ref={deer.groupRef}
      position={[deer.position.x, 0, deer.position.z]}
      rotation={[0, deer.rotation, 0]}
      scale={deerScale}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
};

export default DeerHerd;
