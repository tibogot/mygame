import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// Vertex Shader - Animates butterfly wings with flapping and flight motion
const vertexShader = `
uniform float time;
uniform vec2 butterflySize;

attribute vec3 offset;
attribute float randomScale;
attribute float randomTime;

varying vec2 vUv;

const float PI = 3.1415926535897932384626433832795;
const float FLAP_SPEED = 20.0;
const float FLIGHT_SPEED = 0.5;
const float LOOP_SIZE = 2.0;

// Hash function for random values
float hash11(float p) {
  vec3 p3  = fract(vec3(p) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Simple noise function
float noise11(float x) {
  float i = floor(x);
  float f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hash11(i), hash11(i + 1.0), u);
}

// Rotate around Y axis
mat3 rotateY(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat3(
    c, 0.0, s,
    0.0, 1.0, 0.0,
    -s, 0.0, c
  );
}

void main() {
  vUv = uv;
  
  // Start with base position
  vec3 pos = position;
  
  // Scale butterfly by size and random variation
  pos *= vec3(butterflySize.x, butterflySize.y, 1.0) * randomScale;
  
  // Wing flapping animation
  float flapTime = time * FLAP_SPEED + randomTime * 100.0;
  
  // Wings flap up and down (more at edges, none at center)
  float wingAmount = abs(position.x) * 2.0;
  pos.y += sin(flapTime) * wingAmount * randomScale * 0.3;
  
  // Wings spread open and close
  pos.x *= abs(cos(flapTime)) * 0.8 + 0.2;
  
  // Flight path - circular looping motion
  float loopTime = time * FLIGHT_SPEED + randomTime * 123.23;
  float heightNoise = noise11(time * 3.0 + randomTime * 100.0);
  
  vec3 flightOffset = vec3(
    sin(loopTime) * LOOP_SIZE,
    heightNoise * 0.5,
    cos(loopTime) * LOOP_SIZE
  );
  
  // Rotate butterfly to face forward in flight direction
  pos = rotateY(-loopTime + PI / 2.0) * pos;
  
  // Apply flight offset and spawn position
  pos += flightOffset + offset;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

// Fragment Shader - Renders butterfly texture with transparency
const fragmentShader = `
uniform sampler2D butterflyTexture;

varying vec2 vUv;

void main() {
  vec4 texColor = texture2D(butterflyTexture, vUv);
  
  // Alpha test - discard fully transparent pixels
  if (texColor.a < 0.1) {
    discard;
  }
  
  gl_FragColor = texColor;
}
`;

// Depth shader for casting shadows - SAME vertex transformations!
const depthVertexShader = `
uniform float time;
uniform vec2 butterflySize;

attribute vec3 offset;
attribute float randomScale;
attribute float randomTime;

varying vec2 vUv;

const float PI = 3.1415926535897932384626433832795;
const float FLAP_SPEED = 20.0;
const float FLIGHT_SPEED = 0.5;
const float LOOP_SIZE = 2.0;

