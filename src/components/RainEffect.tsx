import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Realistic rain shader with proper water droplet appearance
const fragmentShader = `
uniform float time;
uniform float rainIntensity;
uniform float dropletIntensity;
uniform float rainSpeed;

varying vec2 vUv;

// Better hash functions
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  
  return mix(
    mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x),
    mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

// Rain streaks - improved for water-like appearance
vec3 rainLayer(vec2 uv, float t, float layer) {
  vec2 pos = uv;
  
  // Scale and scroll
  pos.x *= 20.0 + layer * 5.0;
  pos.y *= 3.0;
  pos.y += t * rainSpeed * (2.0 + layer * 0.5);
  
  // Add wind sway
  pos.x += sin(t * 0.5 + layer) * 0.3;
  pos.x += noise(vec2(pos.y * 0.1, layer)) * 0.5;
  
  vec2 cell = fract(pos);
  vec2 cellId = floor(pos);
  
  float random = hash12(cellId + layer * 100.0);
  
  vec3 rainColor = vec3(0.0);
  
  // Only some cells have streaks
  if(random > 0.4) {
    // Streak shape - thinner and more defined
    float streak = smoothstep(0.25, 0.0, abs(cell.x - 0.5));
    
    // Length variation
    float len = 0.3 + random * 0.5;
    float fade = smoothstep(len, 0.0, cell.y);
    fade *= smoothstep(0.0, 0.02, cell.y);
    
    // Add slight glow
    float glow = smoothstep(0.4, 0.0, abs(cell.x - 0.5)) * 0.3;
    
    // Water color - slightly blue-white with transparency
    float intensity = (streak + glow) * fade;
    rainColor = vec3(0.9, 0.95, 1.0) * intensity;
  }
  
  return rainColor / (layer + 1.0);
}

// Realistic water droplet with proper shape
float waterDrop(vec2 uv, vec2 pos, float size, float aspectRatio) {
  vec2 diff = (uv - pos) * vec2(1.0, aspectRatio);
  float dist = length(diff);
  
  // Soft falloff for water edge
  float drop = smoothstep(size, size * 0.5, dist);
  
  // Add highlight at top (specular)
  vec2 highlightPos = diff + vec2(0.0, size * 0.3);
  float highlight = smoothstep(size * 0.3, 0.0, length(highlightPos));
  
  return drop + highlight * 0.5;
}

// Static droplets on screen
vec3 staticDroplets(vec2 uv, float t) {
  vec3 drops = vec3(0.0);
  
  // Multiple droplets of varying sizes
  for(float i = 0.0; i < 12.0; i++) {
    float dropT = t * 0.2 + i * 3.5;
    float life = fract(dropT);
    
    // Random position
    vec2 seed = vec2(floor(dropT), i);
    vec2 dropPos = hash22(seed);
    
    // Slide down over time
    dropPos.y -= life * life * 0.4; // Accelerate downward
    
    // Random size
    float size = (0.01 + hash12(seed + 0.5) * 0.025);
    
    // Aspect ratio (droplets are taller)
    float aspect = 1.2 + hash12(seed + 1.0) * 0.3;
    
    float drop = waterDrop(uv, dropPos, size, aspect);
    
    // Fade based on lifetime
    float fadein = smoothstep(0.0, 0.1, life);
    float fadeout = smoothstep(1.0, 0.7, life);
    drop *= fadein * fadeout;
    
    // Water color with slight blue tint and bright highlights
    drops += vec3(0.85, 0.9, 1.0) * drop;
  }
  
  return drops;
}

// Ripple rings when drops impact
vec3 ripples(vec2 uv, float t) {
  vec3 ripple = vec3(0.0);
  
  for(float i = 0.0; i < 5.0; i++) {
    float rippleT = t * 0.6 + i * 1.8;
    float life = fract(rippleT);
    
    vec2 seed = vec2(floor(rippleT), i + 20.0);
    vec2 ripplePos = hash22(seed);
    
    float dist = length(uv - ripplePos);
    float radius = life * 0.12;
    
    // Multiple rings (like real water impact)
    for(float j = 0.0; j < 2.0; j++) {
      float ringRadius = radius - j * 0.02;
      float ring = smoothstep(ringRadius + 0.005, ringRadius, dist) - 
                   smoothstep(ringRadius, ringRadius - 0.005, dist);
      
      // Fade out as expands
      ring *= (1.0 - life) * (1.0 - j * 0.3);
      
      ripple += vec3(0.8, 0.85, 1.0) * ring * 0.4;
    }
  }
  
  return ripple;
}

void main() {
  vec2 uv = vUv;
  
  // Track where water exists (for darkening)
  float waterMask = 0.0;
  
  // Accumulate rain effects
  vec3 color = vec3(0.0);
  
  // Falling rain streaks (background) - subtle
  for(float i = 0.0; i < 3.0; i++) {
    vec3 streak = rainLayer(uv, time, i) * rainIntensity * 0.15;
    color += streak;
    waterMask += length(streak);
  }
  
  // Static water droplets on screen
  vec3 drops = staticDroplets(uv, time) * dropletIntensity * 0.3;
  color += drops;
  waterMask += length(drops) * 2.0;
  
  // Impact ripples
  vec3 rip = ripples(uv, time) * dropletIntensity * 0.2;
  color += rip;
  waterMask += length(rip) * 1.5;
  
  // Water appearance:
  // 1. Slight highlights (where light catches water)
  vec3 waterHighlight = color * vec3(1.2, 1.25, 1.3);
  
  // 2. Darkening effect (water obscures view)
  float darken = waterMask * 0.15;
  
  // 3. Blue tint (water color)
  vec3 waterTint = vec3(0.85, 0.92, 1.0);
  
  // Combine: highlights where water catches light, darkening where thick
  vec3 finalColor = waterHighlight * waterTint;
  
  // Alpha: visible water + darkening
  float alpha = waterMask * 0.4 + darken;
  
  gl_FragColor = vec4(finalColor, alpha);
}
`;

