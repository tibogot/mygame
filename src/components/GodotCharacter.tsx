import { useAnimations, useGLTF } from "@react-three/drei";
import React, { useEffect, useRef, useMemo } from "react";
import { useFrame, useGraph } from "@react-three/fiber";
import { useControls } from "leva";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";

interface GodotCharacterProps {
  animation?: string;
  [key: string]: any;
}

export function GodotCharacter({ animation, ...props }: GodotCharacterProps) {
  const group = useRef<THREE.Group>(null);
  const animationGroup = useRef<THREE.Group>(null);

  // Load the model
  const { scene, animations } = useGLTF(
    "/models/AnimationLibrary_Godot_Standard-transformed.glb"
  );

  // Clone the scene properly with skeleton
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { nodes, materials } = useGraph(clone) as any;

  const { actions, mixer } = useAnimations(animations, animationGroup);

  // Character controls
  const { yPosition, showDebug, characterScaleDisplay } = useControls(
    "Godot Character",
    {
      yPosition: {
        value: -0.99,
        min: -2,
        max: 2,
        step: 0.01,
        label: "Feet Position - Align feet with capsule bottom",
      },
      characterScaleDisplay: {
        value: 1,
        min: 0.1,
        max: 5,
        step: 0.1,
        label: "Character Visual Scale (1 = realistic)",
      },
      showDebug: {
        value: false,
        label: "Show Alignment Markers (Orange=Ground)",
      },
    }
  );

  // Use the character scale directly (no conversion needed)
  const characterScale = characterScaleDisplay;

  // Log available animations and nodes once
  useEffect(() => {
    console.log("=== GODOT CHARACTER INFO ===");
    console.log("Character scale:", characterScaleDisplay);
    console.log("Character yPosition:", yPosition);

    // Check character bounding box for real-world size
    if (nodes.Mannequin_1) {
      nodes.Mannequin_1.geometry.computeBoundingBox();
      const bbox = nodes.Mannequin_1.geometry.boundingBox;
      if (bbox) {
        const height = (bbox.max.y - bbox.min.y) * characterScaleDisplay;
        const width = (bbox.max.x - bbox.min.x) * characterScaleDisplay;
        console.log(
          `Character mesh dimensions at scale ${characterScaleDisplay}:`
        );
        console.log(`  Height: ${height.toFixed(2)}m`);
        console.log(`  Width: ${width.toFixed(2)}m`);
        console.log(`  Expected: Human ~1.7-1.8m tall, ~0.5m wide`);
        if (height < 1.5 || height > 2.0) {
          console.warn(
            `⚠️ Character height ${height.toFixed(
              2
            )}m is NOT realistic! Adjust scale.`
          );
        } else {
          console.log(`✅ Character height is realistic!`);
        }
      }
    }

    console.log(
      "Available animations:",
      animations.map((anim) => anim.name)
    );
  }, [animations, nodes, characterScaleDisplay, yPosition]);

  // Animation mapping - map our animation names to Godot animation names
  const animationMap: { [key: string]: string } = {
    idle: "Idle_Loop",
    walk: "Walk_Loop",
    run: "Sprint_Loop",
    walkBackwards: "Walk_Loop", // No backwards walk, use regular walk
    leftTurn: "Walk_Loop",
    rightTurn: "Walk_Loop",
    dance: "Dance_Loop",
    jumpStart: "Jump_Start",
    jumpLoop: "Jump_Loop",
    jumpLand: "Jump_Land",
    crouchIdle: "Crouch_Idle_Loop",
    crouchWalk: "Crouch_Fwd_Loop",
    // Combat animations
    swordIdle: "Sword_Idle",
    swordAttack: "Sword_Attack",
    swordAttackAlt: "Sword_Attack_RM",
  };

  const currentAnimationRef = useRef<string | null>(null);

  // Force reset position every frame to prevent sliding
  useFrame(() => {
    if (animationGroup.current) {
      animationGroup.current.position.set(0, yPosition, 0);
      animationGroup.current.rotation.set(0, 0, 0);
    }
  });

  useEffect(() => {
    if (actions && animation && animationGroup.current) {
      const mappedAnimation = animationMap[animation] || animationMap.idle;

      console.log(
        `Godot Animation requested: ${animation} -> ${mappedAnimation}`
      );

      if (currentAnimationRef.current !== mappedAnimation) {
        const previousAction = currentAnimationRef.current
          ? actions[currentAnimationRef.current]
          : null;
        const nextAction = actions[mappedAnimation];

        if (nextAction) {
          console.log(`Playing animation: ${mappedAnimation}`);

          // If there was a previous animation, fade it out
          if (previousAction) {
            previousAction.fadeOut(0.2);
          }

          // Fade in the new animation
          nextAction
            .reset()
            .setEffectiveTimeScale(1)
            .setEffectiveWeight(1)
            .fadeIn(0.2)
            .play();

          currentAnimationRef.current = mappedAnimation;
        } else {
          console.warn(`Animation ${mappedAnimation} not found!`);
          // Fallback to Idle_Loop if mapping doesn't exist
          if (actions["Idle_Loop"]) {
            console.log("Falling back to Idle_Loop");
            if (previousAction) {
              previousAction.fadeOut(0.2);
            }
            actions["Idle_Loop"].reset().fadeIn(0.2).play();
            currentAnimationRef.current = "Idle_Loop";
          }
        }
      }
    }
  }, [animation, actions, animationMap]);

  return (
    <group ref={group} {...props}>
      {/* Visual Debug markers */}
      {showDebug && (
        <>
          {/* Character center marker (chest level) */}
          <mesh position={[0, yPosition + 0.9, 0]}>
            <boxGeometry args={[0.1, 0.1, 0.1]} />
            <meshBasicMaterial color="blue" />
          </mesh>

          {/* Character feet marker */}
          <mesh position={[0, yPosition, 0]}>
            <sphereGeometry args={[0.05]} />
            <meshBasicMaterial color="green" />
          </mesh>

          {/* Ground level marker (0,0,0) */}
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.02]} />
            <meshBasicMaterial color="orange" />
          </mesh>
        </>
      )}

      {/* Animation group */}
      <group
        ref={animationGroup}
        position={[0, yPosition, 0]}
        scale={characterScale}
      >
        <group name="Scene">
          <group name="Rig">
            {nodes.root && <primitive object={nodes.root} />}
          </group>
          <group name="Mannequin">
            {nodes.Mannequin_1 && (
              <skinnedMesh
                name="Mannequin_1"
                geometry={nodes.Mannequin_1.geometry}
                material={materials?.M_Main || nodes.Mannequin_1.material}
                skeleton={nodes.Mannequin_1.skeleton}
                castShadow
                receiveShadow
                frustumCulled={false}
              />
            )}
            {nodes.Mannequin_2 && (
              <skinnedMesh
                name="Mannequin_2"
                geometry={nodes.Mannequin_2.geometry}
                material={materials?.M_Joints || nodes.Mannequin_2.material}
                skeleton={nodes.Mannequin_2.skeleton}
                castShadow
                receiveShadow
                frustumCulled={false}
              />
            )}
          </group>
        </group>
      </group>
    </group>
  );
}

useGLTF.preload("/models/AnimationLibrary_Godot_Standard-transformed.glb");
