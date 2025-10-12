import { useKeyboardControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, useRapier } from "@react-three/rapier";
import { useControls } from "leva";
import { useEffect, useRef, useState } from "react";
import { MathUtils, Vector3 } from "three";
import { degToRad } from "three/src/math/MathUtils.js";
import { GodotCharacter } from "./GodotCharacter";

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

interface GodotCharacterControllerProps {
  position?: [number, number, number];
  cameraMode?: string;
  onRigidBodyRef?: any;
  onPositionChange?: (position: [number, number, number]) => void;
  onPhysicsDebugChange?: (debug: boolean) => void;
}

export const GodotCharacterController = ({
  position = [0, 2, 0],
  cameraMode = "orbit",
  onRigidBodyRef,
  onPositionChange,
  onPhysicsDebugChange,
}: GodotCharacterControllerProps) => {
  const {
    WALK_SPEED,
    RUN_SPEED,
    ROTATION_SPEED,
    JUMP_FORCE,
    GRAVITY,
    FRICTION,
  } = useControls("Godot Character Control", {
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
  } = useControls("Godot Follow Camera", {
    cameraX: { value: 0, min: -10, max: 10, step: 0.1 },
    cameraY: { value: 1.5, min: 0, max: 10, step: 0.1 },
    cameraZ: { value: -5.6, min: -10, max: 2, step: 0.1 },
    targetZ: { value: 5, min: -2, max: 5, step: 0.1 },
    cameraLerpSpeed: { value: 0.1, min: 0.01, max: 0.5, step: 0.01 },
    showCameraDebug: { value: false },
  });

  // Physics controls - Properly sized for 1.83m character
  const { capsuleHeight, capsuleRadius, showPhysicsDebug } = useControls(
    "Godot Physics Collision",
    {
      capsuleHeight: {
        value: 1.4,
        min: 0.5,
        max: 2.0,
        step: 0.05,
        label: "Capsule Total Height (should cover body)",
      },
      capsuleRadius: {
        value: 0.15,
        min: 0.05,
        max: 0.3,
        step: 0.01,
        label: "Capsule Radius",
      },
      showPhysicsDebug: {
        value: false,
        label: "🔍 Show Physics Debug Wireframes",
      },
    }
  );

  // DEBUG: Log capsule and ground info
  useEffect(() => {
    console.log("=== CAPSULE & GROUND INFO ===");
    console.log("Capsule Radius:", capsuleRadius, "meters");
    console.log("Capsule Total Height:", capsuleHeight, "meters");
    console.log("Capsule Half-Height:", capsuleHeight / 2, "meters");
    console.log(
      "Capsule Total Height with caps:",
      capsuleHeight + capsuleRadius * 2,
      "meters"
    );
    console.log("CapsuleCollider args: [halfHeight, radius] =", [
      capsuleHeight / 2,
      capsuleRadius,
    ]);
    console.log("---");

    // Calculate where capsule bottom is
    const capsuleBottom = -(capsuleHeight / 2 + capsuleRadius);
    const capsuleTop = capsuleHeight / 2 + capsuleRadius;
    const characterFeetY = -0.85; // Current yPosition in GodotCharacter
    const characterHeightVisual = 1.83; // From GodotCharacter mesh
    const characterHeadY = characterFeetY + characterHeightVisual;

    console.log("⚠️ ALIGNMENT CHECK:");
    console.log("  Capsule center (RigidBody): y = 0.00m");
    console.log(`  Capsule bottom: y = ${capsuleBottom.toFixed(2)}m`);
    console.log(`  Capsule top: y = ${capsuleTop.toFixed(2)}m`);
    console.log(
      `  Capsule total height: ${(capsuleTop - capsuleBottom).toFixed(2)}m`
    );
    console.log("  ---");
    console.log(`  Character feet: y = ${characterFeetY.toFixed(2)}m`);
    console.log(`  Character head: y = ${characterHeadY.toFixed(2)}m`);
    console.log(
      `  Character visual height: ${characterHeightVisual.toFixed(2)}m`
    );
    console.log("---");

    if (Math.abs(capsuleBottom - characterFeetY) > 0.05) {
      console.warn("❌ MISALIGNMENT DETECTED!");
      console.warn(
        `  Character feet are ${Math.abs(
          capsuleBottom - characterFeetY
        ).toFixed(2)}m away from capsule bottom!`
      );
      console.warn(
        "  Solution: Adjust GodotCharacter yPosition to:",
        capsuleBottom.toFixed(2)
      );
    } else {
      console.log("✅ Character feet aligned with capsule bottom!");
    }

    console.log("---");
    console.log(
      "NOTE: Capsule is intentionally smaller than visual character!"
    );
    console.log("This is NORMAL and helps with slopes and tight spaces.");
  }, [capsuleHeight, capsuleRadius]);

  const rb = useRef<any>();
  const container = useRef<any>();
  const character = useRef<any>();

  const [animation, setAnimation] = useState("idle");
  const [isGrounded, setIsGrounded] = useState(true); // Start grounded
  const wasGrounded = useRef(false);
  const jumpPhase = useRef<"none" | "start" | "loop" | "land">("none");

  // Ensure idle animation plays on component mount
  useEffect(() => {
    setAnimation("idle");
    console.log("GodotCharacterController mounted - setting idle animation");
  }, []);

  // Expose RigidBody reference to parent component
  useEffect(() => {
    if (onRigidBodyRef && rb.current) {
      console.log("GodotCharacterController: Exposing RigidBody ref to parent");
      onRigidBodyRef(rb);
    }
  }, [onRigidBodyRef]);

  // Notify parent when physics debug changes
  useEffect(() => {
    if (onPhysicsDebugChange) {
      onPhysicsDebugChange(showPhysicsDebug);
    }
  }, [showPhysicsDebug, onPhysicsDebugChange]);

  const characterRotationTarget = useRef(0);
  const rotationTarget = useRef(0);
  const cameraTarget = useRef<any>();
  const cameraPosition = useRef<any>();
  const cameraWorldPosition = useRef(new Vector3());
  const cameraLookAtWorldPosition = useRef(new Vector3());
  const cameraLookAt = useRef(new Vector3());
  const [, get] = useKeyboardControls();
  const isClicking = useRef(false);
  const jumpPressed = useRef(false);
  const previousVelocity = useRef(new Vector3());
  const cameraInitialized = useRef(false);

  const { world } = useRapier();

  // SMART ground detection - handles both slopes AND walls correctly
  const checkGrounded = () => {
    if (!rb.current || !world) return false;

    try {
      const vel = rb.current.linvel();
      if (!vel) return false;
      const position = rb.current.translation();

      // WALL FLOATING DETECTION:
      // If vertical velocity is small BUT horizontal velocity is ALSO small,
      // you're likely stuck on a wall, not on ground
      const verticalSpeed = Math.abs(vel.y);
      const horizontalSpeed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);

      // If barely moving in ANY direction = stuck on wall
      if (verticalSpeed < 0.1 && horizontalSpeed < 0.1) {
        // Could be on ground OR stuck on wall - use raycast
        const rayOrigin = { x: position.x, y: position.y, z: position.z };
        const rayDirection = { x: 0, y: -1, z: 0 };
        const rayLength = capsuleHeight / 2 + capsuleRadius + 0.2;

        const hit = world.castRay(rayOrigin, rayDirection, rayLength, true);

        if (hit && hit.normal) {
          // Check if it's ground (not wall)
          return hit.normal.y > 0.7;
        }

        // No hit below = not grounded
        return false;
      }

      // Normal movement - lenient check for slopes
      return verticalSpeed < 2.5;
    } catch (error) {
      try {
        const vel = rb.current.linvel();
        return vel ? Math.abs(vel.y) < 0.1 : false;
      } catch {
        return false;
      }
    }
  };

  // Mouse controls for character movement
  useEffect(() => {
    if (cameraMode === "follow") {
      const onMouseDown = (e: any) => {
        isClicking.current = true;
      };
      const onMouseUp = (e: any) => {
        isClicking.current = false;
      };
      document.addEventListener("mousedown", onMouseDown);
      document.addEventListener("mouseup", onMouseUp);
      document.addEventListener("touchstart", onMouseDown);
      document.addEventListener("touchend", onMouseUp);
      return () => {
        document.removeEventListener("mousedown", onMouseDown);
        document.removeEventListener("mouseup", onMouseUp);
        document.removeEventListener("touchstart", onMouseDown);
        document.removeEventListener("touchend", onMouseUp);
        isClicking.current = false;
      };
    } else {
      isClicking.current = false;
    }
  }, [cameraMode]);

  useFrame(({ camera, mouse }) => {
    if (rb.current) {
      const vel = rb.current.linvel();
      if (!vel) return;

      // Update position for shadow following
      if (onPositionChange) {
        const pos = rb.current.translation();
        onPositionChange([pos.x, pos.y, pos.z]);
      }

      const movement: any = {
        x: 0,
        z: 0,
      };

      // Get movement input FIRST to detect blocking
      if (get().forward) {
        movement.z = 1;
      }
      if (get().backward) {
        movement.z = -1;
      }
      if (get().left) {
        movement.x = 1;
      }
      if (get().right) {
        movement.x = -1;
      }

      // Calculate intended movement
      let speed = get().run ? RUN_SPEED : WALK_SPEED;
      let intendedVelX = 0;
      let intendedVelZ = 0;

      if (movement.x !== 0 || movement.z !== 0) {
        const characterRotationAngle = Math.atan2(movement.x, movement.z);
        intendedVelX =
          Math.sin(rotationTarget.current + characterRotationAngle) * speed;
        intendedVelZ =
          Math.cos(rotationTarget.current + characterRotationAngle) * speed;
      }

      // BLOCKING DETECTION: Are we trying to move but can't?
      const intendedSpeed = Math.sqrt(
        intendedVelX * intendedVelX + intendedVelZ * intendedVelZ
      );
      const actualSpeed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
      const isBlocked = intendedSpeed > 1.0 && actualSpeed < 0.3;

      // Check if grounded (but override if blocked)
      let grounded = checkGrounded();

      if (isBlocked && grounded && Math.abs(vel.y) < 0.2) {
        // We're "grounded" but blocked and not moving vertically = stuck on wall!
        console.log("🚫 BLOCKED ON WALL! Forcing not grounded.");
        grounded = false;
      }

      setIsGrounded(grounded);

      // DETAILED DEBUG
      if (Math.random() < 0.02) {
        console.log(
          `Grounded: ${grounded}, vel.y: ${vel.y.toFixed(
            2
          )}, intended: ${intendedSpeed.toFixed(
            2
          )}, actual: ${actualSpeed.toFixed(2)}, blocked: ${isBlocked}`
        );
      }

      // Jump with animations
      const jumpInput = get().jump;

      // Detect landing
      if (!wasGrounded.current && grounded) {
        jumpPhase.current = "land";
        setAnimation("jumpLand");
        setTimeout(() => {
          if (jumpPhase.current === "land") {
            jumpPhase.current = "none";
          }
        }, 300);
      }

      // Handle jump
      if (jumpInput && grounded && !jumpPressed.current) {
        jumpPressed.current = true;
        vel.y = JUMP_FORCE;
        jumpPhase.current = "start";
        setAnimation("jumpStart");

        // Transition to jump loop
        setTimeout(() => {
          if (jumpPhase.current === "start") {
            jumpPhase.current = "loop";
            setAnimation("jumpLoop");
          }
        }, 200);
      } else if (!jumpInput) {
        jumpPressed.current = false;
      }

      // If in air and not in a jump phase, set to loop
      if (!grounded && jumpPhase.current === "none") {
        jumpPhase.current = "loop";
        setAnimation("jumpLoop");
      }

      // Track grounded state
      wasGrounded.current = grounded;

      // Handle dance input
      const danceInput = get().dance;
      if (danceInput) {
        setAnimation("dance");
        movement.x = 0;
        movement.z = 0;
      }

      // Handle crouch input
      const crouchInput = get().crouch;

      // Q key: Classic walk backward
      const walkBackwardInput = get().walkBackward;
      if (walkBackwardInput) {
        movement.z = -1;
        movement.walkBackwardMode = true;
      }

      // Adjust speed based on run/crouch
      if (crouchInput) {
        speed = WALK_SPEED * 0.5; // Crouch walk is slower
      }

      // Mouse movement controls
      if (cameraMode === "follow" && isClicking.current) {
        if (Math.abs(mouse.x) > 0.1) {
          movement.x = -mouse.x;
        }
        movement.z = mouse.y + 0.4;
        if (Math.abs(movement.x) > 0.5 || Math.abs(movement.z) > 0.5) {
          speed = RUN_SPEED;
        }
      }

      if (movement.x !== 0) {
        rotationTarget.current += ROTATION_SPEED * movement.x;
      }

      if (movement.x !== 0 || movement.z !== 0) {
        if (movement.walkBackwardMode) {
          characterRotationTarget.current = Math.atan2(movement.x, 1);
        } else {
          characterRotationTarget.current = Math.atan2(movement.x, movement.z);
        }

        // Recalculate intendedVel with proper rotation
        intendedVelX =
          Math.sin(rotationTarget.current + characterRotationTarget.current) *
          speed;
        intendedVelZ =
          Math.cos(rotationTarget.current + characterRotationTarget.current) *
          speed;

        if (movement.walkBackwardMode && movement.z < 0) {
          intendedVelX = -intendedVelX;
          intendedVelZ = -intendedVelZ;
        }

        previousVelocity.current.set(vel.x, vel.y, vel.z);

        if (isBlocked) {
          // We're being blocked (wall) - force NOT grounded
          console.log(
            "🚫 BLOCKED! Forcing not grounded. Intended:",
            intendedSpeed.toFixed(2),
            "Actual:",
            actualSpeed.toFixed(2)
          );
          // Don't apply any velocity - let character fall
        } else if (!grounded) {
          // In air - DON'T TOUCH VELOCITY AT ALL
          // Just keep the momentum you had when you jumped
          // Rapier handles everything (gravity, walls, etc.)
        } else {
          // Grounded - full control like original
          vel.x = intendedVelX;
          vel.z = intendedVelZ;
        }

        // Only change to walk/run animation if grounded, not jumping, and not dancing
        if (grounded && jumpPhase.current === "none" && !danceInput) {
          if (crouchInput) {
            // Crouching animations
            setAnimation("crouchWalk");
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
          // On ground - apply friction to slow down
          vel.x *= FRICTION;
          vel.z *= FRICTION;

          if (Math.abs(vel.x) < 0.01) vel.x = 0;
          if (Math.abs(vel.z) < 0.01) vel.z = 0;
        } else {
          // In air - DON'T touch velocity at all!
          // Let Rapier physics handle everything naturally
          // No air friction, no modifications
        }

        // Only change to idle if grounded, not jumping, and not dancing
        if (grounded && jumpPhase.current === "none" && !danceInput) {
          if (crouchInput) {
            setAnimation("crouchIdle");
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
      linearDamping={0}
      angularDamping={0}
    >
      <group ref={container}>
        <group ref={cameraTarget} position-z={targetZ} />
        <group ref={cameraPosition} position={[cameraX, cameraY, cameraZ]} />
        <group ref={character}>
          <GodotCharacter animation={animation} />
        </group>

        {/* Camera debug markers */}
        {showCameraDebug && (
          <>
            <mesh position={[cameraX, cameraY, cameraZ]}>
              <sphereGeometry args={[0.1]} />
              <meshBasicMaterial color="purple" />
            </mesh>

            <mesh position={[0, 0, targetZ]}>
              <sphereGeometry args={[0.05]} />
              <meshBasicMaterial color="orange" />
            </mesh>
          </>
        )}

        {/* Physics debug markers - show capsule alignment */}
        {showPhysicsDebug && (
          <>
            {/* RigidBody center (where capsule is centered) */}
            <mesh position={[0, 0, 0]}>
              <sphereGeometry args={[0.05]} />
              <meshBasicMaterial color="red" transparent opacity={0.8} />
            </mesh>

            {/* Capsule bottom (where feet should be) */}
            <mesh position={[0, -(capsuleHeight / 2 + capsuleRadius), 0]}>
              <cylinderGeometry args={[0.15, 0.15, 0.02]} />
              <meshBasicMaterial color="green" transparent opacity={0.8} />
            </mesh>

            {/* Capsule top */}
            <mesh position={[0, capsuleHeight / 2 + capsuleRadius, 0]}>
              <sphereGeometry args={[0.05]} />
              <meshBasicMaterial color="yellow" transparent opacity={0.8} />
            </mesh>
          </>
        )}
      </group>
      {/* Capsule collider - centered at RigidBody origin */}
      <CapsuleCollider
        args={[capsuleHeight / 2, capsuleRadius]}
        friction={0}
        restitution={0}
      />
    </RigidBody>
  );
};
