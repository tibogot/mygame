import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// Vertex Shader - Simple vertical falling rain
const vertexShader = `
uniform float time;
uniform float rainSpeed;
uniform float rainHeight;

attribute vec3 offset;
attribute float randomSpeed;
attribute float randomPhase;

varying float vAlpha;
varying float vHeight;

void main() {
  vec3 pos = position;
  
  // Raindrop is elongated vertically (motion blur)
  pos.y *= 0.5;
  
  // Calculate fall position
  float fallSpeed = rainSpeed * randomSpeed;
  float fallDist = mod(time * fallSpeed + randomPhase * rainHeight, rainHeight);
  
  // World position - falls straight down
  vec3 worldPos = offset;
  worldPos.y = rainHeight - fallDist;
  
  // Height ratio for coloring
  float heightRatio = worldPos.y / rainHeight;
  vHeight = heightRatio;
  
  // Apply world position
  pos += worldPos;
  
  // Fade in at spawn, fade out near ground
  vAlpha = smoothstep(rainHeight, rainHeight * 0.9, worldPos.y) * 
           smoothstep(0.0, 0.5, worldPos.y);
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const fragmentShader = `
uniform vec3 rainColor;
uniform float rainOpacity;

varying float vAlpha;
varying float vHeight;

void main() {
  // Use custom rain color with gradient based on height
  // Higher drops are brighter (catching sky light)
  vec3 topColor = rainColor * 1.2; // Brighter at top
  vec3 bottomColor = rainColor * 0.7; // Darker at bottom
  
  vec3 color = mix(bottomColor, topColor, vHeight);
  
  // Add slight specular highlight
  float specular = pow(vHeight, 2.0) * 0.3;
  color += vec3(specular) * rainColor;
  
  float alpha = vAlpha * rainOpacity;
  
  gl_FragColor = vec4(color, alpha);
}
`;

// Depth shader for shadows - SAME transformations as main shader!
const depthVertexShader = `
uniform float time;
uniform float rainSpeed;
uniform float rainHeight;

attribute vec3 offset;
attribute float randomSpeed;
attribute float randomPhase;

