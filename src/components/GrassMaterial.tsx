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
 * GrassMaterial - Extracted Material Creation Logic for Grass System
 *
 * This component contains all the material creation logic that was previously
 * embedded in SimonDevGrass11. This separation makes the main component
 * much cleaner and easier to debug.
 */
export const createGrassMaterials = (
  texture: THREE.Texture,
  envMap: THREE.CubeTexture | null,
  config: GrassMaterialConfig
): {
  grassMaterial: THREE.ShaderMaterial;
  depthMaterial: THREE.ShaderMaterial;
} => {
  // Create shared material (used by all chunks)
  console.log("🔧 Creating grass material with shaders...");
  console.log("🔧 Vertex shader length:", grassVertexShader.length);
  console.log("🔧 Fragment shader length:", grassFragmentShader.length);

  const grassMaterial = new THREE.ShaderMaterial({
    vertexShader: grassVertexShader,
    fragmentShader: grassFragmentShader,
    depthWrite: true, // ✅ Required for post-processing
    depthTest: true, // ✅ Required for post-processing
    onBeforeCompile: (shader) => {
      console.log("🔧 Compiling grass shaders...");
      console.log(
        "🔧 Vertex shader source:",
        shader.vertexShader.substring(0, 200) + "..."
      );
      console.log(
        "🔧 Fragment shader source:",
        shader.fragmentShader.substring(0, 200) + "..."
      );
    },
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
      highDetailDistance: { value: 60 }, // Will be updated dynamically
      mediumDetailDistance: { value: 100 }, // Will be updated dynamically
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
    transparent: true,
    side: THREE.DoubleSide,
    alphaTest: config.alphaTest,
    // ✅ Post-processing compatibility
    stencilWrite: false,
  });

  // Create custom depth material for shadows - KEY FOR ANIMATED SHADOWS!
  const depthMaterial = new THREE.ShaderMaterial({
    depthWrite: true, // ✅ Required for post-processing
    depthTest: true, // ✅ Required for post-processing
    uniforms: {
      time: { value: 0.0 },
      grassTexture: { value: texture }, // Need texture for alpha testing!
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
      playerPosition: { value: new THREE.Vector3(0, 0, 0) },
      highDetailDistance: { value: 60 }, // Will be updated dynamically
      mediumDetailDistance: { value: 100 }, // Will be updated dynamically
      viewMatrixInverse: { value: new THREE.Matrix4() },
      enableViewThickening: { value: config.enableViewThickening },
      grassBaseLean: { value: config.grassBaseLean },
      bladeCurveAmount: { value: config.bladeCurveAmount },
      enablePlayerInteraction: { value: config.enablePlayerInteraction },
      playerInteractionRadius: { value: config.playerInteractionRadius },
      playerInteractionStrength: { value: config.playerInteractionStrength },
      playerInteractionRepel: { value: config.playerInteractionRepel },
    },
    vertexShader: grassDepthVertexShader,
    fragmentShader: grassDepthFragmentShader,
    // ✅ Post-processing compatibility
    stencilWrite: false,
  });

  return { grassMaterial, depthMaterial };
};

/**
 * Helper function to update material uniforms from controls
 */
export const updateGrassMaterialUniforms = (
  material: THREE.ShaderMaterial,
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

  // Update config-based values
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
  if (config.disableMoonReflection !== undefined)
    u.disableMoonReflection.value = config.disableMoonReflection;
  if (config.moonIntensity !== undefined)
    u.moonIntensity.value = config.moonIntensity;
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
  if (config.moonColor !== undefined) u.moonColor.value.set(config.moonColor);
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
  if (config.disableTextureTint !== undefined)
    u.disableTextureTint.value = config.disableTextureTint;
  if (config.edgeDarkeningStrength !== undefined)
    u.edgeDarkeningStrength.value = config.edgeDarkeningStrength;
  if (config.sssIntensity !== undefined)
    u.sssIntensity.value = config.sssIntensity;
  if (config.sssPower !== undefined) u.sssPower.value = config.sssPower;
  if (config.sssScale !== undefined) u.sssScale.value = config.sssScale;
  if (config.sssColor !== undefined) u.sssColor.value.set(config.sssColor);
  if (config.disableSSS !== undefined) u.disableSSS.value = config.disableSSS;
  if (config.contactShadowIntensity !== undefined)
    u.contactShadowIntensity.value = config.contactShadowIntensity;
  if (config.contactShadowRadius !== undefined)
    u.contactShadowRadius.value = config.contactShadowRadius;
  if (config.enableAO !== undefined) u.enableAO.value = config.enableAO;
  if (config.aoIntensity !== undefined)
    u.aoIntensity.value = config.aoIntensity;
  if (config.aoRadius !== undefined) u.aoRadius.value = config.aoRadius;
  if (config.enableColorVariation !== undefined)
    u.enableColorVariation.value = config.enableColorVariation;
  if (config.colorVariationIntensity !== undefined)
    u.colorVariationIntensity.value = config.colorVariationIntensity;
  if (config.tipColorVariationIntensity !== undefined)
    u.tipColorVariationIntensity.value = config.tipColorVariationIntensity;
  if (config.enableEnvMap !== undefined)
    u.enableEnvMap.value = config.enableEnvMap;
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
  if (config.enableAnisotropy !== undefined)
    u.enableAnisotropy.value = config.enableAnisotropy;
  if (config.anisotropyStrength !== undefined)
    u.anisotropyStrength.value = config.anisotropyStrength;
  if (config.anisotropyTangent !== undefined)
    u.anisotropyTangent.value = config.anisotropyTangent;
  if (config.anisotropyBitangent !== undefined)
    u.anisotropyBitangent.value = config.anisotropyBitangent;
  if (config.enableDistanceFog !== undefined)
    u.enableDistanceFog.value = config.enableDistanceFog;
  if (config.fogScatterDensity !== undefined)
    u.fogScatterDensity.value = config.fogScatterDensity;
  if (config.fogExtinctionDensity !== undefined)
    u.fogExtinctionDensity.value = config.fogExtinctionDensity;
  if (config.fogSkyColor !== undefined)
    u.fogSkyColor.value.set(config.fogSkyColor);
  if (config.enableWrappedLighting !== undefined)
    u.enableWrappedLighting.value = config.enableWrappedLighting;
  if (config.wrapAmount !== undefined) u.wrapAmount.value = config.wrapAmount;
  if (config.enablePlayerInteraction !== undefined)
    u.enablePlayerInteraction.value = config.enablePlayerInteraction;
  if (config.playerInteractionRadius !== undefined)
    u.playerInteractionRadius.value = config.playerInteractionRadius;
  if (config.playerInteractionStrength !== undefined)
    u.playerInteractionStrength.value = config.playerInteractionStrength;
  if (config.playerInteractionRepel !== undefined)
    u.playerInteractionRepel.value = config.playerInteractionRepel;
  if (config.grassBaseLean !== undefined)
    u.grassBaseLean.value = config.grassBaseLean;
  if (config.bladeCurveAmount !== undefined)
    u.bladeCurveAmount.value = config.bladeCurveAmount;
  if (config.enableViewThickening !== undefined)
    u.enableViewThickening.value = config.enableViewThickening;

  material.needsUpdate = true;
};

/**
 * Helper function to update depth material uniforms from controls
 */
export const updateDepthMaterialUniforms = (
  material: THREE.ShaderMaterial,
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

  // Update config-based values
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