interface RainEffectProps {
  enabled?: boolean;
  rainIntensity?: number;
  dropletIntensity?: number;
  rainSpeed?: number;
}

export function RainEffect({
  enabled = true,
  rainIntensity = 1.0,
  dropletIntensity = 1.0,
  rainSpeed = 2.0,
}: RainEffectProps) {
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const timeRef = useRef(0);

  // Memoize uniforms to prevent material rebuilding
  const uniforms = useMemo(
    () => ({
      time: { value: 0.0 },
      rainIntensity: { value: 0.0 },
      dropletIntensity: { value: 0.0 },
      rainSpeed: { value: 0.0 },
    }),
    []
  );

  // Update uniforms and follow camera
  useFrame((state, delta) => {
    if (!materialRef.current || !meshRef.current || !enabled) return;

    // Update time
    timeRef.current += delta;
    materialRef.current.uniforms.time.value = timeRef.current;

    // Update intensity uniforms (real-time controls!)
    materialRef.current.uniforms.rainIntensity.value = rainIntensity;
    materialRef.current.uniforms.dropletIntensity.value = dropletIntensity;
    materialRef.current.uniforms.rainSpeed.value = rainSpeed;

    // Position plane in front of camera
    const distance = 0.1;
    meshRef.current.position.copy(camera.position);
    meshRef.current.position.add(
      new THREE.Vector3(0, 0, -distance).applyQuaternion(camera.quaternion)
    );
    meshRef.current.quaternion.copy(camera.quaternion);
  });

  if (!enabled) return null;

  return (
    <mesh ref={meshRef} renderOrder={999}>
      <planeGeometry args={[0.2, 0.2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.NormalBlending}
      />
    </mesh>
  );
}
