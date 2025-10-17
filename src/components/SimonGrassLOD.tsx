import React, {
  useRef,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
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
} from "./GrassMaterial_Optimized";
import { createGrassGeometries, GrassGeometryConfig } from "./GrassGeometry";

interface SimonGrassLODProps {
  areaSize?: number;
  getGroundHeight?: (x: number, z: number) => number;
  grassHeight?: number;
  grassScale?: number;
  characterPosition?: THREE.Vector3;
  map?: string;
}

/**
 * SimonGrassLOD - Simple LOD System based on SimonDevGrass12
 *
 * Features:
 * - Same as SimonDevGrass12 but with LOD levels
 * - One large grass field with distance-based LOD
 * - High detail near camera, low detail far away
 * - Uses camera position for LOD switching (like AAA games)
 */
export const SimonGrassLOD: React.FC<SimonGrassLODProps> = ({
  areaSize = 200,
  getGroundHeight,
  grassHeight = 1.0,
  grassScale = 1.0,
  characterPosition = new THREE.Vector3(0, 0, 0),
  map = "map1(intro)",
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const grassMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const depthMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const textureRef = useRef<THREE.Texture | null>(null);
  const envMapTextureRef = useRef<THREE.DataTexture | null>(null);
  const isCreatingGrassRef = useRef<boolean>(false);
  const lastCameraPosition = useRef<THREE.Vector3>(new THREE.Vector3());
  const lastUpdateTime = useRef<number>(0);

  const { camera } = useThree();
  const controls = useSimonDevGrass12Controls();

  // LOD Configuration - distances from CAMERA (like AAA games)
  const lodConfig = {
    highDetail: 30, // 🟢 Center ring (0-30m): High detail (12 segments) - 100% density
    mediumDetail: 60, // 🟡 Middle ring (30-60m): Medium detail (6 segments) - 50% density
    lowDetail: 100, // 🔴 Outer ring (60-100m): Low detail (3 segments) - 25% density
    maxDistance: 100, // No grass beyond 100m
    densities: {
      high: 1.0, // 100% density (center ring) - DEBUG: Same as others
      medium: 1.0, // 100% density (middle ring) - DEBUG: Same as others
      low: 1.0, // 100% density (outer ring) - DEBUG: Same as others
    },
  };

  // Determine if we're on a post-processing map
  const isPostProcessingMap =
    map === "map4(terrain+newcharacter)" ||
    map === "map5(copy)" ||
    map === "map6(heightmap-terrain)";

  // Create geometries (same as SimonDevGrass12 but with LOD levels)
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

  // State for materials
  const [materials, setMaterials] = useState<{
    grassMaterial: THREE.ShaderMaterial;
    depthMaterial: THREE.ShaderMaterial;
  } | null>(null);

  // State for LOD meshes
  const [lodMeshes, setLodMeshes] = useState<{
    high: THREE.InstancedMesh | null;
    medium: THREE.InstancedMesh | null;
    low: THREE.InstancedMesh | null;
  }>({
    high: null,
    medium: null,
    low: null,
  });

  // Update material references
  useEffect(() => {
    if (materials) {
      materialRef.current = materials.grassMaterial;
      depthMaterialRef.current = materials.depthMaterial;
    }
  }, [materials]);

  // Environment map loading (same as SimonDevGrass12)
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

  // Initialize materials (only when texture loads)
  useEffect(() => {
    if (!textureRef.current) return;

    console.log("🔧 Creating LOD grass materials...");

    const materialConfig: GrassMaterialConfig = {
      // Colors
      baseColor: controls.baseColor,
      middleColor: controls.middleColor,
      tipColor: controls.tipColor,
      gradientPower: controls.gradientPower,
      baseTransitionPoint: controls.baseTransitionPoint,
      tipTransitionPoint: controls.tipTransitionPoint,

      // Wind
      windStrength: controls.enableWind ? controls.windStrength : 0.0,
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
      // envMap: envMapTextureRef.current, // TODO: Fix envMap type
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
      textureRef.current,
      null,
      materialConfig
    );
    setMaterials(newMaterials);
    console.log("✅ LOD materials created");
  }, [textureRef.current]);

  // Load texture (same as SimonDevGrass12)
  useEffect(() => {
    console.log("🖼️ Loading grass texture...");
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      "/textures/grass.png",
      (texture) => {
        console.log("✅ Grass texture loaded");
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.flipY = false;
        texture.repeat.set(controls.textureRepeatX, controls.textureRepeatY);
        textureRef.current = texture;
      },
      undefined,
      (error) => {
        console.error("❌ Failed to load grass texture:", error);
        // Create fallback texture
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
      }
    );
  }, [controls.textureRepeatX, controls.textureRepeatY]);

  // Create static grass field data (positions never change - no more jumping!)
  const createStaticGrassData = useCallback(() => {
    const grassCount = controls.grassCount;
    const maxInstances = grassCount * controls.bladesPerCluster;

    console.log(
      `🌾 Creating STATIC grass field: ${grassCount} blades across entire area`
    );

    const offsets = new Float32Array(maxInstances * 3);
    const scales = new Float32Array(maxInstances);
    const rotations = new Float32Array(maxInstances);
    const windInfluences = new Float32Array(maxInstances);
    const grassTypes = new Float32Array(maxInstances);
    const colorVariations = new Float32Array(maxInstances * 3);
    const tipColorVariations = new Float32Array(maxInstances * 3);
    const distances = new Float32Array(maxInstances); // Store distance from origin for LOD

    let instanceIndex = 0;

    for (let i = 0; i < grassCount; i++) {
      // Generate static positions across entire area (no more annular rings)
      const x = (Math.random() - 0.5) * areaSize;
      const z = (Math.random() - 0.5) * areaSize;
      const distance = Math.sqrt(x * x + z * z); // Distance from origin

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

      for (let bladeIdx = 0; bladeIdx < controls.bladesPerCluster; bladeIdx++) {
        offsets[instanceIndex * 3] = x;
        offsets[instanceIndex * 3 + 1] = groundHeight;
        offsets[instanceIndex * 3 + 2] = z;

        scales[instanceIndex] = scale;
        const clusterRotation =
          rotation + (bladeIdx / controls.bladesPerCluster) * Math.PI * 2;
        rotations[instanceIndex] = clusterRotation;
        windInfluences[instanceIndex] = windInfluence;
        grassTypes[instanceIndex] = grassType;
        distances[instanceIndex] = distance; // Store distance for LOD culling

        colorVariations[instanceIndex * 3] = colorVariation[0];
        colorVariations[instanceIndex * 3 + 1] = colorVariation[1];
        colorVariations[instanceIndex * 3 + 2] = colorVariation[2];

        tipColorVariations[instanceIndex * 3] = tipColorVariation[0];
        tipColorVariations[instanceIndex * 3 + 1] = tipColorVariation[1];
        tipColorVariations[instanceIndex * 3 + 2] = tipColorVariation[2];

        instanceIndex++;
      }
    }

    return {
      offsets: offsets.slice(0, instanceIndex * 3),
      scales: scales.slice(0, instanceIndex),
      rotations: rotations.slice(0, instanceIndex),
      windInfluences: windInfluences.slice(0, instanceIndex),
      grassTypes: grassTypes.slice(0, instanceIndex),
      colorVariations: colorVariations.slice(0, instanceIndex * 3),
      tipColorVariations: tipColorVariations.slice(0, instanceIndex * 3),
      distances: distances.slice(0, instanceIndex),
      instanceCount: instanceIndex,
    };
  }, [
    controls.grassCount,
    controls.bladesPerCluster,
    controls.grassScaleMultiplier,
    areaSize,
    grassScale,
    getGroundHeight,
  ]);

  // Create grass data for concentric LOD rings (static field)
  const createConcentricLODGrassData = useCallback(
    (lodLevel: "high" | "medium" | "low") => {
      const density = lodConfig.densities[lodLevel];
      const grassCount = Math.floor(controls.grassCount * density);
      const maxInstances = grassCount * controls.bladesPerCluster;

      // Define concentric ring boundaries
      let minRadius = 0;
      let maxRadius = lodConfig.highDetail; // 30m

      if (lodLevel === "medium") {
        minRadius = lodConfig.highDetail; // 30m
        maxRadius = lodConfig.mediumDetail; // 60m
      } else if (lodLevel === "low") {
        minRadius = lodConfig.mediumDetail; // 60m
        maxRadius = lodConfig.lowDetail; // 100m
      }

      console.log(
        `🌾 Creating ${lodLevel} LOD ring: ${grassCount} blades (${(
          density * 100
        ).toFixed(0)}% density) - Radius: ${minRadius}-${maxRadius}m`
      );

      const offsets = new Float32Array(maxInstances * 3);
      const scales = new Float32Array(maxInstances);
      const rotations = new Float32Array(maxInstances);
      const windInfluences = new Float32Array(maxInstances);
      const grassTypes = new Float32Array(maxInstances);
      const colorVariations = new Float32Array(maxInstances * 3);
      const tipColorVariations = new Float32Array(maxInstances * 3);

      let instanceIndex = 0;

      for (let i = 0; i < grassCount; i++) {
        // Generate positions within the concentric ring
        let x, z, distance;
        do {
          x = (Math.random() - 0.5) * areaSize;
          z = (Math.random() - 0.5) * areaSize;
          distance = Math.sqrt(x * x + z * z);
        } while (distance < minRadius || distance > maxRadius);

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

      return {
        offsets: offsets.slice(0, instanceIndex * 3),
        scales: scales.slice(0, instanceIndex),
        rotations: rotations.slice(0, instanceIndex),
        windInfluences: windInfluences.slice(0, instanceIndex),
        grassTypes: grassTypes.slice(0, instanceIndex),
        colorVariations: colorVariations.slice(0, instanceIndex * 3),
        tipColorVariations: tipColorVariations.slice(0, instanceIndex * 3),
        instanceCount: instanceIndex,
        minRadius,
        maxRadius,
      };
    },
    [
      controls.grassCount,
      controls.bladesPerCluster,
      controls.grassScaleMultiplier,
      areaSize,
      grassScale,
      getGroundHeight,
      lodConfig.highDetail,
      lodConfig.mediumDetail,
      lodConfig.lowDetail,
      lodConfig.densities,
    ]
  );

  // Create LOD mesh with specific geometry and density
  const createLODMesh = useCallback(
    (lodLevel: "high" | "medium" | "low", geometry: THREE.BufferGeometry) => {
      if (!materials || !geometries) return null;

      const grassData = createConcentricLODGrassData(lodLevel);
      if (grassData.instanceCount === 0) return null;

      const grassGeo = geometry.clone();
      grassGeo.setAttribute(
        "offset",
        new THREE.InstancedBufferAttribute(grassData.offsets, 3)
      );
      grassGeo.setAttribute(
        "scale",
        new THREE.InstancedBufferAttribute(grassData.scales, 1)
      );
      grassGeo.setAttribute(
        "rotation",
        new THREE.InstancedBufferAttribute(grassData.rotations, 1)
      );
      grassGeo.setAttribute(
        "windInfluence",
        new THREE.InstancedBufferAttribute(grassData.windInfluences, 1)
      );
      grassGeo.setAttribute(
        "grassType",
        new THREE.InstancedBufferAttribute(grassData.grassTypes, 1)
      );
      grassGeo.setAttribute(
        "colorVariation",
        new THREE.InstancedBufferAttribute(grassData.colorVariations, 3)
      );
      grassGeo.setAttribute(
        "tipColorVariation",
        new THREE.InstancedBufferAttribute(grassData.tipColorVariations, 3)
      );

      // Create material with LOD-specific colors
      const lodMaterial = materials.grassMaterial.clone();

      // Apply color coding based on LOD level
      if (lodLevel === "high") {
        // 🟢 Green for high LOD (center ring)
        lodMaterial.uniforms.baseColor.value.setHex(0x00ff00);
        lodMaterial.uniforms.middleColor.value.setHex(0x00cc00);
        lodMaterial.uniforms.tipColor.value.setHex(0x009900);
        console.log(`🟢 Applied GREEN colors to ${lodLevel} LOD mesh`);
      } else if (lodLevel === "medium") {
        // 🟡 Yellow for medium LOD (middle ring)
        lodMaterial.uniforms.baseColor.value.setHex(0xffff00);
        lodMaterial.uniforms.middleColor.value.setHex(0xcccc00);
        lodMaterial.uniforms.tipColor.value.setHex(0x999900);
        console.log(`🟡 Applied YELLOW colors to ${lodLevel} LOD mesh`);
      } else if (lodLevel === "low") {
        // 🔴 Red for low LOD (outer ring)
        lodMaterial.uniforms.baseColor.value.setHex(0xff0000);
        lodMaterial.uniforms.middleColor.value.setHex(0xcc0000);
        lodMaterial.uniforms.tipColor.value.setHex(0x990000);
        console.log(`🔴 Applied RED colors to ${lodLevel} LOD mesh`);
      }

      const grassMesh = new THREE.InstancedMesh(
        grassGeo,
        lodMaterial,
        grassData.instanceCount
      );
      grassMesh.position.set(0, 0, 0);
      grassMesh.frustumCulled = false;
      grassMesh.castShadow = controls.shadowCasting;
      grassMesh.receiveShadow = controls.shadowReceiving;
      grassMesh.customDepthMaterial = materials.depthMaterial;
      grassMesh.userData = { lodLevel, density: lodConfig.densities[lodLevel] };

      if (groupRef.current) {
        groupRef.current.add(grassMesh);
      }

      console.log(
        `✅ Created ${lodLevel} LOD mesh: ${
          grassData.instanceCount
        } instances (${(lodConfig.densities[lodLevel] * 100).toFixed(
          0
        )}% density)`
      );
      return grassMesh;
    },
    [
      materials,
      geometries,
      createConcentricLODGrassData,
      controls.shadowCasting,
      controls.shadowReceiving,
    ]
  );

  // Create single seamless grass mesh with static positions
  const createSeamlessGrassMesh = useCallback(() => {
    if (!materials || !geometries) return null;

    const grassData = createStaticGrassData();
    if (grassData.instanceCount === 0) return null;

    // Use high detail geometry for the base mesh
    const grassGeo = geometries.high.clone();
    grassGeo.setAttribute(
      "offset",
      new THREE.InstancedBufferAttribute(grassData.offsets, 3)
    );
    grassGeo.setAttribute(
      "scale",
      new THREE.InstancedBufferAttribute(grassData.scales, 1)
    );
    grassGeo.setAttribute(
      "rotation",
      new THREE.InstancedBufferAttribute(grassData.rotations, 1)
    );
    grassGeo.setAttribute(
      "windInfluence",
      new THREE.InstancedBufferAttribute(grassData.windInfluences, 1)
    );
    grassGeo.setAttribute(
      "grassType",
      new THREE.InstancedBufferAttribute(grassData.grassTypes, 1)
    );
    grassGeo.setAttribute(
      "colorVariation",
      new THREE.InstancedBufferAttribute(grassData.colorVariations, 3)
    );
    grassGeo.setAttribute(
      "tipColorVariation",
      new THREE.InstancedBufferAttribute(grassData.tipColorVariations, 3)
    );
    grassGeo.setAttribute(
      "distance",
      new THREE.InstancedBufferAttribute(grassData.distances, 1)
    );

    const grassMesh = new THREE.InstancedMesh(
      grassGeo,
      materials.grassMaterial,
      grassData.instanceCount
    );
    grassMesh.position.set(0, 0, 0);
    grassMesh.frustumCulled = false;
    grassMesh.castShadow = controls.shadowCasting;
    grassMesh.receiveShadow = controls.shadowReceiving;
    grassMesh.customDepthMaterial = materials.depthMaterial;
    grassMesh.userData = {
      staticPositions: true,
      totalInstances: grassData.instanceCount,
      grassData: grassData,
    };

    if (groupRef.current) {
      groupRef.current.add(grassMesh);
    }

    console.log(
      `✅ Created SEAMLESS grass mesh: ${grassData.instanceCount} static instances`
    );
    return grassMesh;
  }, [
    materials,
    geometries,
    createStaticGrassData,
    controls.shadowCasting,
    controls.shadowReceiving,
  ]);

  // Main grass creation - Create concentric LOD rings (static field)
  useEffect(() => {
    if (!groupRef.current || !materials || !geometries) return;

    // Prevent duplicate creation
    if (isCreatingGrassRef.current) {
      return;
    }

    isCreatingGrassRef.current = true;
    console.log("🌾 Creating CONCENTRIC LOD RINGS (static field)...");

    // Clean up old meshes
    if (groupRef.current) {
      const existingMeshes = groupRef.current.children.filter(
        (child) =>
          child instanceof THREE.InstancedMesh && child.userData.lodLevel
      );
      existingMeshes.forEach((mesh) => {
        groupRef.current!.remove(mesh);
        if (mesh instanceof THREE.InstancedMesh) {
          mesh.geometry.dispose();
        }
      });
    }

    // Create concentric LOD rings - all visible simultaneously
    const newLodMeshes = {
      high: createLODMesh("high", geometries.high), // 🟢 Center ring (0-30m): 12 segments, 100% density
      medium: createLODMesh("medium", geometries.medium), // 🟡 Middle ring (30-60m): 6 segments, 50% density
      low: createLODMesh("low", geometries.low), // 🔴 Outer ring (60-100m): 3 segments, 25% density
    };

    // Set all meshes to visible (concentric rings)
    Object.values(newLodMeshes).forEach((mesh) => {
      if (mesh) {
        mesh.visible = true;
      }
    });

    setLodMeshes(newLodMeshes);
    isCreatingGrassRef.current = false;
    console.log(
      "✅ CONCENTRIC LOD RINGS created! 🟢🟡🔴 Static field with true geometry + density differences!"
    );
  }, [materials, geometries]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("🧹 SimonGrassLOD cleanup");
      // Cleanup LOD meshes
      if (groupRef.current) {
        const existingMeshes = groupRef.current.children.filter(
          (child) =>
            child instanceof THREE.InstancedMesh && child.userData.lodLevel
        );
        existingMeshes.forEach((mesh) => {
          groupRef.current!.remove(mesh);
          if (mesh instanceof THREE.InstancedMesh) {
            mesh.geometry.dispose();
          }
        });
      }
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
  }, [materials]);

  // Update LOD meshes visibility and material uniforms every frame
  useFrame((state) => {
    if (!materialRef.current || !depthMaterialRef.current) return;

    const currentTime = state.clock.elapsedTime;

    // HIGH FREQUENCY UPDATES (60 FPS) - Update each LOD mesh individually
    Object.values(lodMeshes).forEach((mesh) => {
      if (!mesh) return;

      // Update time uniform for each LOD mesh
      if (mesh.material instanceof THREE.ShaderMaterial) {
        if (mesh.material.uniforms.time) {
          mesh.material.uniforms.time.value = currentTime;
        }
        if (mesh.material.uniforms.playerPosition && characterPosition) {
          mesh.material.uniforms.playerPosition.value.copy(characterPosition);
        }
      }
    });

    // Also update the depth material (used for shadows) - with wind disabled
    if (depthMaterialRef.current) {
      if (depthMaterialRef.current.uniforms.time) {
        depthMaterialRef.current.uniforms.time.value = currentTime;
      }
      if (
        characterPosition &&
        depthMaterialRef.current.uniforms.playerPosition
      ) {
        depthMaterialRef.current.uniforms.playerPosition.value.copy(
          characterPosition
        );
      }

      // Update depth material with wind disabled
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
        lodConfig.highDetail,
        lodConfig.mediumDetail,
        characterPosition
      );
    }

    // MEDIUM FREQUENCY UPDATES (when camera moves)
    const cameraMovement = camera.position.distanceTo(
      lastCameraPosition.current
    );
    if (cameraMovement > 5) {
      lastCameraPosition.current.copy(camera.position);

      // Update LOD distances for shader uniforms
      if (materialRef.current.uniforms.highDetailDistance) {
        materialRef.current.uniforms.highDetailDistance.value =
          lodConfig.highDetail;
      }
      if (materialRef.current.uniforms.mediumDetailDistance) {
        materialRef.current.uniforms.mediumDetailDistance.value =
          lodConfig.mediumDetail;
      }

      // Update view matrix
      if (materialRef.current.uniforms.viewMatrixInverse) {
        materialRef.current.uniforms.viewMatrixInverse.value.copy(
          camera.matrixWorld
        );
      }
      if (depthMaterialRef.current.uniforms.viewMatrixInverse) {
        depthMaterialRef.current.uniforms.viewMatrixInverse.value.copy(
          camera.matrixWorld
        );
      }
    }

    // Update material uniforms (each LOD mesh has its own colored material)
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
      // envMap: envMapTextureRef.current, // TODO: Fix envMap type
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

    // Update uniforms for each LOD mesh individually
    Object.values(lodMeshes).forEach((mesh) => {
      if (!mesh) return;

      // Update time and player position for each mesh
      if (mesh.material instanceof THREE.ShaderMaterial) {
        if (mesh.material.uniforms.time) {
          mesh.material.uniforms.time.value = currentTime;
        }
        if (mesh.material.uniforms.playerPosition && characterPosition) {
          mesh.material.uniforms.playerPosition.value.copy(characterPosition);
        }

        // Create material config WITHOUT colors (to preserve LOD-specific colors)
        const lodMaterialConfig = { ...materialConfig };
        delete lodMaterialConfig.baseColor;
        delete lodMaterialConfig.middleColor;
        delete lodMaterialConfig.tipColor;

        // Update other uniforms (excluding colors which are static per LOD)
        // This includes wind uniforms which should now work properly!
        updateGrassMaterialUniforms(
          mesh.material,
          lodMaterialConfig,
          lodConfig.highDetail,
          lodConfig.mediumDetail,
          characterPosition
        );
      }
    });

    // Throttled updates (every 100ms)
    if (currentTime - lastUpdateTime.current > 0.1) {
      lastUpdateTime.current = currentTime;
      // Additional throttled updates can go here
    }
  });

  return <group ref={groupRef} />;
};

export default SimonGrassLOD;
