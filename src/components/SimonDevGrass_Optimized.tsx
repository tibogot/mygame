import React, { useRef, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { useFrame, useThree } from "@react-three/fiber";
import { useSimonDevGrass12Controls } from "./SimonDevGrass12Controls";
import {
  createGrassMaterials,
  updateGrassMaterialUniforms,
  updateDepthMaterialUniforms,
  GrassMaterialConfig,
} from "./GrassMaterial_Optimized";
import { createGrassGeometries, GrassGeometryConfig } from "./GrassGeometry";

interface SimonDevGrassOptimizedProps {
  areaSize?: number;
  getGroundHeight?: (x: number, z: number) => number;
  grassHeight?: number;
  grassScale?: number;
  characterPosition?: THREE.Vector3;
  map?: string;
}

/**
 * 🚀 PERFORMANCE-OPTIMIZED Grass System
 *
 * Key optimizations:
 * 1. Only updates HIGH FREQUENCY uniforms in useFrame (time, playerPosition)
 * 2. Updates MEDIUM FREQUENCY uniforms only when camera moves significantly
 * 3. Updates LOW FREQUENCY uniforms only when controls change
 * 4. Frustum culling enabled (optional)
 * 5. Ready for chunk-based LOD system
 */
export const SimonDevGrassOptimized: React.FC<SimonDevGrassOptimizedProps> = ({
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
  const lastCameraPositionRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const { camera } = useThree();

  const controls = useSimonDevGrass12Controls();

  // Determine if we're on a post-processing map
  const isPostProcessingMap =
    map === "map4(terrain+newcharacter)" ||
    map === "map5(copy)" ||
    map === "map6(heightmap-terrain)";

  console.log(
    `🌾 Optimized Grass - Map: ${map}, Post-processing: ${isPostProcessingMap}`
  );

  // Create geometries (all LOD levels!)
  const geometries = useMemo(() => {
    const geometryConfig: GrassGeometryConfig = {
      grassHeight,
      grassHeightMultiplier: controls.grassHeightMultiplier,
      grassBaseWidth: controls.grassBaseWidth,
      grassTipWidth: controls.grassTipWidth,
      grassBaseLean: 0.0,
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
  ]);

  const [materials, setMaterials] = useState<{
    grassMaterial: THREE.ShaderMaterial;
    depthMaterial: THREE.ShaderMaterial;
  } | null>(null);

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
            // Note: No needsUpdate! Just changing uniform value
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
      console.log("🧹 Optimized Grass cleanup");
      if (grassMeshRef.current) {
        if (groupRef.current) {
          groupRef.current.remove(grassMeshRef.current);
        }
        grassMeshRef.current.geometry.dispose();
        grassMeshRef.current = null;
      }
    };
  }, []);

  // Main grass creation
  useEffect(() => {
    if (
      !groupRef.current ||
      grassMeshRef.current ||
      isCreatingGrassRef.current
    ) {
      return;
    }

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
    console.log("🌾 Creating OPTIMIZED grass system...");

    setTimeout(() => {
      if (!groupRef.current || grassMeshRef.current) {
        isCreatingGrassRef.current = false;
        return;
      }

      let grassCreated = false;

      if (grassMeshRef.current) {
        const mesh = grassMeshRef.current as THREE.InstancedMesh;
        groupRef.current.remove(mesh);
        mesh.geometry.dispose();
        grassMeshRef.current = null;
      }

      console.log("🖼️ Loading grass texture...");
      const textureLoader = new THREE.TextureLoader();

      const createGrassWithTexture = (texture: THREE.Texture) => {
        if (grassCreated) return;

        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.flipY = false;
        texture.repeat.set(controls.textureRepeatX, controls.textureRepeatY);
        textureRef.current = texture;

        // Create materials
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
          texture,
          null,
          materialConfig
        );
        setMaterials(newMaterials);

        console.log("📦 Creating grass instances...");
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
          const smallAreaSize = 20;
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
          new THREE.InstancedBufferAttribute(scales.slice(0, instanceIndex), 1)
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
        // ✅ Enable frustum culling for better performance!
        grassMesh.frustumCulled = true;
        grassMesh.castShadow = controls.shadowCasting;
        grassMesh.receiveShadow = controls.shadowReceiving;
        grassMesh.customDepthMaterial = newMaterials.depthMaterial;
        grassMesh.visible = false;

        if (groupRef.current) {
          groupRef.current.add(grassMesh);
        }
        grassMeshRef.current = grassMesh;
        grassCreated = true;
        isCreatingGrassRef.current = false;

        setTimeout(() => {
          if (grassMeshRef.current) {
            grassMeshRef.current.visible = true;
          }
        }, 50);

        console.log(`✅ Optimized grass created: ${instanceIndex} blades`);
      };

      textureLoader.load(
        "/textures/grass.png",
        createGrassWithTexture,
        undefined,
        (error) => {
          console.error("❌ Texture load failed:", error);
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
          createGrassWithTexture(fallbackTexture);
        }
      );
    }, 10);

    return () => {
      if (grassMeshRef.current && groupRef.current) {
        groupRef.current.remove(grassMeshRef.current);
        grassMeshRef.current.geometry.dispose();
        grassMeshRef.current = null;
      }
      isCreatingGrassRef.current = false;
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
  ]);

  // 🚀 OPTIMIZED UNIFORM UPDATES - Only what's needed!
  useFrame((state) => {
    if (!materialRef.current || !depthMaterialRef.current) return;

    // ========== HIGH FREQUENCY (Every frame) ==========
    // Only update time and player position!
    const time = state.clock.elapsedTime;
    materialRef.current.uniforms.time.value = time;
    depthMaterialRef.current.uniforms.time.value = time;

    if (characterPosition) {
      materialRef.current.uniforms.playerPosition.value.copy(characterPosition);
      depthMaterialRef.current.uniforms.playerPosition.value.copy(
        characterPosition
      );
    }

    // ========== MEDIUM FREQUENCY (Camera moved significantly) ==========
    const cameraDistanceMoved = camera.position.distanceTo(
      lastCameraPositionRef.current
    );
    if (cameraDistanceMoved > 5.0) {
      // Only update if camera moved 5+ units
      lastCameraPositionRef.current.copy(camera.position);

      materialRef.current.uniforms.highDetailDistance.value =
        controls.highDetailDistance;
      materialRef.current.uniforms.mediumDetailDistance.value =
        controls.mediumDetailDistance;
      materialRef.current.uniforms.viewMatrixInverse.value.copy(
        camera.matrixWorld
      );

      depthMaterialRef.current.uniforms.highDetailDistance.value =
        controls.highDetailDistance;
      depthMaterialRef.current.uniforms.mediumDetailDistance.value =
        controls.mediumDetailDistance;
      depthMaterialRef.current.uniforms.viewMatrixInverse.value.copy(
        camera.matrixWorld
      );
    }
  });

  // ========== LOW FREQUENCY (Controls changed) ==========
  // Update material uniforms only when controls actually change
  useEffect(() => {
    if (!materialRef.current) return;

    // Build minimal config with only changed values
    const materialConfig: Partial<GrassMaterialConfig> = {
      baseColor: controls.baseColor,
      middleColor: controls.middleColor,
      tipColor: controls.tipColor,
      windStrength: controls.enableWind ? controls.windStrength : 0.0,
      windDirectionX: controls.windDirectionX,
      windDirectionZ: controls.windDirectionZ,
      windSpeed: controls.windSpeed,
      windFrequency: controls.windFrequency,
      windAmplitude: controls.windAmplitude,
      windTurbulence: controls.windTurbulence,
      flappingIntensity: controls.flappingIntensity,
      specularIntensity: controls.specularIntensity,
      specularColor: controls.specularColor,
      moonColor: controls.moonColor,
      sssColor: controls.sssColor,
      fogSkyColor: controls.fogSkyColor,
      disableLighting: controls.disableLighting,
      enableEnvMap: controls.enableEnvMap,
      envMapIntensity: controls.envMapIntensity,
      enablePlayerInteraction: controls.enablePlayerInteraction,
      playerInteractionRadius: controls.playerInteractionRadius,
      playerInteractionStrength: controls.playerInteractionStrength,
      grassBaseLean: controls.grassBaseLean,
      bladeCurveAmount: controls.bladeCurveAmount,
    };

    updateGrassMaterialUniforms(materialRef.current, materialConfig);
  }, [
    controls.baseColor,
    controls.middleColor,
    controls.tipColor,
    controls.enableWind,
    controls.windStrength,
    controls.windDirectionX,
    controls.windDirectionZ,
    controls.windSpeed,
    controls.windFrequency,
    controls.windAmplitude,
    controls.windTurbulence,
    controls.flappingIntensity,
    controls.specularIntensity,
    controls.specularColor,
    controls.moonColor,
    controls.sssColor,
    controls.fogSkyColor,
    controls.disableLighting,
    controls.enableEnvMap,
    controls.envMapIntensity,
    controls.enablePlayerInteraction,
    controls.playerInteractionRadius,
    controls.playerInteractionStrength,
    controls.grassBaseLean,
    controls.bladeCurveAmount,
  ]);

  return <group ref={groupRef} />;
};

export default SimonDevGrassOptimized;
