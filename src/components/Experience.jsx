import {
  Environment,
  OrbitControls,
  OrthographicCamera,
  Stats,
  useProgress,
} from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { useControls, folder } from "leva";
import { useRef, useState, Suspense, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CharacterController } from "./CharacterController";
import { YbotCharacterController } from "./YbotCharacterController";
import { GodotCharacterController } from "./GodotCharacterController";
import { GodotCharacterHybrid } from "./GodotCharacterHybrid";
import { BVHCollider } from "./BVHCollider";
import { DynamicLeaves as DynamicLeaves4 } from "./DynamicLeaves4";
import { DynamicLeaves as DynamicLeaves3 } from "./DynamicLeaves3";
import { SimonDevGrass9 } from "./SimonDevGrass9";
import { SimonDevGrass10 } from "./SimonDevGrass10";
import { SimonDevGrass11 } from "./SimonDevGrass11";
import { SSAOEffect } from "./SSAOEffect";
import { VolumetricFog } from "./VolumetricFog";
import { AtmosphericFog } from "./AtmosphericFog";
import { AOTestObjects } from "./AOTestObjects";
import { Map } from "./Map";
import { PlaneMap } from "./PlaneMap";
import { TerrainMap } from "./TerrainMap";
import { GroundScatter } from "./GroundScatter";
import { GroundScatterTest } from "./GroundScatterTest";
import { ParkourCourse } from "./ParkourCourse";
import { ParkourCourseMap5 } from "./ParkourCourseMap5";
import { ParkourCourseMap6 } from "./ParkourCourseMap6";
import { DustParticles } from "./DustParticles";
import { ButterflyParticles } from "./ButterflyParticles";
import { RainParticles3D } from "./RainParticles3D";
import { MovingShadowPlanes } from "./MovingShadowPlanes";
import { DeerController } from "./DeerController";
import { DeerHerd } from "./DeerHerd";
import { JapaneseHouse } from "./JapaneseHouse";

const maps = {
  "map1(intro)": {
    type: "plane",
    size: 2000, // Original large size restored
    position: [0, 0, 0],
    color: "#6b8e23",
  },
  "map2(terrain)": {
    type: "plane",
    size: 333, // 6x smaller than map1 (2000 / 6) - compact arena!
    position: [0, 0, 0],
    color: "#6b8e23",
  },
  "map3(terrain2)": {
    type: "terrain",
    size: 500, // Smaller for better gameplay (1/4 of original)
    position: [0, 0, 0],
    heightScale: 75, // Matches Quick_Grass TERRAIN_HEIGHT
    heightOffset: 50, // Matches Quick_Grass TERRAIN_OFFSET
  },
  "map4(terrain+newcharacter)": {
    type: "plane",
    size: 333, // 6x smaller than map1 (2000 / 6) - compact arena!
    position: [0, 0, 0],
    color: "#6b8e23",
  },
  "map5(copy)": {
    type: "plane",
    size: 333, // Same as map4
    position: [0, 0, 0],
    color: "#6b8e23",
  },
  "map6(heightmap-terrain)": {
    type: "heightmap",
    size: 200,
    position: [0, 0, 0],
  },
  castle_on_hills: {
    type: "model",
    scale: 3,
    position: [-6, -7, 0],
  },
  animal_crossing_map: {
    type: "model",
    scale: 20,
    position: [-15, -1, 10],
  },
  city_scene_tokyo: {
    type: "model",
    scale: 0.72,
    position: [0, -1, -3.5],
  },
  de_dust_2_with_real_light: {
    type: "model",
    scale: 0.3,
    position: [-5, -3, 13],
  },
  medieval_fantasy_book: {
    type: "model",
    scale: 0.4,
    position: [-4, 0, -6],
  },
};

