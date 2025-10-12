import React, { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

interface DynamicLeavesProps {
  count?: number;
  areaSize?: number;
  ybotPosition?: THREE.Vector3;
  ybotVelocity?: THREE.Vector3;
  getGroundHeight?: (x: number, z: number) => number;
  characterInteractionRange?: number;
  characterPushStrength?: number;
  characterSwirlStrength?: number;
}

export const DynamicLeaves: React.FC<DynamicLeavesProps> = ({
  count = 1000,
  areaSize = 20,
  ybotPosition = new THREE.Vector3(),
  ybotVelocity = new THREE.Vector3(),
  getGroundHeight,
  characterInteractionRange = 8,
  characterPushStrength = 0.8,
  characterSwirlStrength = 0.5,
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useRef(new THREE.Object3D());
  const { camera } = useThree();

  // Reusable vectors to avoid creating new objects each frame
  const tempVec = useRef(new THREE.Vector3());
  const tempVec2 = useRef(new THREE.Vector3());
  const tempVec3 = useRef(new THREE.Vector3());

  // Create optimized leaf geometry
  const geometry = useMemo(() => {
    // Use fewer vertices for better performance
    const geometry = new THREE.PlaneGeometry(0.3, 0.3, 1, 1);
    geometry.rotateX(-Math.PI * 0.5);

    // Create instanced attributes for variation
    const scaleArray = new Float32Array(count);
    const rotationArray = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      scaleArray[i] = Math.random() * 0.5 + 0.5;
      rotationArray[i] = Math.random() * Math.PI * 2;
    }

    geometry.setAttribute(
      "aScale",
      new THREE.InstancedBufferAttribute(scaleArray, 1)
    );
    geometry.setAttribute(
      "aRotation",
      new THREE.InstancedBufferAttribute(rotationArray, 1)
    );

    return geometry;
  }, [count]);

  // Optimized material with vertex colors
  const material = useMemo(() => {
    const leafColors = [
      new THREE.Color("#c4c557"),
      new THREE.Color("#ff782b"),
      new THREE.Color("#8B4513"),
      new THREE.Color("#A0522D"),
      new THREE.Color("#D2691E"),
      new THREE.Color("#CD853F"),
      new THREE.Color("#228B22"),
      new THREE.Color("#006400"),
      new THREE.Color("#32CD32"),
      new THREE.Color("#9ACD32"),
      new THREE.Color("#B22222"),
      new THREE.Color("#DC143C"),
      new THREE.Color("#8B0000"),
      new THREE.Color("#2F4F4F"),
      new THREE.Color("#556B2F"),
      new THREE.Color("#6B8E23"),
      new THREE.Color("#DAA520"),
      new THREE.Color("#B8860B"),
    ];

    const colorArray = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const colorA = leafColors[Math.floor(Math.random() * leafColors.length)];
      const colorB = leafColors[Math.floor(Math.random() * leafColors.length)];
      const color = colorA.clone().lerp(colorB, Math.random());

      // Slight variation
      color.r = Math.max(
        0,
        Math.min(1, color.r + (Math.random() - 0.5) * 0.15)
      );
      color.g = Math.max(
        0,
        Math.min(1, color.g + (Math.random() - 0.5) * 0.15)
      );
      color.b = Math.max(
        0,
        Math.min(1, color.b + (Math.random() - 0.5) * 0.15)
      );

      color.toArray(colorArray, i * 3);
    }

    geometry.setAttribute(
      "color",
      new THREE.InstancedBufferAttribute(colorArray, 3)
    );

    return new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: true,
    });
  }, [count, geometry]);

  // Leaf physics data with improved structure
  const leafDataRef = useRef<
    Array<{
      pos: Float32Array; // [x, y, z]
      vel: Float32Array; // [x, y, z]
      rot: Float32Array; // [x, y, z]
      groundOffset: number;
      angularVel: Float32Array; // [x, y, z] for more realistic tumbling
      isResting: boolean; // Track if leaf is at rest
      restTimer: number; // How long it's been resting
    }>
  >([]);

  // Initialize leaf data with typed arrays for better performance
  useEffect(() => {
    leafDataRef.current = [];

    for (let i = 0; i < count; i++) {
      // Get ground height for this leaf's position
      const x = (Math.random() - 0.5) * areaSize;
      const z = (Math.random() - 0.5) * areaSize;
      const groundY = getGroundHeight ? getGroundHeight(x, z) : 0;

      leafDataRef.current.push({
        pos: new Float32Array([
          x,
          groundY + Math.random() * 3 + 0.5, // Start closer to ground (0.5 to 3.5 units above)
          z,
        ]),
        vel: new Float32Array([
          (Math.random() - 0.5) * 0.1,
          -Math.random() * 0.2,
          (Math.random() - 0.5) * 0.1,
        ]),
        rot: new Float32Array([
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
        ]),
        groundOffset: Math.random() * 0.015,
        angularVel: new Float32Array([
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
        ]),
        isResting: false,
        restTimer: 0,
      });
    }
  }, [count, areaSize, getGroundHeight]);

  // Animation with optimizations
  useFrame((state, delta) => {
    if (!meshRef.current || !dummy.current) return;

    const mesh = meshRef.current;
    const dummyObj = dummy.current;
    const time = state.clock.elapsedTime;

    // Clamp delta to avoid physics explosions
    const safeDelta = Math.min(delta, 0.1);

    // Cache character position for faster access
    const charX = ybotPosition.x;
    const charY = ybotPosition.y;
    const charZ = ybotPosition.z;
    const charVelX = ybotVelocity.x;
    const charVelY = ybotVelocity.y;
    const charVelZ = ybotVelocity.z;
    const charSpeed = Math.sqrt(charVelX * charVelX + charVelZ * charVelZ);

    // Update each leaf
    leafDataRef.current.forEach((leaf, i) => {
      // Skip physics for resting leaves unless character is nearby
      const dx = leaf.pos[0] - charX;
      const dz = leaf.pos[2] - charZ;
      const distSq = dx * dx + dz * dz;
      const dist = Math.sqrt(distSq);

      // Wake up resting leaves if character approaches
      if (leaf.isResting && dist < characterInteractionRange) {
        leaf.isResting = false;
        leaf.restTimer = 0;
      }

      // Skip most physics for resting leaves
      if (leaf.isResting) {
        // Only update matrix every 10th frame for resting leaves
        if (i % 10 === Math.floor(time * 60) % 10) {
          dummyObj.position.set(leaf.pos[0], leaf.pos[1], leaf.pos[2]);
          dummyObj.rotation.set(leaf.rot[0], leaf.rot[1], leaf.rot[2]);
          const scale = geometry.getAttribute("aScale").getX(i);
          dummyObj.scale.setScalar(scale);
          dummyObj.updateMatrix();
          mesh.setMatrixAt(i, dummyObj.matrix);
        }
        return;
      }

      // Character interaction
      const influence = Math.max(0, 1 - dist / characterInteractionRange);

      if (influence > 0.05) {
        const invDist = 1 / (dist + 0.1);

        // Push away from character
        const pushX = dx * invDist * influence * 50.0 * safeDelta;
        const pushZ = dz * invDist * influence * 50.0 * safeDelta;
        leaf.vel[0] += pushX;
        leaf.vel[2] += pushZ;

        // Upward kick
        leaf.vel[1] += influence * 25.0 * safeDelta;

        // Character velocity influence
        if (charSpeed > 0.1) {
          const velFactor =
            influence * characterPushStrength * 15.0 * safeDelta;
          leaf.vel[0] += charVelX * velFactor;
          leaf.vel[2] += charVelZ * velFactor;

          // Swirl effect
          const swirlStrength =
            influence * charSpeed * characterSwirlStrength * 10.0 * safeDelta;
          leaf.vel[0] += -charVelZ * swirlStrength;
          leaf.vel[2] += charVelX * swirlStrength;
        }

        // Explosive force when very close
        if (dist < 3) {
          leaf.vel[1] += influence * 20.0 * safeDelta;
          const explosionAngle = Math.random() * Math.PI * 2;
          const explosionForce = influence * 30.0 * safeDelta;
          leaf.vel[0] += Math.cos(explosionAngle) * explosionForce;
          leaf.vel[2] += Math.sin(explosionAngle) * explosionForce;

          // Add tumbling
          leaf.angularVel[0] += (Math.random() - 0.5) * 20 * influence;
          leaf.angularVel[1] += (Math.random() - 0.5) * 20 * influence;
          leaf.angularVel[2] += (Math.random() - 0.5) * 20 * influence;
        }
      }

      // Wind with simplex-like pattern
      const windX = Math.sin(leaf.pos[0] * 0.1 + time * 2) * 0.1 * safeDelta;
      const windZ = Math.cos(leaf.pos[2] * 0.1 + time * 1.5) * 0.1 * safeDelta;
      leaf.vel[0] += windX;
      leaf.vel[2] += windZ;

      // Gravity
      leaf.vel[1] -= 9.81 * safeDelta;

      // Check ground
      const groundY = getGroundHeight
        ? getGroundHeight(leaf.pos[0], leaf.pos[2])
        : 0;
      const isOnGround = leaf.pos[1] <= groundY + 0.05 + leaf.groundOffset;

      if (isOnGround) {
        leaf.pos[1] = groundY + 0.01 + leaf.groundOffset;

        // Ground collision response
        if (leaf.vel[1] < 0) {
          leaf.vel[1] = Math.abs(leaf.vel[1]) * 0.15; // Bounce
        }

        // Strong horizontal damping on ground
        leaf.vel[0] *= 0.7;
        leaf.vel[2] *= 0.7;
        leaf.vel[1] *= 0.85;

        // FORCE leaves to be completely flat on ground - no gradual, immediate
        leaf.rot[0] = 0;
        leaf.rot[2] = 0;
        leaf.angularVel[0] = 0;
        leaf.angularVel[2] = 0;

        // Check if leaf should rest
        const speedSq = leaf.vel[0] * leaf.vel[0] + leaf.vel[2] * leaf.vel[2];
        if (speedSq < 0.0001 && influence < 0.1) {
          leaf.restTimer += safeDelta;
          if (leaf.restTimer > 0.5) {
            leaf.isResting = true;
            leaf.vel[0] = 0;
            leaf.vel[1] = 0;
            leaf.vel[2] = 0;
            leaf.angularVel[0] = 0;
            leaf.angularVel[1] = 0;
            leaf.angularVel[2] = 0;
          }
        } else {
          leaf.restTimer = 0;
        }
      } else {
        // Air damping
        leaf.vel[0] *= 0.98;
        leaf.vel[1] *= 0.98;
        leaf.vel[2] *= 0.98;

        // Angular damping in air
        leaf.angularVel[0] *= 0.95;
        leaf.angularVel[1] *= 0.95;
        leaf.angularVel[2] *= 0.95;

        // Tumbling based on velocity - only when airborne
        leaf.angularVel[0] += leaf.vel[0] * 0.5;
        leaf.angularVel[2] += leaf.vel[2] * 0.5;

        // Flutter effect - leaves oscillate as they fall
        leaf.angularVel[0] += Math.sin(time * 3 + i) * 2 * safeDelta;
        leaf.angularVel[2] += Math.cos(time * 2.5 + i) * 2 * safeDelta;

        // Update rotation with angular velocity - only when airborne
        leaf.rot[0] += leaf.angularVel[0] * safeDelta;
        leaf.rot[1] += leaf.angularVel[1] * safeDelta;
        leaf.rot[2] += leaf.angularVel[2] * safeDelta;
      }

      // Update position
      leaf.pos[0] += leaf.vel[0] * safeDelta;
      leaf.pos[1] += leaf.vel[1] * safeDelta;
      leaf.pos[2] += leaf.vel[2] * safeDelta;

      // Respawn if too far
      const camDistSq =
        (leaf.pos[0] - camera.position.x) ** 2 +
        (leaf.pos[2] - camera.position.z) ** 2;

      if (camDistSq > areaSize * areaSize * 4) {
        const angle = Math.random() * Math.PI * 2;
        const radius = areaSize * 0.8;
        leaf.pos[0] = camera.position.x + Math.cos(angle) * radius;
        leaf.pos[1] = camera.position.y + Math.random() * 5 + 1;
        leaf.pos[2] = camera.position.z + Math.sin(angle) * radius;
        leaf.vel[0] = (Math.random() - 0.5) * 0.1;
        leaf.vel[1] = -Math.random() * 0.2;
        leaf.vel[2] = (Math.random() - 0.5) * 0.1;
        leaf.isResting = false;
        leaf.restTimer = 0;
      }

      // Update instance matrix
      dummyObj.position.set(leaf.pos[0], leaf.pos[1], leaf.pos[2]);
      dummyObj.rotation.set(leaf.rot[0], leaf.rot[1], leaf.rot[2]);
      const scale = geometry.getAttribute("aScale").getX(i);
      dummyObj.scale.setScalar(scale);
      dummyObj.updateMatrix();
      mesh.setMatrixAt(i, dummyObj.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
      castShadow
      receiveShadow
    />
  );
};
