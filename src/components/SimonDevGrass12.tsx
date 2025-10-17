import React, { useRef, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { useFrame, useThree } from "@react-three/fiber";
import { useSimonDevGrass12Controls } from "./SimonDevGrass12Controls";
import {
  grassVertexShader,
  grassFragmentShader,
  grassDepthVertexShader,
  grassDepthFragmentShader,
} from "./GrassShaders";
import {
  createGrassMaterials,
  updateGrassMaterialUniforms,
  updateDepthMaterialUniforms,
  GrassMaterialConfig,
} from "./GrassMaterial";
import { createGrassGeometries, GrassGeometryConfig } from "./GrassGeometry";

interface SimonDevGrass12Props {
  areaSize?: number;
  getGroundHeight?: (x: number, z: number) => number;
  grassHeight?: number;
  grassScale?: number;
  characterPosition?: THREE.Vector3;
  map?: string;
}

/**
 * SimonDevGrass12 - Simple Static Grass System (No Chunks, No LOD)
 *
 * This is a simplified version of SimonDevGrass11 without chunk management
 * or LOD systems for easier debugging and testing.
 */
export const SimonDevGrass12: React.FC<SimonDevGrass12Props> = ({
  areaSize = 200,
  getGroundHeight,
  grassHeight = 1.0,
  grassScale = 1.0,
  characterPosition,
  map = "map1(intro)",
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const grassMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const depthMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const textureRef = useRef<THREE.Texture | null>(null);
  const envMapTextureRef = useRef<THREE.CubeTexture | null>(null);
  const isCreatingGrassRef = useRef<boolean>(false);
  const { camera } = useThree();

  const controls = useSimonDevGrass12Controls();

  // Determine if we're on a post-processing map (where SSAOEffect is rendered)
  const isPostProcessingMap =
    map === "map4(terrain+newcharacter)" ||
    map === "map5(copy)" ||
    map === "map6(heightmap-terrain)";

  // Debug post-processing state
  useEffect(() => {
    console.log(`🌾 SimonDevGrass12 - Map: ${map}`);
    console.log(
      `🌾 SimonDevGrass12 - Post-processing map: ${isPostProcessingMap}`
    );
    console.log(
      `🌾 SimonDevGrass12 - Custom depth material: enabled (shadows working)`
    );
  }, [map, isPostProcessingMap]);

  // Create geometries (only high detail, no LOD)
  const geometries = useMemo(() => {
    const geometryConfig: GrassGeometryConfig = {
      grassHeight,
      grassHeightMultiplier: controls.grassHeightMultiplier,
      grassBaseWidth: controls.grassBaseWidth,
      grassTipWidth: controls.grassTipWidth,
      grassBaseLean: 0.0, // Fixed value - grassBaseLean is applied in shader, not geometry
      widthTaperPower: controls.widthTaperPower,
      tipPointPercent: controls.tipPointPercent,
    };
    return createGrassGeometries(geometryConfig);
  }, [
    grassHeight,
    controls.grassHeightMultiplier,
    controls.grassBaseWidth,
    controls.grassTipWidth,
    controls.widthTaperPower,
    controls.tipPointPercent,
    // ✅ grassBaseLean REMOVED - it's shader-only!
  ]);

  // Materials will be created after texture loads
  const [materials, setMaterials] = useState<{
    grassMaterial: THREE.ShaderMaterial;
    depthMaterial: THREE.ShaderMaterial;
  } | null>(null);

  // Update material references
  useEffect(() => {
    if (materials) {
      materialRef.current = materials.grassMaterial;
      depthMaterialRef.current = materials.depthMaterial;
    }
  }, [materials]);

  // Environment map loading
  useEffect(() => {
    if (!materialRef.current) return;

    if (controls.enableEnvMap) {
      const hdrLoader = new HDRLoader();
      let hdrPath = "/textures/industrial_sunset_02_puresky_4k.hdr";

      if (controls.environmentType === "kloofendal") {
        hdrPath = "/textures/kloofendal_48d_partly_cloudy_puresky_4k.hdr";
      } else if (controls.environmentType === "qwantani") {
        hdrPath = "/textures/qwantani_afternoon_puresky_4k.hdr";
      }

      hdrLoader.load(
        hdrPath,
        (texture) => {
          if (envMapTextureRef.current) {
            envMapTextureRef.current.dispose();
          }
          envMapTextureRef.current = texture;
          if (materialRef.current) {
            materialRef.current.uniforms.envMap.value = texture;
            materialRef.current.needsUpdate = true;
          }
          console.log(
            `✅ Loaded ${controls.environmentType} HDR environment map`
          );
        },
        undefined,
        (error) => {
          console.error(
            `Failed to load ${controls.environmentType} HDR:`,
            error
          );
        }
      );
    } else {
      if (envMapTextureRef.current) {
        envMapTextureRef.current.dispose();
        envMapTextureRef.current = null;
      }
      if (materialRef.current) {
        materialRef.current.uniforms.envMap.value = null;
      }
    }
  }, [controls.enableEnvMap, controls.environmentType]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("🧹 SimonDevGrass12 cleanup on unmount");
      if (grassMeshRef.current) {
        if (groupRef.current) {
          groupRef.current.remove(grassMeshRef.current);
        }
        grassMeshRef.current.geometry.dispose();
        grassMeshRef.current = null;
      }
    };
  }, []);

  // Main grass creation - simple static grass
  useEffect(() => {
    if (!groupRef.current) return;

    // Prevent duplicate creation
    if (grassMeshRef.current || isCreatingGrassRef.current) {
      return;
    }

    // Additional safety: Clean up any existing InstancedMesh children first
    const existingMeshes = groupRef.current.children.filter(
      (child) => child instanceof THREE.InstancedMesh
    );
    if (existingMeshes.length > 0) {
      existingMeshes.forEach((mesh) => {
        groupRef.current!.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
      });
    }

    isCreatingGrassRef.current = true;
    console.log("🌾 SimonDevGrass12 creating simple static grass...");

    // Small delay to ensure any previous cleanup is complete
    setTimeout(() => {
      if (!groupRef.current || grassMeshRef.current) {
        isCreatingGrassRef.current = false;
        return;
      }

      // Flag to prevent both success and error callbacks from creating grass
      let grassCreated = false;

      // Cleanup old grass
      if (grassMeshRef.current) {
        const mesh = grassMeshRef.current as THREE.InstancedMesh;
        groupRef.current.remove(mesh);
        mesh.geometry.dispose();
        grassMeshRef.current = null;
      }

      // Environment map will be loaded separately based on enableEnvMap control

      console.log("🖼️ Starting texture load...");
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(
        "/textures/grass.png",
        (texture) => {
          if (grassCreated) {
            console.log(
              "🛑 Grass already created in success callback - skipping"
            );
            return;
          }

          console.log("✅ Texture loaded successfully!");
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          texture.flipY = false;
          texture.repeat.set(controls.textureRepeatX, controls.textureRepeatY);

          // Store texture reference
          textureRef.current = texture;

          // Create materials
          const materialConfig: GrassMaterialConfig = {
            // Colors
            baseColor: controls.baseColor,
            middleColor: controls.middleColor,
            tipColor: controls.tipColor,
            gradientPower: controls.gradientPower,
            baseTransitionPoint: controls.baseTransitionPoint,
            tipTransitionPoint: controls.tipTransitionPoint,

            // Wind
            windStrength: controls.windStrength,
            windDirectionX: controls.windDirectionX,
            windDirectionZ: controls.windDirectionZ,
            windSpeed: controls.windSpeed,
            windFrequency: controls.windFrequency,
            windAmplitude: controls.windAmplitude,
            windTurbulence: controls.windTurbulence,
            flappingIntensity: controls.flappingIntensity,
            grassDensity: controls.grassDensity,

            // Lighting
            disableLighting: controls.disableLighting,
            specularIntensity: controls.specularIntensity,
            specularColor: controls.specularColor,
            specularPower: controls.specularPower,
            sunDirectionX: controls.sunDirectionX,
            sunDirectionY: controls.sunDirectionY,
            sunDirectionZ: controls.sunDirectionZ,

            // Moon
            disableMoonReflection: controls.disableMoonReflection,
            moonIntensity: controls.moonIntensity,
            moonDirectionX: controls.moonDirectionX,
            moonDirectionY: controls.moonDirectionY,
            moonDirectionZ: controls.moonDirectionZ,
            moonColor: controls.moonColor,

            // Texture
            disableTextureTint: controls.disableTextureTint,
            edgeDarkeningStrength: controls.edgeDarkeningStrength,

            // Subsurface Scattering
            sssIntensity: controls.sssIntensity,
            sssPower: controls.sssPower,
            sssScale: controls.sssScale,
            sssColor: controls.sssColor,
            disableSSS: controls.disableSSS,

            // Contact Shadows
            contactShadowIntensity: controls.contactShadowIntensity,
            contactShadowRadius: controls.contactShadowRadius,

            // Ambient Occlusion
            enableAO: controls.enableAO,
            aoIntensity: controls.aoIntensity,
            aoRadius: controls.aoRadius,

            // Color Variation
            enableColorVariation: controls.enableColorVariation,
            colorVariationIntensity: controls.colorVariationIntensity,
            tipColorVariationIntensity: controls.tipColorVariationIntensity,

            // Environment Mapping
            enableEnvMap: controls.enableEnvMap,
            envMapIntensity: controls.envMapIntensity,
            envMap: envMapTextureRef.current,
            roughnessBase: controls.roughnessBase,
            roughnessTip: controls.roughnessTip,
            fresnelPower: controls.fresnelPower,
            roughnessIntensity: controls.roughnessIntensity,

            // Anisotropy
            enableAnisotropy: controls.enableAnisotropy,
            anisotropyStrength: controls.anisotropyStrength,
            anisotropyTangent: controls.anisotropyTangent,
            anisotropyBitangent: controls.anisotropyBitangent,

            // Distance Fog
            enableDistanceFog: controls.enableDistanceFog,
            fogScatterDensity: controls.fogScatterDensity,
            fogExtinctionDensity: controls.fogExtinctionDensity,
            fogSkyColor: controls.fogSkyColor,

            // Wrapped Lighting
            enableWrappedLighting: controls.enableWrappedLighting,
            wrapAmount: controls.wrapAmount,

            // Player Interaction
            enablePlayerInteraction: controls.enablePlayerInteraction,
            playerInteractionRadius: controls.playerInteractionRadius,
            playerInteractionStrength: controls.playerInteractionStrength,
            playerInteractionRepel: controls.playerInteractionRepel,

            // Grass Shape
            grassBaseLean: controls.grassBaseLean,
            bladeCurveAmount: controls.bladeCurveAmount,
            enableViewThickening: controls.enableViewThickening,

            // Shadow
            shadowAlphaThreshold: controls.shadowAlphaThreshold,
            alphaTest: controls.alphaTest,
          };

          const newMaterials = createGrassMaterials(
            texture,
            null,
            materialConfig
          );
          setMaterials(newMaterials);

          console.log("  ✅ Materials created");

          // Create simple static grass
          console.log("📦 Creating simple static grass...");
          console.log(`  🌾 Using grass count: ${controls.grassCount} blades`);

          // Create grass data
          const grassCount = controls.grassCount;
          const maxInstances = grassCount * controls.bladesPerCluster;

          const offsets = new Float32Array(maxInstances * 3);
          const scales = new Float32Array(maxInstances);
          const rotations = new Float32Array(maxInstances);
          const windInfluences = new Float32Array(maxInstances);
          const grassTypes = new Float32Array(maxInstances);
          const colorVariations = new Float32Array(maxInstances * 3);
          const tipColorVariations = new Float32Array(maxInstances * 3);

          let instanceIndex = 0;

          for (let i = 0; i < grassCount; i++) {
            // Small field around player (much smaller area)
            const smallAreaSize = 20; // Small 20x20 area instead of full areaSize
            const x = (Math.random() - 0.5) * smallAreaSize;
            const z = (Math.random() - 0.5) * smallAreaSize;
            const groundHeight = getGroundHeight ? getGroundHeight(x, z) : 0;

            // Scale and other attributes
            const scale =
              (0.6 + Math.random() * 0.8) *
              grassScale *
              controls.grassScaleMultiplier;
            const rotation = Math.random() * Math.PI * 2;
            const windInfluence = 0.3 + Math.random() * 0.7;
            const grassType = Math.random();

            // Color variations
            const colorVariation = [
              (Math.random() - 0.5) * 0.1,
              (Math.random() - 0.5) * 0.2,
              (Math.random() - 0.5) * 0.05,
            ];
            const tipColorVariation = [
              (Math.random() - 0.5) * 0.2,
              (Math.random() - 0.5) * 0.3,
              (Math.random() - 0.5) * 0.1,
            ];

            // Create multiple blades at this position (cluster technique)
            for (
              let bladeIdx = 0;
              bladeIdx < controls.bladesPerCluster;
              bladeIdx++
            ) {
              offsets[instanceIndex * 3] = x;
              offsets[instanceIndex * 3 + 1] = groundHeight;
              offsets[instanceIndex * 3 + 2] = z;

              scales[instanceIndex] = scale;

              const clusterRotation =
                rotation + (bladeIdx / controls.bladesPerCluster) * Math.PI * 2;
              rotations[instanceIndex] = clusterRotation;

              windInfluences[instanceIndex] = windInfluence;
              grassTypes[instanceIndex] = grassType;

              // Color variations
              colorVariations[instanceIndex * 3] = colorVariation[0];
              colorVariations[instanceIndex * 3 + 1] = colorVariation[1];
              colorVariations[instanceIndex * 3 + 2] = colorVariation[2];

              tipColorVariations[instanceIndex * 3] = tipColorVariation[0];
              tipColorVariations[instanceIndex * 3 + 1] = tipColorVariation[1];
              tipColorVariations[instanceIndex * 3 + 2] = tipColorVariation[2];

              instanceIndex++;
            }
          }

          // Create geometry with attributes
          const grassGeo = geometries.high.clone();
          grassGeo.setAttribute(
            "offset",
            new THREE.InstancedBufferAttribute(
              offsets.slice(0, instanceIndex * 3),
              3
            )
          );
          grassGeo.setAttribute(
            "scale",
            new THREE.InstancedBufferAttribute(
              scales.slice(0, instanceIndex),
              1
            )
          );
          grassGeo.setAttribute(
            "rotation",
            new THREE.InstancedBufferAttribute(
              rotations.slice(0, instanceIndex),
              1
            )
          );
          grassGeo.setAttribute(
            "windInfluence",
            new THREE.InstancedBufferAttribute(
              windInfluences.slice(0, instanceIndex),
              1
            )
          );
          grassGeo.setAttribute(
            "grassType",
            new THREE.InstancedBufferAttribute(
              grassTypes.slice(0, instanceIndex),
              1
            )
          );
          grassGeo.setAttribute(
            "colorVariation",
            new THREE.InstancedBufferAttribute(
              colorVariations.slice(0, instanceIndex * 3),
              3
            )
          );
          grassGeo.setAttribute(
            "tipColorVariation",
            new THREE.InstancedBufferAttribute(
              tipColorVariations.slice(0, instanceIndex * 3),
              3
            )
          );

          // Create the grass mesh
          const grassMesh = new THREE.InstancedMesh(
            grassGeo,
            newMaterials.grassMaterial,
            instanceIndex
          );

          grassMesh.position.set(0, 0, 0);
          grassMesh.frustumCulled = false;
          grassMesh.castShadow = controls.shadowCasting;
          grassMesh.receiveShadow = controls.shadowReceiving;
          // Use custom depth material for accurate animated shadows
          grassMesh.customDepthMaterial = newMaterials.depthMaterial;
          grassMesh.visible = false; // Start invisible to prevent flash

          if (groupRef.current) {
            groupRef.current.add(grassMesh);
          }
          grassMeshRef.current = grassMesh;
          grassCreated = true; // Mark grass as created
          isCreatingGrassRef.current = false; // Reset creation flag

          // Small delay before making visible to prevent flash
          setTimeout(() => {
            if (grassMeshRef.current) {
              grassMeshRef.current.visible = true;
            }
          }, 50); // 50ms delay

          console.log(
            `✅ Simple static grass created with ${instanceIndex} grass blades`
          );
        },
        (progress) => {
          console.log("📊 Texture loading progress:", progress);
        },
        (error) => {
          if (grassCreated) {
            console.log(
              "🛑 Grass already created in error callback - skipping"
            );
            return;
          }

          console.error("❌ Failed to load grass texture:", error);
          console.log("🔄 Creating fallback texture...");

          // Create a simple white texture as fallback
          const canvas = document.createElement("canvas");
          canvas.width = 64;
          canvas.height = 64;
          const context = canvas.getContext("2d")!;
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, 64, 64);

          const fallbackTexture = new THREE.CanvasTexture(canvas);
          fallbackTexture.wrapS = fallbackTexture.wrapT = THREE.RepeatWrapping;
          fallbackTexture.flipY = false;
          fallbackTexture.repeat.set(
            controls.textureRepeatX,
            controls.textureRepeatY
          );

          textureRef.current = fallbackTexture;

          // Create materials with fallback texture
          const materialConfig: GrassMaterialConfig = {
            baseColor: controls.baseColor,
            middleColor: controls.middleColor,
            tipColor: controls.tipColor,
            gradientPower: controls.gradientPower,
            baseTransitionPoint: controls.baseTransitionPoint,
            tipTransitionPoint: controls.tipTransitionPoint,
            windStrength: controls.windStrength,
            windDirectionX: controls.windDirectionX,
            windDirectionZ: controls.windDirectionZ,
            windSpeed: controls.windSpeed,
            windFrequency: controls.windFrequency,
            windAmplitude: controls.windAmplitude,
            windTurbulence: controls.windTurbulence,
            flappingIntensity: controls.flappingIntensity,
            grassDensity: controls.grassDensity,
            disableLighting: controls.disableLighting,
            specularIntensity: controls.specularIntensity,
            specularColor: controls.specularColor,
            specularPower: controls.specularPower,
            sunDirectionX: controls.sunDirectionX,
            sunDirectionY: controls.sunDirectionY,
            sunDirectionZ: controls.sunDirectionZ,
            disableMoonReflection: controls.disableMoonReflection,
            moonIntensity: controls.moonIntensity,
            moonDirectionX: controls.moonDirectionX,
            moonDirectionY: controls.moonDirectionY,
            moonDirectionZ: controls.moonDirectionZ,
            moonColor: controls.moonColor,
            disableTextureTint: controls.disableTextureTint,
            edgeDarkeningStrength: controls.edgeDarkeningStrength,
            sssIntensity: controls.sssIntensity,
            sssPower: controls.sssPower,
            sssScale: controls.sssScale,
            sssColor: controls.sssColor,
            disableSSS: controls.disableSSS,
            contactShadowIntensity: controls.contactShadowIntensity,
            contactShadowRadius: controls.contactShadowRadius,
            enableAO: controls.enableAO,
            aoIntensity: controls.aoIntensity,
            aoRadius: controls.aoRadius,
            enableColorVariation: controls.enableColorVariation,
            colorVariationIntensity: controls.colorVariationIntensity,
            tipColorVariationIntensity: controls.tipColorVariationIntensity,
            enableEnvMap: controls.enableEnvMap,
            envMapIntensity: controls.envMapIntensity,
            envMap: envMapTextureRef.current,
            roughnessBase: controls.roughnessBase,
            roughnessTip: controls.roughnessTip,
            fresnelPower: controls.fresnelPower,
            roughnessIntensity: controls.roughnessIntensity,
            enableAnisotropy: controls.enableAnisotropy,
            anisotropyStrength: controls.anisotropyStrength,
            anisotropyTangent: controls.anisotropyTangent,
            anisotropyBitangent: controls.anisotropyBitangent,
            enableDistanceFog: controls.enableDistanceFog,
            fogScatterDensity: controls.fogScatterDensity,
            fogExtinctionDensity: controls.fogExtinctionDensity,
            fogSkyColor: controls.fogSkyColor,
            enableWrappedLighting: controls.enableWrappedLighting,
            wrapAmount: controls.wrapAmount,
            enablePlayerInteraction: controls.enablePlayerInteraction,
            playerInteractionRadius: controls.playerInteractionRadius,
            playerInteractionStrength: controls.playerInteractionStrength,
            playerInteractionRepel: controls.playerInteractionRepel,
            grassBaseLean: controls.grassBaseLean,
            bladeCurveAmount: controls.bladeCurveAmount,
            enableViewThickening: controls.enableViewThickening,
            shadowAlphaThreshold: controls.shadowAlphaThreshold,
            alphaTest: controls.alphaTest,
          };

          const newMaterials = createGrassMaterials(
            fallbackTexture,
            null,
            materialConfig
          );
          setMaterials(newMaterials);

          console.log("✅ Fallback materials created");

          // Create simple static grass with fallback materials
          console.log(
            "📦 Creating simple static grass with fallback texture..."
          );
          console.log(`  🌾 Using grass count: ${controls.grassCount} blades`);

          // Same grass creation logic as above
          const grassCount = controls.grassCount;
          const maxInstances = grassCount * controls.bladesPerCluster;

          const offsets = new Float32Array(maxInstances * 3);
          const scales = new Float32Array(maxInstances);
          const rotations = new Float32Array(maxInstances);
          const windInfluences = new Float32Array(maxInstances);
          const grassTypes = new Float32Array(maxInstances);
          const colorVariations = new Float32Array(maxInstances * 3);
          const tipColorVariations = new Float32Array(maxInstances * 3);

          let instanceIndex = 0;

          for (let i = 0; i < grassCount; i++) {
            // Small field around player (much smaller area)
            const smallAreaSize = 20; // Small 20x20 area instead of full areaSize
            const x = (Math.random() - 0.5) * smallAreaSize;
            const z = (Math.random() - 0.5) * smallAreaSize;
            const groundHeight = getGroundHeight ? getGroundHeight(x, z) : 0;

            const scale =
              (0.6 + Math.random() * 0.8) *
              grassScale *
              controls.grassScaleMultiplier;
            const rotation = Math.random() * Math.PI * 2;
            const windInfluence = 0.3 + Math.random() * 0.7;
            const grassType = Math.random();

            const colorVariation = [
              (Math.random() - 0.5) * 0.1,
              (Math.random() - 0.5) * 0.2,
              (Math.random() - 0.5) * 0.05,
            ];
            const tipColorVariation = [
              (Math.random() - 0.5) * 0.2,
              (Math.random() - 0.5) * 0.3,
              (Math.random() - 0.5) * 0.1,
            ];

            for (
              let bladeIdx = 0;
              bladeIdx < controls.bladesPerCluster;
              bladeIdx++
            ) {
              offsets[instanceIndex * 3] = x;
              offsets[instanceIndex * 3 + 1] = groundHeight;
              offsets[instanceIndex * 3 + 2] = z;

              scales[instanceIndex] = scale;

              const clusterRotation =
                rotation + (bladeIdx / controls.bladesPerCluster) * Math.PI * 2;
              rotations[instanceIndex] = clusterRotation;

              windInfluences[instanceIndex] = windInfluence;
              grassTypes[instanceIndex] = grassType;

              colorVariations[instanceIndex * 3] = colorVariation[0];
              colorVariations[instanceIndex * 3 + 1] = colorVariation[1];
              colorVariations[instanceIndex * 3 + 2] = colorVariation[2];

              tipColorVariations[instanceIndex * 3] = tipColorVariation[0];
              tipColorVariations[instanceIndex * 3 + 1] = tipColorVariation[1];
              tipColorVariations[instanceIndex * 3 + 2] = tipColorVariation[2];

              instanceIndex++;
            }
          }

          const grassGeo = geometries.high.clone();
          grassGeo.setAttribute(
            "offset",
            new THREE.InstancedBufferAttribute(
              offsets.slice(0, instanceIndex * 3),
              3
            )
          );
          grassGeo.setAttribute(
            "scale",
            new THREE.InstancedBufferAttribute(
              scales.slice(0, instanceIndex),
              1
            )
          );
          grassGeo.setAttribute(
            "rotation",
            new THREE.InstancedBufferAttribute(
              rotations.slice(0, instanceIndex),
              1
            )
          );
          grassGeo.setAttribute(
            "windInfluence",
            new THREE.InstancedBufferAttribute(
              windInfluences.slice(0, instanceIndex),
              1
            )
          );
          grassGeo.setAttribute(
            "grassType",
            new THREE.InstancedBufferAttribute(
              grassTypes.slice(0, instanceIndex),
              1
            )
          );
          grassGeo.setAttribute(
            "colorVariation",
            new THREE.InstancedBufferAttribute(
              colorVariations.slice(0, instanceIndex * 3),
              3
            )
          );
          grassGeo.setAttribute(
            "tipColorVariation",
            new THREE.InstancedBufferAttribute(
              tipColorVariations.slice(0, instanceIndex * 3),
              3
            )
          );

          const grassMesh = new THREE.InstancedMesh(
            grassGeo,
            newMaterials.grassMaterial,
            instanceIndex
          );
          grassMesh.position.set(0, 0, 0);
          grassMesh.frustumCulled = false;
          grassMesh.castShadow = controls.shadowCasting;
          grassMesh.receiveShadow = controls.shadowReceiving;
          // Use custom depth material for accurate animated shadows
          grassMesh.customDepthMaterial = newMaterials.depthMaterial;
          grassMesh.visible = false; // Start invisible to prevent flash

          if (groupRef.current) {
            groupRef.current.add(grassMesh);
          }
          grassMeshRef.current = grassMesh;
          grassCreated = true; // Mark grass as created
          isCreatingGrassRef.current = false; // Reset creation flag

          // Small delay before making visible to prevent flash
          setTimeout(() => {
            if (grassMeshRef.current) {
              grassMeshRef.current.visible = true;
            }
          }, 50); // 50ms delay

          console.log(
            `✅ Fallback static grass created with ${instanceIndex} grass blades`
          );
        }
      );
    }, 10); // 10ms delay to ensure cleanup is complete

    return () => {
      console.log("🧹 Cleanup SimonDevGrass12");

      // Cleanup grass mesh
      if (grassMeshRef.current && groupRef.current) {
        groupRef.current.remove(grassMeshRef.current);
        grassMeshRef.current.geometry.dispose();
        grassMeshRef.current = null;
      }

      // Reset creation flag
      isCreatingGrassRef.current = false;

      // Cleanup materials
      if (materials) {
        materials.grassMaterial.dispose();
        materials.depthMaterial.dispose();
      }
      if (envMapTextureRef.current) {
        envMapTextureRef.current.dispose();
        envMapTextureRef.current = null;
      }
    };
  }, [
    controls.grassCount,
    controls.bladesPerCluster,
    controls.shadowCasting,
    controls.shadowReceiving,
    controls.textureRepeatX,
    controls.textureRepeatY,
    areaSize,
    grassScale,
    getGroundHeight,
    // ✅ geometries REMOVED - prevents recreation on every geometry change!
  ]); // Removed materials from dependency array to prevent infinite loop

  // Update material uniforms every frame
  useFrame((state) => {
    if (!materialRef.current || !depthMaterialRef.current) return;

    // Update main material uniforms
    const materialConfig: Partial<GrassMaterialConfig> = {
      baseColor: controls.baseColor,
      middleColor: controls.middleColor,
      tipColor: controls.tipColor,
      gradientPower: controls.gradientPower,
      baseTransitionPoint: controls.baseTransitionPoint,
      tipTransitionPoint: controls.tipTransitionPoint,
      windStrength: controls.enableWind ? controls.windStrength : 0.0,
      windDirectionX: controls.windDirectionX,
      windDirectionZ: controls.windDirectionZ,
      grassDensity: controls.grassDensity,
      disableLighting: controls.disableLighting,
      specularIntensity: controls.specularIntensity,
      specularColor: controls.specularColor,
      specularPower: controls.specularPower,
      windSpeed: controls.windSpeed,
      windFrequency: controls.windFrequency,
      windAmplitude: controls.windAmplitude,
      windTurbulence: controls.windTurbulence,
      flappingIntensity: controls.flappingIntensity,
      disableMoonReflection: controls.disableMoonReflection,
      moonIntensity: controls.moonIntensity,
      moonDirectionX: controls.moonDirectionX,
      moonDirectionY: controls.moonDirectionY,
      moonDirectionZ: controls.moonDirectionZ,
      moonColor: controls.moonColor,
      sunDirectionX: controls.sunDirectionX,
      sunDirectionY: controls.sunDirectionY,
      sunDirectionZ: controls.sunDirectionZ,
      disableTextureTint: controls.disableTextureTint,
      edgeDarkeningStrength: controls.edgeDarkeningStrength,
      sssIntensity: controls.sssIntensity,
      sssPower: controls.sssPower,
      sssScale: controls.sssScale,
      sssColor: controls.sssColor,
      disableSSS: controls.disableSSS,
      contactShadowIntensity: controls.contactShadowIntensity,
      contactShadowRadius: controls.contactShadowRadius,
      enableAO: controls.enableAO,
      aoIntensity: controls.aoIntensity,
      aoRadius: controls.aoRadius,
      enableColorVariation: controls.enableColorVariation,
      colorVariationIntensity: controls.colorVariationIntensity,
      tipColorVariationIntensity: controls.tipColorVariationIntensity,
      enableEnvMap: controls.enableEnvMap,
      envMapIntensity: controls.envMapIntensity,
      envMap: envMapTextureRef.current,
      roughnessBase: controls.roughnessBase,
      roughnessTip: controls.roughnessTip,
      fresnelPower: controls.fresnelPower,
      roughnessIntensity: controls.roughnessIntensity,
      enableAnisotropy: controls.enableAnisotropy,
      anisotropyStrength: controls.anisotropyStrength,
      anisotropyTangent: controls.anisotropyTangent,
      anisotropyBitangent: controls.anisotropyBitangent,
      enableDistanceFog: controls.enableDistanceFog,
      fogScatterDensity: controls.fogScatterDensity,
      fogExtinctionDensity: controls.fogExtinctionDensity,
      fogSkyColor: controls.fogSkyColor,
      enableWrappedLighting: controls.enableWrappedLighting,
      wrapAmount: controls.wrapAmount,
      enablePlayerInteraction: controls.enablePlayerInteraction,
      playerInteractionRadius: controls.playerInteractionRadius,
      playerInteractionStrength: controls.playerInteractionStrength,
      playerInteractionRepel: controls.playerInteractionRepel,
      grassBaseLean: controls.grassBaseLean,
      bladeCurveAmount: controls.bladeCurveAmount,
      enableViewThickening: controls.enableViewThickening,
    };

    // Update time uniform
    if (materialRef.current.uniforms.time) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
    }

    // Update uniforms
    updateGrassMaterialUniforms(
      materialRef.current,
      materialConfig,
      controls.highDetailDistance,
      controls.mediumDetailDistance,
      characterPosition
    );

    // Update view matrix inverse
    if (materialRef.current.uniforms.viewMatrixInverse) {
      materialRef.current.uniforms.viewMatrixInverse.value.copy(
        camera.matrixWorld
      );
    }

    // Update depth material uniforms
    updateDepthMaterialUniforms(
      depthMaterialRef.current,
      {
        shadowAlphaThreshold: controls.shadowAlphaThreshold,
        windStrength: controls.enableWind ? controls.windStrength : 0.0,
        windDirectionX: controls.windDirectionX,
        windDirectionZ: controls.windDirectionZ,
        grassDensity: controls.grassDensity,
        windSpeed: controls.windSpeed,
        windFrequency: controls.windFrequency,
        windAmplitude: controls.windAmplitude,
        windTurbulence: controls.windTurbulence,
        flappingIntensity: controls.flappingIntensity,
        enableViewThickening: controls.enableViewThickening,
        grassBaseLean: controls.grassBaseLean,
        bladeCurveAmount: controls.bladeCurveAmount,
        enablePlayerInteraction: controls.enablePlayerInteraction,
        playerInteractionRadius: controls.playerInteractionRadius,
        playerInteractionStrength: controls.playerInteractionStrength,
        playerInteractionRepel: controls.playerInteractionRepel,
      },
      controls.highDetailDistance,
      controls.mediumDetailDistance,
      characterPosition
    );

    // Update time and view matrix for depth material
    if (depthMaterialRef.current.uniforms.time) {
      depthMaterialRef.current.uniforms.time.value = state.clock.elapsedTime;
    }
    if (depthMaterialRef.current.uniforms.viewMatrixInverse) {
      depthMaterialRef.current.uniforms.viewMatrixInverse.value.copy(
        camera.matrixWorld
      );
    }
  });

  return <group ref={groupRef} />;
};

export default SimonDevGrass12;