float hash11(float p) {
  vec3 p3  = fract(vec3(p) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise11(float x) {
  float i = floor(x);
  float f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hash11(i), hash11(i + 1.0), u);
}

mat3 rotateY(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat3(
    c, 0.0, s,
    0.0, 1.0, 0.0,
    -s, 0.0, c
  );
}

void main() {
  vUv = uv; // Pass UV to fragment shader for texture sampling!
  
  vec3 pos = position;
  pos *= vec3(butterflySize.x, butterflySize.y, 1.0) * randomScale;
  
  float flapTime = time * FLAP_SPEED + randomTime * 100.0;
  float wingAmount = abs(position.x) * 2.0;
  pos.y += sin(flapTime) * wingAmount * randomScale * 0.3;
  pos.x *= abs(cos(flapTime)) * 0.8 + 0.2;
  
  float loopTime = time * FLIGHT_SPEED + randomTime * 123.23;
  float heightNoise = noise11(time * 3.0 + randomTime * 100.0);
  
  vec3 flightOffset = vec3(
    sin(loopTime) * LOOP_SIZE,
    heightNoise * 0.5,
    cos(loopTime) * LOOP_SIZE
  );
  
  pos = rotateY(-loopTime + PI / 2.0) * pos;
  pos += flightOffset + offset;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const depthFragmentShader = `
uniform sampler2D butterflyTexture;
varying vec2 vUv;

void main() {
  // Sample texture and test alpha - KEY FOR BUTTERFLY-SHAPED SHADOWS!
  vec4 texColor = texture2D(butterflyTexture, vUv);
  
  // Discard transparent pixels (same as main material)
  if (texColor.a < 0.1) {
    discard;
  }
  
  // Output depth for shadow map
  gl_FragColor = vec4(vec3(gl_FragCoord.z), 1.0);
}
`;

interface ButterflyParticlesProps {
  count?: number;
  spawnRange?: number;
  maxDistance?: number;
  butterflySize?: [number, number];
  enabled?: boolean;
  texture?: "butterfly" | "moth" | "both";
  heightMin?: number;
  heightMax?: number;
  spreadRadius?: number;
}

export function ButterflyParticles({
  count = 8,
  spawnRange = 40.0,
  maxDistance = 100.0,
  butterflySize = [0.5, 1.25],
  enabled = true,
  texture = "butterfly",
  heightMin = 2.0,
  heightMax = 5.0,
  spreadRadius = 1.0,
}: ButterflyParticlesProps) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const depthMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const geometryRef = useRef<THREE.InstancedBufferGeometry | null>(null);
  const butterflyTextureRef = useRef<THREE.Texture | null>(null);
  const { camera } = useThree();

  const meshesRef = useRef<THREE.Mesh[]>([]);
  const timeRef = useRef(0);
  const prevCountRef = useRef(count);
  const prevSpawnRangeRef = useRef(spawnRange);
  const prevHeightMinRef = useRef(heightMin);
  const prevHeightMaxRef = useRef(heightMax);
  const prevSpreadRadiusRef = useRef(spreadRadius);

  // Initialize ONCE on mount
  useEffect(() => {
    // Load texture
    const loader = new THREE.TextureLoader();
    const tex = loader.load(`/textures/${texture}.png`);
    tex.colorSpace = THREE.SRGBColorSpace;
    butterflyTextureRef.current = tex;

    // Create geometry with segments for wing deformation
    const plane = new THREE.PlaneGeometry(1, 1, 2, 1);
    plane.rotateX(-Math.PI / 2);

    // Create instanced geometry
    const offsets = new Float32Array(count * 3);
    const randomScales = new Float32Array(count);
    const randomTimes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      offsets[i * 3 + 0] =
        (Math.random() * 2.0 - 1.0) * (spawnRange / 2) * spreadRadius;
      offsets[i * 3 + 1] = Math.random() * (heightMax - heightMin) + heightMin;
      offsets[i * 3 + 2] =
        (Math.random() * 2.0 - 1.0) * (spawnRange / 2) * spreadRadius;

      randomScales[i] = Math.random() * 0.2 + 0.35;
      randomTimes[i] = Math.random();
    }

    const geo = new THREE.InstancedBufferGeometry();
    geo.instanceCount = count;
    geo.setAttribute("position", plane.attributes.position);
    geo.setAttribute("uv", plane.attributes.uv);
    geo.setAttribute("normal", plane.attributes.normal);
    geo.setAttribute("offset", new THREE.InstancedBufferAttribute(offsets, 3));
    geo.setAttribute(
      "randomScale",
      new THREE.InstancedBufferAttribute(randomScales, 1)
    );
    geo.setAttribute(
      "randomTime",
      new THREE.InstancedBufferAttribute(randomTimes, 1)
    );
    geo.setIndex(plane.index);
    geo.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, 0, 0),
      spawnRange
    );
    geometryRef.current = geo;

    // Create main material
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
        butterflyTexture: { value: tex },
        butterflySize: {
          value: new THREE.Vector2(butterflySize[0], butterflySize[1]),
        },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: true,
    });
    materialRef.current = mat;

    // Create custom depth material for shadows - KEY FOR SHADOWS!
    const depthMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
        butterflyTexture: { value: tex }, // Need texture for alpha testing!
        butterflySize: {
          value: new THREE.Vector2(butterflySize[0], butterflySize[1]),
        },
      },
      vertexShader: depthVertexShader,
      fragmentShader: depthFragmentShader,
    });
    depthMaterialRef.current = depthMat;

    // Cleanup
    return () => {
      geo.dispose();
      mat.dispose();
      depthMat.dispose();
      plane.dispose();
      tex.dispose();

      meshesRef.current.forEach((m) => {
        m.removeFromParent();
      });
      meshesRef.current = [];
    };
  }, []);

  // Update texture when texture type changes
  useEffect(() => {
    if (!materialRef.current || !depthMaterialRef.current) return;

    const loader = new THREE.TextureLoader();
    const newTexture = loader.load(`/textures/${texture}.png`);
    newTexture.colorSpace = THREE.SRGBColorSpace;

    // Update BOTH materials!
    materialRef.current.uniforms.butterflyTexture.value = newTexture;
    depthMaterialRef.current.uniforms.butterflyTexture.value = newTexture;

    if (butterflyTextureRef.current) {
      butterflyTextureRef.current.dispose();
    }
    butterflyTextureRef.current = newTexture;
  }, [texture]);

  // Update geometry if parameters change
  useEffect(() => {
    if (!geometryRef.current) return;
    if (
      prevCountRef.current === count &&
      prevSpawnRangeRef.current === spawnRange &&
      prevHeightMinRef.current === heightMin &&
      prevHeightMaxRef.current === heightMax &&
      prevSpreadRadiusRef.current === spreadRadius
    )
      return;

    prevCountRef.current = count;
    prevSpawnRangeRef.current = spawnRange;
    prevHeightMinRef.current = heightMin;
    prevHeightMaxRef.current = heightMax;
    prevSpreadRadiusRef.current = spreadRadius;

    const offsets = new Float32Array(count * 3);
    const randomScales = new Float32Array(count);
    const randomTimes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      offsets[i * 3 + 0] =
        (Math.random() * 2.0 - 1.0) * (spawnRange / 2) * spreadRadius;
      offsets[i * 3 + 1] = Math.random() * (heightMax - heightMin) + heightMin;
      offsets[i * 3 + 2] =
        (Math.random() * 2.0 - 1.0) * (spawnRange / 2) * spreadRadius;

      randomScales[i] = Math.random() * 0.2 + 0.35;
      randomTimes[i] = Math.random();
    }

    geometryRef.current.instanceCount = count;
    geometryRef.current.setAttribute(
      "offset",
      new THREE.InstancedBufferAttribute(offsets, 3)
    );
    geometryRef.current.setAttribute(
      "randomScale",
      new THREE.InstancedBufferAttribute(randomScales, 1)
    );
    geometryRef.current.setAttribute(
      "randomTime",
      new THREE.InstancedBufferAttribute(randomTimes, 1)
    );
    geometryRef.current.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, 0, 0),
      spawnRange
    );
  }, [count, spawnRange, heightMin, heightMax, spreadRadius]);

  // Create mesh for each cell
  const createMesh = () => {
    if (
      !geometryRef.current ||
      !materialRef.current ||
      !depthMaterialRef.current
    )
      return null;

    const m = new THREE.Mesh(geometryRef.current, materialRef.current);

    // Enable shadows AND provide custom depth material!
    m.castShadow = true;
    m.receiveShadow = true;
    m.customDepthMaterial = depthMaterialRef.current; // KEY FOR SHADOWS!
    m.visible = true;

    if (groupRef.current) {
      meshesRef.current.push(m);
      groupRef.current.add(m);
    }

    return m;
  };

  // Animation loop
  useFrame((state, delta) => {
    if (
      !enabled ||
      !groupRef.current ||
      !materialRef.current ||
      !depthMaterialRef.current
    )
      return;

    // Update time uniform for BOTH materials!
    timeRef.current += delta;
    materialRef.current.uniforms.time.value = timeRef.current;
    depthMaterialRef.current.uniforms.time.value = timeRef.current; // Sync depth material!

    // Update butterflySize uniform
    materialRef.current.uniforms.butterflySize.value.set(
      butterflySize[0],
      butterflySize[1]
    );
    depthMaterialRef.current.uniforms.butterflySize.value.set(
      butterflySize[0],
      butterflySize[1]
    );

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

    // Calculate base cell position
    const baseCellPos = camera.position.clone();
    baseCellPos.divideScalar(spawnRange);
    baseCellPos.floor();
    baseCellPos.multiplyScalar(spawnRange);

    const cameraPosXZ = new THREE.Vector3(
      camera.position.x,
      0,
      camera.position.z
    );

    // Create grid of butterfly cells around camera
    for (let x = -3; x < 3; x++) {
      for (let z = -3; z < 3; z++) {
        const currentCell = new THREE.Vector3(
          baseCellPos.x + x * spawnRange,
          0,
          baseCellPos.z + z * spawnRange
        );

        const aabb = new THREE.Box3().setFromCenterAndSize(
          currentCell,
          new THREE.Vector3(spawnRange, 100, spawnRange)
        );

        const distToCell = aabb.distanceToPoint(cameraPosXZ);
        if (distToCell > maxDistance) {
          continue;
        }

        if (!frustum.intersectsBox(aabb)) {
          continue;
        }

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
