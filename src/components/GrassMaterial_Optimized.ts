import * as THREE from "three";
import {
  grassVertexShader,
  grassFragmentShader,
  grassDepthVertexShader,
  grassDepthFragmentShader,
} from "./GrassShaders";

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
 * 🚀 PERFORMANCE-OPTIMIZED Material Creation
 *
 * Key optimizations:
 * 1. Separate HIGH FREQUENCY vs LOW FREQUENCY uniforms
 * 2. Removed needsUpdate=true (only for shader changes!)
 * 3. Minimal depth material uniforms
 * 4. Ready for shader LOD system
 */
export const createGrassMaterials = (
  texture: THREE.Texture,
  envMap: THREE.CubeTexture | null,
  config: GrassMaterialConfig
): {
  grassMaterial: THREE.ShaderMaterial;
  depthMaterial: THREE.ShaderMaterial;
} => {
  console.log("🔧 Creating OPTIMIZED grass materials...");

  // ========== MAIN GRASS MATERIAL ==========
  const grassMaterial = new THREE.ShaderMaterial({
    vertexShader: grassVertexShader,
    fragmentShader: grassFragmentShader,
    depthWrite: true,
    depthTest: true,
    transparent: true,
    side: THREE.DoubleSide,
    alphaTest: config.alphaTest,
    stencilWrite: false,

    uniforms: {
      // ========== HIGH FREQUENCY (Updated every frame) ==========
      time: { value: 0 },
      playerPosition: { value: new THREE.Vector3(0, 0, 0) },

      // ========== MEDIUM FREQUENCY (Updated on camera move) ==========
      highDetailDistance: { value: 60 },
      mediumDetailDistance: { value: 100 },
      viewMatrixInverse: { value: new THREE.Matrix4() },

      // ========== LOW FREQUENCY (Updated on config change) ==========
      // Textures
      grassTexture: { value: texture },
      envMap: { value: envMap },

      // Colors
      baseColor: { value: new THREE.Color(config.baseColor) },
      middleColor: { value: new THREE.Color(config.middleColor) },
      tipColor: { value: new THREE.Color(config.tipColor) },
      gradientPower: { value: config.gradientPower },
      baseTransitionPoint: { value: config.baseTransitionPoint },
      tipTransitionPoint: { value: config.tipTransitionPoint },

      // Wind (frequently changed)
      windStrength: { value: config.windStrength },
      windDirection: {
        value: new THREE.Vector2(config.windDirectionX, config.windDirectionZ),
      },
      windSpeed: { value: config.windSpeed },
      windFrequency: { value: config.windFrequency },
      windAmplitude: { value: config.windAmplitude },
      windTurbulence: { value: config.windTurbulence },
      flappingIntensity: { value: config.flappingIntensity },

      // Lighting
      sunDirection: {
        value: new THREE.Vector3(
          config.sunDirectionX,
          config.sunDirectionY,
          config.sunDirectionZ
        ),
      },
      moonDirection: {
        value: new THREE.Vector3(
          config.moonDirectionX,
          config.moonDirectionY,
          config.moonDirectionZ
        ),
      },
      specularColor: { value: new THREE.Color(config.specularColor) },
      moonColor: { value: new THREE.Color(config.moonColor) },
      sssColor: { value: new THREE.Color(config.sssColor) },
      fogSkyColor: { value: new THREE.Color(config.fogSkyColor) },

      // Scalar values (rarely changed)
      grassDensity: { value: config.grassDensity },
      specularIntensity: { value: config.specularIntensity },
      specularPower: { value: config.specularPower },
      moonIntensity: { value: config.moonIntensity },
      edgeDarkeningStrength: { value: config.edgeDarkeningStrength },
      sssIntensity: { value: config.sssIntensity },
      sssPower: { value: config.sssPower },
      sssScale: { value: config.sssScale },
      contactShadowIntensity: { value: config.contactShadowIntensity },
      contactShadowRadius: { value: config.contactShadowRadius },
      aoIntensity: { value: config.aoIntensity },
      aoRadius: { value: config.aoRadius },
      colorVariationIntensity: { value: config.colorVariationIntensity },
      tipColorVariationIntensity: { value: config.tipColorVariationIntensity },
      envMapIntensity: { value: config.envMapIntensity },
      roughnessBase: { value: config.roughnessBase },
      roughnessTip: { value: config.roughnessTip },
      fresnelPower: { value: config.fresnelPower },
      roughnessIntensity: { value: config.roughnessIntensity },
      anisotropyStrength: { value: config.anisotropyStrength },
      anisotropyTangent: { value: config.anisotropyTangent },
      anisotropyBitangent: { value: config.anisotropyBitangent },
      fogScatterDensity: { value: config.fogScatterDensity },
      fogExtinctionDensity: { value: config.fogExtinctionDensity },
      wrapAmount: { value: config.wrapAmount },
      playerInteractionRadius: { value: config.playerInteractionRadius },
      playerInteractionStrength: { value: config.playerInteractionStrength },
      grassBaseLean: { value: config.grassBaseLean },
      bladeCurveAmount: { value: config.bladeCurveAmount },

      // Booleans (rarely changed)
      disableLighting: { value: config.disableLighting },
      disableMoonReflection: { value: config.disableMoonReflection },
      disableTextureTint: { value: config.disableTextureTint },
      disableSSS: { value: config.disableSSS },
      enableAO: { value: config.enableAO },
      enableColorVariation: { value: config.enableColorVariation },
      enableEnvMap: { value: config.enableEnvMap },
      enableAnisotropy: { value: config.enableAnisotropy },
      enableDistanceFog: { value: config.enableDistanceFog },
      enableWrappedLighting: { value: config.enableWrappedLighting },
      enablePlayerInteraction: { value: config.enablePlayerInteraction },
      playerInteractionRepel: { value: config.playerInteractionRepel },
      enableViewThickening: { value: config.enableViewThickening },
    },
  });

  // ========== DEPTH MATERIAL (Shadows/Depth Pass) ==========
  // ✅ ONLY includes uniforms that affect vertex position + alpha test
  const depthMaterial = new THREE.ShaderMaterial({
    depthWrite: true,
    depthTest: true,
    stencilWrite: false,
    vertexShader: grassDepthVertexShader,
    fragmentShader: grassDepthFragmentShader,

    uniforms: {
      // HIGH FREQUENCY
      time: { value: 0.0 },
      playerPosition: { value: new THREE.Vector3(0, 0, 0) },

      // MEDIUM FREQUENCY
      highDetailDistance: { value: 60 },
      mediumDetailDistance: { value: 100 },
      viewMatrixInverse: { value: new THREE.Matrix4() },

      // LOW FREQUENCY - Only what affects shadows!
      grassTexture: { value: texture },
      shadowAlphaThreshold: { value: config.shadowAlphaThreshold },
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
      grassBaseLean: { value: config.grassBaseLean },
      bladeCurveAmount: { value: config.bladeCurveAmount },
      playerInteractionRadius: { value: config.playerInteractionRadius },
      playerInteractionStrength: { value: config.playerInteractionStrength },
      enableViewThickening: { value: config.enableViewThickening },
      enablePlayerInteraction: { value: config.enablePlayerInteraction },
      playerInteractionRepel: { value: config.playerInteractionRepel },
    },
  });

  console.log(
    `✅ Created materials with ${
      Object.keys(grassMaterial.uniforms).length
    } main uniforms, ${
      Object.keys(depthMaterial.uniforms).length
    } depth uniforms`
  );

  return { grassMaterial, depthMaterial };
};

