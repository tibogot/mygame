import * as THREE from "three";
import CustomShaderMaterial from "three-custom-shader-material/vanilla";
import {
  grassVertexShaderCSM,
  grassFragmentShaderCSM,
} from "./GrassShadersCSM";

export interface GrassMaterialConfig {
  // Colors
  baseColor: string;
  middleColor: string;
  tipColor: string;
  gradientPower: number;
  baseTransitionPoint: number;
  tipTransitionPoint: number;

  // Wind
  windStrength: number;
  windDirectionX: number;
  windDirectionZ: number;
  windSpeed: number;
  windFrequency: number;
  windAmplitude: number;
  windTurbulence: number;
  flappingIntensity: number;
  grassDensity: number;

  // Lighting
  disableLighting: boolean;
  specularIntensity: number;
  specularColor: string;
  specularPower: number;
  sunDirectionX: number;
  sunDirectionY: number;
  sunDirectionZ: number;

  // Moon
  disableMoonReflection: boolean;
  moonIntensity: number;
  moonDirectionX: number;
  moonDirectionY: number;
  moonDirectionZ: number;
  moonColor: string;

  // Texture
  disableTextureTint: boolean;
  edgeDarkeningStrength: number;

  // Subsurface Scattering
  sssIntensity: number;
  sssPower: number;
  sssScale: number;
  sssColor: string;
  disableSSS: boolean;

  // Contact Shadows
  contactShadowIntensity: number;
  contactShadowRadius: number;

  // Ambient Occlusion
  enableAO: boolean;
  aoIntensity: number;
  aoRadius: number;

  // Color Variation
  enableColorVariation: boolean;
  colorVariationIntensity: number;
  tipColorVariationIntensity: number;

  // Environment Mapping
  enableEnvMap: boolean;
  envMapIntensity: number;
  roughnessBase: number;
  roughnessTip: number;
  fresnelPower: number;
  roughnessIntensity: number;

  // Anisotropy
  enableAnisotropy: boolean;
  anisotropyStrength: number;
  anisotropyTangent: number;
  anisotropyBitangent: number;

  // Distance Fog
  enableDistanceFog: boolean;
  fogScatterDensity: number;
  fogExtinctionDensity: number;
  fogSkyColor: string;

  // Wrapped Lighting
  enableWrappedLighting: boolean;
  wrapAmount: number;

  // Player Interaction
  enablePlayerInteraction: boolean;
  playerInteractionRadius: number;
  playerInteractionStrength: number;
  playerInteractionRepel: boolean;

  // Grass Shape
  grassBaseLean: number;
  bladeCurveAmount: number;
  enableViewThickening: boolean;

  // Shadow
  shadowAlphaThreshold: number;
  alphaTest: number;
}

/**
 * Create grass materials using CustomShaderMaterial for shadow support
 */