export const Experience = () => {
  const shadowCameraRef = useRef();
  const directionalLightRef = useRef();
  const characterPositionRef = useRef([0, 0, 0]);
  const characterPositionVector = useRef(new THREE.Vector3());
  const characterVelocity = useRef(new THREE.Vector3());
  const surfaceRef = useRef(null);
  const [enableScatter, setEnableScatter] = useState(false);
  const [bvhCollider, setBVHCollider] = useState(null);
  const [terrainMesh, setTerrainMesh] = useState(null); // Map6 terrain for deer
  const [heightmapLookup, setHeightmapLookup] = useState(null); // Map6 heightmap O(1) lookup

  // Terrain height getter for Map6 grass/effects - FAST O(1) HEIGHTMAP LOOKUP!
  // 🚀 NO MORE RAYCASTING - Direct array lookup like Quick_Grass!
  const getTerrainHeight = useCallback(
    (x, z) => {
      if (heightmapLookup) {
        // Use fast O(1) heightmap lookup - THOUSANDS of times faster than raycasting!
        return heightmapLookup(x, z);
      }
      return 0;
    },
    [heightmapLookup]
  ); // Only changes when heightmap lookup function changes!

  const { map } = useControls("Map", {
    map: {
      value: "map1(intro)",
      options: Object.keys(maps),
    },
  });

  const { cameraMode } = useControls("Camera", {
    cameraMode: {
      value: "character",
      options: {
        "Character Follow": "character",
        "Orbit Camera": "orbit",
      },
    },
  });

  const {
    environmentType,
    envPreset,
    backgroundIntensity,
    environmentIntensity,
    sunIntensity,
    sunColor,
    sunPositionX,
    sunPositionY,
    sunPositionZ,
    shadowMapSize,
    shadowCameraSize,
    shadowBias,
    shadowRadius,
    shadowNormalBias,
    followCharacter,
    ambientIntensity,
    ambientColor,
  } = useControls("💡 LIGHTS", {
    environment: folder(
      {
        environmentType: {
          value: "hdri",
          options: {
            "Custom HDRI": "hdri",
            Preset: "preset",
            None: "none",
          },
        },
        envPreset: {
          value: "sunset",
          options: [
            "sunset",
            "dawn",
            "night",
            "warehouse",
            "forest",
            "apartment",
            "studio",
            "city",
            "park",
            "lobby",
          ],
        },
        backgroundIntensity: { value: 0.5, min: 0, max: 2, step: 0.1 },
        environmentIntensity: { value: 1, min: 0, max: 2, step: 0.1 },
      },
      { collapsed: true }
    ),
    sunLight: folder(
      {
        sunIntensity: {
          value: 3.5,
          min: 0,
          max: 5,
          step: 0.1,
          label: "Intensity",
        },
        sunColor: { value: "#fffaed", label: "Color" },
        sunPositionX: {
          value: -30,
          min: -100,
          max: 100,
          step: 1,
          label: "Position X",
        },
        sunPositionY: {
          value: 60,
          min: 10,
          max: 100,
          step: 1,
          label: "Position Y",
        },
        sunPositionZ: {
          value: 40,
          min: -100,
          max: 100,
          step: 1,
          label: "Position Z",
        },
        followCharacter: {
          value: true,
          label: "Follow Character (Better Shadows)",
        },
        shadowMapSize: {
          value: 2048,
          options: [512, 1024, 2048, 4096],
          label: "Shadow Quality",
        },
        shadowCameraSize: {
          value: 30,
          min: 10,
          max: 200,
          step: 10,
          label: "Shadow Area",
        },
        shadowBias: {
          value: -0.0001,
          min: -0.001,
          max: 0,
          step: 0.00001,
          label: "Shadow Bias",
        },
        shadowRadius: {
          value: 4,
          min: 1,
          max: 10,
          step: 0.5,
          label: "Shadow Smoothness (Higher = Softer)",
        },
        shadowNormalBias: {
          value: 0.02,
          min: 0,
          max: 0.1,
          step: 0.005,
          label: "Normal Bias (Fixes Vertical Surfaces)",
        },
      },
      { collapsed: true }
    ),
    ambientLight: folder(
      {
        ambientIntensity: {
          value: 0.6,
          min: 0,
          max: 2,
          step: 0.1,
          label: "Intensity",
        },
        ambientColor: { value: "#b3d9ff", label: "Color" },
      },
      { collapsed: true }
    ),
  });

  const { enableGroundScatter, showPhysicsDebug } = useControls("🔍 DEBUG", {
    groundScatter: folder(
      {
        enableGroundScatter: {
          value: false,
          label: "🌿 Enable Ground Scatter",
        },
      },
      { collapsed: true }
    ),
    physics: folder(
      {
        showPhysicsDebug: {
          value: false,
          label: "🔍 Show Physics Meshes",
        },
      },
      { collapsed: true }
    ),
  });

  const {
    enableJapaneseHouse,
    housePositionX,
    housePositionY,
    housePositionZ,
    houseRotationY,
    houseScale,
  } = useControls("🏛️ OBJECTS", {
    japaneseHouse: folder(
      {
        enableJapaneseHouse: {
          value: false,
          label: "✨ Enable Japanese House",
        },
        housePositionX: {
          value: -30,
          min: -50,
          max: 50,
          step: 1,
          label: "📍 Position X",
        },
        housePositionY: {
          value: 0,
          min: -5,
          max: 5,
          step: 0.5,
          label: "📍 Position Y (Ground Level)",
        },
        housePositionZ: {
          value: 30,
          min: -50,
          max: 50,
          step: 1,
          label: "📍 Position Z",
        },
        houseRotationY: {
          value: 0,
          min: -Math.PI,
          max: Math.PI,
          step: 0.1,
          label: "🔄 Rotation Y",
        },
        houseScale: {
          value: 1.0,
          min: 0.5,
          max: 5.0,
          step: 0.1,
          label: "📏 House Scale",
        },
      },
      { collapsed: true }
    ),
  });

  const {
    enableDynamicLeaves3,
    enableDynamicLeaves4,
    leavesCount,
    leavesAreaSize,
    leavesInteractionRange,
    enableSimonDevGrass9,
    enableSimonDevGrass10,
    enableSimonDevGrass11,
  } = useControls("🌿 FOLIAGE", {
    dynamicLeaves: folder(
      {
        enableDynamicLeaves3: {
          value: false,
          label: "🍂 Enable v3 (CPU)",
        },
        enableDynamicLeaves4: {
          value: false,
          label: "🍂 Enable v4 (GPU)",
        },
        leavesCount: {
          value: 1000,
          min: 100,
          max: 5000,
          step: 100,
          label: "Leaves Count",
        },
        leavesAreaSize: {
          value: 30,
          min: 10,
          max: 100,
          step: 5,
          label: "Area Size",
        },
        leavesInteractionRange: {
          value: 8,
          min: 2,
          max: 20,
          step: 1,
          label: "Interaction Range",
        },
      },
      { collapsed: true }
    ),
    simonDevGrass: folder(
      {
        enableSimonDevGrass9: {
          value: false,
          label: "🌾 Enable v9 (Original)",
        },
        enableSimonDevGrass10: {
          value: false,
          label: "🚀 Enable v10 (Optimized)",
        },
        enableSimonDevGrass11: {
          value: false,
          label: "✨ Enable v11 (Custom Shadow Material)",
        },
      },
      { collapsed: true }
    ),
  });

  const {
    enableDustParticles,
    dustCount,
    dustSpawnRange,
    dustMaxDistance,
    dustSizeX,
    dustSizeY,
    enableButterflies,
    butterflyCount,
    butterflySpawnRange,
    butterflyMaxDistance,
    butterflyWidth,
    butterflyHeight,
    butterflyTexture,
    butterflyHeightMin,
    butterflyHeightMax,
    butterflySpreadRadius,
    enable3DRain,
    rainDensity,
    rain3DSpeed,
    rainAreaSize,
    rainParticleSize,
    rain3DColor,
    rain3DOpacity,
  } = useControls("🌤️ AMBIENCE", {
    dustParticles: folder(
      {
        enableDustParticles: {
          value: false,
          label: "✨ Enable Dust Particles",
        },
        dustCount: {
          value: 8,
          min: 4,
          max: 20,
          step: 1,
          label: "Particle Count",
        },
        dustSpawnRange: {
          value: 20.0,
          min: 10.0,
          max: 50.0,
          step: 5.0,
          label: "Spawn Range",
        },
        dustMaxDistance: {
          value: 50.0,
          min: 20.0,
          max: 100.0,
          step: 10.0,
          label: "Max Distance",
        },
        dustSizeX: {
          value: 0.4,
          min: 0.1,
          max: 2.0,
          step: 0.1,
          label: "Dust Width",
        },
        dustSizeY: {
          value: 0.4,
          min: 0.1,
          max: 2.0,
          step: 0.1,
          label: "Dust Height",
        },
      },
      { collapsed: true }
    ),
    butterflyParticles: folder(
      {
        enableButterflies: {
          value: false,
          label: "🦋 Enable Butterflies",
        },
        butterflyTexture: {
          value: "butterfly",
          options: ["butterfly", "moth", "both"],
          label: "Type",
        },
        butterflyCount: {
          value: 8,
          min: 4,
          max: 16,
          step: 1,
          label: "Count per Cell",
        },
        butterflySpawnRange: {
          value: 40.0,
          min: 20.0,
          max: 80.0,
          step: 10.0,
          label: "Spawn Range",
        },
        butterflyMaxDistance: {
          value: 100.0,
          min: 50.0,
          max: 200.0,
          step: 10.0,
          label: "Max Distance",
        },
        butterflyHeightMin: {
          value: 2.0,
          min: 0.0,
          max: 10.0,
          step: 0.5,
          label: "Height Min (Y)",
        },
        butterflyHeightMax: {
          value: 5.0,
          min: 0.0,
          max: 15.0,
          step: 0.5,
          label: "Height Max (Y)",
        },
        butterflySpreadRadius: {
          value: 1.0,
          min: 0.1,
          max: 2.0,
          step: 0.1,
          label: "Spread Randomness",
        },
        butterflyWidth: {
          value: 0.5,
          min: 0.2,
          max: 1.5,
          step: 0.1,
          label: "Wing Width",
        },
        butterflyHeight: {
          value: 1.25,
          min: 0.5,
          max: 2.5,
          step: 0.25,
          label: "Wing Height",
        },
      },
      { collapsed: true }
    ),
    rainParticles: folder(
      {
        enable3DRain: {
          value: false,
          label: "💧 Enable 3D Rain (with shadows!)",
        },
        rainDensity: {
          value: 500,
          min: 100,
          max: 2000,
          step: 100,
          label: "Rain Density",
        },
        rainAreaSize: {
          value: 50.0,
          min: 20.0,
          max: 100.0,
          step: 10.0,
          label: "Area Size",
        },
        rain3DSpeed: {
          value: 8.0,
          min: 2.0,
          max: 20.0,
          step: 1.0,
          label: "Fall Speed",
        },
        rainParticleSize: {
          value: 0.01,
          min: 0.005,
          max: 0.05,
          step: 0.001,
          label: "Particle Size",
        },
        rain3DColor: {
          value: "#d0e0ff",
          label: "🎨 Rain Color",
        },
        rain3DOpacity: {
          value: 0.4,
          min: 0.1,
          max: 1.0,
          step: 0.05,
          label: "💧 Opacity",
        },
      },
      { collapsed: true }
    ),
  });

  // Update shadow camera to follow character
  useFrame(() => {
    if (
      followCharacter &&
      directionalLightRef.current &&
      characterPositionRef.current
    ) {
      const [x, y, z] = characterPositionRef.current;
      // Keep the light's relative position but move it with the character
      directionalLightRef.current.position.set(
        x + sunPositionX,
        sunPositionY,
        z + sunPositionZ
      );
      // Update shadow camera target to follow character
      directionalLightRef.current.target.position.set(x, 0, z);
      directionalLightRef.current.target.updateMatrixWorld();
    }
  });

  const currentMap = maps[map];

  return (
    <>
      <Stats />
      {cameraMode === "orbit" && <OrbitControls />}

      {/* Background color - always render to prevent white flash */}
      <color attach="background" args={["#87CEEB"]} />

      {/* Environment Setup with Suspense to prevent white flash */}
      <Suspense fallback={null}>
        {environmentType === "hdri" && (
          <Environment
            files="/textures/industrial_sunset_02_puresky_4k.hdr"
            background
            backgroundIntensity={backgroundIntensity}
            environmentIntensity={environmentIntensity}
          />
        )}
        {environmentType === "preset" && (
          <Environment
            preset={envPreset}
            background
            backgroundIntensity={backgroundIntensity}
            environmentIntensity={environmentIntensity}
          />
        )}
      </Suspense>

      {/* Ambient Light */}
      <ambientLight intensity={ambientIntensity} color={ambientColor} />

      {/* Sun Light with optimized shadows */}
      <directionalLight
        ref={directionalLightRef}
        intensity={sunIntensity}
        color={sunColor}
        castShadow
        position={[sunPositionX, sunPositionY, sunPositionZ]}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-bias={shadowBias}
        shadow-radius={shadowRadius}
        shadow-normalBias={shadowNormalBias}
      >
        <OrthographicCamera
          left={-shadowCameraSize}
          right={shadowCameraSize}
          top={shadowCameraSize}
          bottom={-shadowCameraSize}
          near={0.5}
          far={200}
          ref={shadowCameraRef}
          attach={"shadow-camera"}
        />
      </directionalLight>
      <Physics key={map} debug={showPhysicsDebug}>
        {currentMap.type === "plane" ? (
          <>
            <PlaneMap
              size={currentMap.size}
              position={currentMap.position}
              color={currentMap.color}
              onMeshReady={(mesh) => {
                surfaceRef.current = mesh;
                setEnableScatter(true);
              }}
            />
            {/* Using BASIC SHAPES (no texture errors!) - Toggle in Leva */}
            {enableScatter && enableGroundScatter && (
              <GroundScatterTest surfaceRef={surfaceRef} enabled={true} />
            )}
            {/* Parkour course - different for map4 vs map5 vs map6 */}
            {map === "map4(terrain+newcharacter)" && <ParkourCourse />}
            {map === "map5(copy)" && <ParkourCourseMap5 />}
            {/* Dynamic Leaves v3 (CPU-based) for map5 - react to character movement */}
            {map === "map5(copy)" && enableDynamicLeaves3 && (
              <DynamicLeaves3
                count={leavesCount}
                areaSize={leavesAreaSize}
                ybotPosition={characterPositionVector.current}
                ybotVelocity={characterVelocity.current}
                getGroundHeight={(x, z) => 0} // Ground at y = 0
                characterInteractionRange={leavesInteractionRange}
                characterPushStrength={0.8}
                characterSwirlStrength={0.5}
              />
            )}
            {/* Dynamic Leaves v4 (GPU-based) for map5 - react to character movement */}
            {map === "map5(copy)" && enableDynamicLeaves4 && (
              <DynamicLeaves4
                count={leavesCount}
                areaSize={leavesAreaSize}
                ybotPosition={characterPositionVector.current}
                ybotVelocity={characterVelocity.current}
                getGroundHeight={(x, z) => 0} // Ground at y = 0
                characterInteractionRange={leavesInteractionRange}
                characterPushStrength={0.8}
                characterSwirlStrength={0.5}
              />
            )}
            {/* SimonDev Grass v9 for map5 - Original version */}
            {map === "map5(copy)" && enableSimonDevGrass9 && (
              <SimonDevGrass9
                areaSize={50}
                getGroundHeight={(x, z) => 0}
                grassHeight={1.0}
                grassScale={1.0}
              />
            )}
            {/* SimonDev Grass v10 for map5 - Optimized with chunking + frustum culling */}
            {map === "map5(copy)" && enableSimonDevGrass10 && (
              <SimonDevGrass10
                areaSize={50}
                getGroundHeight={(x, z) => 0}
                grassHeight={1.0}
                grassScale={1.0}
              />
            )}
            {/* SimonDev Grass v11 for map5 - Custom depth material for accurate animated shadows */}
            {map === "map5(copy)" && enableSimonDevGrass11 && (
              <SimonDevGrass11
                areaSize={200}
                getGroundHeight={(x, z) => 0}
                grassHeight={1.0}
                grassScale={1.0}
                characterPosition={characterPositionVector.current}
              />
            )}
            {/* Dust Particles for map5 - Atmospheric wind-blown dust effect */}
            {map === "map5(copy)" && enableDustParticles && (
              <DustParticles
                count={dustCount}
                spawnRange={dustSpawnRange}
                maxDistance={dustMaxDistance}
                dustSize={[dustSizeX, dustSizeY]}
                enabled={enableDustParticles}
              />
            )}
            {/* 3D Rain Particles for map5 - Falling rain with shadows */}
            {map === "map5(copy)" && enable3DRain && (
              <RainParticles3D
                enabled={enable3DRain}
                density={rainDensity}
                areaSize={rainAreaSize}
                rainSpeed={rain3DSpeed}
                particleSize={rainParticleSize}
                rainHeight={20.0}
                rainColor={rain3DColor}
                rainOpacity={rain3DOpacity}
              />
            )}
            {/* Butterflies/Moths for map5 - Animated flying insects with wing flapping */}
            {map === "map5(copy)" &&
              enableButterflies &&
              butterflyTexture !== "both" && (
                <ButterflyParticles
                  count={butterflyCount}
                  spawnRange={butterflySpawnRange}
                  maxDistance={butterflyMaxDistance}
                  butterflySize={[butterflyWidth, butterflyHeight]}
                  texture={butterflyTexture}
                  heightMin={butterflyHeightMin}
                  heightMax={butterflyHeightMax}
                  spreadRadius={butterflySpreadRadius}
                  enabled={enableButterflies}
                />
              )}
            {/* Render both butterflies AND moths when "both" is selected */}
            {map === "map5(copy)" &&
              enableButterflies &&
              butterflyTexture === "both" && (
                <>
                  <ButterflyParticles
                    count={Math.ceil(butterflyCount / 2)}
                    spawnRange={butterflySpawnRange}
                    maxDistance={butterflyMaxDistance}
                    butterflySize={[butterflyWidth, butterflyHeight]}
                    texture="butterfly"
                    heightMin={butterflyHeightMin}
                    heightMax={butterflyHeightMax}
                    spreadRadius={butterflySpreadRadius}
                    enabled={enableButterflies}
                  />
                  <ButterflyParticles
                    count={Math.floor(butterflyCount / 2)}
                    spawnRange={butterflySpawnRange}
                    maxDistance={butterflyMaxDistance}
                    butterflySize={[butterflyWidth, butterflyHeight]}
                    texture="moth"
                    heightMin={butterflyHeightMin}
                    heightMax={butterflyHeightMax}
                    spreadRadius={butterflySpreadRadius}
                    enabled={enableButterflies}
                  />
                </>
              )}
            {/* AO Test Objects for map5 - Shows where AO is most visible */}
            {map === "map5(copy)" && <AOTestObjects />}
            {/* Moving Shadow Planes for map5 - Atmospheric moving shadows (cloud placeholders) */}
            {map === "map5(copy)" && (
              <MovingShadowPlanes
                characterPosition={characterPositionVector.current}
              />
            )}
            {/* Deer for map5 - Single deer OR herd of deer */}
            {map === "map5(copy)" && <DeerController />}
            {map === "map5(copy)" && <DeerHerd />}
            {/* Japanese House for map5 - First building on the map */}
            {map === "map5(copy)" && enableJapaneseHouse && (
              <JapaneseHouse
                position={[housePositionX, housePositionY, housePositionZ]}
                rotation={[0, houseRotationY, 0]}
                scale={houseScale}
                castShadow
                receiveShadow
              />
            )}
            {/* BVH Collider for map4 and map5 - builds collision mesh */}
            {(map === "map4(terrain+newcharacter)" || map === "map5(copy)") && (
              <BVHCollider onColliderReady={setBVHCollider} />
            )}
            {/* Use Hybrid BVH+Rapier for map4/map5, YbotCharacterController for other plane maps */}
            {map === "map4(terrain+newcharacter)" || map === "map5(copy)" ? (
              <GodotCharacterHybrid
                position={[0, 1.5, 0]}
                cameraMode={cameraMode === "orbit" ? "orbit" : "follow"}
                collider={bvhCollider}
                onPositionChange={(pos) => {
                  characterPositionRef.current = pos;
                  characterPositionVector.current.set(pos[0], pos[1], pos[2]);
                }}
                onVelocityChange={(vel) => {
                  characterVelocity.current.set(vel[0], vel[1], vel[2]);
                }}
              />
            ) : (
              <YbotCharacterController
                position={[0, 2, 0]}
                cameraMode={cameraMode === "orbit" ? "orbit" : "follow"}
                onPositionChange={(pos) => {
                  characterPositionRef.current = pos;
                }}
              />
            )}
          </>
        ) : currentMap.type === "heightmap" ? (
          <>
            {/* MAP6 - HEIGHTMAP TERRAIN with ground scatter, trees, and parkour! */}
            <ParkourCourseMap6
              onTerrainReady={setTerrainMesh}
              onHeightmapReady={(fn) => setHeightmapLookup(() => fn)}
            />

            {/* Dynamic Leaves v3 (CPU-based) for map6 - TERRAIN-AWARE! */}
            {map === "map6(heightmap-terrain)" && enableDynamicLeaves3 && (
              <DynamicLeaves3
                count={leavesCount}
                areaSize={leavesAreaSize}
                ybotPosition={characterPositionVector.current}
                ybotVelocity={characterVelocity.current}
                getGroundHeight={getTerrainHeight}
                characterInteractionRange={leavesInteractionRange}
                characterPushStrength={0.8}
                characterSwirlStrength={0.5}
              />
            )}

            {/* Dynamic Leaves v4 (GPU-based) for map6 - TERRAIN-AWARE! */}
            {map === "map6(heightmap-terrain)" && enableDynamicLeaves4 && (
              <DynamicLeaves4
                count={leavesCount}
                areaSize={leavesAreaSize}
                ybotPosition={characterPositionVector.current}
                ybotVelocity={characterVelocity.current}
                getGroundHeight={getTerrainHeight}
                characterInteractionRange={leavesInteractionRange}
                characterPushStrength={0.8}
                characterSwirlStrength={0.5}
              />
            )}

            {/* SimonDev Grass for map6 - TERRAIN-AWARE! */}
            {map === "map6(heightmap-terrain)" && enableSimonDevGrass9 && (
              <SimonDevGrass9
                areaSize={50}
                getGroundHeight={getTerrainHeight}
                grassHeight={1.0}
                grassScale={1.0}
              />
            )}

            {map === "map6(heightmap-terrain)" && enableSimonDevGrass10 && (
              <SimonDevGrass10
                areaSize={50}
                getGroundHeight={getTerrainHeight}
                grassHeight={1.0}
                grassScale={1.0}
              />
            )}

            {map === "map6(heightmap-terrain)" && enableSimonDevGrass11 && (
              <SimonDevGrass11
                areaSize={200}
                getGroundHeight={getTerrainHeight}
                grassHeight={1.0}
                grassScale={1.0}
                characterPosition={characterPositionVector.current}
              />
            )}

            {/* Dust Particles for map6 */}
            {map === "map6(heightmap-terrain)" && enableDustParticles && (
              <DustParticles
                count={dustCount}
                spawnRange={dustSpawnRange}
                maxDistance={dustMaxDistance}
                dustSize={[dustSizeX, dustSizeY]}
                enabled={enableDustParticles}
              />
            )}

            {/* 3D Rain for map6 */}
            {map === "map6(heightmap-terrain)" && enable3DRain && (
              <RainParticles3D
                enabled={enable3DRain}
                density={rainDensity}
                areaSize={rainAreaSize}
                rainSpeed={rain3DSpeed}
                particleSize={rainParticleSize}
                rainHeight={20.0}
                rainColor={rain3DColor}
                rainOpacity={rain3DOpacity}
              />
            )}

            {/* Butterflies/Moths for map6 */}
            {map === "map6(heightmap-terrain)" &&
              enableButterflies &&
              butterflyTexture !== "both" && (
                <ButterflyParticles
                  count={butterflyCount}
                  spawnRange={butterflySpawnRange}
                  maxDistance={butterflyMaxDistance}
                  butterflySize={[butterflyWidth, butterflyHeight]}
                  texture={butterflyTexture}
                  heightMin={butterflyHeightMin}
                  heightMax={butterflyHeightMax}
                  spreadRadius={butterflySpreadRadius}
                  enabled={enableButterflies}
                />
              )}

            {map === "map6(heightmap-terrain)" &&
              enableButterflies &&
              butterflyTexture === "both" && (
                <>
                  <ButterflyParticles
                    count={Math.ceil(butterflyCount / 2)}
                    spawnRange={butterflySpawnRange}
                    maxDistance={butterflyMaxDistance}
                    butterflySize={[butterflyWidth, butterflyHeight]}
                    texture="butterfly"
                    heightMin={butterflyHeightMin}
                    heightMax={butterflyHeightMax}
                    spreadRadius={butterflySpreadRadius}
                    enabled={enableButterflies}
                  />
                  <ButterflyParticles
                    count={Math.floor(butterflyCount / 2)}
                    spawnRange={butterflySpawnRange}
                    maxDistance={butterflyMaxDistance}
                    butterflySize={[butterflyWidth, butterflyHeight]}
                    texture="moth"
                    heightMin={butterflyHeightMin}
                    heightMax={butterflyHeightMax}
                    spreadRadius={butterflySpreadRadius}
                    enabled={enableButterflies}
                  />
                </>
              )}

            {/* AO Test Objects for map6 */}
            {map === "map6(heightmap-terrain)" && <AOTestObjects />}

            {/* Moving Shadow Planes for map6 */}
            {map === "map6(heightmap-terrain)" && (
              <MovingShadowPlanes
                characterPosition={characterPositionVector.current}
              />
            )}

            {/* Deer for map6 - TERRAIN-AWARE! */}
            {map === "map6(heightmap-terrain)" && (
              <DeerController terrainMesh={terrainMesh} />
            )}
            {map === "map6(heightmap-terrain)" && (
              <DeerHerd terrainMesh={terrainMesh} />
            )}

            {/* Japanese House for map6 */}
            {map === "map6(heightmap-terrain)" && enableJapaneseHouse && (
              <JapaneseHouse
                position={[housePositionX, housePositionY, housePositionZ]}
                rotation={[0, houseRotationY, 0]}
                scale={houseScale}
                castShadow
                receiveShadow
              />
            )}

            {/* BVH Collider for map6 */}
            {map === "map6(heightmap-terrain)" && (
              <BVHCollider onColliderReady={setBVHCollider} />
            )}

            {/* Character controller for map6 */}
            <GodotCharacterHybrid
              position={[0, 1.5, 0]}
              cameraMode={cameraMode === "orbit" ? "orbit" : "follow"}
              collider={bvhCollider}
              onPositionChange={(pos) => {
                characterPositionRef.current = pos;
                characterPositionVector.current.set(pos[0], pos[1], pos[2]);
              }}
              onVelocityChange={(vel) => {
                characterVelocity.current.set(vel[0], vel[1], vel[2]);
              }}
            />
          </>
        ) : currentMap.type === "terrain" ? (
          <>
            <TerrainMap
              size={currentMap.size}
              position={currentMap.position}
              heightScale={currentMap.heightScale}
              heightOffset={currentMap.heightOffset}
              onMeshReady={(mesh) => {
                surfaceRef.current = mesh;
                setEnableScatter(true);
              }}
            />
            {/* Ground scatter on terrain */}
            {enableScatter && enableGroundScatter && (
              <GroundScatterTest surfaceRef={surfaceRef} enabled={true} />
            )}
            <YbotCharacterController
              position={[0, 2, 0]}
              cameraMode={cameraMode === "orbit" ? "orbit" : "follow"}
              onPositionChange={(pos) => {
                characterPositionRef.current = pos;
              }}
            />
          </>
        ) : (
          <>
            <Map
              scale={currentMap.scale}
              position={currentMap.position}
              model={`models/${map}.glb`}
            />
            <CharacterController disableCamera={cameraMode === "orbit"} />
          </>
        )}
      </Physics>

      {/* Post-Processing Effects (N8AO + Volumetric Fog + Rain) for map4/map5/map6 */}
      {/* Post-Processing Effects (N8AO, Bloom, etc.) */}
      {(map === "map4(terrain+newcharacter)" ||
        map === "map5(copy)" ||
        map === "map6(heightmap-terrain)") && <SSAOEffect />}

      {/* Scene-Based Fog Effects (NOT post-processing!) */}
      {(map === "map4(terrain+newcharacter)" ||
        map === "map5(copy)" ||
        map === "map6(heightmap-terrain)") && (
        <>
          <VolumetricFog />
          <AtmosphericFog />
        </>
      )}
    </>
  );
};
