import React, { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useControls, folder } from "leva";
import { useTexture } from "@react-three/drei";

interface WavingFlagProps {
  position?: [number, number, number];
  size?: [number, number]; // [width, height]
  getGroundHeight?: (x: number, z: number) => number; // Heightmap lookup function
}

export const WavingFlag: React.FC<WavingFlagProps> = ({
  position = [0, 5, 0],
  size = [6, 4],
  getGroundHeight,
}) => {
  const flagRef = useRef<THREE.Mesh>(null);
  const poleRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { scene } = useThree();

  // Load flag texture
  const flagTexture = useTexture("/textures/flag.png");

  // Calculate ground-aligned position
  const [worldX, baseY, worldZ] = position;
  const groundY = getGroundHeight ? getGroundHeight(worldX, worldZ) : baseY;
  const finalPosition: [number, number, number] = [worldX, groundY, worldZ];

  // Flag controls
  const {
    flagWidth,
    flagHeight,
    poleHeight,
    windStrength,
    windSpeed,
    waveFrequency,
    flagColor,
    enableFlag,
  } = useControls("🏛️ OBJECTS", {
    wavingFlag: folder(
      {
        enableFlag: {
          value: true,
          label: "Enable Flag",
        },
        flagWidth: {
          value: size[0],
          min: 2,
          max: 15,
          step: 0.5,
          label: "Flag Width",
        },
        flagHeight: {
          value: size[1],
          min: 1,
          max: 10,
          step: 0.5,
          label: "Flag Height",
        },
        poleHeight: {
          value: 10,
          min: 5,
          max: 20,
          step: 0.5,
          label: "Pole Height",
        },
        windStrength: {
          value: 0.4,
          min: 0,
          max: 2,
          step: 0.05,
          label: "Wind Strength",
        },
        windSpeed: {
          value: 1.5,
          min: 0,
          max: 5,
          step: 0.1,
          label: "Wind Speed",
        },
        waveFrequency: {
          value: 4.0,
          min: 1,
          max: 10,
          step: 0.5,
          label: "Wave Frequency",
        },
        flagColor: {
          value: "#000000",
          label: "Flag Color",
        },
      },
      { collapsed: true }
    ),
  });

  // Create flag geometry with lots of segments for smooth waving
  const flagGeometry = useMemo(() => {
    const widthSegments = 40;
    const heightSegments = 30;
    return new THREE.PlaneGeometry(
      flagWidth,
      flagHeight,
      widthSegments,
      heightSegments
    );
  }, [flagWidth, flagHeight]);

  // Custom depth material for proper animated shadows
  const depthMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        windStrength: { value: windStrength },
        windSpeed: { value: windSpeed },
        waveFrequency: { value: waveFrequency },
      },
      vertexShader: `
        uniform float time;
        uniform float windStrength;
        uniform float windSpeed;
        uniform float waveFrequency;
        
        // Simple noise function
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          
          float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
          float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
          float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
          float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
          
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        
        void main() {
          float distanceFromPole = uv.x;
          float waveAmount = distanceFromPole * distanceFromPole;
          
          float horizontalWave = sin(uv.x * waveFrequency + time * windSpeed) * waveAmount;
          float verticalWave = sin(uv.y * waveFrequency * 1.5 + time * windSpeed * 0.8) * waveAmount * 0.5;
          float noiseValue = noise(vec2(uv.x * 3.0 + time * windSpeed * 0.5, uv.y * 3.0));
          float noiseWave = (noiseValue - 0.5) * waveAmount;
          
          vec3 pos = position;
          pos.z += (horizontalWave + noiseWave) * windStrength;
          pos.y += verticalWave * windStrength * 0.5;
          pos.z += waveAmount * windStrength * 0.3;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        void main() {
          gl_FragColor = vec4(vec3(gl_FragCoord.z), 1.0);
        }
      `,
    });
  }, [windStrength, windSpeed, waveFrequency]);

  // Custom shader material for the flag
  const flagMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        windStrength: { value: windStrength },
        windSpeed: { value: windSpeed },
        waveFrequency: { value: waveFrequency },
        flagWidth: { value: flagWidth },
        flagHeight: { value: flagHeight },
        flagColor: { value: new THREE.Color(flagColor) },
        flagTexture: { value: flagTexture },
        sunDirection: { value: new THREE.Vector3(1, 1, 0.5).normalize() }, // Will be updated each frame
        sunIntensity: { value: 1.0 }, // Will be updated each frame
      },
      vertexShader: `
        uniform float time;
        uniform float windStrength;
        uniform float windSpeed;
        uniform float waveFrequency;
        uniform float flagWidth;
        uniform float flagHeight;
        
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        varying float vWaveIntensity;
        
        // Simple noise function
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          
          float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
          float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
          float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
          float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
          
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        
        void main() {
          vUv = uv;
          
          // Calculate how far from the pole (0 = attached to pole, 1 = free edge)
          float distanceFromPole = uv.x;
          
          // Wave effect: more movement at the free edge
          float waveAmount = distanceFromPole * distanceFromPole; // Quadratic falloff
          
          // Create horizontal wave along the flag
          float horizontalWave = sin(uv.x * waveFrequency + time * windSpeed) * waveAmount;
          
          // Add vertical ripple
          float verticalWave = sin(uv.y * waveFrequency * 1.5 + time * windSpeed * 0.8) * waveAmount * 0.5;
          
          // Combine with noise for natural movement
          float noiseValue = noise(vec2(uv.x * 3.0 + time * windSpeed * 0.5, uv.y * 3.0));
          float noiseWave = (noiseValue - 0.5) * waveAmount;
          
          // Total displacement
          vec3 pos = position;
          
          // Apply wind displacement (mainly in Z direction, some in Y)
          pos.z += (horizontalWave + noiseWave) * windStrength;
          pos.y += verticalWave * windStrength * 0.5;
          
          // Add gentle forward lean from wind
          pos.z += waveAmount * windStrength * 0.3;
          
          // Store wave intensity for fragment shader (for shading)
          vWaveIntensity = abs(horizontalWave + verticalWave);
          
          // Calculate normals for lighting (approximate)
          vNormal = normalize(normalMatrix * normal);
          
          // Transform to world position
          vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
          vWorldPosition = worldPosition.xyz;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 flagColor;
        uniform sampler2D flagTexture;
        uniform vec3 sunDirection;
        uniform float sunIntensity;
        
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        varying float vWaveIntensity;
        
        // sRGB to Linear conversion (for proper color in Three.js r180+)
        vec3 sRGBToLinear(vec3 srgb) {
          return pow(srgb, vec3(2.2));
        }
        
        void main() {
          // Sample the texture
          vec4 textureColor = texture2D(flagTexture, vUv);
          
          // Convert from sRGB to linear space for proper lighting
          vec3 linearColor = sRGBToLinear(textureColor.rgb);
          
          // Use actual sun light from scene
          vec3 lightDir = normalize(sunDirection);
          
          // Calculate diffuse lighting
          float diffuse = max(dot(vNormal, lightDir), 0.0);
          
          // MUCH higher ambient for base visibility
          float ambient = 0.6;
          
          // Combine lighting with sun intensity (boosted for visibility)
          float lighting = ambient + diffuse * sunIntensity * 1.5;
          
          // Very subtle wave shading
          float waveDarkening = 1.0 - vWaveIntensity * 0.02;
          
          // Final color with texture (boost overall brightness)
          vec3 finalColor = linearColor * lighting * waveDarkening * 1.2;
          
          gl_FragColor = vec4(finalColor, textureColor.a);
        }
      `,
      side: THREE.DoubleSide,
      transparent: true,
    });
  }, [
    flagWidth,
    flagHeight,
    flagColor,
    windStrength,
    windSpeed,
    waveFrequency,
    flagTexture,
  ]);

  // Update material uniforms
  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value += delta;
      materialRef.current.uniforms.windStrength.value = windStrength;
      materialRef.current.uniforms.windSpeed.value = windSpeed;
      materialRef.current.uniforms.waveFrequency.value = waveFrequency;
      materialRef.current.uniforms.flagWidth.value = flagWidth;
      materialRef.current.uniforms.flagHeight.value = flagHeight;
      materialRef.current.uniforms.flagColor.value.set(flagColor);
      materialRef.current.uniforms.flagTexture.value = flagTexture;

      // Update sun direction and intensity from scene's directional light
      const directionalLight = scene.children.find(
        (child) => child.type === "DirectionalLight"
      ) as THREE.DirectionalLight;

      if (directionalLight) {
        // Get light direction (from light position to target)
        const lightDirection = new THREE.Vector3();
        directionalLight.getWorldDirection(lightDirection);
        // Invert because we want direction TO the light (for lighting calculation)
        lightDirection.negate();
        materialRef.current.uniforms.sunDirection.value.copy(lightDirection);

        // Update sun intensity
        materialRef.current.uniforms.sunIntensity.value =
          directionalLight.intensity;
      }
    }

    // Update depth material for animated shadows
    if (depthMaterial) {
      depthMaterial.uniforms.time.value += delta;
      depthMaterial.uniforms.windStrength.value = windStrength;
      depthMaterial.uniforms.windSpeed.value = windSpeed;
      depthMaterial.uniforms.waveFrequency.value = waveFrequency;
    }
  });

  if (!enableFlag) return null;

  return (
    <group position={finalPosition}>
      {/* Flag pole - positioned so bottom is at ground level */}
      <mesh
        ref={poleRef}
        position={[0, poleHeight / 2, 0]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.08, 0.1, poleHeight, 16]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Pole top sphere */}
      <mesh position={[0, poleHeight, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Flag - attached near top of pole */}
      <mesh
        ref={flagRef}
        position={[flagWidth / 2, poleHeight - flagHeight / 2, 0]}
        geometry={flagGeometry}
        material={flagMaterial}
        customDepthMaterial={depthMaterial}
        castShadow
        receiveShadow
      >
        <primitive object={flagMaterial} attach="material" ref={materialRef} />
      </mesh>
    </group>
  );
};