export const createGrassMaterials = (
  texture: THREE.Texture,
  envMap: THREE.CubeTexture | null,
  config: GrassMaterialConfig
): {
  grassMaterial: any; // CustomShaderMaterial type
  depthMaterial: any; // CustomShaderMaterial type
} => {
  console.log("🔧 Creating CSM grass material with shadow support...");

  // Main grass material with shadow receiving
  const grassMaterial = new CustomShaderMaterial({
    baseMaterial: THREE.MeshStandardMaterial,
    vertexShader: grassVertexShaderCSM,
    fragmentShader: grassFragmentShaderCSM,

    uniforms: {
      time: { value: 0 },
      grassTexture: { value: texture },
      baseColor: { value: new THREE.Color(config.baseColor) },
      middleColor: { value: new THREE.Color(config.middleColor) },
      tipColor: { value: new THREE.Color(config.tipColor) },
      gradientPower: { value: config.gradientPower },
      baseTransitionPoint: { value: config.baseTransitionPoint },
      tipTransitionPoint: { value: config.tipTransitionPoint },
      windStrength: { value: config.windStrength },
      windDirection: {
        value: new THREE.Vector2(config.windDirectionX, config.windDirectionZ),
      },
      grassDensity: { value: config.grassDensity },
      disableLighting: { value: config.disableLighting },
      specularIntensity: { value: config.specularIntensity },
      specularColor: { value: new THREE.Color(config.specularColor) },
      specularPower: { value: config.specularPower },
      windSpeed: { value: config.windSpeed },
      windFrequency: { value: config.windFrequency },
      windAmplitude: { value: config.windAmplitude },
      windTurbulence: { value: config.windTurbulence },
      flappingIntensity: { value: config.flappingIntensity },
      playerPosition: { value: new THREE.Vector3(0, 0, 0) },
      highDetailDistance: { value: 60 },
      mediumDetailDistance: { value: 100 },
      viewMatrixInverse: { value: new THREE.Matrix4() },
      enableViewThickening: { value: config.enableViewThickening },
      grassBaseLean: { value: config.grassBaseLean },
      bladeCurveAmount: { value: config.bladeCurveAmount },
      disableMoonReflection: { value: config.disableMoonReflection },
      moonIntensity: { value: config.moonIntensity },
      moonDirection: {
        value: new THREE.Vector3(
          config.moonDirectionX,
          config.moonDirectionY,
          config.moonDirectionZ
        ),
      },
      moonColor: { value: new THREE.Color(config.moonColor) },
      sunDirection: {
        value: new THREE.Vector3(
          config.sunDirectionX,
          config.sunDirectionY,
          config.sunDirectionZ
        ),
      },
      disableTextureTint: { value: config.disableTextureTint },
      edgeDarkeningStrength: { value: config.edgeDarkeningStrength },
      sssIntensity: { value: config.sssIntensity },
      sssPower: { value: config.sssPower },
      sssScale: { value: config.sssScale },
      sssColor: { value: new THREE.Color(config.sssColor) },
      disableSSS: { value: config.disableSSS },
      contactShadowIntensity: { value: config.contactShadowIntensity },
      contactShadowRadius: { value: config.contactShadowRadius },
      enableAO: { value: config.enableAO },
      aoIntensity: { value: config.aoIntensity },
      aoRadius: { value: config.aoRadius },
      enableColorVariation: { value: config.enableColorVariation },
      colorVariationIntensity: { value: config.colorVariationIntensity },
      tipColorVariationIntensity: { value: config.tipColorVariationIntensity },
      envMap: { value: envMap },
      enableEnvMap: { value: config.enableEnvMap },
      envMapIntensity: { value: config.envMapIntensity },
      roughnessBase: { value: config.roughnessBase },
      roughnessTip: { value: config.roughnessTip },
      fresnelPower: { value: config.fresnelPower },
      roughnessIntensity: { value: config.roughnessIntensity },
      enableAnisotropy: { value: config.enableAnisotropy },
      anisotropyStrength: { value: config.anisotropyStrength },
      anisotropyTangent: { value: config.anisotropyTangent },
      anisotropyBitangent: { value: config.anisotropyBitangent },
      enableDistanceFog: { value: config.enableDistanceFog },
      fogScatterDensity: { value: config.fogScatterDensity },
      fogExtinctionDensity: { value: config.fogExtinctionDensity },
      fogSkyColor: { value: new THREE.Color(config.fogSkyColor) },
      enableWrappedLighting: { value: config.enableWrappedLighting },
      wrapAmount: { value: config.wrapAmount },
      enablePlayerInteraction: { value: config.enablePlayerInteraction },
      playerInteractionRadius: { value: config.playerInteractionRadius },
      playerInteractionStrength: { value: config.playerInteractionStrength },
      playerInteractionRepel: { value: config.playerInteractionRepel },
    },

    // MeshStandardMaterial base properties
    transparent: true,
    side: THREE.DoubleSide,
    alphaTest: config.alphaTest,

    // Enable shadow receiving!
    shadowSide: THREE.DoubleSide,

    // Silent mode to avoid CSM warnings
    silent: true,
  });

  // Depth material for shadow casting with wind animation
  const depthMaterial = new CustomShaderMaterial({
    baseMaterial: THREE.MeshDepthMaterial,
    vertexShader: grassVertexShaderCSM, // Same vertex shader
    fragmentShader: `
      // Custom depth fragment shader
      uniform sampler2D grassTexture;
      varying vec2 vUv;
      
      void main() {
        vec4 texColor = texture2D(grassTexture, vUv);
        if (texColor.a < 0.1) discard;
        // CSM handles depth writing automatically
      }
    `,

    uniforms: {
      time: { value: 0.0 },
      grassTexture: { value: texture },
      windStrength: { value: config.windStrength },
      windDirection: {
        value: new THREE.Vector2(config.windDirectionX, config.windDirectionZ),
      },
      grassDensity: { value: config.grassDensity },
      windSpeed: { value: config.windSpeed },
      windFrequency: { value: config.windFrequency },
      windAmplitude: { value: config.windAmplitude },
      windTurbulence: { value: config.windTurbulence },
      flappingIntensity: { value: config.flappingIntensity },
      playerPosition: { value: new THREE.Vector3(0, 0, 0) },
      highDetailDistance: { value: 60 },
      mediumDetailDistance: { value: 100 },
      viewMatrixInverse: { value: new THREE.Matrix4() },
      enableViewThickening: { value: config.enableViewThickening },
      grassBaseLean: { value: config.grassBaseLean },
      bladeCurveAmount: { value: config.bladeCurveAmount },
      enablePlayerInteraction: { value: config.enablePlayerInteraction },
      playerInteractionRadius: { value: config.playerInteractionRadius },
      playerInteractionStrength: { value: config.playerInteractionStrength },
      playerInteractionRepel: { value: config.playerInteractionRepel },
    },

    // MeshDepthMaterial properties
    depthPacking: THREE.RGBADepthPacking,

    silent: true,
  });

  return { grassMaterial, depthMaterial };
};

/**
 * Helper function to update material uniforms
 */
