import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// Vertex Shader - Creates billboards that always face camera and animate with wind
const vertexShader = `
uniform float time;
uniform vec2 dustSize;

attribute vec3 offset;
attribute float randomSize;
attribute float randomOpacity;

varying vec2 vUVs;
varying float vWindParams;
varying float vOpacity;

const float PI = 3.1415926535897932384626433832795;
const float TIME_REPEAT_PERIOD = 4.0;

// Hash function for random values
float hash12(vec2 p) {
  vec3 p3  = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Simple noise function
float noise12(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Rotate 2D
mat2 rotate2D(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

float saturate(float x) {
  return clamp(x, 0.0, 1.0);
}

void main() {
  vec3 baseWorldPosition = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz + offset;
  float hashSample = hash12(baseWorldPosition.xz);
  
  float hashedTime = time + hashSample * 100.0;
  
  // Wind direction based on noise
  float windDir = noise12(baseWorldPosition.xz * 0.05 + 0.5 * time);
  vec3 windAxis = vec3(sin(windDir), 0.0, -cos(windDir));
  
  // Repeating animation with fade in/out
  float repeatingTime = mod(hashedTime, TIME_REPEAT_PERIOD);
  float fadeInOut = (
    smoothstep(0.0, TIME_REPEAT_PERIOD * 0.25, repeatingTime) *
    smoothstep(TIME_REPEAT_PERIOD, TIME_REPEAT_PERIOD * 0.75, repeatingTime)
  );
  
  // Wind offset
  vec3 windOffset = offset + windAxis * repeatingTime * 5.0;
  
  // Calculate world position of particle center (with wind offset)
  vec3 particleWorldCenter = (modelMatrix * vec4(windOffset, 1.0)).xyz;
  
  // Billboard effect - always face camera from particle center
  vec3 toCam = normalize(cameraPosition - particleWorldCenter);
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 right = normalize(cross(up, toCam));
  vec3 billboardUp = cross(toCam, right);
  
  // Scale the local position by dust size AND random size variation
  vec2 scaledPos = position.xy * dustSize * randomSize;
  
  // Build billboard position using camera-facing axes
  vec3 billboardPosition = particleWorldCenter + right * scaledPos.x + billboardUp * scaledPos.y;
  
  // Transform to view space
  vec3 transformed = (inverse(modelMatrix) * vec4(billboardPosition, 1.0)).xyz;
  
  vWindParams = fadeInOut;
  vOpacity = randomOpacity; // Pass opacity to fragment shader
  
  // Random rotation for variety
  float randomAngle = hashSample * 2.0 * PI;
  vUVs = rotate2D(randomAngle) * uv;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
}
`;

// Fragment Shader - Renders the dust texture with fade animation
const fragmentShader = `
uniform sampler2D diffuseTexture;

varying vec2 vUVs;
varying float vWindParams;
varying float vOpacity;

void main() {
  // Use .xyzx swizzling: RGB from texture, but use RED channel as alpha
  // This converts grayscale brightness to alpha (white = opaque, black = transparent)
  vec4 colour = texture2D(diffuseTexture, vUVs).xyzx;
  
  // Make dust lighter and more visible (warm dust color)
  colour.xyz = vec3(0.8, 0.75, 0.7); // Warm light dust color
  
  // Apply fade animation and random opacity variation to alpha
  colour.w *= vWindParams * vOpacity * 0.6; // Adjusted opacity
  
  gl_FragColor = colour;
}
`;

interface DustParticlesProps {
  count?: number; // Number of dust particles
  spawnRange?: number; // Range around center point to spawn particles
  maxDistance?: number; // Maximum distance from camera to render
  dustSize?: [number, number]; // Size of each dust particle [width, height]
  enabled?: boolean; // Toggle on/off
}

