import { forwardRef, useMemo } from "react";
import { Effect } from "postprocessing";
import { Uniform } from "three";

// Rain Effect Shader - Samples scene and distorts it through water
const fragmentShader = `
uniform float time;
uniform float rainIntensity;
uniform float dropletIntensity;
uniform float rainSpeed;

// Hash functions
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

// Rain streaks - thin and translucent
float rainStreaks(vec2 uv, float t) {
  float rain = 0.0;
  
  for(float i = 0.0; i < 3.0; i++) {
    vec2 pos = uv * vec2(40.0 + i * 10.0, 4.0); // More columns = thinner streaks
    pos.y += t * rainSpeed * (2.0 + i * 0.3);
    pos.x += sin(t * 0.5 + i) * 0.2;
    pos.x += noise(vec2(pos.y * 0.1, i)) * 0.4;
    
    vec2 cell = fract(pos);
    vec2 cellId = floor(pos);
    
    float random = hash12(cellId + i * 50.0);
    
    if(random > 0.65) { // Less dense
      // Much thinner streaks
      float streak = smoothstep(0.08, 0.0, abs(cell.x - 0.5)); // Was 0.2, now 0.08!
      float len = 0.2 + random * 0.3;
      float fade = smoothstep(len, 0.0, cell.y) * smoothstep(0.0, 0.02, cell.y);
      rain += streak * fade / (i + 1.0);
    }
  }
  
  return rain * 0.4;
}

// Water droplet - returns both distortion AND highlight
struct Droplet {
  vec2 distortion;
  float highlight;
};

Droplet waterDroplet(vec2 uv, vec2 pos, float size, float life) {
  Droplet drop;
  drop.distortion = vec2(0.0);
  drop.highlight = 0.0;
  
  vec2 diff = uv - pos;
  diff.y *= 1.3; // Taller droplet shape
  
  float dist = length(diff);
  
  if(dist < size) {
    // Distance from center (0 at center, 1 at edge)
    float normalizedDist = dist / size;
    
    // Lens distortion - stronger at edges, like a real water droplet
    // Real water acts as a convex lens
    vec2 normal = normalize(diff);
    
    // Droplet edge has strongest refraction
    float refractionStrength = smoothstep(0.3, 0.9, normalizedDist) * 0.02;
    drop.distortion = normal * refractionStrength * life;
    
    // Center of droplet is brighter (focuses light like a lens)
    float centerGlow = smoothstep(size, size * 0.3, dist) * 0.4;
    
    // Edge highlight (specular reflection on water surface)
    float edgeHighlight = smoothstep(size * 0.7, size * 0.95, dist) * 
                          smoothstep(size, size * 0.95, dist);
    
    drop.highlight = (centerGlow + edgeHighlight * 0.6) * life;
  }
  
  return drop;
}

// Static droplets - returns distortion and highlights
struct DropletResult {
  vec2 distortion;
  float highlight;
};

DropletResult staticDroplets(vec2 uv, float t) {
  DropletResult result;
  result.distortion = vec2(0.0);
  result.highlight = 0.0;
  
  for(float i = 0.0; i < 15.0; i++) {
    float dropT = t * 0.2 + i * 2.5;
    float life = fract(dropT);
    
    vec2 seed = vec2(floor(dropT), i);
    vec2 dropPos = hash22(seed);
    
    // Slide down with gravity
    dropPos.y -= life * life * 0.4;
    
    // Size variation
    float size = 0.015 + hash12(seed + 0.5) * 0.03;
    
    // Fade
    float fade = smoothstep(0.0, 0.1, life) * smoothstep(1.0, 0.7, life);
    
    Droplet drop = waterDroplet(uv, dropPos, size, fade);
    result.distortion += drop.distortion;
    result.highlight += drop.highlight;
  }
  
  return result;
}

// Ripple distortion - very subtle
vec2 rippleDistortion(vec2 uv, float t) {
  vec2 distortion = vec2(0.0);
  
  for(float i = 0.0; i < 5.0; i++) {
    float rippleT = t * 0.6 + i * 1.5;
    float life = fract(rippleT);
    
    vec2 seed = vec2(floor(rippleT), i + 20.0);
    vec2 ripplePos = hash22(seed);
    
    vec2 diff = uv - ripplePos;
    float dist = length(diff);
    float radius = life * 0.1;
    
    // Gentler ring distortion
    if(dist > radius - 0.01 && dist < radius + 0.01) {
      vec2 normal = normalize(diff);
      // Much weaker ripple distortion
      float strength = (1.0 - life) * 0.008;
      distortion += normal * strength;
    }
  }
  
  return distortion;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // Get droplet distortion and highlights
  DropletResult droplets = staticDroplets(uv, time);
  vec2 distortion = droplets.distortion * dropletIntensity;
  
  // Add ripple distortion (gentler)
  distortion += rippleDistortion(uv, time) * dropletIntensity * 0.3;
  
  // Sample scene with distortion - REFRACTION!
  vec3 sceneColor = texture2D(inputBuffer, uv + distortion).rgb;
  
  // Rain streaks - thin translucent lines
  float streaks = rainStreaks(uv, time) * rainIntensity;
  
  // Rain color - light blue-white
  vec3 rainColor = vec3(0.85, 0.9, 1.0);
  
  // Rain streaks brighten (catching light)
  sceneColor = mix(sceneColor, rainColor, streaks * 0.2);
  
  // Add droplet highlights (water catches light)
  vec3 dropletHighlight = rainColor * droplets.highlight * dropletIntensity * 0.4;
  
  // Add rain streak highlights
  vec3 streakHighlight = rainColor * streaks * 0.1;
  
  // Final: refracted scene + water highlights
  vec3 finalColor = sceneColor + dropletHighlight + streakHighlight;
  
  outputColor = vec4(finalColor, inputColor.a);
}
`;

// Custom Effect class
class RainEffectImpl extends Effect {
  constructor({
    rainIntensity = 1.0,
    dropletIntensity = 1.0,
    rainSpeed = 2.0,
  }) {
    super("RainEffect", fragmentShader, {
      uniforms: new Map([
        ["time", new Uniform(0.0)],
        ["rainIntensity", new Uniform(rainIntensity)],
        ["dropletIntensity", new Uniform(dropletIntensity)],
        ["rainSpeed", new Uniform(rainSpeed)],
      ]),
    });
  }

  update(renderer: any, inputBuffer: any, deltaTime: number) {
    this.uniforms.get("time")!.value += deltaTime;
  }
}

// React component
interface RainEffectProps {
  rainIntensity?: number;
  dropletIntensity?: number;
  rainSpeed?: number;
}

export const RainEffectPostprocessing = forwardRef<
  RainEffectImpl,
  RainEffectProps
>(({ rainIntensity = 1.0, dropletIntensity = 1.0, rainSpeed = 2.0 }, ref) => {
  const effect = useMemo(
    () => new RainEffectImpl({ rainIntensity, dropletIntensity, rainSpeed }),
    []
  );

  // Update uniforms when props change
  if (effect.uniforms) {
    effect.uniforms.get("rainIntensity")!.value = rainIntensity;
    effect.uniforms.get("dropletIntensity")!.value = dropletIntensity;
    effect.uniforms.get("rainSpeed")!.value = rainSpeed;
  }

  return <primitive ref={ref} object={effect} />;
});

RainEffectPostprocessing.displayName = "RainEffectPostprocessing";