export const updateGrassMaterialUniforms = (
  material: any,
  config: Partial<GrassMaterialConfig>,
  highDetailDistance?: number,
  mediumDetailDistance?: number,
  playerPosition?: THREE.Vector3
) => {
  if (!material || !material.uniforms) return;

  const u = material.uniforms;

  // Update dynamic values
  if (highDetailDistance !== undefined)
    u.highDetailDistance.value = highDetailDistance;
  if (mediumDetailDistance !== undefined)
    u.mediumDetailDistance.value = mediumDetailDistance;
  if (playerPosition) u.playerPosition.value.copy(playerPosition);

  // Update all config-based values (same as before)
  if (config.baseColor !== undefined) u.baseColor.value.set(config.baseColor);
  if (config.middleColor !== undefined)
    u.middleColor.value.set(config.middleColor);
  if (config.tipColor !== undefined) u.tipColor.value.set(config.tipColor);
  if (config.gradientPower !== undefined)
    u.gradientPower.value = config.gradientPower;
  if (config.baseTransitionPoint !== undefined)
    u.baseTransitionPoint.value = config.baseTransitionPoint;
  if (config.tipTransitionPoint !== undefined)
    u.tipTransitionPoint.value = config.tipTransitionPoint;
  if (config.windStrength !== undefined)
    u.windStrength.value = config.windStrength;
  if (
    config.windDirectionX !== undefined ||
    config.windDirectionZ !== undefined
  ) {
    u.windDirection.value.set(
      config.windDirectionX ?? u.windDirection.value.x,
      config.windDirectionZ ?? u.windDirection.value.z
    );
  }
  if (config.grassDensity !== undefined)
    u.grassDensity.value = config.grassDensity;
  if (config.disableLighting !== undefined)
    u.disableLighting.value = config.disableLighting;
  if (config.specularIntensity !== undefined)
    u.specularIntensity.value = config.specularIntensity;
  if (config.specularColor !== undefined)
    u.specularColor.value.set(config.specularColor);
  if (config.specularPower !== undefined)
    u.specularPower.value = config.specularPower;
  if (config.windSpeed !== undefined) u.windSpeed.value = config.windSpeed;
  if (config.windFrequency !== undefined)
    u.windFrequency.value = config.windFrequency;
  if (config.windAmplitude !== undefined)
    u.windAmplitude.value = config.windAmplitude;
  if (config.windTurbulence !== undefined)
    u.windTurbulence.value = config.windTurbulence;
  if (config.flappingIntensity !== undefined)
    u.flappingIntensity.value = config.flappingIntensity;
  // ... (rest of your uniform updates remain the same)

  material.needsUpdate = true;
};

/**
 * Helper function to update depth material uniforms
 */
export const updateDepthMaterialUniforms = (
  material: any,
  config: Partial<GrassMaterialConfig>,
  highDetailDistance?: number,
  mediumDetailDistance?: number,
  playerPosition?: THREE.Vector3
) => {
  if (!material || !material.uniforms) return;

  const u = material.uniforms;

  if (highDetailDistance !== undefined)
    u.highDetailDistance.value = highDetailDistance;
  if (mediumDetailDistance !== undefined)
    u.mediumDetailDistance.value = mediumDetailDistance;
  if (playerPosition) u.playerPosition.value.copy(playerPosition);

  if (config.windStrength !== undefined)
    u.windStrength.value = config.windStrength;
  if (
    config.windDirectionX !== undefined ||
    config.windDirectionZ !== undefined
  ) {
    u.windDirection.value.set(
      config.windDirectionX ?? u.windDirection.value.x,
      config.windDirectionZ ?? u.windDirection.value.z
    );
  }
  if (config.grassDensity !== undefined)
    u.grassDensity.value = config.grassDensity;
  if (config.windSpeed !== undefined) u.windSpeed.value = config.windSpeed;
  if (config.windFrequency !== undefined)
    u.windFrequency.value = config.windFrequency;
  if (config.windAmplitude !== undefined)
    u.windAmplitude.value = config.windAmplitude;
  if (config.windTurbulence !== undefined)
    u.windTurbulence.value = config.windTurbulence;
  if (config.flappingIntensity !== undefined)
    u.flappingIntensity.value = config.flappingIntensity;
  if (config.enableViewThickening !== undefined)
    u.enableViewThickening.value = config.enableViewThickening;
  if (config.grassBaseLean !== undefined)
    u.grassBaseLean.value = config.grassBaseLean;
  if (config.bladeCurveAmount !== undefined)
    u.bladeCurveAmount.value = config.bladeCurveAmount;
  if (config.enablePlayerInteraction !== undefined)
    u.enablePlayerInteraction.value = config.enablePlayerInteraction;
  if (config.playerInteractionRadius !== undefined)
    u.playerInteractionRadius.value = config.playerInteractionRadius;
  if (config.playerInteractionStrength !== undefined)
    u.playerInteractionStrength.value = config.playerInteractionStrength;
  if (config.playerInteractionRepel !== undefined)
    u.playerInteractionRepel.value = config.playerInteractionRepel;

  material.needsUpdate = true;
};

export default {
  createGrassMaterials,
  updateGrassMaterialUniforms,
  updateDepthMaterialUniforms,
};