void main() {
  vec3 pos = position;
  pos.y *= 0.5;
  
  float fallSpeed = rainSpeed * randomSpeed;
  float fallDist = mod(time * fallSpeed + randomPhase * rainHeight, rainHeight);
  
  vec3 worldPos = offset;
  worldPos.y = rainHeight - fallDist;
  
  pos += worldPos;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const depthFragmentShader = `
void main() {
  gl_FragColor = vec4(vec3(gl_FragCoord.z), 1.0);
}
`;

interface RainParticles3DProps {
  enabled?: boolean;
  density?: number; // Particles per cell
  areaSize?: number; // Size of rain area
  rainHeight?: number; // How high rain starts
  rainSpeed?: number; // Fall speed
  particleSize?: number; // Size of each raindrop
  rainColor?: string; // Rain color (hex)
  rainOpacity?: number; // Rain opacity
}

export function RainParticles3D({
  enabled = true,
  density = 500,
  areaSize = 50.0,
  rainHeight = 20.0,
  rainSpeed = 8.0,
  particleSize = 0.01,
  rainColor = "#d0e0ff",
  rainOpacity = 0.4,
}: RainParticles3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const depthMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const geometryRef = useRef<THREE.InstancedBufferGeometry | null>(null);
  const { camera } = useThree();

  const meshesRef = useRef<THREE.Mesh[]>([]);
  const timeRef = useRef(0);

  // Parse color
  const colorObj = new THREE.Color(rainColor);

  // Initialize geometry and materials ONCE
  useEffect(() => {
    // Create positions for rain particles
    const offsets = new Float32Array(density * 3);
    const randomSpeeds = new Float32Array(density);
    const randomPhases = new Float32Array(density);

    for (let i = 0; i < density; i++) {
      // Random XZ position in area
      offsets[i * 3 + 0] = (Math.random() - 0.5) * areaSize;
      offsets[i * 3 + 1] = 0; // Y is handled in shader
      offsets[i * 3 + 2] = (Math.random() - 0.5) * areaSize;

      // Speed variation (0.8 to 1.2)
      randomSpeeds[i] = 0.8 + Math.random() * 0.4;

      // Phase offset so they don't all start at same height
      randomPhases[i] = Math.random();
    }

    // Thin cylinder for raindrop (stretched vertically)
    const cylinder = new THREE.CylinderGeometry(
      particleSize,
      particleSize,
      1.0,
      4,
      1
    );

    const geo = new THREE.InstancedBufferGeometry();
    geo.instanceCount = density;
    geo.setAttribute("position", cylinder.attributes.position);
    geo.setAttribute("normal", cylinder.attributes.normal);
    geo.setAttribute("uv", cylinder.attributes.uv);
    geo.setAttribute("offset", new THREE.InstancedBufferAttribute(offsets, 3));
    geo.setAttribute(
      "randomSpeed",
      new THREE.InstancedBufferAttribute(randomSpeeds, 1)
    );
    geo.setAttribute(
      "randomPhase",
      new THREE.InstancedBufferAttribute(randomPhases, 1)
    );
    geo.setIndex(cylinder.index);
    geo.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, rainHeight / 2, 0),
      Math.max(areaSize, rainHeight)
    );
    geometryRef.current = geo;

    // Main material
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
        rainSpeed: { value: rainSpeed },
        rainHeight: { value: rainHeight },
        rainColor: {
          value: new THREE.Vector3(colorObj.r, colorObj.g, colorObj.b),
        },
        rainOpacity: { value: rainOpacity },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });
    materialRef.current = mat;

    // Depth material for shadows
    const depthMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0.0 },
        rainSpeed: { value: rainSpeed },
        rainHeight: { value: rainHeight },
      },
      vertexShader: depthVertexShader,
      fragmentShader: depthFragmentShader,
    });
    depthMaterialRef.current = depthMat;

    return () => {
      geo.dispose();
      mat.dispose();
      depthMat.dispose();
      cylinder.dispose();
    };
  }, [density, areaSize, rainHeight, particleSize]);

  // Create mesh (positioned at camera location)
  useEffect(() => {
    if (
      !geometryRef.current ||
      !materialRef.current ||
      !depthMaterialRef.current
    )
      return;

    // Clear old meshes
    meshesRef.current.forEach((m) => m.removeFromParent());
    meshesRef.current = [];

    // Create one mesh
    const mesh = new THREE.Mesh(geometryRef.current, materialRef.current);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.customDepthMaterial = depthMaterialRef.current;

    if (groupRef.current) {
      groupRef.current.add(mesh);
      meshesRef.current.push(mesh);
    }
  }, [geometryRef.current, materialRef.current, depthMaterialRef.current]);

  // Update position to follow camera
  useFrame((state, delta) => {
    if (
      !materialRef.current ||
      !depthMaterialRef.current ||
      !groupRef.current ||
      !enabled
    )
      return;

    // Update time for both materials
    timeRef.current += delta;
    materialRef.current.uniforms.time.value = timeRef.current;
    depthMaterialRef.current.uniforms.time.value = timeRef.current;

    // Update speed uniforms
    materialRef.current.uniforms.rainSpeed.value = rainSpeed;
    depthMaterialRef.current.uniforms.rainSpeed.value = rainSpeed;

    // Update color and opacity uniforms
    const color = new THREE.Color(rainColor);
    materialRef.current.uniforms.rainColor.value.set(color.r, color.g, color.b);
    materialRef.current.uniforms.rainOpacity.value = rainOpacity;

    // Follow camera position (XZ only)
    groupRef.current.position.x = camera.position.x;
    groupRef.current.position.z = camera.position.z;
    groupRef.current.position.y = 0;
  });

  if (!enabled) return null;

  return <group ref={groupRef} />;
}
