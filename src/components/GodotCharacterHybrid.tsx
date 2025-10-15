// Hybrid approach: Rapier for physics + BVH for ground detection
import React, { useEffect, useRef, useState } from "react";
import { useKeyboardControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, useRapier } from "@react-three/rapier";
import { useControls, folder } from "leva";
import { MathUtils, Vector3, Matrix4, Line3, Box3 } from "three";
import { degToRad } from "three/src/math/MathUtils.js";
import { GodotCharacter } from "./GodotCharacter";
import type * as THREE from "three";

const normalizeAngle = (angle: number) => {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
};

const lerpAngle = (start: number, end: number, t: number) => {
  start = normalizeAngle(start);
  end = normalizeAngle(end);

  if (Math.abs(end - start) > Math.PI) {
    if (end > start) {
      start += 2 * Math.PI;
    } else {
      end += 2 * Math.PI;
    }
  }

  return normalizeAngle(start + (end - start) * t);
};

interface Props {
  position?: [number, number, number];
  cameraMode?: string;
  collider?: THREE.Mesh | null;
  onPositionChange?: (position: [number, number, number]) => void;
  onVelocityChange?: (velocity: [number, number, number]) => void;
}

export const GodotCharacterHybrid = ({
  position = [0, 2, 0],
  cameraMode = "orbit",
  collider = null,
  onPositionChange,
  onVelocityChange,
}: Props) => {
  // Access Rapier world for raycasting dynamic objects
  const { world, rapier } = useRapier();

  const {
    WALK_SPEED,
    RUN_SPEED,
    ROTATION_SPEED,
    JUMP_FORCE,
    cameraX,
    cameraY,
    cameraZ,
    targetZ,
    cameraLerpSpeed,
    capsuleHeight,
    capsuleRadius,
  } = useControls("🎮 GODOT CHARACTER", {
    control: folder(
      {
        WALK_SPEED: { value: 1.8, min: 0.1, max: 4, step: 0.1 },
        RUN_SPEED: { value: 4, min: 0.2, max: 12, step: 0.1 },
        ROTATION_SPEED: {
          value: degToRad(0.5),
          min: degToRad(0.1),
          max: degToRad(5),
          step: degToRad(0.1),
        },
        JUMP_FORCE: { value: 6, min: 1, max: 10, step: 0.1 },
      },
      { collapsed: true }
    ),
    camera: folder(
      {
        cameraX: { value: 0, min: -10, max: 10, step: 0.1 },
        cameraY: { value: 1.5, min: 0, max: 10, step: 0.1 },
        cameraZ: { value: -5.6, min: -10, max: 2, step: 0.1 },
        targetZ: { value: 5, min: -2, max: 5, step: 0.1 },
        cameraLerpSpeed: { value: 0.1, min: 0.01, max: 0.5, step: 0.01 },
      },
      { collapsed: true }
    ),
    capsule: folder(
      {
        capsuleHeight: {
          value: 1.4,
          min: 0.5,
          max: 2.0,
          step: 0.05,
          label: "Capsule Total Height",
        },
        capsuleRadius: {
          value: 0.3,
          min: 0.05,
          max: 0.3,
          step: 0.01,
          label: "Capsule Radius",
        },
      },
      { collapsed: true }
    ),
  });

  const rb = useRef<any>(null);
  const container = useRef<any>(null);
  const character = useRef<any>(null);
  const [animation, setAnimation] = useState("idle");
  const [isGrounded, setIsGrounded] = useState(true);
  const wasGrounded = useRef(false);
  const jumpPhase = useRef<"none" | "start" | "loop" | "land">("none");
  const [combatMode, setCombatMode] = useState(false);
  const isAttacking = useRef(false);

  const characterRotationTarget = useRef(0);
  const rotationTarget = useRef(0);
  const cameraTarget = useRef<any>(null);
  const cameraPosition = useRef<any>(null);
  const cameraWorldPosition = useRef(new Vector3());
  const cameraLookAtWorldPosition = useRef(new Vector3());
  const cameraLookAt = useRef(new Vector3());
  const [, get] = useKeyboardControls();
  const jumpPressed = useRef(false);
  const cameraInitialized = useRef(false);
  const isCrouchingRef = useRef(false);
  const crouchTransitioningRef = useRef(false);
  const ceilingClearanceTimer = useRef(0);

  // BVH temps
  const tempBox = useRef(new Box3());
  const tempMat = useRef(new Matrix4());
  const tempSegment = useRef(new Line3());
  const tempVector = useRef(new Vector3());
  const tempVector2 = useRef(new Vector3());

  // Combat mode toggle - R key (E is used for dance)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") {
        setCombatMode((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Mouse attack handlers
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (!combatMode || isAttacking.current) return;

      isAttacking.current = true;

      if (e.button === 0) {
        // Left click - primary attack
        setAnimation("swordAttack");
        setTimeout(() => {
          isAttacking.current = false;
        }, 600); // Attack duration
      } else if (e.button === 2) {
        // Right click - secondary attack
        setAnimation("swordAttackAlt");
        setTimeout(() => {
          isAttacking.current = false;
        }, 600);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (combatMode) {
        e.preventDefault(); // Prevent right-click menu in combat mode
      }
    };

    if (combatMode) {
      window.addEventListener("mousedown", handleMouseDown);
      window.addEventListener("contextmenu", handleContextMenu);
    }

    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [combatMode]);

  // BVH-based ground detection - checks surface normal (STATIC GEOMETRY)
  const checkGroundedBVH = () => {
    if (!rb.current || !collider || !collider.geometry.boundsTree) return false;

    try {
      const position = rb.current.translation();
      const vel = rb.current.linvel();
      if (!vel) return false;

      // Create capsule segment in world space
      const tempSeg = tempSegment.current;
      tempSeg.start.set(position.x, position.y + capsuleRadius, position.z);
      tempSeg.end.set(
        position.x,
        position.y - capsuleHeight / 2 - capsuleRadius,
        position.z
      );

      // Transform to collider local space
      tempMat.current.copy(collider.matrixWorld).invert();
      tempSeg.start.applyMatrix4(tempMat.current);
      tempSeg.end.applyMatrix4(tempMat.current);

      // Create bounding box
      tempBox.current.makeEmpty();
      tempBox.current.expandByPoint(tempSeg.start);
      tempBox.current.expandByPoint(tempSeg.end);
      tempBox.current.min.addScalar(-capsuleRadius);
      tempBox.current.max.addScalar(capsuleRadius);

      let hitGround = false;

      // BVH shapecast to find closest surface
      collider.geometry.boundsTree.shapecast({
        intersectsBounds: (box: any) => box.intersectsBox(tempBox.current),

        intersectsTriangle: (tri: any) => {
          const triPoint = tempVector.current;
          const capsulePoint = tempVector2.current;

          const distance = tri.closestPointToSegment(
            tempSeg,
            triPoint,
            capsulePoint
          );

          if (distance < capsuleRadius + 0.2) {
            // Get triangle normal
            tri.getNormal(tempVector.current);
            const normal = tempVector.current;

            // If normal points up (> 0.7), it's ground
            if (normal.y > 0.7) {
              hitGround = true;
            }
          }

          return false;
        },
      });

      return hitGround;
    } catch (error) {
      console.error("BVH ground check error:", error);
      return false;
    }
  };

  // Rapier raycast for ALL objects (static ground + dynamic cubes)
  const checkGroundedRapier = () => {
    if (!rb.current || !world || !rapier) return false;

    try {
      const position = rb.current.translation();

      // Use current capsule height (accounts for crouch)
      const currentHalfHeight = isCrouchingRef.current
        ? (capsuleHeight * 0.5) / 2
        : capsuleHeight / 2;

      // Cast ray from slightly above character feet downward
      const rayOrigin = {
        x: position.x,
        y: position.y - currentHalfHeight - capsuleRadius + 0.05, // Start just above feet
        z: position.z,
      };
      const rayDirection = { x: 0, y: -1, z: 0 };
      // Short ray - only check immediate ground
      const rayLength = 0.2; // 20cm detection range

      // Create Ray object
      const ray = new rapier.Ray(rayOrigin, rayDirection);

      // Cast ray - EXCLUDE the character's own collider
      // Parameters: ray, maxToi, solid, filterFlags, filterGroups, filterExcludeCollider, filterExcludeRigidBody, filterPredicate
      const hit = world.castRay(
        ray,
        rayLength,
        true, // solid (stop at first hit)
        undefined, // filterFlags
        undefined, // filterGroups
        undefined, // filterExcludeCollider
        rb.current, // filterExcludeRigidBody - EXCLUDE CHARACTER!
        undefined // filterPredicate
      );

      if (hit && hit.timeOfImpact !== undefined) {
        // Check if hit is close to feet (not hitting something far away)
        const hitDistance = hit.timeOfImpact;

        // Only count as grounded if hit is within the ray length
        if (hitDistance <= rayLength) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error("Rapier raycast error:", error);
      return false;
    }
  };

  // Check if there's COMFORTABLE space above to stand up (ceiling detection with buffer)
  const checkCeilingClearance = () => {
    if (!rb.current || !world || !rapier) return true;

    try {
      const position = rb.current.translation();
      const crouchHalfHeight = (capsuleHeight * 0.5) / 2;
      const standingHalfHeight = capsuleHeight / 2;

      // Cast ray UPWARD from top of crouched capsule
      const rayOrigin = {
        x: position.x,
        y: position.y + crouchHalfHeight + capsuleRadius,
        z: position.z,
      };
      const rayDirection = { x: 0, y: 1, z: 0 };
      // Check for COMFORTABLE clearance - larger buffer for safety
      const safetyBuffer = 0.5; // 50cm comfort zone!
      const rayLength = standingHalfHeight - crouchHalfHeight + safetyBuffer;

      const ray = new rapier.Ray(rayOrigin, rayDirection);
      const hit = world.castRay(
        ray,
        rayLength,
        true,
        undefined,
        undefined,
        undefined,
        rb.current,
        undefined
      );

      // If hit something above, NO comfortable clearance to stand
      if (hit) {
        return false;
      }

      return true; // Comfortable clearance - safe to stand!
    } catch (error) {
      console.error("Ceiling check error:", error);
      return true; // Default to allowing stand
    }
  };

  useFrame(({ camera }, delta) => {
    if (rb.current) {
      const vel = rb.current.linvel();
      if (!vel) return;

      // Update position and velocity for external components (like leaves)
      if (onPositionChange) {
        const pos = rb.current.translation();
        onPositionChange([pos.x, pos.y, pos.z]);
      }

      if (onVelocityChange) {
        onVelocityChange([vel.x, vel.y, vel.z]);
      }

      // Get crouch input FIRST (needed for ground detection)
      const crouchInput = get().crouch;

      // SIMPLE GROUND DETECTION - Rapier ONLY (pass current crouch state)
      let grounded = checkGroundedRapier();

      // FORCE grounded during crouch transitions to prevent fall animations
      if (crouchTransitioningRef.current) {
        grounded = true;
      }

      setIsGrounded(grounded);

      // Get other input states
      const danceInput = get().dance;

      // Handle crouch input and update capsule state FIRST
      // FORCED CROUCH WITH DELAY: Only delay when auto-standing from forced crouch
      // ONLY check ceiling if already crouching (prevents auto-crouch when walking under objects)
      const hasCeilingClearance = isCrouchingRef.current
        ? checkCeilingClearance()
        : true;

      // Timer management for forced crouch
      if (crouchInput) {
        // Manual crouch - disable timer
        ceilingClearanceTimer.current = -1;
      } else if (!hasCeilingClearance && isCrouchingRef.current) {
        // Under ceiling (forced crouch) - set timer to 0 (ready to start)
        ceilingClearanceTimer.current = 0;
      } else if (
        hasCeilingClearance &&
        isCrouchingRef.current &&
        ceilingClearanceTimer.current >= 0
      ) {
        // Has clearance now - start counting
        ceilingClearanceTimer.current += delta;
      } else if (!isCrouchingRef.current) {
        // Standing - reset timer
        ceilingClearanceTimer.current = -1;
      }

      // Stand up delay - ONLY applies when exiting forced crouch
      const standUpDelay = 0.5; // 500ms delay for stability

      let shouldBeCrouched;
      if (crouchInput) {
        // Manual crouch - immediate, no delay
        shouldBeCrouched = true;
        ceilingClearanceTimer.current = -1; // Reset timer
      } else if (!hasCeilingClearance) {
        // Ceiling blocking - forced crouch
        shouldBeCrouched = true;
      } else if (
        ceilingClearanceTimer.current >= 0 &&
        ceilingClearanceTimer.current < standUpDelay
      ) {
        // Exiting forced crouch - apply delay
        shouldBeCrouched = true;
      } else {
        // All other cases - stand up
        shouldBeCrouched = false;
      }

      // Landing detection
      if (!wasGrounded.current && grounded) {
        jumpPhase.current = "land";
        setAnimation("jumpLand");
        setTimeout(() => {
          if (jumpPhase.current === "land") {
            jumpPhase.current = "none";
          }
        }, 300);
      }

      // If in air and not in jump phase, set to loop (unless crouching or transitioning)
      if (
        !grounded &&
        jumpPhase.current === "none" &&
        !shouldBeCrouched &&
        !crouchTransitioningRef.current
      ) {
        jumpPhase.current = "loop";
        setAnimation("jumpLoop");
      }

      wasGrounded.current = grounded;

      const movement: any = { x: 0, z: 0 };

      // Handle dance input
      if (danceInput) {
        setAnimation("dance");
        movement.x = 0;
        movement.z = 0;
      }

      // Update capsule size when crouch state changes

      if (shouldBeCrouched !== isCrouchingRef.current) {
        const currentPos = rb.current.translation();
        const standingHalfHeight = capsuleHeight / 2;
        const crouchHalfHeight = (capsuleHeight * 0.5) / 2;
        const heightDiff = standingHalfHeight - crouchHalfHeight;

        // Set transitioning flag to prevent jump animations
        crouchTransitioningRef.current = true;

        // Reset jump phase to prevent fall animation
        jumpPhase.current = "none";

        setTimeout(() => {
          crouchTransitioningRef.current = false;
        }, 200); // 200ms grace period

        if (shouldBeCrouched) {
          // Crouching: move body DOWN
          rb.current.setTranslation(
            { x: currentPos.x, y: currentPos.y - heightDiff, z: currentPos.z },
            true
          );
        } else {
          // Standing up: move body UP (only if clearance!)
          rb.current.setTranslation(
            { x: currentPos.x, y: currentPos.y + heightDiff, z: currentPos.z },
            true
          );

          // Force idle animation when standing up
          setAnimation("idle");
        }

        // Update ref immediately (not async)
        isCrouchingRef.current = shouldBeCrouched;
      }

      // Movement input FIRST (before jump)
      if (get().forward) movement.z = 1;
      if (get().backward) movement.z = -1;
      if (get().left) movement.x = 1;
      if (get().right) movement.x = -1;

      // Q key: Classic walk backward
      const walkBackwardInput = get().walkBackward;
      if (walkBackwardInput) {
        movement.z = -1;
        movement.walkBackwardMode = true;
      }

      if (movement.x !== 0) {
        rotationTarget.current += ROTATION_SPEED * movement.x;
      }

      // Adjust speed based on run/crouch (use actual crouch state, not just input)
      let speed = get().run ? RUN_SPEED : WALK_SPEED;
      if (shouldBeCrouched) {
        speed = WALK_SPEED * 0.5; // Crouch walk is slower
      }

      if (movement.x !== 0 || movement.z !== 0) {
        if (movement.walkBackwardMode) {
          characterRotationTarget.current = Math.atan2(movement.x, 1);
        } else {
          characterRotationTarget.current = Math.atan2(movement.x, movement.z);
        }

        let intendedVelX =
          Math.sin(rotationTarget.current + characterRotationTarget.current) *
          speed;
        let intendedVelZ =
          Math.cos(rotationTarget.current + characterRotationTarget.current) *
          speed;

        if (movement.walkBackwardMode && movement.z < 0) {
          intendedVelX = -intendedVelX;
          intendedVelZ = -intendedVelZ;
        }

        // Apply velocity only when grounded OR when initiating jump
        if (grounded) {
          vel.x = intendedVelX;
          vel.z = intendedVelZ;
        }
        // When not grounded, don't touch velocity - let Rapier handle it

        // JUMP: Check if jumping this frame - apply horizontal momentum
        const jumpInput = get().jump;
        if (jumpInput && grounded && !jumpPressed.current) {
          jumpPressed.current = true;
          vel.y = JUMP_FORCE;
          // Apply horizontal velocity for forward jumping!
          vel.x = intendedVelX;
          vel.z = intendedVelZ;

          jumpPhase.current = "start";
          setAnimation("jumpStart");

          setTimeout(() => {
            if (jumpPhase.current === "start") {
              jumpPhase.current = "loop";
              setAnimation("jumpLoop");
            }
          }, 200);
        } else if (!jumpInput) {
          jumpPressed.current = false;
        }

        if (
          grounded &&
          jumpPhase.current === "none" &&
          !danceInput &&
          !isAttacking.current
        ) {
          if (shouldBeCrouched) {
            setAnimation("crouchWalk");
          } else if (combatMode) {
            // Combat mode - use sword idle while moving (or could add sword walk)
            setAnimation("swordIdle");
          } else if (speed === RUN_SPEED) {
            setAnimation("run");
          } else if (movement.walkBackwardMode) {
            setAnimation("walkBackwards");
          } else {
            setAnimation("walk");
          }
        }
      } else {
        // No movement input

        if (grounded) {
          vel.x *= 0.85;
          vel.z *= 0.85;

          if (Math.abs(vel.x) < 0.01) vel.x = 0;
          if (Math.abs(vel.z) < 0.01) vel.z = 0;
        }

        // JUMP: Handle jumping when standing still
        const jumpInput = get().jump;
        if (jumpInput && grounded && !jumpPressed.current) {
          jumpPressed.current = true;
          vel.y = JUMP_FORCE;
          // No horizontal velocity - jump straight up

          jumpPhase.current = "start";
          setAnimation("jumpStart");

          setTimeout(() => {
            if (jumpPhase.current === "start") {
              jumpPhase.current = "loop";
              setAnimation("jumpLoop");
            }
          }, 200);
        } else if (!jumpInput) {
          jumpPressed.current = false;
        }

        if (
          grounded &&
          jumpPhase.current === "none" &&
          !danceInput &&
          !isAttacking.current
        ) {
          if (shouldBeCrouched) {
            setAnimation("crouchIdle");
          } else if (combatMode) {
            setAnimation("swordIdle");
          } else {
            setAnimation("idle");
          }
        }
      }

      if (character.current) {
        character.current.rotation.y = lerpAngle(
          character.current.rotation.y,
          characterRotationTarget.current,
          0.1
        );
      }

      rb.current.setLinvel(vel, true);
    }

    // CAMERA
    if (cameraMode === "follow") {
      container.current.rotation.y = MathUtils.lerp(
        container.current.rotation.y,
        rotationTarget.current,
        cameraLerpSpeed
      );

      cameraPosition.current.getWorldPosition(cameraWorldPosition.current);

      const isFirstFrame = !cameraInitialized.current;

      if (isFirstFrame) {
        camera.position.copy(cameraWorldPosition.current);
      } else {
        camera.position.lerp(cameraWorldPosition.current, cameraLerpSpeed);
      }

      if (cameraTarget.current) {
        cameraTarget.current.getWorldPosition(
          cameraLookAtWorldPosition.current
        );

        if (isFirstFrame) {
          cameraLookAt.current.copy(cameraLookAtWorldPosition.current);
        } else {
          cameraLookAt.current.lerp(
            cameraLookAtWorldPosition.current,
            cameraLerpSpeed
          );
        }

        camera.lookAt(cameraLookAt.current);
      }

      if (isFirstFrame) {
        cameraInitialized.current = true;
      }
    }
  });

  return (
    <RigidBody
      colliders={false}
      ref={rb}
      position={position}
      gravityScale={1}
      enabledRotations={[false, false, false]}
      type="dynamic"
      ccd={true}
    >
      <group ref={container}>
        <group ref={cameraTarget} position-z={targetZ} />
        <group ref={cameraPosition} position={[cameraX, cameraY, cameraZ]} />
        <group
          ref={character}
          position-y={
            isCrouchingRef.current
              ? capsuleHeight / 2 - (capsuleHeight * 0.5) / 2
              : 0
          }
        >
          <GodotCharacter animation={animation} />
        </group>
      </group>
      <CapsuleCollider
        args={[
          isCrouchingRef.current
            ? (capsuleHeight * 0.5) / 2
            : capsuleHeight / 2,
          capsuleRadius,
        ]}
        friction={0}
        restitution={0}
      />
    </RigidBody>
  );
};