/**
 * 🚀 OPTIMIZED Uniform Updater
 *
 * CRITICAL: NO material.needsUpdate! Only updates uniform VALUES
 * Split into categories for performance
 */
export const updateGrassMaterialUniforms = (
  material: THREE.ShaderMaterial,
  config: Partial<GrassMaterialConfig>,
  highDetailDistance?: number,
  mediumDetailDistance?: number,
  playerPosition?: THREE.Vector3
) => {
  if (!material?.uniforms) return;

  const u = material.uniforms;

  // ========== DYNAMIC VALUES (every frame) ==========
  if (playerPosition) u.playerPosition.value.copy(playerPosition);

  // ========== CAMERA-BASED VALUES (on camera move) ==========
  if (highDetailDistance !== undefined)
    u.highDetailDistance.value = highDetailDistance;
  if (mediumDetailDistance !== undefined)
    u.mediumDetailDistance.value = mediumDetailDistance;

  // ========== CONFIG VALUES (on control change) ==========
  // Only update if provided (selective updates!)
  if (config.baseColor) u.baseColor.value.set(config.baseColor);
  if (config.middleColor) u.middleColor.value.set(config.middleColor);
  if (config.tipColor) u.tipColor.value.set(config.tipColor);
  if (config.gradientPower !== undefined)
    u.gradientPower.value = config.gradientPower;
  if (config.baseTransitionPoint !== undefined)
    u.baseTransitionPoint.value = config.baseTransitionPoint;
  if (config.tipTransitionPoint !== undefined)
    u.tipTransitionPoint.value = config.tipTransitionPoint;

  // Wind (frequently updated)
  if (config.windStrength !== undefined)
    u.windStrength.value = config.windStrength;
  if (
    config.windDirectionX !== undefined ||
    config.windDirectionZ !== undefined
  ) {
    u.windDirection.value.set(
      config.windDirectionX ?? u.windDirection.value.x,
      config.windDirectionZ ?? u.windDirection.value.y
    );
  }
  if (config.windSpeed !== undefined) u.windSpeed.value = config.windSpeed;
  if (config.windFrequency !== undefined)
    u.windFrequency.value = config.windFrequency;
  if (config.windAmplitude !== undefined)
    u.windAmplitude.value = config.windAmplitude;
  if (config.windTurbulence !== undefined)
    u.windTurbulence.value = config.windTurbulence;
  if (config.flappingIntensity !== undefined)
    u.flappingIntensity.value = config.flappingIntensity;

  // Lighting
  if (
    config.sunDirectionX !== undefined ||
    config.sunDirectionY !== undefined ||
    config.sunDirectionZ !== undefined
  ) {
    u.sunDirection.value.set(
      config.sunDirectionX ?? u.sunDirection.value.x,
      config.sunDirectionY ?? u.sunDirection.value.y,
      config.sunDirectionZ ?? u.sunDirection.value.z
    );
  }
  if (
    config.moonDirectionX !== undefined ||
    config.moonDirectionY !== undefined ||
    config.moonDirectionZ !== undefined
  ) {
    u.moonDirection.value.set(
      config.moonDirectionX ?? u.moonDirection.value.x,
      config.moonDirectionY ?? u.moonDirection.value.y,
      config.moonDirectionZ ?? u.moonDirection.value.z
    );
  }

  // Colors
  if (config.specularColor) u.specularColor.value.set(config.specularColor);
  if (config.moonColor) u.moonColor.value.set(config.moonColor);
  if (config.sssColor) u.sssColor.value.set(config.sssColor);
  if (config.fogSkyColor) u.fogSkyColor.value.set(config.fogSkyColor);

  // Scalars - grouped by usage frequency
  if (config.grassDensity !== undefined)
    u.grassDensity.value = config.grassDensity;
  if (config.specularIntensity !== undefined)
    u.specularIntensity.value = config.specularIntensity;
  if (config.specularPower !== undefined)
    u.specularPower.value = config.specularPower;
  if (config.moonIntensity !== undefined)
    u.moonIntensity.value = config.moonIntensity;
  if (config.edgeDarkeningStrength !== undefined)
    u.edgeDarkeningStrength.value = config.edgeDarkeningStrength;
  if (config.sssIntensity !== undefined)
    u.sssIntensity.value = config.sssIntensity;
  if (config.sssPower !== undefined) u.sssPower.value = config.sssPower;
  if (config.sssScale !== undefined) u.sssScale.value = config.sssScale;
  if (config.contactShadowIntensity !== undefined)
    u.contactShadowIntensity.value = config.contactShadowIntensity;
  if (config.contactShadowRadius !== undefined)
    u.contactShadowRadius.value = config.contactShadowRadius;
  if (config.aoIntensity !== undefined)
    u.aoIntensity.value = config.aoIntensity;
  if (config.aoRadius !== undefined) u.aoRadius.value = config.aoRadius;
  if (config.colorVariationIntensity !== undefined)
    u.colorVariationIntensity.value = config.colorVariationIntensity;
  if (config.tipColorVariationIntensity !== undefined)
    u.tipColorVariationIntensity.value = config.tipColorVariationIntensity;
  if (config.envMapIntensity !== undefined)
    u.envMapIntensity.value = config.envMapIntensity;
  if (config.roughnessBase !== undefined)
    u.roughnessBase.value = config.roughnessBase;
  if (config.roughnessTip !== undefined)
    u.roughnessTip.value = config.roughnessTip;
  if (config.fresnelPower !== undefined)
    u.fresnelPower.value = config.fresnelPower;
  if (config.roughnessIntensity !== undefined)
    u.roughnessIntensity.value = config.roughnessIntensity;
  if (config.anisotropyStrength !== undefined)
    u.anisotropyStrength.value = config.anisotropyStrength;
  if (config.anisotropyTangent !== undefined)
    u.anisotropyTangent.value = config.anisotropyTangent;
  if (config.anisotropyBitangent !== undefined)
    u.anisotropyBitangent.value = config.anisotropyBitangent;
  if (config.fogScatterDensity !== undefined)
    u.fogScatterDensity.value = config.fogScatterDensity;
  if (config.fogExtinctionDensity !== undefined)
    u.fogExtinctionDensity.value = config.fogExtinctionDensity;
  if (config.wrapAmount !== undefined) u.wrapAmount.value = config.wrapAmount;
  if (config.playerInteractionRadius !== undefined)
    u.playerInteractionRadius.value = config.playerInteractionRadius;
  if (config.playerInteractionStrength !== undefined)
    u.playerInteractionStrength.value = config.playerInteractionStrength;
  if (config.grassBaseLean !== undefined)
    u.grassBaseLean.value = config.grassBaseLean;
  if (config.bladeCurveAmount !== undefined)
    u.bladeCurveAmount.value = config.bladeCurveAmount;

  // Booleans
  if (config.disableLighting !== undefined)
    u.disableLighting.value = config.disableLighting;
  if (config.disableMoonReflection !== undefined)
    u.disableMoonReflection.value = config.disableMoonReflection;
  if (config.disableTextureTint !== undefined)
    u.disableTextureTint.value = config.disableTextureTint;
  if (config.disableSSS !== undefined) u.disableSSS.value = config.disableSSS;
  if (config.enableAO !== undefined) u.enableAO.value = config.enableAO;
  if (config.enableColorVariation !== undefined)
    u.enableColorVariation.value = config.enableColorVariation;
  if (config.enableEnvMap !== undefined)
    u.enableEnvMap.value = config.enableEnvMap;
  if (config.enableAnisotropy !== undefined)
    u.enableAnisotropy.value = config.enableAnisotropy;
  if (config.enableDistanceFog !== undefined)
    u.enableDistanceFog.value = config.enableDistanceFog;
  if (config.enableWrappedLighting !== undefined)
    u.enableWrappedLighting.value = config.enableWrappedLighting;
  if (config.enablePlayerInteraction !== undefined)
    u.enablePlayerInteraction.value = config.enablePlayerInteraction;
  if (config.playerInteractionRepel !== undefined)
    u.playerInteractionRepel.value = config.playerInteractionRepel;
  if (config.enableViewThickening !== undefined)
    u.enableViewThickening.value = config.enableViewThickening;

  // ✅ NO material.needsUpdate! Uniforms auto-update!
};