export function DustParticles({
  count = 8,
  spawnRange = 20.0,
  maxDistance = 50.0,
  dustSize = [0.4, 0.4],
  enabled = true,
}: DustParticlesProps) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const geometryRef = useRef<THREE.InstancedBufferGeometry | null>(null);
  const dustTextureRef = useRef<THREE.Texture | null>(null);
  const { camera } = useThree();

  const meshesRef = useRef<THREE.Mesh[]>([]);
  const timeRef = useRef(0);
  const prevCountRef = useRef(count);
  const prevSpawnRangeRef = useRef(spawnRange);

  // Initialize ONCE on mount - never recreate!
  useEffect(() => {
    // Load texture
    const loader = new THREE.TextureLoader();
    const texture = loader.load("/textures/dust.png");
    texture.colorSpace = THREE.SRGBColorSpace;
    dustTextureRef.current = texture;

    // Create initial geometry with random variations
    const offsets = new Float32Array(count * 3);
    const randomSizes = new Float32Array(count);
    const randomOpacities = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      offsets[i * 3 + 0] = (Math.random() * 2.0 - 1.0) * (spawnRange / 2);
      offsets[i * 3 + 1] = Math.random() * 1.0 + 2.0;
      offsets[i * 3 + 2] = (Math.random() * 2.0 - 1.0) * (spawnRange / 2);

      // Random size variation (0.5 to 1.5 multiplier)
      randomSizes[i] = Math.random() * 1.0 + 0.5;

      // Random opacity variation (0.3 to 1.0)
      randomOpacities[i] = Math.random() * 0.7 + 0.3;
    }

    const plane = new THREE.PlaneGeometry(1, 1, 1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.instanceCount = count;
    geo.setAttribute("position", plane.attributes.position);
    geo.setAttribute("uv", plane.attributes.uv);
    geo.setAttribute("normal", plane.attributes.normal);
    geo.setAttribute("offset", new THREE.InstancedBufferAttribute(offsets, 3));
    geo.setAttribute(
      "randomSize",
      new THREE.InstancedBufferAttribute(randomSizes, 1)
    );
    geo.setAttribute(
      "randomOpacity",
      new THREE.InstancedBufferAttribute(randomOpacities, 1)
    );
    geo.setIndex(plane.index);
    geo.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, 0, 0),
      spawnRange
    );
    geometryRef.current = geo;

    // Create material with additive blending for ethereal dust effect
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
        diffuseTexture: { value: texture },
        dustSize: { value: new THREE.Vector2(dustSize[0], dustSize[1]) },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false, // Critical for transparent particles
      depthTest: true,
      blending: THREE.AdditiveBlending, // Makes dust glow and look ethereal
    });
    materialRef.current = mat;

    // Cleanup
    return () => {
      geo.dispose();
      mat.dispose();
      plane.dispose();
      texture.dispose();

      // Clear all meshes
      meshesRef.current.forEach((m) => {
        m.removeFromParent();
      });
      meshesRef.current = [];
    };
  }, []); // EMPTY DEPS - only run once!

  // Update geometry if count/spawnRange changes (recreate offsets only)
  useEffect(() => {
    if (!geometryRef.current) return;
    if (
      prevCountRef.current === count &&
      prevSpawnRangeRef.current === spawnRange
    )
      return;

    prevCountRef.current = count;
    prevSpawnRangeRef.current = spawnRange;

    // Recreate offsets and random variations
    const offsets = new Float32Array(count * 3);
    const randomSizes = new Float32Array(count);
    const randomOpacities = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      offsets[i * 3 + 0] = (Math.random() * 2.0 - 1.0) * (spawnRange / 2);
      offsets[i * 3 + 1] = Math.random() * 1.0 + 2.0;
      offsets[i * 3 + 2] = (Math.random() * 2.0 - 1.0) * (spawnRange / 2);

      randomSizes[i] = Math.random() * 1.0 + 0.5;
      randomOpacities[i] = Math.random() * 0.7 + 0.3;
    }

    geometryRef.current.instanceCount = count;
    geometryRef.current.setAttribute(
      "offset",
      new THREE.InstancedBufferAttribute(offsets, 3)
    );
    geometryRef.current.setAttribute(
      "randomSize",
      new THREE.InstancedBufferAttribute(randomSizes, 1)
    );
    geometryRef.current.setAttribute(
      "randomOpacity",
      new THREE.InstancedBufferAttribute(randomOpacities, 1)
    );
    geometryRef.current.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, 0, 0),
      spawnRange
    );
  }, [count, spawnRange]);

  // Create mesh for each cell
  const createMesh = () => {
    if (!geometryRef.current || !materialRef.current) return null;

    const m = new THREE.Mesh(geometryRef.current, materialRef.current);
    m.receiveShadow = false;
    m.castShadow = false;
    m.visible = true;

    if (groupRef.current) {
      meshesRef.current.push(m);
      groupRef.current.add(m);
    }

    return m;
  };

  // Animation loop - Update uniforms every frame
  useFrame((state, delta) => {
    if (!enabled || !groupRef.current || !materialRef.current) return;

    // Update time uniform (animation)
    timeRef.current += delta;
    materialRef.current.uniforms.time.value = timeRef.current;

    // Update dustSize uniform (real-time control)
    materialRef.current.uniforms.dustSize.value.set(dustSize[0], dustSize[1]);

    // Frustum culling
    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();
    projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(projScreenMatrix);

    // Hide all meshes first
    for (const child of groupRef.current.children) {
      if (child instanceof THREE.Mesh) {
        child.visible = false;
      }
    }

    const meshes = [...meshesRef.current];

    // Calculate base cell position (snap to grid)
    const baseCellPos = camera.position.clone();
    baseCellPos.divideScalar(spawnRange);
    baseCellPos.floor();
    baseCellPos.multiplyScalar(spawnRange);

    const cameraPosXZ = new THREE.Vector3(
      camera.position.x,
      0,
      camera.position.z
    );

    // Create grid of dust particle cells around camera
    for (let x = -3; x < 3; x++) {
      for (let z = -3; z < 3; z++) {
        const currentCell = new THREE.Vector3(
          baseCellPos.x + x * spawnRange,
          0,
          baseCellPos.z + z * spawnRange
        );

        // Distance culling
        const aabb = new THREE.Box3().setFromCenterAndSize(
          currentCell,
          new THREE.Vector3(spawnRange, 100, spawnRange)
        );

        const distToCell = aabb.distanceToPoint(cameraPosXZ);
        if (distToCell > maxDistance) {
          continue;
        }

        // Frustum culling
        if (!frustum.intersectsBox(aabb)) {
          continue;
        }

        // Reuse existing mesh or create new one
        const m = meshes.length > 0 ? meshes.pop()! : createMesh();
        if (!m) continue;

        m.position.copy(currentCell);
        m.position.y = 0;
        m.visible = true;
      }
    }
  });

  if (!enabled) return null;

  return <group ref={groupRef} />;
}
