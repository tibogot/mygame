/*
YbotCharacter with physics collision debug visualization
Helps align character with physics capsule properly
*/

import { useAnimations, useGLTF } from "@react-three/drei";
import React, { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useControls } from "leva";

export function YbotCharacterPhysicsDebug({ animation, ...props }) {
  const group = useRef();
  const animationGroup = useRef();
  const { nodes, materials, animations } = useGLTF("/models/ybot.glb");
  const { actions, mixer } = useAnimations(animations, animationGroup);

  // Enhanced controls with physics debug
  const {
    yPosition,
    showDebug,
    showPhysicsDebug,
    characterScaleDisplay,
    capsuleHeight,
    capsuleRadius,
  } = useControls("Ybot Character", {
    yPosition: {
      value: -0.25,
      min: -0.5,
      max: 0.5,
      step: 0.01,
      label: "Character Feet Position",
    },
    characterScaleDisplay: {
      value: 10,
      min: 5,
      max: 30,
      step: 0.1,
      label: "Character Scale (x1000)",
    },
    showDebug: { value: false },
    showPhysicsDebug: {
      value: false,
      label: "Show Physics Capsule",
    },
    capsuleHeight: {
      value: 1.8,
      min: 0.5,
      max: 3.0,
      step: 0.1,
      label: "Capsule Height (Physics)",
    },
    capsuleRadius: {
      value: 0.3,
      min: 0.1,
      max: 0.8,
      step: 0.05,
      label: "Capsule Radius (Physics)",
    },
  });

  // Convert display scale to actual scale
  const characterScale = characterScaleDisplay / 1000;

  // Debug: Log yPosition changes
  // console.log("Character yPosition:", yPosition);

  // Log available animations once
  useEffect(() => {
    console.log(
      "Available ybot animations:",
      animations.map((anim) => anim.name)
    );
  }, [animations]);

  // Animation mapping - all available animations from ybot.glb
  const animationMap = {
    idle: "Idle",
    walk: "WalkingForwards",
    run: "Running",
    walkBackwards: "WalkingBackwards",
    leftTurn: "LeftTurn",
    rightTurn: "RightTurn",
    dance: "Dance",
    jump: "T-Pose (No Animation)", // Keep this for now until we find a proper jump animation
  };

  const currentAnimationRef = useRef(null);

  // Force reset position every frame to prevent sliding, but respect yPosition
  useFrame(() => {
    if (animationGroup.current) {
      animationGroup.current.position.set(0, yPosition, 0);
      animationGroup.current.rotation.set(0, 0, 0);
    }
  });

  useEffect(() => {
    if (actions && animation) {
      const mappedAnimation = animationMap[animation] || animationMap.idle;

      if (currentAnimationRef.current !== mappedAnimation) {
        // Stop all animations
        Object.values(actions).forEach((action) => {
          action?.stop();
        });

        // Start new animation
        if (actions[mappedAnimation]) {
          actions[mappedAnimation].reset().play();
          currentAnimationRef.current = mappedAnimation;
        }
      }
    }
  }, [animation, actions]);

  if (!nodes || !materials) {
    return null;
  }

  return (
    <group ref={group} {...props}>
      {/* Physics Capsule Visualization - FULL SIZE (not affected by character scale) */}
      {showPhysicsDebug && (
        <group position={[0, 0, 0]}>
          {/* No additional scaling needed - show actual physics size */}
          <group scale={1}>
            {/* Capsule body */}
            <mesh position={[0, capsuleHeight / 2, 0]}>
              <cylinderGeometry
                args={[capsuleRadius, capsuleRadius, capsuleHeight]}
              />
              <meshBasicMaterial
                color="red"
                wireframe
                opacity={0.7}
                transparent
              />
            </mesh>

            {/* Top sphere */}
            <mesh position={[0, capsuleHeight, 0]}>
              <sphereGeometry args={[capsuleRadius]} />
              <meshBasicMaterial
                color="red"
                wireframe
                opacity={0.5}
                transparent
              />
            </mesh>

            {/* Bottom sphere */}
            <mesh position={[0, 0, 0]}>
              <sphereGeometry args={[capsuleRadius]} />
              <meshBasicMaterial
                color="red"
                wireframe
                opacity={0.5}
                transparent
              />
            </mesh>

            {/* Ground level indicator - at the very bottom of the capsule sphere */}
            <mesh position={[0, -capsuleRadius, 0]}>
              <cylinderGeometry args={[capsuleRadius, capsuleRadius, 0.005]} />
              <meshBasicMaterial color="yellow" opacity={0.8} transparent />
            </mesh>
          </group>

          {/* Physics capsule outline (solid for better visibility) */}
          <group scale={1}>
            <mesh position={[0, capsuleHeight / 2, 0]}>
              <cylinderGeometry
                args={[capsuleRadius, capsuleRadius, capsuleHeight]}
              />
              <meshBasicMaterial color="red" opacity={0.2} transparent />
            </mesh>
          </group>
        </group>
      )}

      {/* Visual Debug markers - properly sized */}
      {showDebug && (
        <>
          {/* Character center marker (at character's chest level) */}
          <mesh position={[0, yPosition + 0.9, 0]}>
            <boxGeometry args={[0.1, 0.1, 0.1]} />
            <meshBasicMaterial color="blue" />
          </mesh>

          {/* Character feet level marker - at ground contact level */}
          <mesh position={[0, -capsuleRadius, 0]}>
            <sphereGeometry args={[0.05]} />
            <meshBasicMaterial color="green" />
          </mesh>

          {/* Ground level marker (where physics capsule actually touches ground) */}
          <mesh position={[0, -capsuleRadius, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.02]} />
            <meshBasicMaterial color="orange" />
          </mesh>
        </>
      )}

      {/* Animation group - adjust yPosition until character feet align with green sphere */}
      <group
        ref={animationGroup}
        position={[0, yPosition, 0]}
        scale={characterScale}
      >
        {nodes.mixamorigHips && <primitive object={nodes.mixamorigHips} />}

        {nodes.Alpha_Surface && (
          <skinnedMesh
            name="Alpha_Surface"
            geometry={nodes.Alpha_Surface.geometry}
            material={materials.Alpha_Body_MAT}
            skeleton={nodes.Alpha_Surface.skeleton}
            castShadow
            receiveShadow
            frustumCulled={false}
          />
        )}

        {nodes.Alpha_Joints && (
          <skinnedMesh
            name="Alpha_Joints"
            geometry={nodes.Alpha_Joints.geometry}
            material={materials.Alpha_Joints_MAT}
            skeleton={nodes.Alpha_Joints.skeleton}
            castShadow
            receiveShadow
            frustumCulled={false}
          />
        )}
      </group>
    </group>
  );
}

useGLTF.preload("/models/ybot.glb");
