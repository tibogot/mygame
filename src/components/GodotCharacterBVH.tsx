import { useKeyboardControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { RigidBody } from "@react-three/rapier";
import { useControls } from "leva";
import { useEffect, useRef, useState } from "react";
import { MathUtils, Vector3, Matrix4, Line3, Box3, Triangle } from "three";
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

interface GodotCharacterBVHProps {
  position?: [number, number, number];
  cameraMode?: string;
  collider?: THREE.Mesh | null;
  onPositionChange?: (position: [number, number, number]) => void;
}

export const GodotCharacterBVH = ({
  position = [0, 2, 0],
  cameraMode = "orbit",
  collider = null,
  onPositionChange,
}: GodotCharacterBVHProps) => {
  const { WALK_SPEED, RUN_SPEED, ROTATION_SPEED, JUMP_FORCE, GRAVITY } =
    useControls("Godot BVH Control", {
      WALK_SPEED: { value: 1.8, min: 0.1, max: 4, step: 0.1 },
      RUN_SPEED: { value: 3.6, min: 0.2, max: 12, step: 0.1 },
      ROTATION_SPEED: {
        value: degToRad(0.5),
        min: degToRad(0.1),
        max: degToRad(5),
        step: degToRad(0.1),
      },
      JUMP_FORCE: { value: 5, min: 1, max: 10, step: 0.1 },
      GRAVITY: { value: 20, min: 5, max: 30, step: 0.1 },
    });

  const { cameraX, cameraY, cameraZ, targetZ, cameraLerpSpeed } = useControls(
    "Godot BVH Camera",
    {
      cameraX: { value: 0, min: -10, max: 10, step: 0.1 },
      cameraY: { value: 1.5, min: 0, max: 10, step: 0.1 },
      cameraZ: { value: -5.6, min: -10, max: 2, step: 0.1 },
      targetZ: { value: 5, min: -2, max: 5, step: 0.1 },
      cameraLerpSpeed: { value: 0.1, min: 0.01, max: 0.5, step: 0.01 },
    }
  );

  const { capsuleRadius, capsuleHeight } = useControls("Godot BVH Capsule", {
    capsuleRadius: { value: 0.35, min: 0.1, max: 0.5, step: 0.05 },
    capsuleHeight: { value: 1.0, min: 0.5, max: 2.0, step: 0.1 },
  });

  const container = useRef<any>();
  const character = useRef<any>();
  const [animation, setAnimation] = useState("idle");
  const characterRotationTarget = useRef(0);
  const rotationTarget = useRef(0);
  const cameraTarget = useRef<any>();
  const cameraPosition = useRef<any>();
  const cameraWorldPosition = useRef(new Vector3());
  const cameraLookAtWorldPosition = useRef(new Vector3());
  const cameraLookAt = useRef(new Vector3());
  const [, get] = useKeyboardControls();

  // Player physics state
  const playerPosition = useRef(new Vector3(...position));
  const playerVelocity = useRef(new Vector3());
  const playerOnGround = useRef(false);

  // BVH collision temps (reused every frame)
  const tempBox = useRef(new Box3());
  const tempMat = useRef(new Matrix4());
  const tempSegment = useRef(new Line3());
  const tempVector = useRef(new Vector3());
  const tempVector2 = useRef(new Vector3());

  // Capsule info
  const capsuleInfo = useMemo(
    () => ({
      radius: capsuleRadius,
      segment: new Line3(
        new Vector3(0, capsuleRadius, 0),
        new Vector3(0, -capsuleHeight - capsuleRadius, 0)
      ),
    }),
    [capsuleRadius, capsuleHeight]
  );

  useFrame(({ camera, mouse, clock }, delta) => {
    if (!collider || !collider.geometry.boundsTree) {
      return; // Wait for BVH to be ready
    }

    const velocity = playerVelocity.current;
    const pos = playerPosition.current;

    // Apply gravity
    velocity.y -= GRAVITY * delta;

    // Get input
    const movement = { x: 0, z: 0 };
    if (get().forward) movement.z = 1;
    if (get().backward) movement.z = -1;
    if (get().left) movement.x = 1;
    if (get().right) movement.x = -1;

    const speed = get().run ? RUN_SPEED : WALK_SPEED;

    if (movement.x !== 0) {
      rotationTarget.current += ROTATION_SPEED * movement.x;
    }

    // Apply movement
    if (movement.x !== 0 || movement.z !== 0) {
      characterRotationTarget.current = Math.atan2(movement.x, movement.z);

      const vx =
        Math.sin(rotationTarget.current + characterRotationTarget.current) *
        speed;
      const vz =
        Math.cos(rotationTarget.current + characterRotationTarget.current) *
        speed;

      velocity.x = vx;
      velocity.z = vz;

      setAnimation(speed === RUN_SPEED ? "run" : "walk");
    } else {
      velocity.x *= 0.8; // Friction
      velocity.z *= 0.8;
      if (playerOnGround.current) {
        setAnimation("idle");
      }
    }

    // Apply velocity
    pos.addScaledVector(velocity, delta);

    // BVH COLLISION DETECTION
    const tempSegmentRef = tempSegment.current;
    tempSegmentRef.copy(capsuleInfo.segment);

    // Transform capsule to world space
    const playerMatrix = new Matrix4().makeTranslation(pos.x, pos.y, pos.z);
    tempSegmentRef.start.applyMatrix4(playerMatrix);
    tempSegmentRef.end.applyMatrix4(playerMatrix);

    // Transform to collider local space
    tempMat.current.copy(collider.matrixWorld).invert();
    tempSegmentRef.start.applyMatrix4(tempMat.current);
    tempSegmentRef.end.applyMatrix4(tempMat.current);

    // Create bounding box for capsule
    tempBox.current.makeEmpty();
    tempBox.current.expandByPoint(tempSegmentRef.start);
    tempBox.current.expandByPoint(tempSegmentRef.end);
    tempBox.current.min.addScalar(-capsuleInfo.radius);
    tempBox.current.max.addScalar(capsuleInfo.radius);

    // Perform BVH shapecast
    collider.geometry.boundsTree.shapecast({
      intersectsBounds: (box: any) => box.intersectsBox(tempBox.current),

      intersectsTriangle: (tri: Triangle) => {
        const triPoint = tempVector.current;
        const capsulePoint = tempVector2.current;

        const distance = tri.closestPointToSegment(
          tempSegmentRef,
          triPoint,
          capsulePoint
        );

        if (distance < capsuleInfo.radius) {
          const depth = capsuleInfo.radius - distance;
          const direction = capsulePoint.sub(triPoint).normalize();

          tempSegmentRef.start.addScaledVector(direction, depth);
          tempSegmentRef.end.addScaledVector(direction, depth);
        }

        return false;
      },
    });

    // Apply correction back to world space
    const newPosition = tempVector.current;
    newPosition.copy(tempSegmentRef.start).applyMatrix4(collider.matrixWorld);

    const deltaVector = tempVector2.current;
    deltaVector.subVectors(newPosition, pos);

    // Detect if on ground
    playerOnGround.current =
      deltaVector.y > Math.abs(delta * velocity.y * 0.25);

    // Apply position correction
    const offset = Math.max(0.0, deltaVector.length() - 1e-5);
    deltaVector.normalize().multiplyScalar(offset);
    pos.add(deltaVector);

    // Adjust velocity based on collision
    if (!playerOnGround.current) {
      deltaVector.normalize();
      velocity.addScaledVector(deltaVector, -deltaVector.dot(velocity));
    } else {
      velocity.x *= 0.9;
      velocity.z *= 0.9;
    }

    // Update container position
    if (container.current) {
      container.current.position.copy(pos);
    }

    // Character rotation
    if (character.current) {
      character.current.rotation.y = lerpAngle(
        character.current.rotation.y,
        characterRotationTarget.current,
        0.1
      );
    }

    // Update parent
    if (onPositionChange) {
      onPositionChange([pos.x, pos.y, pos.z]);
    }

    // CAMERA
    if (cameraMode === "follow") {
      container.current.rotation.y = MathUtils.lerp(
        container.current.rotation.y,
        rotationTarget.current,
        cameraLerpSpeed
      );

      cameraPosition.current.getWorldPosition(cameraWorldPosition.current);
      camera.position.lerp(cameraWorldPosition.current, cameraLerpSpeed);

      if (cameraTarget.current) {
        cameraTarget.current.getWorldPosition(
          cameraLookAtWorldPosition.current
        );
        cameraLookAt.current.lerp(
          cameraLookAtWorldPosition.current,
          cameraLerpSpeed
        );
        camera.lookAt(cameraLookAt.current);
      }
    }
  });

  return (
    <group ref={container}>
      <group ref={cameraTarget} position-z={targetZ} />
      <group ref={cameraPosition} position={[cameraX, cameraY, cameraZ]} />
      <group ref={character}>
        <GodotCharacter animation={animation} />
      </group>
    </group>
  );
};
