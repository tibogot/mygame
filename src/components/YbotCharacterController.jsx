import { useKeyboardControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, useRapier } from "@react-three/rapier";
import { useControls } from "leva";
import { useEffect, useRef, useState } from "react";
import { MathUtils, Vector3, Ray } from "three";
import { degToRad } from "three/src/math/MathUtils.js";
import { YbotCharacterPhysicsDebug } from "./YbotCharacterPhysicsDebug";

const normalizeAngle = (angle) => {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
};

const lerpAngle = (start, end, t) => {
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

export const YbotCharacterController = ({
  position = [0, 2, 0],
  cameraMode = "orbit",
  onRigidBodyRef,
  onPositionChange,
}) => {
  const {
    WALK_SPEED,
    RUN_SPEED,
    ROTATION_SPEED,
    JUMP_FORCE,
    GRAVITY,
    FRICTION,
  } = useControls("Ybot Character Control", {
    WALK_SPEED: { value: 1.8, min: 0.1, max: 4, step: 0.1 },
    RUN_SPEED: { value: 3.6, min: 0.2, max: 12, step: 0.1 },
    ROTATION_SPEED: {
      value: degToRad(0.5),
      min: degToRad(0.1),
      max: degToRad(5),
      step: degToRad(0.1),
    },
    JUMP_FORCE: { value: 4, min: 1, max: 10, step: 0.1 },
    GRAVITY: { value: 9.81, min: 1, max: 20, step: 0.1 },
    FRICTION: { value: 0.85, min: 0.1, max: 0.99, step: 0.01 },
  });

  // Camera position controls
  const {
    cameraX,
    cameraY,
    cameraZ,
    targetZ,
    cameraLerpSpeed,
    showCameraDebug,
  } = useControls("Follow Camera", {
    cameraX: { value: 0, min: -10, max: 10, step: 0.1 },
    cameraY: { value: 1.5, min: 0, max: 10, step: 0.1 },
    cameraZ: { value: -5.6, min: -10, max: 2, step: 0.1 },
    targetZ: { value: 5, min: -2, max: 5, step: 0.1 },
    cameraLerpSpeed: { value: 0.1, min: 0.01, max: 0.5, step: 0.01 },
    showCameraDebug: { value: false },
  });

  // Physics controls
  const { capsuleHeight, capsuleRadius } = useControls(
    "Ybot Physics Collision",
    {
      capsuleHeight: { value: 0.3, min: 0.1, max: 1.0, step: 0.05 },
      capsuleRadius: { value: 0.08, min: 0.02, max: 0.2, step: 0.01 },
    }
  );
  const rb = useRef();
  const container = useRef();
  const character = useRef();

  const [animation, setAnimation] = useState("idle");
  const [isGrounded, setIsGrounded] = useState(false);

  // Ensure idle animation plays on component mount
  useEffect(() => {
    setAnimation("idle");
  }, []);

  // Expose RigidBody reference to parent component
  useEffect(() => {
    if (onRigidBodyRef && rb.current) {
      console.log("YbotCharacterController: Exposing RigidBody ref to parent");
      onRigidBodyRef(rb);
    }
  }, [onRigidBodyRef]);

  const characterRotationTarget = useRef(0);
  const rotationTarget = useRef(0);
  const cameraTarget = useRef();
  const cameraPosition = useRef();
  const cameraWorldPosition = useRef(new Vector3());
  const cameraLookAtWorldPosition = useRef(new Vector3());
  const cameraLookAt = useRef(new Vector3());
  const [, get] = useKeyboardControls();
  const isClicking = useRef(false);
  const jumpPressed = useRef(false);
  const previousVelocity = useRef(new Vector3());
  const cameraInitialized = useRef(false); // Track if camera position is set

  const { world } = useRapier();
  const ray = useRef(new Ray());
  const rayOrigin = useRef(new Vector3());
  const rayDirection = useRef(new Vector3());

  // Ground detection function - improved version
  const checkGrounded = () => {
    if (!rb.current) return false;

    try {
      const vel = rb.current.linvel();
      if (!vel) return false;

      // More robust ground detection
      // Consider grounded if:
      // 1. Not falling fast (vel.y >= -0.5)
      // 2. Not rising fast (vel.y <= 0.5)
      // 3. OR if we're very close to the ground (this would need raycast in a real implementation)

      const isFalling = vel.y < -0.5;
      const isRising = vel.y > 0.5;

      // For now, use a more lenient approach
      // This should work better on slightly uneven terrain
      return !isFalling && !isRising;
    } catch (error) {
      console.warn("Ground detection error:", error);
      return false;
    }
  };

  // Wall detection function to prevent movement conflicts during jumps
  const checkWallCollision = (intendedMovement, currentVel) => {
    if (!rb.current) return false;

    try {
      // Simple approach: if we're trying to move but not actually moving much,
      // we're likely hitting a wall
      const intendedSpeed = Math.sqrt(
        intendedMovement.x * intendedMovement.x +
          intendedMovement.z * intendedMovement.z
      );
      const actualSpeed = Math.sqrt(
        currentVel.x * currentVel.x + currentVel.z * currentVel.z
      );

      // If we're trying to move fast but moving slowly, likely hitting a wall
      if (intendedSpeed > 0.5 && actualSpeed < intendedSpeed * 0.3) {
        return true;
      }

      return false;
    } catch (error) {
      console.warn("Wall detection error:", error);
      return false;
    }
  };

  // Mouse controls for character movement - only active in "follow" camera mode
  useEffect(() => {
    if (cameraMode === "follow") {
      const onMouseDown = (e) => {
        isClicking.current = true;
      };
      const onMouseUp = (e) => {
        isClicking.current = false;
      };
      document.addEventListener("mousedown", onMouseDown);
      document.addEventListener("mouseup", onMouseUp);
      // touch
      document.addEventListener("touchstart", onMouseDown);
      document.addEventListener("touchend", onMouseUp);
      return () => {
        document.removeEventListener("mousedown", onMouseDown);
        document.removeEventListener("mouseup", onMouseUp);
        document.removeEventListener("touchstart", onMouseDown);
        document.removeEventListener("touchend", onMouseUp);
        // Reset clicking state when cleaning up
        isClicking.current = false;
      };
    } else {
      // Ensure mouse controls are disabled in orbit mode
      isClicking.current = false;
    }
  }, [cameraMode]);

  useFrame(({ camera, mouse }) => {
    if (rb.current) {
      const vel = rb.current.linvel();
      if (!vel) return; // Safety check

      // Update position for shadow following
      if (onPositionChange) {
        const pos = rb.current.translation();
        onPositionChange([pos.x, pos.y, pos.z]);
      }

      // Check if grounded first
      const grounded = checkGrounded();
      setIsGrounded(grounded);

      // Debug: Log movement state when keys are released
      const hasMovement =
        get().forward || get().backward || get().left || get().right;
      if (!hasMovement && (Math.abs(vel.x) > 0.01 || Math.abs(vel.z) > 0.01)) {
        // console.log(
        //   `Sliding detected - Grounded: ${grounded}, Vel: x=${vel.x.toFixed(
        //     3
        //   )}, z=${vel.z.toFixed(3)}`
        // );
      }

      const movement = {
        x: 0,
        z: 0,
      };

      // Handle jump input
      const jumpInput = get().jump;
      if (jumpInput && grounded && !jumpPressed.current) {
        jumpPressed.current = true;
        vel.y = JUMP_FORCE;
        setAnimation("jump");
      } else if (!jumpInput) {
        jumpPressed.current = false;
      }

      // Handle dance input
      const danceInput = get().dance;
      if (danceInput) {
        setAnimation("dance");
        // Don't allow movement while dancing
        movement.x = 0;
        movement.z = 0;
      }

      // Zelda-style controls: Down/S turns character around
      if (get().forward) {
        movement.z = 1;
      }
      if (get().backward) {
        // S/Down: Turn around and walk toward camera
        movement.z = -1;
      }

      // Q key: Classic walk backward (moonwalk style!)
      const walkBackwardInput = get().walkBackward;
      if (walkBackwardInput) {
        movement.z = -1;
        movement.walkBackwardMode = true; // Flag for animation
      }

      let speed = get().run ? RUN_SPEED : WALK_SPEED;

      // Mouse movement controls - only active in "follow" camera mode
      if (cameraMode === "follow" && isClicking.current) {
        // console.log("clicking", mouse.x, mouse.y);
        if (Math.abs(mouse.x) > 0.1) {
          movement.x = -mouse.x;
        }
        movement.z = mouse.y + 0.4;
        if (Math.abs(movement.x) > 0.5 || Math.abs(movement.z) > 0.5) {
          speed = RUN_SPEED;
        }
      }

      if (get().left) {
        movement.x = 1;
      }
      if (get().right) {
        movement.x = -1;
      }

      if (movement.x !== 0) {
        rotationTarget.current += ROTATION_SPEED * movement.x;
      }

      if (movement.x !== 0 || movement.z !== 0) {
        // Zelda-style: Character faces movement direction
        // UNLESS in walkBackward mode (Q key)
        if (movement.walkBackwardMode) {
          // Q key: Keep facing forward, walk backward
          characterRotationTarget.current = Math.atan2(movement.x, 1);
        } else {
          // S/Down or W/Up: Turn to face movement direction
          characterRotationTarget.current = Math.atan2(movement.x, movement.z);
        }

        // Calculate intended movement direction
        let intendedVelX =
          Math.sin(rotationTarget.current + characterRotationTarget.current) *
          speed;
        let intendedVelZ =
          Math.cos(rotationTarget.current + characterRotationTarget.current) *
          speed;

        // If in walkBackward mode, reverse the movement
        if (movement.walkBackwardMode && movement.z < 0) {
          intendedVelX = -intendedVelX;
          intendedVelZ = -intendedVelZ;
        }

        // Store current velocity before applying new movement
        previousVelocity.current.set(vel.x, vel.y, vel.z);

        // Handle movement based on grounded state and jump phase
        if (grounded) {
          // Normal movement when grounded
          vel.x = intendedVelX;
          vel.z = intendedVelZ;
        } else {
          // When in the air, check if we're rising (just jumped) or falling
          const isRising = vel.y > 0.1; // Still going up
          const isFalling = vel.y < -0.1; // Coming down

          if (isRising) {
            // During the rising phase of jump, allow full directional movement
            // This enables directional jumping (forward+jump, etc.)
            vel.x = intendedVelX;
            vel.z = intendedVelZ;
          } else if (isFalling) {
            // During falling phase, blend between current velocity and intended movement
            // This maintains natural physics while allowing slight control
            const blendFactor = 0.1; // Very small influence
            vel.x = vel.x * (1 - blendFactor) + intendedVelX * blendFactor;
            vel.z = vel.z * (1 - blendFactor) + intendedVelZ * blendFactor;
          } else {
            // At the peak of jump (vel.y ≈ 0), allow some movement
            vel.x = intendedVelX * 0.5;
            vel.z = intendedVelZ * 0.5;
          }
        }

        // Only change to walk/run animation if not jumping and not dancing
        if ((!jumpInput || grounded) && !danceInput) {
          if (speed === RUN_SPEED) {
            setAnimation("run");
          } else if (movement.walkBackwardMode) {
            // Q key: Use backward walk animation
            setAnimation("walkBackwards");
          } else {
            // S/Down or W/Up: Always use forward walk
            setAnimation("walk");
          }
        }
      } else {
        // Stop horizontal movement when no keys are pressed
        // Apply friction regardless of grounded state, but with different strength
        const oldVelX = vel.x;
        const oldVelZ = vel.z;

        if (grounded) {
          // Strong friction when grounded
          vel.x *= FRICTION;
          vel.z *= FRICTION;
        } else {
          // Light friction when in air (to prevent infinite sliding)
          const airFriction = 0.95; // Much lighter friction in air
          vel.x *= airFriction;
          vel.z *= airFriction;
        }

        // Debug: Log friction application
        if (Math.abs(oldVelX) > 0.01 || Math.abs(oldVelZ) > 0.01) {
          // console.log(
          //   `Applying friction (${
          //     grounded ? "grounded" : "air"
          //   }) - Before: x=${oldVelX.toFixed(3)}, z=${oldVelZ.toFixed(
          //     3
          //   )}, After: x=${vel.x.toFixed(3)}, z=${vel.z.toFixed(3)}`
          // );
        }

        // Stop completely if velocity is very low
        if (Math.abs(vel.x) < 0.01) vel.x = 0;
        if (Math.abs(vel.z) < 0.01) vel.z = 0;

        // Only change to idle if not jumping and not dancing
        if ((!jumpInput || grounded) && !danceInput) {
          setAnimation("idle");
        }
      }
      character.current.rotation.y = lerpAngle(
        character.current.rotation.y,
        characterRotationTarget.current,
        0.1
      );

      rb.current.setLinvel(vel, true);
    }

    // CAMERA - Conditional based on cameraMode
    if (cameraMode === "follow") {
      // Character-following camera (original gameplay camera)
      container.current.rotation.y = MathUtils.lerp(
        container.current.rotation.y,
        rotationTarget.current,
        cameraLerpSpeed
      );

      cameraPosition.current.getWorldPosition(cameraWorldPosition.current);

      // Check if first frame
      const isFirstFrame = !cameraInitialized.current;

      // On first frame, SNAP camera position instead of lerping
      if (isFirstFrame) {
        camera.position.copy(cameraWorldPosition.current);
      } else {
        // After first frame, use smooth lerping
        camera.position.lerp(cameraWorldPosition.current, cameraLerpSpeed);
      }

      if (cameraTarget.current) {
        cameraTarget.current.getWorldPosition(
          cameraLookAtWorldPosition.current
        );

        // On first frame snap, otherwise lerp smoothly
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

      // Mark as initialized after first frame completes
      if (isFirstFrame) {
        cameraInitialized.current = true;
      }
    }
    // If cameraMode === "orbit", OrbitControls handles the camera
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
        <group ref={character}>
          <YbotCharacterPhysicsDebug animation={animation} />
        </group>

        {/* Camera debug markers - only show when enabled */}
        {showCameraDebug && (
          <>
            {/* Camera position marker */}
            <mesh position={[cameraX, cameraY, cameraZ]}>
              <sphereGeometry args={[0.1]} />
              <meshBasicMaterial color="purple" />
            </mesh>

            {/* Camera target marker */}
            <mesh position={[0, 0, targetZ]}>
              <sphereGeometry args={[0.05]} />
              <meshBasicMaterial color="orange" />
            </mesh>
          </>
        )}
      </group>
      <CapsuleCollider args={[capsuleHeight / 2, capsuleRadius]} />
    </RigidBody>
  );
};