/**
 * 🚀 OPTIMIZED Depth Material Updater
 * Only updates uniforms that affect shadows
 */
export const updateDepthMaterialUniforms = (
  material: THREE.ShaderMaterial,
  config: Partial<GrassMaterialConfig>,
  highDetailDistance?: number,
  mediumDetailDistance?: number,
  playerPosition?: THREE.Vector3
) => {
  if (!material?.uniforms) return;

  const u = material.uniforms;

  // Dynamic values
  if (playerPosition) u.playerPosition.value.copy(playerPosition);
  if (highDetailDistance !== undefined)
    u.highDetailDistance.value = highDetailDistance;
  if (mediumDetailDistance !== undefined)
    u.mediumDetailDistance.value = mediumDetailDistance;

  // Only update what affects vertex position + alpha
  if (config.shadowAlphaThreshold !== undefined)
    u.shadowAlphaThreshold.value = config.shadowAlphaThreshold;
  if (config.windStrength !== undefined)
    u.windStrength.value = config.windStrength;
  if (
    config.windDirectionX !== undefined ||
    config.windDirectionZ !== undefined
  ) {
    u.windDirection.value.set(
      config.windDirectionX ?? u.windDirection.value.x,
      config.windDirectionZ ?? u.windDirection.value.y
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
  if (config.grassBaseLean !== undefined)
    u.grassBaseLean.value = config.grassBaseLean;
  if (config.bladeCurveAmount !== undefined)
    u.bladeCurveAmount.value = config.bladeCurveAmount;
  if (config.playerInteractionRadius !== undefined)
    u.playerInteractionRadius.value = config.playerInteractionRadius;
  if (config.playerInteractionStrength !== undefined)
    u.playerInteractionStrength.value = config.playerInteractionStrength;
  if (config.enableViewThickening !== undefined)
    u.enableViewThickening.value = config.enableViewThickening;
  if (config.enablePlayerInteraction !== undefined)
    u.enablePlayerInteraction.value = config.enablePlayerInteraction;
  if (config.playerInteractionRepel !== undefined)
    u.playerInteractionRepel.value = config.playerInteractionRepel;

  // ✅ NO material.needsUpdate!
};

export default {
  createGrassMaterials,
  updateGrassMaterialUniforms,
  updateDepthMaterialUniforms,
};
