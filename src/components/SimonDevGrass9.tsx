import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { useFrame, useThree } from "@react-three/fiber";
import { useControls } from "leva";

interface SimonDevGrass9Props {
  areaSize?: number;
  getGroundHeight?: (x: number, z: number) => number;
  grassHeight?: number;
  grassScale?: number;
}

export const SimonDevGrass9: React.FC<SimonDevGrass9Props> = ({
  areaSize = 80,
  getGroundHeight,
  grassHeight = 1.0,
  grassScale = 1.0,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const grassMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const materialRef = useRef<any>(null);
  const envMapTextureRef = useRef<THREE.Texture | null>(null);
  const { camera } = useThree();

  // Same vertex shader as Grass6 but without shape-related varyings
  const vertexShader = `
    uniform float time;
    uniform float windStrength;
    uniform vec2 windDirection;
    uniform float grassDensity;
    uniform float windSpeed;
    uniform float windFrequency;
    uniform float windAmplitude;
    uniform float windTurbulence;
    uniform float flappingIntensity;
    
    attribute vec3 offset;
    attribute float scale;
    attribute float rotation;
    attribute float windInfluence;
    attribute float grassType;
    attribute vec3 colorVariation;
    attribute vec3 tipColorVariation;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vGrassColour;
    varying float vHeight;
    varying float vGrassType;
    varying float vWindInfluence;
    varying vec3 vWorldPosition;
    varying vec3 vViewPosition;
    varying vec3 vLightPosition;
    varying float vThickness;
    varying vec3 vColorVariation;
    varying vec3 vTipColorVariation;
    varying vec3 vReflect;
    varying vec3 vViewDir;
    varying vec3 vTangent;
    varying vec3 vBitangent;
    
    // Noise functions from SimonDev
    float hash12(vec2 p) {
      vec2 p2 = fract(p * vec2(443.8975, 397.2973));
      p2 += dot(p2.xy, p2.yx + 19.19);
      return fract(p2.x * p2.y);
    }
    
    float noise12(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      
      float a = hash12(i);
      float b = hash12(i + vec2(1.0, 0.0));
      float c = hash12(i + vec2(0.0, 1.0));
      float d = hash12(i + vec2(1.0, 1.0));
      
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y) * 2.0 - 1.0;
    }
    
    float remap(float v, float inMin, float inMax, float outMin, float outMax) {
      return outMin + (v - inMin) * (outMax - outMin) / (inMax - inMin);
    }
    
    float easeIn(float x, float t) {
      return pow(x, t);
    }
    
    mat2 rotate2D(float angle) {
      float s = sin(angle);
      float c = cos(angle);
      return mat2(c, -s, s, c);
    }
    
    void main() {
      vUv = uv;
      vHeight = position.y + 0.5;
      vGrassType = grassType;
      vWindInfluence = windInfluence;
      vColorVariation = colorVariation;
      vTipColorVariation = tipColorVariation;
      
      // Apply instance scale
      vec3 pos = position * scale;
      
      // Apply instance rotation
      float cos_r = cos(rotation);
      float sin_r = sin(rotation);
      mat2 rotationMatrix = mat2(cos_r, -sin_r, sin_r, cos_r);
      pos.xz = rotationMatrix * pos.xz;
      
      // SimonDev's grass blade curve - more pronounced
      float curve = pow(uv.y, 2.0) * 0.5;
      pos.x += curve;
      
      // Enhanced wind system for more realistic flapping and bending
      vec3 worldPos = pos + offset;
      
      // Wind direction based on noise (changes over time and space)
      float windDir = noise12(worldPos.xz * windFrequency + time * windSpeed * 0.5);
      float windNoiseSample = noise12(worldPos.xz * windFrequency * 2.5 + time * windSpeed * 1.0);
      float windLeanAngle = remap(windNoiseSample, -1.0, 1.0, 0.25, 1.0);
      windLeanAngle = easeIn(windLeanAngle, 2.0) * 1.25 * windTurbulence * windAmplitude;
      vec3 windAxis = vec3(cos(windDir), 0.0, sin(windDir));
      
      // Wind strength based on height (stronger at tips) - more pronounced
      float heightFactor = pow(uv.y, 1.5);
      windLeanAngle *= heightFactor;
      
      // Multiple wind layers for more complex movement - using windFrequency and windAmplitude
      float wind1 = noise12(worldPos.xz * windFrequency * 1.0 + time * windSpeed * 0.8) * windStrength * heightFactor * windInfluence * windAmplitude;
      float wind2 = noise12(worldPos.xz * windFrequency * 2.0 + time * windSpeed * 1.2) * windStrength * heightFactor * windInfluence * windAmplitude * 0.6;
      float wind3 = noise12(worldPos.xz * windFrequency * 0.5 + time * windSpeed * 0.3) * windStrength * heightFactor * windInfluence * windAmplitude * 0.4;
      float wind4 = noise12(worldPos.xz * windFrequency * 3.0 + time * windSpeed * 1.5) * windStrength * heightFactor * windInfluence * windAmplitude * 0.3;
      
      // Add flapping motion - side-to-side movement
      float flapping = sin(time * windSpeed * 2.0 + worldPos.x * windFrequency + worldPos.z * windFrequency) * windStrength * heightFactor * windInfluence * windAmplitude * 0.4 * flappingIntensity;
      
      // Combine wind effects with flapping
      float totalWind = (wind1 + wind2 + wind3 + wind4 + flapping) * windTurbulence;
      
      // Apply wind along the wind axis
      pos.x += totalWind * windAxis.x;
      pos.z += totalWind * windAxis.z;
      
      // Enhanced rotation for more realistic movement
      float windRotation = noise12(worldPos.xz * windFrequency * 1.5 + time * windSpeed * 0.6) * windStrength * heightFactor * windInfluence * windAmplitude * 0.15 * windTurbulence;
      pos.xz = rotate2D(windRotation) * pos.xz;
      
      // Add vertical swaying motion
      float verticalSway = sin(time * windSpeed * 1.5 + worldPos.x * windFrequency * 0.8 + worldPos.z * windFrequency * 0.8) * windStrength * heightFactor * windInfluence * windAmplitude * 0.2;
      pos.y += verticalSway;
      
      // Apply instance offset
      pos += offset;
      
      // Calculate world position for moon reflection
      vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
      
      // Calculate view position for SSS
      vViewPosition = (modelViewMatrix * vec4(pos, 1.0)).xyz;
      
      // Calculate normals
      vNormal = normalize(normalMatrix * normal);
      
      // Calculate tangent and bitangent vectors for anisotropic reflections
      // For grass blades, tangent runs along the blade length (Y direction)
      vec3 tangent = vec3(0.0, 1.0, 0.0);
      vec3 bitangent = vec3(1.0, 0.0, 0.0);
      
      // Transform to world space
      vec3 worldTangent = normalize(mat3(modelMatrix) * tangent);
      vec3 worldBitangent = normalize(mat3(modelMatrix) * bitangent);
      
      // Apply wind deformation to tangent vectors for dynamic anisotropic highlights
      float windInfluenceTangent = windInfluence * 0.3; // Reduce wind influence on tangents
      vec3 windTangentOffset = vec3(
        totalWind * windAxis.x * windInfluenceTangent,
        0.0,
        totalWind * windAxis.z * windInfluenceTangent
      );
      
      worldTangent = normalize(worldTangent + windTangentOffset * 0.1);
      worldBitangent = normalize(worldBitangent + windTangentOffset * 0.05);
      
      vTangent = worldTangent;
      vBitangent = worldBitangent;
      
      // Calculate thickness for subsurface scattering
      vThickness = (1.0 - vHeight) * 0.8 + 0.2;
      
      // Calculate view direction for environment reflections (IBL)
      vec3 worldPosCalc = (modelMatrix * vec4(pos, 1.0)).xyz;
      vViewDir = normalize(cameraPosition - worldPosCalc);

      // Calculate reflection vector for environment map sampling
      vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
      vReflect = reflect(-vViewDir, worldNormal);
      
      // SimonDev's grass color - use uniform colors instead of hardcoded
      vGrassColour = vec3(1.0, 1.0, 1.0);
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  // Fragment shader - Grass5's gradient system with Grass6's advanced features
  const fragmentShader = `
    uniform sampler2D grassTexture;
    uniform sampler2D envMap;
    uniform float envMapIntensity;
    uniform float roughnessBase;
    uniform float roughnessTip;
    uniform float fresnelPower;
    uniform bool enableEnvMap;
    uniform float roughnessIntensity;
    uniform vec3 baseColor;
    uniform vec3 middleColor;
    uniform vec3 tipColor;
    uniform vec3 veryTipColor;
    uniform float gradientPower;
    uniform float baseTransitionPoint;
    uniform float tipTransitionPoint;
    uniform float time;
    uniform float grassDensity;
    uniform bool disableLighting;
    uniform float specularIntensity;
    uniform vec3 specularColor;
    uniform float specularPower;
    uniform bool disableMoonReflection;
    uniform float moonIntensity;
    uniform vec3 moonDirection;
    uniform vec3 moonColor;
    uniform bool disableTextureTint;
    uniform vec3 lightPosition;
    uniform float sssIntensity;
    uniform float sssPower;
    uniform float sssScale;
    uniform vec3 sssColor;
    uniform bool disableSSS;
    uniform float contactShadowIntensity;
    uniform float contactShadowRadius;
    uniform float contactShadowBias;
    uniform bool enableAO;
    uniform float aoIntensity;
    uniform float aoRadius;
    uniform bool enableColorVariation;
    uniform float colorVariationIntensity;
    uniform float tipColorVariationIntensity;
    // Anisotropic specular uniforms
    uniform float anisotropyStrength;
    uniform float anisotropyTangent;
    uniform float anisotropyBitangent;
    uniform bool enableAnisotropy;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vGrassColour;
    varying float vHeight;
    varying float vGrassType;
    varying float vWindInfluence;
    varying vec3 vWorldPosition;
    varying vec3 vViewPosition;
    varying vec3 vLightPosition;
    varying float vThickness;
    varying vec3 vColorVariation;
    varying vec3 vTipColorVariation;
    varying vec3 vReflect;
    varying vec3 vViewDir;
    varying vec3 vTangent;
    varying vec3 vBitangent;
    
    // Contact Shadow function - simulates ground shadows
    float getContactShadow(vec3 worldPos, vec3 lightDir) {
      float shadow = 1.0;
      float densityShadow = 1.0 - (grassDensity * 0.3);
      float heightShadow = 1.0 - (vHeight * 0.4);
      float groundDistance = worldPos.y;
      float distanceShadow = 1.0 - smoothstep(0.0, contactShadowRadius, groundDistance) * 0.6;
      shadow = min(densityShadow, min(heightShadow, distanceShadow));
      shadow = mix(1.0, shadow, contactShadowIntensity);
      return shadow;
    }
    
    // Ambient Occlusion approximation
    float getAmbientOcclusion(vec3 worldPos, vec3 normal) {
      float ao = 1.0;
      ao *= 1.0 - (grassDensity * 0.2);
      ao *= 1.0 - (1.0 - vHeight) * 0.3;
      float noise = sin(worldPos.x * aoRadius) * cos(worldPos.z * aoRadius) * 0.1;
      ao += noise;
      ao = mix(1.0, ao, aoIntensity);
      return clamp(ao, 0.3, 1.0);
    }
    
    void main() {
      // Sample the grass texture
      vec4 texColor = texture2D(grassTexture, vUv);
      
      // Alpha test
      if (texColor.a < 0.1) discard;
      
      // DYNAMIC GRADIENT SYSTEM - Fully controllable gradient distribution
      float gradient = vUv.y; // vUv.y goes from 0 to 1 (bottom to top of blade)
      
      // Dynamic transition points
      float baseEnd = baseTransitionPoint;
      float tipStart = tipTransitionPoint;
      
      vec3 color;
      if (enableColorVariation) {
        if (gradient < baseEnd) {
          // Base to middle transition
          float t = gradient / baseEnd;
          t = pow(t, gradientPower); // Apply power curve for smoothness control
          vec3 baseColorVaried = baseColor + vColorVariation * 0.3 * colorVariationIntensity;
          vec3 middleColorVaried = middleColor + vColorVariation * 0.4 * colorVariationIntensity;
          color = mix(baseColorVaried, middleColorVaried, t);
        } else if (gradient < tipStart) {
          // Pure middle color area
          vec3 middleColorVaried = middleColor + vColorVariation * 0.4 * colorVariationIntensity;
          color = middleColorVaried;
        } else {
          // Middle to tip transition
          float t = (gradient - tipStart) / (1.0 - tipStart);
          t = pow(t, gradientPower); // Apply power curve for smoothness control
          vec3 middleColorVaried = middleColor + vColorVariation * 0.4 * colorVariationIntensity;
          vec3 tipColorVaried = tipColor + vTipColorVariation * 0.5 * tipColorVariationIntensity;
          color = mix(middleColorVaried, tipColorVaried, t);
        }
      } else {
        // No color variation - use original colors
        if (gradient < baseEnd) {
          // Base to middle transition
          float t = gradient / baseEnd;
          t = pow(t, gradientPower); // Apply power curve for smoothness control
          color = mix(baseColor, middleColor, t);
        } else if (gradient < tipStart) {
          // Pure middle color area
          color = middleColor;
        } else {
          // Middle to tip transition
          float t = (gradient - tipStart) / (1.0 - tipStart);
          t = pow(t, gradientPower); // Apply power curve for smoothness control
          color = mix(middleColor, tipColor, t);
        }
      }
      
      // Apply texture (optional)
      if (!disableTextureTint) {
        color *= texColor.rgb;
      } else {
        color *= 1.0;
      }
      
      // Environment map reflections for realistic roughness
      if (enableEnvMap) {
        float roughness = mix(roughnessBase, roughnessTip, vHeight) * roughnessIntensity;
        float fresnel = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), fresnelPower);
        
        // Convert reflection vector to equirectangular UV coordinates
        vec3 r = normalize(vReflect);
        vec2 reflectUV;
        reflectUV.x = atan(r.z, r.x) / (2.0 * 3.14159265359) + 0.5;
        reflectUV.y = asin(r.y) / 3.14159265359 + 0.5;
        vec3 envColor = texture2D(envMap, reflectUV).rgb;
        
        float reflectionStrength = mix(0.15, 0.85, vHeight) * fresnel * envMapIntensity;
        
        // Ambient environment contribution (sample from top)
        vec3 upVector = vec3(0.0, 1.0, 0.0);
        vec2 upUV;
        upUV.x = 0.5;
        upUV.y = asin(1.0) / 3.14159265359 + 0.5;
        vec3 ambientEnv = texture2D(envMap, upUV).rgb;
        
        float ambientStrength = (1.0 - vHeight) * 0.3 * envMapIntensity;
        color = color + envColor * reflectionStrength + ambientEnv * ambientStrength;
      }
      
      // Enhanced lighting with specular reflections for realistic grass
      if (!disableLighting) {
        // Main directional light
        vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
        vec3 normal = normalize(vNormal);
        float NdotL = max(dot(normal, lightDir), 0.0);
        
        // Enhanced depth variation - more dramatic for 3D effect
        float depthVariation = 0.4 + 0.6 * vHeight;
        
        // Enhanced rim lighting for better depth perception
        vec3 viewDir = normalize(-vViewPosition);
        float rim = 1.0 - max(dot(normal, viewDir), 0.0);
        rim = pow(rim, 1.5);
        
        // Add side lighting for more 3D appearance
        vec3 sideLightDir = normalize(vec3(0.5, 0.3, 1.0));
        float sideNdotL = max(dot(normal, sideLightDir), 0.0);
        
        // ANISOTROPIC SPECULAR REFLECTIONS - Ghost of Tsushima Style!
        vec3 specular = vec3(0.0);
        
        if (enableAnisotropy) {
          // Anisotropic GGX distribution for stretched highlights
          vec3 H = normalize(lightDir + viewDir); // Half vector
          
          // Calculate anisotropic highlights along grass blade length
          float TdotH = dot(normalize(vTangent), H);
          float BdotH = dot(normalize(vBitangent), H);
          float NdotH = dot(normal, H);
          
          // Anisotropic roughness - rougher along blade length, shinier across width
          float roughnessT = mix(roughnessBase * anisotropyTangent, roughnessTip * anisotropyTangent * 0.5, vHeight);
          float roughnessB = mix(roughnessBase * anisotropyBitangent, roughnessTip * anisotropyBitangent * 2.0, vHeight);
          
          // Convert roughness to alpha values
          float at = roughnessT * roughnessT;
          float ab = roughnessB * roughnessB;
          
          // Anisotropic GGX distribution function
          float denom = (TdotH * TdotH / at) + (BdotH * BdotH / ab) + (NdotH * NdotH);
          denom = max(denom, 0.001);
          float D = 1.0 / (3.14159 * at * ab * denom * denom);
          
          // Fresnel term for realistic reflections
          float VdotH = max(dot(viewDir, H), 0.0);
          float F = pow(1.0 - VdotH, fresnelPower);
          
          // Final anisotropic specular with Ghost of Tsushima intensity
          float anisoSpec = D * F * anisotropyStrength;
          specular = specularColor * anisoSpec * specularIntensity * 8.0; // Boost intensity for that wet look
          
        } else {
          // Fallback to original isotropic specular
          vec3 reflectDir = reflect(-lightDir, normal);
          float spec = pow(max(dot(viewDir, reflectDir), 0.0), specularPower);
          
          // Apply roughness to specular - rougher surfaces have more scattered specular
          float roughness = mix(roughnessBase, roughnessTip, vHeight) * roughnessIntensity;
          spec *= (1.0 - roughness * 0.8);
          
          specular = specularColor * spec * specularIntensity;
        }
        
        // Moon reflection - additional specular for moonlight (optional)
        if (!disableMoonReflection) {
          vec3 moonDir = normalize(moonDirection);
          vec3 moonReflectDir = reflect(-moonDir, normal);
          float moonSpec = pow(max(dot(viewDir, moonReflectDir), 0.0), specularPower * 0.8);
          vec3 moonSpecular = moonColor * moonSpec * specularIntensity * moonIntensity * 3.0;
          specular += moonSpecular;
        }
        
        // SUBSUBFACE SCATTERING - Enhanced for better visibility!
        vec3 sssContribution = vec3(0.0);
        if (!disableSSS) {
          float backScatter = max(dot(-lightDir, normal), 0.0);
          float frontScatter = max(dot(lightDir, normal), 0.0);
          
          float sss = pow(backScatter, sssPower) * vThickness * sssScale;
          float sssFront = pow(frontScatter, sssPower * 0.5) * vThickness * sssScale * 0.3;
          
          float rimSSS = pow(rim, 2.0) * vThickness * 0.5;
          
          float totalSSS = sss + sssFront + rimSSS;
          totalSSS = clamp(totalSSS, 0.0, 1.0);
          
          sssContribution = sssColor * totalSSS * sssIntensity;
        }
        
        // Enhanced lighting calculation for more 3D appearance
        float mainLight = 0.4 + 0.4 * NdotL;
        float sideLight = 0.2 + 0.2 * sideNdotL;
        float rimLight = 0.1 + 0.1 * rim;
        
        float lighting = mainLight + sideLight + rimLight;
        lighting *= depthVariation;
        
        // Add roughness-based variation to make grass look more natural
        float roughnessVariation = 0.8 + 0.4 * sin(vWorldPosition.x * 0.1) * cos(vWorldPosition.z * 0.1);
        lighting *= roughnessVariation;
        
        color = color * lighting + specular + sssContribution;
      }
      
      // CONTACT SHADOWS - AAA technique for realistic ground shadows
      vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
      float contactShadow = getContactShadow(vWorldPosition, lightDir);
      color *= contactShadow;
      
      // AMBIENT OCCLUSION - adds depth and realism
      if (enableAO) {
        float ao = getAmbientOcclusion(vWorldPosition, vNormal);
        color *= ao;
      }
      
      gl_FragColor = vec4(color, texColor.a);
    }
  `;

  // SimonDev's exact controls - Grass5's shape with Grass6's advanced features (NO SHAPE CONTROLS)
  const {
    // Grass count control
    grassCount,
    baseColor,
    middleColor,
    tipColor,
    gradientPower,
    baseTransitionPoint,
    tipTransitionPoint,
    maxDistance,
    lodLevels,
    highDetailDistance,
    mediumDetailDistance,
    disableLighting,
    specularIntensity,
    specularColor,
    specularPower,
    windStrength,
    windSpeed,
    windFrequency,
    windAmplitude,
    windTurbulence,
    flappingIntensity,
    // Additional controls
    grassHeightMultiplier,
    grassScaleMultiplier,
    windDirectionX,
    windDirectionZ,
    grassDensity,
    shadowCasting,
    shadowReceiving,
    alphaTest,
    disableMoonReflection,
    moonIntensity,
    moonDirectionX,
    moonDirectionY,
    moonDirectionZ,
    moonColor,
    disableTextureTint,
    textureRepeatX,
    textureRepeatY,
    // Subsurface Scattering controls
    sssIntensity,
    sssPower,
    sssScale,
    sssColor,
    disableSSS,
    // Contact Shadow controls (AAA technique)
    contactShadowIntensity,
    contactShadowRadius,
    contactShadowBias,
    // Ambient Occlusion controls
    enableAO,
    aoIntensity,
    aoRadius,
    // Color variation controls
    enableColorVariation,
    colorVariationIntensity,
    tipColorVariationIntensity,
    // Environment map controls
    enableEnvMap,
    envMapIntensity,
    roughnessBase,
    roughnessTip,
    fresnelPower,
    roughnessIntensity,
    environmentType,
    // Grass shape controls (back from Grass5)
    grassBaseWidth,
    grassTipWidth,
    // Anisotropic specular controls
    enableAnisotropy,
    anisotropyStrength,
    anisotropyTangent,
    anisotropyBitangent,
  } = useControls("SimonDev Grass 9", {
    // Grass count control
    grassCount: { value: 50000, min: 1000, max: 200000, step: 1000 },
    baseColor: { value: "#2d5016" }, // Dark green base
    middleColor: { value: "#51b770" }, // Main green (takes most space)
    tipColor: { value: "#fff900" }, // Light green/yellow tips
    gradientPower: { value: 1.0, min: 0.1, max: 3.0, step: 0.1 }, // Controls transition smoothness
    baseTransitionPoint: {
      value: 0.1,
      min: 0.0,
      max: 0.5,
      step: 0.01,
      label: "Base Transition Point",
    },
    tipTransitionPoint: {
      value: 0.6,
      min: 0.3,
      max: 0.9,
      step: 0.01,
      label: "Tip Transition Point",
    },
    maxDistance: { value: 100, min: 50, max: 200, step: 10 }, // Max render distance
    lodLevels: { value: 3, min: 1, max: 5, step: 1 }, // Number of LOD levels
    highDetailDistance: { value: 20, min: 5, max: 50, step: 5 }, // Distance for high detail LOD
    mediumDetailDistance: { value: 40, min: 10, max: 80, step: 5 }, // Distance for medium detail LOD
    disableLighting: { value: false }, // Test option to disable lighting
    specularIntensity: { value: 1.5, min: 0, max: 3, step: 0.1 }, // Specular reflection strength
    specularColor: { value: "#4a7c59" }, // Specular reflection color
    specularPower: { value: 32, min: 8, max: 128, step: 8 }, // Specular shininess
    windStrength: {
      value: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.1,
      label: "Wind Strength",
    },
    windSpeed: { value: 1.0, min: 0.1, max: 3.0, step: 0.1 }, // Wind animation speed
    windFrequency: {
      value: 0.1,
      min: 0.01,
      max: 0.5,
      step: 0.01,
      label: "Wind Frequency",
    },
    windAmplitude: {
      value: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.1,
      label: "Wind Amplitude",
    },
    windTurbulence: { value: 1.0, min: 0.1, max: 2.0, step: 0.1 }, // Wind turbulence amount
    flappingIntensity: { value: 1.0, min: 0.0, max: 3.0, step: 0.1 }, // Flapping motion intensity
    // Additional controls
    grassHeightMultiplier: {
      value: 1.0,
      min: 0.5,
      max: 2.0,
      step: 0.1,
      label: "Grass Height Multiplier",
    },
    grassScaleMultiplier: {
      value: 0.7,
      min: 0.5,
      max: 2.0,
      step: 0.1,
      label: "Grass Scale Multiplier",
    },
    windDirectionX: {
      value: 1.0,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: "Wind Direction X",
    },
    windDirectionZ: {
      value: 0.5,
      min: -2.0,
      max: 2.0,
      step: 0.1,
      label: "Wind Direction Z",
    },
    grassDensity: {
      value: 1.0,
      min: 0.1,
      max: 3.0,
      step: 0.1,
      label: "Grass Density",
    },
    shadowCasting: { value: true, label: "Cast Shadows" },
    shadowReceiving: { value: true, label: "Receive Shadows" },
    // Contact Shadow controls (AAA technique)
    contactShadowIntensity: {
      value: 0.0,
      min: 0.0,
      max: 1.0,
      label: "Contact Shadow Intensity",
    },
    contactShadowRadius: {
      value: 2.0,
      min: 0.1,
      max: 10.0,
      label: "Contact Shadow Radius",
    },
    contactShadowBias: {
      value: 0.1,
      min: 0.0,
      max: 1.0,
      label: "Contact Shadow Bias",
    },
    // Ambient Occlusion controls for debugging
    enableAO: {
      value: true,
      label: "Enable Ambient Occlusion",
    },
    aoIntensity: {
      value: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.1,
      label: "AO Intensity",
    },
    aoRadius: {
      value: 0.1,
      min: 0.01,
      max: 1.0,
      step: 0.01,
      label: "AO Radius",
    },
    // Color variation controls for realistic grass
    enableColorVariation: {
      value: false,
      label: "Enable Color Variation",
    },
    colorVariationIntensity: {
      value: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.1,
      label: "Color Variation Intensity",
    },
    tipColorVariationIntensity: {
      value: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.1,
      label: "Tip Color Variation Intensity",
    },
    alphaTest: {
      value: 0.1,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: "Alpha Test Threshold",
    },
    disableMoonReflection: { value: true, label: "Disable Moon Reflection" },
    moonIntensity: {
      value: 2.0,
      min: 0.0,
      max: 5.0,
      step: 0.1,
      label: "Moon Reflection Intensity",
    },
    moonDirectionX: {
      value: -15.0,
      min: -50.0,
      max: 50.0,
      step: 5.0,
      label: "Moon Direction X",
    },
    moonDirectionY: {
      value: 25.0,
      min: 10.0,
      max: 50.0,
      step: 5.0,
      label: "Moon Direction Y",
    },
    moonDirectionZ: {
      value: 10.0,
      min: -50.0,
      max: 50.0,
      step: 5.0,
      label: "Moon Direction Z",
    },
    moonColor: {
      value: "#ff0000",
      label: "Moon Color",
    },
    disableTextureTint: { value: true, label: "Disable Texture Tint" },
    textureRepeatX: {
      value: 1.0,
      min: 0.1,
      max: 5.0,
      step: 0.1,
      label: "Texture Repeat X",
    },
    textureRepeatY: {
      value: 1.0,
      min: 0.1,
      max: 5.0,
      step: 0.1,
      label: "Texture Repeat Y",
    },
    // Subsurface Scattering controls
    sssIntensity: {
      value: 0.8,
      min: 0.0,
      max: 3.0,
      step: 0.1,
      label: "SSS Intensity",
    },
    sssPower: {
      value: 1.5,
      min: 0.5,
      max: 5.0,
      step: 0.1,
      label: "SSS Power",
    },
    sssScale: {
      value: 2.0,
      min: 0.1,
      max: 5.0,
      step: 0.1,
      label: "SSS Scale",
    },
    sssColor: {
      value: "#8fbc8f",
      label: "SSS Color",
    },
    disableSSS: {
      value: true,
      label: "Disable SSS",
    },
    // Environment map controls
    enableEnvMap: { value: false, label: "Enable Environment Reflections" },
    envMapIntensity: {
      value: 1.0,
      min: 0.0,
      max: 3.0,
      step: 0.1,
      label: "Environment Intensity",
    },
    roughnessBase: {
      value: 0.9,
      min: 0.0,
      max: 1.0,
      step: 0.05,
      label: "Roughness (Base)",
    },
    roughnessTip: {
      value: 0.1,
      min: 0.0,
      max: 1.0,
      step: 0.05,
      label: "Roughness (Tip)",
    },
    fresnelPower: {
      value: 3.0,
      min: 1.0,
      max: 10.0,
      step: 0.5,
      label: "Fresnel Power",
    },
    roughnessIntensity: {
      value: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.1,
      label: "Roughness Intensity",
    },
    environmentType: {
      value: "industrial_sunset",
      options: ["industrial_sunset", "kloofendal", "qwantani"],
      label: "Environment Type",
    },
    // Grass shape controls (back from Grass5)
    grassBaseWidth: {
      value: 2.0,
      min: 1.0,
      max: 6.0,
      step: 0.1,
      label: "Grass Base Width",
    },
    grassTipWidth: {
      value: 0.2,
      min: 0.05,
      max: 1.0,
      step: 0.05,
      label: "Grass Tip Width",
    },
    // Anisotropic Specular Controls - Ghost of Tsushima Style!
    enableAnisotropy: {
      value: false,
      label: "Enable Anisotropic Reflections",
    },
    anisotropyStrength: {
      value: 0.8,
      min: 0.0,
      max: 2.0,
      step: 0.1,
      label: "Anisotropy Strength",
    },
    anisotropyTangent: {
      value: 3.0,
      min: 0.1,
      max: 8.0,
      step: 0.1,
      label: "Stretch Along Blade",
    },
    anisotropyBitangent: {
      value: 0.2,
      min: 0.05,
      max: 2.0,
      step: 0.05,
      label: "Tight Across Blade",
    },
  });

  // Load texture and create grass
  useEffect(() => {
    if (!groupRef.current) return;

    console.log("🌾 SimonDevGrass9 useEffect triggered - creating grass...");

    let instancedMesh: THREE.InstancedMesh | null = null;
    let grassGeometry: THREE.PlaneGeometry | null = null;
    let grassMaterial: THREE.ShaderMaterial | null = null;
    let loadedTexture: THREE.Texture | null = null;

    // Create simple environment map first (will be replaced if HDR is selected)
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 64;
    const context = canvas.getContext("2d")!;

    // Create a simple sky blue color
    context.fillStyle = "#87CEEB";
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Create 2D texture (equirectangular format)
    const envMap = new THREE.CanvasTexture(canvas);
    envMap.mapping = THREE.EquirectangularReflectionMapping;
    envMap.needsUpdate = true;

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      "/textures/grass.png",
      (texture) => {
        loadedTexture = texture;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.flipY = false;
        texture.repeat.set(textureRepeatX, textureRepeatY);

        // Create grass geometry with more segments for realistic bending
        grassGeometry = new THREE.PlaneGeometry(
          0.08,
          1.2 * grassHeight * grassHeightMultiplier,
          1,
          12 // Increased to 12 segments for much more flexible bending
        );
        const vertices = grassGeometry.attributes.position
          .array as Float32Array;

        // GRASS5'S EXACT SHAPE LOGIC - No customizable shape controls
        for (let i = 0; i < vertices.length; i += 3) {
          const y = vertices[i + 1];
          // Normalize Y to 0-1 range (original geometry is -0.5 to 0.5)
          const normalizedY = y + 0.5;

          // Create a more pronounced taper: thick base, thin tip
          // Use controls for base and tip width (now controllable again)
          const baseWidth = grassBaseWidth; // Much wider at base (controllable)
          const tipWidth = grassTipWidth; // Thin at tip (controllable)
          const taper = baseWidth - (baseWidth - tipWidth) * normalizedY;

          // Apply the taper to X coordinate (width)
          vertices[i] *= taper;

          // Additional tip tapering for very thin tips
          if (normalizedY > 0.7) {
            const tipTaper = 1.0 - (normalizedY - 0.7) * 3.0; // More aggressive tip tapering
            vertices[i] *= Math.max(tipTaper, 0.1); // Minimum width to avoid disappearing
          }
        }

        // Move the grass geometry up so the bottom edge is at y=0
        // This ensures the bottom of the grass blade sits on the terrain
        for (let i = 0; i < vertices.length; i += 3) {
          vertices[i + 1] += (1.2 * grassHeight * grassHeightMultiplier) / 2; // Move up by half the custom height
        }

        grassGeometry.attributes.position.needsUpdate = true;

        // Add custom attributes for instancing with LOD
        const instanceCount = Math.floor(grassCount);
        const offsets = new Float32Array(instanceCount * 3);
        const scales = new Float32Array(instanceCount);
        const rotations = new Float32Array(instanceCount);
        const windInfluences = new Float32Array(instanceCount);
        const grassTypes = new Float32Array(instanceCount);
        const lodLevels = new Float32Array(instanceCount);
        // Color variation attributes for realistic grass
        const colorVariations = new Float32Array(instanceCount * 3); // RGB variations per blade
        const tipColorVariations = new Float32Array(instanceCount * 3); // Tip color variations

        // Generate instance data with LOD and distance culling (deterministic)
        let instanceIndex = 0;
        for (let i = 0; i < instanceCount; i++) {
          // Deterministic positioning based on index
          const seedX = Math.sin(i * 12.9898) * 43758.5453;
          const seedZ = Math.sin(i * 78.233) * 43758.5453;
          const x = (seedX - Math.floor(seedX) - 0.5) * areaSize;
          const z = (seedZ - Math.floor(seedZ) - 0.5) * areaSize;

          // Skip center area for character movement
          if (Math.abs(x) < 2 && Math.abs(z) < 2) {
            continue;
          }

          // Calculate distance from origin for LOD and culling
          const distance = Math.sqrt(x * x + z * z);

          // Skip grass that's too far away
          if (distance > maxDistance) {
            continue;
          }

          const groundHeight = getGroundHeight ? getGroundHeight(x, z) : 0;

          // LOD system - closer grass is more detailed (deterministic)
          let scale, lodLevel;
          const scaleSeed = Math.sin(i * 3.14159) * 12345.6789;
          const scaleValue = scaleSeed - Math.floor(scaleSeed);

          if (distance < maxDistance * 0.3) {
            // Close range - full detail (same as Grass5)
            scale =
              (0.6 + scaleValue * 0.8) * grassScale * grassScaleMultiplier;
            lodLevel = 0;
          } else if (distance < maxDistance * 0.6) {
            // Medium range - reduced detail (same as Grass5)
            scale =
              (0.4 + scaleValue * 0.6) * grassScale * grassScaleMultiplier;
            lodLevel = 1;
          } else {
            // Far range - minimal detail
            scale =
              (0.2 + scaleValue * 0.4) * grassScale * grassScaleMultiplier;
            lodLevel = 2;
          }

          // Since we moved the geometry up by half the custom height, we need to account for that
          // The bottom of the grass is now at y=0 in the geometry
          const yOffset = 0; // No additional offset needed since geometry is already positioned correctly

          // Set instance data (deterministic)
          const rotationSeed = Math.sin(i * 2.71828) * 9876.5432;
          const windSeed = Math.sin(i * 1.41421) * 2468.1357;
          const typeSeed = Math.sin(i * 0.57721) * 1357.9246;

          offsets[instanceIndex * 3] = x;
          offsets[instanceIndex * 3 + 1] = groundHeight + yOffset;
          offsets[instanceIndex * 3 + 2] = z;
          scales[instanceIndex] = scale;
          rotations[instanceIndex] =
            (rotationSeed - Math.floor(rotationSeed)) * Math.PI * 2;
          windInfluences[instanceIndex] =
            0.3 + (windSeed - Math.floor(windSeed)) * 0.7;
          grassTypes[instanceIndex] = typeSeed - Math.floor(typeSeed);
          lodLevels[instanceIndex] = lodLevel;

          // Generate color variations for realistic grass
          const colorSeed1 = Math.sin(i * 3.14159) * 11111.1111;
          const colorSeed2 = Math.sin(i * 1.61803) * 22222.2222;
          const colorSeed3 = Math.sin(i * 0.70711) * 33333.3333;

          // Base color variation - subtle green range (-0.1 to +0.1)
          colorVariations[instanceIndex * 3] =
            (colorSeed1 - Math.floor(colorSeed1) - 0.5) * 0.1; // R (very subtle red)
          colorVariations[instanceIndex * 3 + 1] =
            (colorSeed2 - Math.floor(colorSeed2) - 0.5) * 0.2; // G (more green variation)
          colorVariations[instanceIndex * 3 + 2] =
            (colorSeed3 - Math.floor(colorSeed3) - 0.5) * 0.05; // B (very subtle blue)

          // Tip color variation - green to yellow range
          const tipSeed1 = Math.sin(i * 2.23607) * 44444.4444;
          const tipSeed2 = Math.sin(i * 1.73205) * 55555.5555;
          const tipSeed3 = Math.sin(i * 0.86603) * 66666.6666;

          tipColorVariations[instanceIndex * 3] =
            (tipSeed1 - Math.floor(tipSeed1) - 0.5) * 0.2; // R (subtle red for yellow tips)
          tipColorVariations[instanceIndex * 3 + 1] =
            (tipSeed2 - Math.floor(tipSeed2) - 0.5) * 0.3; // G (green variation)
          tipColorVariations[instanceIndex * 3 + 2] =
            (tipSeed3 - Math.floor(tipSeed3) - 0.5) * 0.1; // B (subtle blue)

          instanceIndex++;
        }

        // Add attributes to geometry
        grassGeometry.setAttribute(
          "offset",
          new THREE.InstancedBufferAttribute(offsets, 3)
        );
        grassGeometry.setAttribute(
          "scale",
          new THREE.InstancedBufferAttribute(scales, 1)
        );
        grassGeometry.setAttribute(
          "rotation",
          new THREE.InstancedBufferAttribute(rotations, 1)
        );
        grassGeometry.setAttribute(
          "windInfluence",
          new THREE.InstancedBufferAttribute(windInfluences, 1)
        );
        grassGeometry.setAttribute(
          "grassType",
          new THREE.InstancedBufferAttribute(grassTypes, 1)
        );
        grassGeometry.setAttribute(
          "lodLevel",
          new THREE.InstancedBufferAttribute(lodLevels, 1)
        );
        // Add color variation attributes
        grassGeometry.setAttribute(
          "colorVariation",
          new THREE.InstancedBufferAttribute(colorVariations, 3)
        );
        grassGeometry.setAttribute(
          "tipColorVariation",
          new THREE.InstancedBufferAttribute(tipColorVariations, 3)
        );

        // Create SimonDev's custom shader material with shadow support
        grassMaterial = new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms: {
            time: { value: 0 },
            grassTexture: { value: texture },
            baseColor: { value: new THREE.Color(baseColor) },
            middleColor: { value: new THREE.Color(middleColor) },
            tipColor: { value: new THREE.Color(tipColor) },
            gradientPower: { value: gradientPower },
            baseTransitionPoint: { value: baseTransitionPoint },
            tipTransitionPoint: { value: tipTransitionPoint },
            windStrength: { value: windStrength },
            windDirection: {
              value: new THREE.Vector2(windDirectionX, windDirectionZ),
            },
            grassDensity: { value: grassDensity },
            disableLighting: { value: disableLighting },
            specularIntensity: { value: specularIntensity },
            specularColor: { value: new THREE.Color(specularColor) },
            specularPower: { value: specularPower },
            windSpeed: { value: windSpeed },
            windFrequency: { value: windFrequency },
            windAmplitude: { value: windAmplitude },
            windTurbulence: { value: windTurbulence },
            flappingIntensity: { value: flappingIntensity },
            disableMoonReflection: { value: disableMoonReflection },
            moonIntensity: { value: moonIntensity },
            moonDirection: {
              value: new THREE.Vector3(
                moonDirectionX,
                moonDirectionY,
                moonDirectionZ
              ),
            },
            moonColor: { value: new THREE.Color(moonColor) },
            disableTextureTint: { value: disableTextureTint },
            // Subsurface Scattering uniforms
            lightPosition: { value: new THREE.Vector3(10, 10, 10) },
            sssIntensity: { value: sssIntensity },
            sssPower: { value: sssPower },
            sssScale: { value: sssScale },
            sssColor: { value: new THREE.Color(sssColor) },
            disableSSS: { value: disableSSS },
            // Contact Shadow uniforms (AAA technique)
            contactShadowIntensity: { value: contactShadowIntensity },
            contactShadowRadius: { value: contactShadowRadius },
            contactShadowBias: { value: contactShadowBias },
            // Ambient Occlusion uniforms
            enableAO: { value: enableAO },
            aoIntensity: { value: aoIntensity },
            aoRadius: { value: aoRadius },
            // Color variation uniforms
            enableColorVariation: { value: enableColorVariation },
            colorVariationIntensity: { value: colorVariationIntensity },
            tipColorVariationIntensity: { value: tipColorVariationIntensity },
            // Environment map uniforms
            envMap: { value: envMap },
            enableEnvMap: { value: enableEnvMap },
            envMapIntensity: { value: envMapIntensity },
            roughnessBase: { value: roughnessBase },
            roughnessTip: { value: roughnessTip },
            fresnelPower: { value: fresnelPower },
            roughnessIntensity: { value: roughnessIntensity },
            // Anisotropic specular uniforms
            enableAnisotropy: { value: enableAnisotropy },
            anisotropyStrength: { value: anisotropyStrength },
            anisotropyTangent: { value: anisotropyTangent },
            anisotropyBitangent: { value: anisotropyBitangent },
          },
          // Enable shadow support
          transparent: true,
          side: THREE.DoubleSide,
          alphaTest: alphaTest,
        });

        // Note: ShaderMaterial doesn't support castShadow/receiveShadow properties
        // Shadow support is handled through the instancedMesh properties

        materialRef.current = grassMaterial;

        // Create InstancedMesh with proper bounds for frustum culling
        instancedMesh = new THREE.InstancedMesh(
          grassGeometry,
          grassMaterial,
          instanceIndex
        );

        // Disable frustum culling to prevent grass from disappearing
        instancedMesh.frustumCulled = false;
        instancedMesh.castShadow = shadowCasting; // Use control for shadow casting
        instancedMesh.receiveShadow = shadowReceiving;

        // Set proper bounds for the grass area
        const boundingBox = new THREE.Box3();
        boundingBox.setFromCenterAndSize(
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(areaSize * 2, 10, areaSize * 2)
        );
        instancedMesh.geometry.boundingBox = boundingBox;

        // Remove old mesh before adding new one
        if (grassMeshRef.current && groupRef.current) {
          console.log("🧹 Removing old grass mesh before adding new one");
          groupRef.current.remove(grassMeshRef.current);
          grassMeshRef.current.geometry?.dispose();
          if (grassMeshRef.current.material) {
            (grassMeshRef.current.material as THREE.Material).dispose();
          }
        }

        if (groupRef.current) {
          console.log("➕ Adding new grass mesh to scene");
          groupRef.current.add(instancedMesh);
        }
        grassMeshRef.current = instancedMesh;
      },
      undefined,
      (error) => {
        console.error("Failed to load grass texture:", error);
      }
    );

    // Cleanup function - runs when effect is cleaned up
    return () => {
      console.log("🧹 SimonDevGrass9 cleanup triggered");
      if (grassMeshRef.current && groupRef.current) {
        groupRef.current.remove(grassMeshRef.current);
        grassMeshRef.current.geometry?.dispose();
        if (grassMeshRef.current.material) {
          (grassMeshRef.current.material as THREE.Material).dispose();
        }
        grassMeshRef.current = null;
      }
      if (loadedTexture) {
        loadedTexture.dispose();
      }
      if (envMapTextureRef.current) {
        envMapTextureRef.current.dispose();
        envMapTextureRef.current = null;
      }
    };
  }, [
    // ONLY rebuild grass when these STRUCTURAL properties change:
    grassCount, // Number of grass instances
    areaSize, // Area size for grass placement
    grassHeight, // Base geometry height
    grassScale, // Base geometry scale
    getGroundHeight, // Ground height function
    maxDistance, // Affects instance count (culling)
    lodLevels, // Number of LOD levels
    highDetailDistance, // LOD distance
    mediumDetailDistance, // LOD distance
    grassHeightMultiplier, // Affects geometry
    grassScaleMultiplier, // Affects geometry
    grassBaseWidth, // Affects geometry shape
    grassTipWidth, // Affects geometry shape
    // NOTE: Colors, wind, lighting, textures, shadows, etc. should NOT trigger rebuild!
  ]);

  // Update material and mesh properties without rebuilding grass
  useEffect(() => {
    if (!materialRef.current || !grassMeshRef.current) return;

    // Update material alpha test
    materialRef.current.alphaTest = alphaTest;
    materialRef.current.needsUpdate = true;

    // Update mesh shadow properties
    grassMeshRef.current.castShadow = shadowCasting;
    grassMeshRef.current.receiveShadow = shadowReceiving;

    // Update texture repeat (if texture exists)
    if (materialRef.current.uniforms.grassTexture.value) {
      materialRef.current.uniforms.grassTexture.value.repeat.set(
        textureRepeatX,
        textureRepeatY
      );
    }
  }, [
    alphaTest,
    shadowCasting,
    shadowReceiving,
    textureRepeatX,
    textureRepeatY,
  ]);

  // Separate useEffect for environment map loading - doesn't rebuild grass!
  useEffect(() => {
    if (!materialRef.current) return;

    // Load HDR environment map based on selected type (only if enabled)
    if (enableEnvMap) {
      const hdrLoader = new HDRLoader();
      let hdrPath = "/textures/industrial_sunset_02_puresky_4k.hdr";

      if (environmentType === "kloofendal") {
        hdrPath = "/textures/kloofendal_48d_partly_cloudy_puresky_4k.hdr";
      } else if (environmentType === "qwantani") {
        hdrPath = "/textures/qwantani_afternoon_puresky_4k.hdr";
      }

      hdrLoader.load(
        hdrPath,
        (hdrTexture) => {
          // Don't use PMREMGenerator - use texture directly for shader
          hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
          hdrTexture.needsUpdate = true;

          // Dispose old texture before assigning new one
          if (envMapTextureRef.current) {
            envMapTextureRef.current.dispose();
            envMapTextureRef.current = null;
          }

          // Store reference for later disposal
          envMapTextureRef.current = hdrTexture;

          // Update material with HDR environment map
          if (materialRef.current) {
            materialRef.current.uniforms.envMap.value = hdrTexture;
            materialRef.current.needsUpdate = true;
          }
        },
        undefined,
        (error) => {
          console.error(
            `Failed to load ${environmentType} HDR environment map:`,
            error
          );
        }
      );
    } else {
      // Dispose and clear envMap when disabled
      if (envMapTextureRef.current) {
        envMapTextureRef.current.dispose();
        envMapTextureRef.current = null;
      }
      if (materialRef.current) {
        materialRef.current.uniforms.envMap.value = null;
      }
    }
  }, [enableEnvMap, environmentType]);

  // Update shader uniforms
  useFrame((state) => {
    if (materialRef.current && materialRef.current.uniforms) {
      materialRef.current.uniforms.baseColor.value.set(baseColor);
      materialRef.current.uniforms.middleColor.value.set(middleColor);
      materialRef.current.uniforms.tipColor.value.set(tipColor);
      materialRef.current.uniforms.gradientPower.value = gradientPower;
      materialRef.current.uniforms.baseTransitionPoint.value =
        baseTransitionPoint;
      materialRef.current.uniforms.tipTransitionPoint.value =
        tipTransitionPoint;
      materialRef.current.uniforms.windStrength.value = windStrength;
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
      materialRef.current.uniforms.disableLighting.value = disableLighting;
      materialRef.current.uniforms.specularIntensity.value = specularIntensity;
      materialRef.current.uniforms.specularColor.value.set(specularColor);
      materialRef.current.uniforms.specularPower.value = specularPower;
      materialRef.current.uniforms.windSpeed.value = windSpeed;
      materialRef.current.uniforms.windFrequency.value = windFrequency;
      materialRef.current.uniforms.windAmplitude.value = windAmplitude;
      materialRef.current.uniforms.windTurbulence.value = windTurbulence;
      materialRef.current.uniforms.flappingIntensity.value = flappingIntensity;
      materialRef.current.uniforms.windDirection.value.set(
        windDirectionX,
        windDirectionZ
      );
      materialRef.current.uniforms.grassDensity.value = grassDensity;
      materialRef.current.uniforms.disableMoonReflection.value =
        disableMoonReflection;
      materialRef.current.uniforms.moonIntensity.value = moonIntensity;
      materialRef.current.uniforms.moonDirection.value.set(
        moonDirectionX,
        moonDirectionY,
        moonDirectionZ
      );
      materialRef.current.uniforms.moonColor.value.set(moonColor);
      materialRef.current.uniforms.disableTextureTint.value =
        disableTextureTint;

      // Update Subsurface Scattering uniforms
      materialRef.current.uniforms.sssIntensity.value = sssIntensity;
      materialRef.current.uniforms.sssPower.value = sssPower;
      materialRef.current.uniforms.sssScale.value = sssScale;
      materialRef.current.uniforms.sssColor.value.set(sssColor);
      materialRef.current.uniforms.disableSSS.value = disableSSS;

      // Update Contact Shadow uniforms (AAA technique)
      materialRef.current.uniforms.contactShadowIntensity.value =
        contactShadowIntensity;
      materialRef.current.uniforms.contactShadowRadius.value =
        contactShadowRadius;
      materialRef.current.uniforms.contactShadowBias.value = contactShadowBias;

      // Update Ambient Occlusion uniforms
      materialRef.current.uniforms.enableAO.value = enableAO;
      materialRef.current.uniforms.aoIntensity.value = aoIntensity;
      materialRef.current.uniforms.aoRadius.value = aoRadius;

      // Update Color Variation uniforms
      materialRef.current.uniforms.enableColorVariation.value =
        enableColorVariation;
      materialRef.current.uniforms.colorVariationIntensity.value =
        colorVariationIntensity;
      materialRef.current.uniforms.tipColorVariationIntensity.value =
        tipColorVariationIntensity;

      // Update Environment Map uniforms
      materialRef.current.uniforms.enableEnvMap.value = enableEnvMap;
      materialRef.current.uniforms.envMapIntensity.value = envMapIntensity;
      materialRef.current.uniforms.roughnessBase.value = roughnessBase;
      materialRef.current.uniforms.roughnessTip.value = roughnessTip;
      materialRef.current.uniforms.fresnelPower.value = fresnelPower;
      materialRef.current.uniforms.roughnessIntensity.value =
        roughnessIntensity;

      // Update Anisotropic Specular uniforms
      materialRef.current.uniforms.enableAnisotropy.value = enableAnisotropy;
      materialRef.current.uniforms.anisotropyStrength.value =
        anisotropyStrength;
      materialRef.current.uniforms.anisotropyTangent.value = anisotropyTangent;
      materialRef.current.uniforms.anisotropyBitangent.value =
        anisotropyBitangent;

      // Handle environment type switching
      // DON'T reload HDR in useFrame - it causes performance issues
      // HDR loading is handled in useEffect above
    }
  });

  return <group ref={groupRef} />;
};

export default SimonDevGrass9;
