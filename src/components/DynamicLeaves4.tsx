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
  console.log("🍂 DynamicLeaves4 component mounted!");
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { camera } = useThree();

  // Physics data stored in DataTextures for GPU access
  const textureSize = Math.ceil(Math.sqrt(count));
  const texturePixels = textureSize * textureSize;

  const positionTexture = useRef<THREE.DataTexture>(null);
  const velocityTexture = useRef<THREE.DataTexture>(null);
  const rotationTexture = useRef<THREE.DataTexture>(null);
  const metaTexture = useRef<THREE.DataTexture>(null);

  // Create optimized leaf geometry with instanced attributes
  const geometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(0.3, 0.3, 1, 1);
    geometry.rotateX(-Math.PI * 0.5);

    const scaleArray = new Float32Array(count);
    const leafIdArray = new Float32Array(count);
    const colorArray = new Float32Array(count * 3);

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

    for (let i = 0; i < count; i++) {
      scaleArray[i] = Math.random() * 0.5 + 0.5;
      leafIdArray[i] = i;

      const colorA = leafColors[Math.floor(Math.random() * leafColors.length)];
      const colorB = leafColors[Math.floor(Math.random() * leafColors.length)];
      const color = colorA.clone().lerp(colorB, Math.random());

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
      "aScale",
      new THREE.InstancedBufferAttribute(scaleArray, 1)
    );
    geometry.setAttribute(
      "aLeafId",
      new THREE.InstancedBufferAttribute(leafIdArray, 1)
    );
    geometry.setAttribute(
      "color",
      new THREE.InstancedBufferAttribute(colorArray, 3)
    );

    return geometry;
  }, [count]);

  // GPU-accelerated shader material
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        positionTexture: { value: null },
        velocityTexture: { value: null },
        rotationTexture: { value: null },
        textureSize: { value: textureSize },
      },
      vertexShader: `
        attribute float aScale;
        attribute float aLeafId;
        attribute vec3 color;

        uniform float time;
        uniform sampler2D positionTexture;
        uniform sampler2D rotationTexture;
        uniform float textureSize;

        varying vec3 vColor;

        vec2 getUV(float id) {
          float x = mod(id, textureSize);
          float y = floor(id / textureSize);
          return (vec2(x, y) + 0.5) / textureSize;
        }

        void main() {
          vColor = color;
          
          vec2 uv = getUV(aLeafId);
          vec4 posData = texture2D(positionTexture, uv);
          vec4 rotData = texture2D(rotationTexture, uv);
          
          vec3 leafPos = posData.xyz;
          vec3 leafRot = rotData.xyz;
          
          // Apply rotation
          vec3 pos = position;
          
          // Rotate around X
          float cosX = cos(leafRot.x);
          float sinX = sin(leafRot.x);
          float y1 = pos.y * cosX - pos.z * sinX;
          float z1 = pos.y * sinX + pos.z * cosX;
          pos.y = y1;
          pos.z = z1;
          
          // Rotate around Y
          float cosY = cos(leafRot.y);
          float sinY = sin(leafRot.y);
          float x2 = pos.x * cosY + pos.z * sinY;
          float z2 = -pos.x * sinY + pos.z * cosY;
          pos.x = x2;
          pos.z = z2;
          
          // Rotate around Z
          float cosZ = cos(leafRot.z);
          float sinZ = sin(leafRot.z);
          float x3 = pos.x * cosZ - pos.y * sinZ;
          float y3 = pos.x * sinZ + pos.y * cosZ;
          pos.x = x3;
          pos.y = y3;
          
          // Apply scale
          pos *= aScale;
          
          // Apply position
          pos += leafPos;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;

        void main() {
          gl_FragColor = vec4(vColor, 0.9);
        }
      `,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: true,
    });
  }, [textureSize]);

  // Initialize physics data in textures
  const leafDataRef = useRef<
    Array<{
      pos: Float32Array;
      vel: Float32Array;
      rot: Float32Array;
      angularVel: Float32Array;
      groundOffset: number;
      isResting: boolean;
      restTimer: number;
    }>
  >([]);

  useEffect(() => {
    console.log("🍂 DynamicLeaves4 initializing...", { count, areaSize });
    // Initialize data arrays
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
        angularVel: new Float32Array([
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
        ]),
        groundOffset: Math.random() * 0.015,
        isResting: false,
        restTimer: 0,
      });
    }

    // Create data textures
    const posData = new Float32Array(texturePixels * 4);
    const velData = new Float32Array(texturePixels * 4);
    const rotData = new Float32Array(texturePixels * 4);
    const metaData = new Float32Array(texturePixels * 4);

    for (let i = 0; i < count; i++) {
      const leaf = leafDataRef.current[i];
      posData[i * 4] = leaf.pos[0];
      posData[i * 4 + 1] = leaf.pos[1];
      posData[i * 4 + 2] = leaf.pos[2];
      posData[i * 4 + 3] = 1.0;

      rotData[i * 4] = leaf.rot[0];
      rotData[i * 4 + 1] = leaf.rot[1];
      rotData[i * 4 + 2] = leaf.rot[2];
      rotData[i * 4 + 3] = 1.0;

      velData[i * 4] = leaf.vel[0];
      velData[i * 4 + 1] = leaf.vel[1];
      velData[i * 4 + 2] = leaf.vel[2];
      velData[i * 4 + 3] = 1.0;

      metaData[i * 4] = leaf.groundOffset;
      metaData[i * 4 + 1] = leaf.isResting ? 1.0 : 0.0;
      metaData[i * 4 + 2] = leaf.restTimer;
      metaData[i * 4 + 3] = 1.0;
    }

    const posTex = new THREE.DataTexture(
      posData,
      textureSize,
      textureSize,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    posTex.needsUpdate = true;
    positionTexture.current = posTex;

    const velTex = new THREE.DataTexture(
      velData,
      textureSize,
      textureSize,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    velTex.needsUpdate = true;
    velocityTexture.current = velTex;

    const rotTex = new THREE.DataTexture(
      rotData,
      textureSize,
      textureSize,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    rotTex.needsUpdate = true;
    rotationTexture.current = rotTex;

    const metaTex = new THREE.DataTexture(
      metaData,
      textureSize,
      textureSize,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    metaTex.needsUpdate = true;
    metaTexture.current = metaTex;

    material.uniforms.positionTexture.value = posTex;
    material.uniforms.rotationTexture.value = rotTex;

    console.log("🍂 Textures created and assigned to material");
  }, [count, areaSize, textureSize, material, getGroundHeight]);

  // Optimized animation loop with spatial partitioning hint
  useFrame((state, delta) => {
    if (
      !meshRef.current ||
      !positionTexture.current ||
      !velocityTexture.current ||
      !rotationTexture.current
    )
      return;

    const time = state.clock.elapsedTime;
    const safeDelta = Math.min(delta, 0.1);

    material.uniforms.time.value = time;

    // Cache character data
    const charX = ybotPosition.x;
    const charY = ybotPosition.y;
    const charZ = ybotPosition.z;
    const charVelX = ybotVelocity.x;
    const charVelZ = ybotVelocity.z;
    const charSpeed = Math.sqrt(charVelX * charVelX + charVelZ * charVelZ);

    // Batch update arrays
    const posData = positionTexture.current.image.data;
    const velData = velocityTexture.current.image.data;
    const rotData = rotationTexture.current.image.data;

    let needsUpdate = false;

    // Process leaves in batches
    const batchSize = 100;
    const frame = Math.floor(time * 60);
    const startIdx = (frame * batchSize) % count;
    const endIdx = Math.min(startIdx + batchSize, count);

    for (let i = 0; i < count; i++) {
      const leaf = leafDataRef.current[i];

      // Calculate distance to character
      const dx = leaf.pos[0] - charX;
      const dz = leaf.pos[2] - charZ;
      const distSq = dx * dx + dz * dz;
      const dist = Math.sqrt(distSq);

      // Wake up resting leaves near character
      if (leaf.isResting && dist < characterInteractionRange) {
        leaf.isResting = false;
        leaf.restTimer = 0;
      }

      // Optimize: only update active leaves or leaves in current batch
      const shouldFullUpdate = !leaf.isResting || (i >= startIdx && i < endIdx);

      if (!shouldFullUpdate && leaf.isResting) continue;

      needsUpdate = true;

      // Character interaction
      const influence = Math.max(0, 1 - dist / characterInteractionRange);

      if (influence > 0.05 && !leaf.isResting) {
        const invDist = 1 / (dist + 0.1);

        // Push force
        leaf.vel[0] += dx * invDist * influence * 50.0 * safeDelta;
        leaf.vel[2] += dz * invDist * influence * 50.0 * safeDelta;
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

        // Explosion when very close
        if (dist < 3) {
          leaf.vel[1] += influence * 20.0 * safeDelta;
          const angle = Math.random() * Math.PI * 2;
          const force = influence * 30.0 * safeDelta;
          leaf.vel[0] += Math.cos(angle) * force;
          leaf.vel[2] += Math.sin(angle) * force;

          leaf.angularVel[0] += (Math.random() - 0.5) * 20 * influence;
          leaf.angularVel[1] += (Math.random() - 0.5) * 20 * influence;
          leaf.angularVel[2] += (Math.random() - 0.5) * 20 * influence;
        }
      }

      if (leaf.isResting) continue;

      // Wind
      const windX = Math.sin(leaf.pos[0] * 0.1 + time * 2) * 0.1 * safeDelta;
      const windZ = Math.cos(leaf.pos[2] * 0.1 + time * 1.5) * 0.1 * safeDelta;
      leaf.vel[0] += windX;
      leaf.vel[2] += windZ;

      // Gravity
      leaf.vel[1] -= 9.81 * safeDelta;

      // Ground collision
      const groundY = getGroundHeight
        ? getGroundHeight(leaf.pos[0], leaf.pos[2])
        : 0;
      const isOnGround = leaf.pos[1] <= groundY + 0.05 + leaf.groundOffset;

      if (isOnGround) {
        leaf.pos[1] = groundY + 0.01 + leaf.groundOffset;

        if (leaf.vel[1] < 0) {
          leaf.vel[1] = Math.abs(leaf.vel[1]) * 0.15;
        }

        // Ground damping
        leaf.vel[0] *= 0.7;
        leaf.vel[2] *= 0.7;
        leaf.vel[1] *= 0.85;

        // Force flat on ground
        leaf.rot[0] = 0;
        leaf.rot[2] = 0;
        leaf.angularVel[0] = 0;
        leaf.angularVel[2] = 0;

        // Check for rest
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
        // Air physics
        leaf.vel[0] *= 0.98;
        leaf.vel[1] *= 0.98;
        leaf.vel[2] *= 0.98;

        leaf.angularVel[0] *= 0.95;
        leaf.angularVel[1] *= 0.95;
        leaf.angularVel[2] *= 0.95;

        // Tumbling
        leaf.angularVel[0] += leaf.vel[0] * 0.5;
        leaf.angularVel[2] += leaf.vel[2] * 0.5;

        // Flutter
        leaf.angularVel[0] += Math.sin(time * 3 + i) * 2 * safeDelta;
        leaf.angularVel[2] += Math.cos(time * 2.5 + i) * 2 * safeDelta;

        // Update rotation
        leaf.rot[0] += leaf.angularVel[0] * safeDelta;
        leaf.rot[1] += leaf.angularVel[1] * safeDelta;
        leaf.rot[2] += leaf.angularVel[2] * safeDelta;
      }

      // Update position
      leaf.pos[0] += leaf.vel[0] * safeDelta;
      leaf.pos[1] += leaf.vel[1] * safeDelta;
      leaf.pos[2] += leaf.vel[2] * safeDelta;

      // Respawn check
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

      // Write to texture data
      posData[i * 4] = leaf.pos[0];
      posData[i * 4 + 1] = leaf.pos[1];
      posData[i * 4 + 2] = leaf.pos[2];

      rotData[i * 4] = leaf.rot[0];
      rotData[i * 4 + 1] = leaf.rot[1];
      rotData[i * 4 + 2] = leaf.rot[2];
    }

    // Batch texture updates
    if (needsUpdate) {
      positionTexture.current.needsUpdate = true;
      rotationTexture.current.needsUpdate = true;
    }
  });

  // Don't render until textures are initialized
  if (!positionTexture.current || !rotationTexture.current) {
    console.log("🍂 Waiting for textures to initialize...");
    return null;
  }

  console.log("🍂 Rendering", count, "leaves");

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
