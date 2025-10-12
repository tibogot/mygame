import React, { useMemo, useRef } from "react";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { useTexture, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import CustomShaderMaterial from "three-custom-shader-material";
import { useControls } from "leva";
import { SpheresMaterials } from "./SpheresMaterials";

export const ParkourCourseMap5 = () => {
  // Load mountain model for background
  const { scene: mountainScene } = useGLTF("/models/mountain.glb");

  // Elevator reference and animation
  const elevatorRef = useRef<any>(null);
  const timeRef = useRef(0);

  useFrame((state, delta) => {
    if (elevatorRef.current) {
      timeRef.current += delta;

      // Calculate velocity directly from the derivative of sin
      // If position = sin(t * 0.3) * 2.5 + 2.5
      // Then velocity = cos(t * 0.3) * 0.3 * 2.5
      const velocityY = Math.cos(timeRef.current * 0.3) * 0.3 * 2.5;

      // Use velocity-based movement for smooth physics interaction
      elevatorRef.current.setLinvel({ x: 0, y: velocityY, z: 0 }, true);
    }
  });

  // Mountain ring position controls - Surrounds the map
  const { mountainX, mountainY, mountainZ, mountainScale } = useControls(
    "Mountain Background (Map5)",
    {
      mountainX: {
        value: 0,
        min: -200,
        max: 200,
        step: 5,
        label: "Position X",
      },
      mountainY: {
        value: -0.5, // Match ground level
        min: -50,
        max: 50,
        step: 1,
        label: "Position Y",
      },
      mountainZ: {
        value: 0,
        min: -200,
        max: 200,
        step: 5,
        label: "Position Z",
      },
      mountainScale: {
        value: 0.08, // Scale to fit around 333-unit map
        min: 0.01,
        max: 0.5,
        step: 0.01,
        label: "Scale",
      },
    }
  );

  // Material spheres toggle
  const { enableMaterialSpheres } = useControls("Material Showcase (Map5)", {
    enableMaterialSpheres: {
      value: false,
      label: "🎨 Enable Material Spheres",
    },
  });

  // Shadow test plane toggle
  const { enableShadowTestPlane, shadowPlaneHeight, shadowPlaneSize } =
    useControls("Shadow Test (Map5)", {
      enableShadowTestPlane: {
        value: false,
        label: "🔴 Enable Shadow Test Plane",
      },
      shadowPlaneHeight: {
        value: 6,
        min: 1,
        max: 20,
        step: 0.5,
        label: "Plane Height",
      },
      shadowPlaneSize: {
        value: 10,
        min: 2,
        max: 50,
        step: 1,
        label: "Plane Size",
      },
    });

  // Use the same grid texture as the ground
  const gridTexture = useTexture("/textures/grid.png");

  // Configure texture - EXACT same as PlaneMap
  gridTexture.wrapS = gridTexture.wrapT = THREE.RepeatWrapping;
  gridTexture.anisotropy = 16;

  // Memoize uniforms
  const uniforms = useMemo(
    () => ({
      gridTexture: { value: gridTexture },
      gradientIntensity: { value: 0.5 },
    }),
    [gridTexture]
  );

  // Reusable material component (JSX, not constructor)
  const TileMaterial = () => (
    <CustomShaderMaterial
      baseMaterial={THREE.MeshStandardMaterial}
      vertexShader={`
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        }
      `}
      fragmentShader={`
        uniform sampler2D gridTexture;
        uniform float gradientIntensity;
        varying vec3 vWorldPos;
        
        float hash12(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        
        float remap(float value, float oldMin, float oldMax, float newMin, float newMax) {
          return newMin + (value - oldMin) * (newMax - newMin) / (oldMax - oldMin);
        }
        
        void main() {
          // EXACT same sampling as PlaneMap for matching tiles
          float grid1 = texture2D(gridTexture, vWorldPos.xz * 0.125).r;
          float grid2 = texture2D(gridTexture, vWorldPos.xz * 1.25).r;
          
          // Generate hash for variation
          float gridHash1 = hash12(floor(vWorldPos.xz * 1.25));
          
          // Apply gradient intensity to the variation amount
          float variationAmount = gradientIntensity * 0.2;
          
          // Create grid color with variations
          vec3 gridColour = mix(
            vec3(0.45 + remap(gridHash1, 0.0, 1.0, -variationAmount, variationAmount)), 
            vec3(0.08), 
            grid2
          );
          gridColour = mix(gridColour, vec3(0.0), grid1);
          
          // Set the diffuse color
          csm_DiffuseColor = vec4(gridColour, 1.0);
        }
      `}
      uniforms={uniforms}
      roughness={1.0}
      metalness={0.0}
    />
  );

  // Clone and setup mountain with visible materials and centered pivot
  const mountain = useMemo(() => {
    const clonedMountain = mountainScene.clone();

    // Get bounding box to find center offset
    const box = new THREE.Box3().setFromObject(clonedMountain);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // Offset all children to center the mountain at its pivot
    clonedMountain.children.forEach((child) => {
      child.position.sub(center);
    });

    // Force materials to be visible
    clonedMountain.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshStandardMaterial({
          color: "#8B7355", // Brown rock color
          roughness: 0.9,
          metalness: 0.1,
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return clonedMountain;
  }, [mountainScene]);

  return (
    <group>
      {/* MOUNTAIN RING - Circular rock formation surrounding the map */}
      <primitive
        object={mountain}
        position={[mountainX, mountainY, mountainZ]}
        scale={mountainScale}
      />

      {/* LONG CONTINUOUS SLOPE - with tile texture */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[20, 2.5, 15]}
        rotation={[-Math.PI / 12, 0, 0]}
        friction={1}
      >
        <CuboidCollider args={[3, 0.25, 10]} friction={1} restitution={0} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[6, 0.5, 20]} />
          <TileMaterial />
        </mesh>
      </RigidBody>

      {/* LONG DOWNWARD SLOPE - with tile texture */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[-20, 2.5, 15]}
        rotation={[Math.PI / 12, 0, 0]}
        friction={1}
      >
        <CuboidCollider args={[3, 0.25, 10]} friction={1} restitution={0} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[6, 0.5, 20]} />
          <TileMaterial />
        </mesh>
      </RigidBody>

      {/* TEST SLOPE 1 - Very gentle (5 degrees) - with tile texture */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[15, 0.3, 5]}
        rotation={[-Math.PI / 36, 0, 0]}
        friction={1}
      >
        <CuboidCollider args={[2, 0.2, 4]} friction={1} restitution={0} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[4, 0.4, 8]} />
          <TileMaterial />
        </mesh>
      </RigidBody>

      {/* TEST SLOPE 2 - Gentle (10 degrees) - with tile texture */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[15, 0.6, 15]}
        rotation={[-Math.PI / 18, 0, 0]}
        friction={1}
      >
        <CuboidCollider args={[2, 0.2, 4]} friction={1} restitution={0} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[4, 0.4, 8]} />
          <TileMaterial />
        </mesh>
      </RigidBody>

      {/* TEST SLOPE 3 - Medium (20 degrees) - with tile texture */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[15, 1.2, 25]}
        rotation={[-Math.PI / 9, 0, 0]}
        friction={1}
      >
        <CuboidCollider args={[2, 0.2, 4]} friction={1} restitution={0} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[4, 0.4, 8]} />
          <TileMaterial />
        </mesh>
      </RigidBody>

      {/* TEST SLOPE 4 - Steep (30 degrees) - with tile texture */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[15, 2, 35]}
        rotation={[-Math.PI / 6, 0, 0]}
        friction={1}
      >
        <CuboidCollider args={[2, 0.2, 4]} friction={1} restitution={0} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[4, 0.4, 8]} />
          <TileMaterial />
        </mesh>
      </RigidBody>

      {/* YELLOW STAIRS - with tile texture */}
      {[...Array(10)].map((_, i) => (
        <RigidBody
          key={`yellow-${i}`}
          type="fixed"
          colliders={false}
          position={[10, i * 0.25 + 0.125, 6 + i * 0.5 + 0.25]}
          friction={1}
        >
          <CuboidCollider
            args={[1.5, 0.125, 0.25]}
            friction={1}
            restitution={0}
          />
          <mesh castShadow receiveShadow>
            <boxGeometry args={[3, 0.25, 0.5]} />
            <TileMaterial />
          </mesh>
        </RigidBody>
      ))}

      {/* LANDING PLATFORM at top of yellow stairs - with tile texture */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[10, 2.5, 11.5]}
        friction={1}
      >
        <CuboidCollider args={[1.5, 0.15, 1]} friction={1} restitution={0} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[3, 0.3, 2]} />
          <TileMaterial />
        </mesh>
      </RigidBody>

      {/* BIG WALL 1 - Tall wall for jump testing (Front) - with tile texture */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[0, 2.5, 15]}
        friction={0}
      >
        <CuboidCollider args={[5, 2.5, 0.25]} friction={0} restitution={0} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[10, 5, 0.5]} />
          <TileMaterial />
        </mesh>
      </RigidBody>

      {/* BIG WALL 2 - Tall wall (Left side) - with tile texture */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[-15, 2.5, 0]}
        friction={0}
      >
        <CuboidCollider args={[0.25, 2.5, 5]} friction={0} restitution={0} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.5, 5, 10]} />
          <TileMaterial />
        </mesh>
      </RigidBody>

      {/* BIG WALL 3 - Tall wall (Right side) - with tile texture */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[15, 2.5, 0]}
        friction={0}
      >
        <CuboidCollider args={[0.25, 2.5, 5]} friction={0} restitution={0} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.5, 5, 10]} />
          <TileMaterial />
        </mesh>
      </RigidBody>

      {/* CORNER WALL - Test corner collisions - with tile texture */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[-10, 2, -5]}
        friction={0}
      >
        <CuboidCollider args={[0.25, 2, 3]} friction={0} restitution={0} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.5, 4, 6]} />
          <TileMaterial />
        </mesh>
      </RigidBody>

      {/* ========== PHYSICS CUBES - KEEP ORIGINAL COLORS ========== */}

      {/* LIGHT CUBE 1 - Very easy to push (Green) - Mass: 1kg */}
      <RigidBody
        type="dynamic"
        colliders="cuboid"
        position={[-5, 0.5, 0]}
        mass={1}
        friction={0.5}
        restitution={0.1}
        linearDamping={0.5}
        angularDamping={0.5}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#00ff00"
            roughness={0.7}
            metalness={0.2}
          />
        </mesh>
      </RigidBody>

      {/* LIGHT CUBE 2 - Very easy to push (Lime) - Mass: 1kg */}
      <RigidBody
        type="dynamic"
        colliders="cuboid"
        position={[-3, 0.5, 0]}
        mass={1}
        friction={0.5}
        restitution={0.1}
        linearDamping={0.5}
        angularDamping={0.5}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#7fff00"
            roughness={0.7}
            metalness={0.2}
          />
        </mesh>
      </RigidBody>

      {/* MEDIUM CUBE 1 - Moderate (Yellow) - Mass: 5kg */}
      <RigidBody
        type="dynamic"
        colliders="cuboid"
        position={[3, 0.5, 0]}
        mass={5}
        friction={0.5}
        restitution={0.1}
        linearDamping={0.5}
        angularDamping={0.5}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#ffff00"
            roughness={0.7}
            metalness={0.3}
          />
        </mesh>
      </RigidBody>

      {/* MEDIUM CUBE 2 - Moderate (Orange) - Mass: 5kg */}
      <RigidBody
        type="dynamic"
        colliders="cuboid"
        position={[5, 0.5, 0]}
        mass={5}
        friction={0.5}
        restitution={0.1}
        linearDamping={0.5}
        angularDamping={0.5}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#ffa500"
            roughness={0.7}
            metalness={0.3}
          />
        </mesh>
      </RigidBody>

      {/* HEAVY CUBE 1 - Hard to push (Red) - Mass: 15kg */}
      <RigidBody
        type="dynamic"
        colliders="cuboid"
        position={[-5, 0.5, 3]}
        mass={15}
        friction={0.6}
        restitution={0.05}
        linearDamping={0.5}
        angularDamping={0.5}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#ff0000"
            roughness={0.8}
            metalness={0.4}
          />
        </mesh>
      </RigidBody>

      {/* HEAVY CUBE 2 - Hard to push (Dark Red) - Mass: 15kg */}
      <RigidBody
        type="dynamic"
        colliders="cuboid"
        position={[-3, 0.5, 3]}
        mass={15}
        friction={0.6}
        restitution={0.05}
        linearDamping={0.5}
        angularDamping={0.5}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#8b0000"
            roughness={0.8}
            metalness={0.4}
          />
        </mesh>
      </RigidBody>

      {/* VERY HEAVY CUBE - Very hard to push (Purple) - Mass: 30kg */}
      <RigidBody
        type="dynamic"
        colliders="cuboid"
        position={[0, 0.5, 3]}
        mass={30}
        friction={0.7}
        restitution={0}
        linearDamping={0.5}
        angularDamping={0.5}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#8b008b"
            roughness={0.9}
            metalness={0.5}
          />
        </mesh>
      </RigidBody>

      {/* SUPER LIGHT CUBE - Flies away easily (Cyan) - Mass: 0.5kg */}
      <RigidBody
        type="dynamic"
        colliders="cuboid"
        position={[3, 0.5, 3]}
        mass={0.5}
        friction={0.3}
        restitution={0.3}
        linearDamping={0.3}
        angularDamping={0.3}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#00ffff"
            roughness={0.5}
            metalness={0.1}
          />
        </mesh>
      </RigidBody>

      {/* STACK OF LIGHT CUBES - Fun to knock over - Mass: 2kg each */}
      {[0, 1, 2].map((i) => (
        <RigidBody
          key={`stack-${i}`}
          type="dynamic"
          colliders="cuboid"
          position={[5, 0.5 + i * 1.05, 3]}
          mass={2}
          friction={0.5}
          restitution={0.1}
          linearDamping={0.5}
          angularDamping={0.5}
        >
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={i === 0 ? "#90ee90" : i === 1 ? "#98fb98" : "#adff2f"}
              roughness={0.7}
              metalness={0.2}
            />
          </mesh>
        </RigidBody>
      ))}

      {/* LARGE HEAVY BOX - Like a crate (Brown) - Mass: 50kg */}
      <RigidBody
        type="dynamic"
        colliders="cuboid"
        position={[-7, 0.75, 6]}
        mass={50}
        friction={0.8}
        restitution={0}
        linearDamping={0.5}
        angularDamping={0.5}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.5, 1.5, 1.5]} />
          <meshStandardMaterial
            color="#8b4513"
            roughness={0.9}
            metalness={0.1}
          />
        </mesh>
      </RigidBody>

      {/* TINY LIGHT CUBE - Kicks far (White) - Mass: 0.2kg */}
      <RigidBody
        type="dynamic"
        colliders="cuboid"
        position={[7, 0.25, 2]}
        mass={0.2}
        friction={0.2}
        restitution={0.5}
        linearDamping={0.2}
        angularDamping={0.2}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial
            color="#ffffff"
            roughness={0.4}
            metalness={0.1}
          />
        </mesh>
      </RigidBody>

      {/* DEBUG TEST CUBE - Heavy, no rotation (Black) - Mass: 40kg - For testing jump hang issue */}
      <RigidBody
        type="dynamic"
        colliders="cuboid"
        position={[0, 0.5, -3]}
        mass={40}
        friction={0.5}
        restitution={0}
        lockRotations
        linearDamping={0.5}
        angularDamping={0.5}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#000000"
            roughness={0.9}
            metalness={0.1}
          />
        </mesh>
      </RigidBody>

      {/* ========== DECORATIVE STEPS - WITH CUBOID COLLIDERS ========== */}

      {/* STEP 0 - Extra small height */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[-8, 0.05, -6]}
        friction={1}
      >
        <CuboidCollider args={[1, 0.05, 1]} friction={1} restitution={0} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[2, 0.1, 2]} />
          <TileMaterial />
        </mesh>
      </RigidBody>

      {/* STEP 1 - Smallest height */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[-8, 0.1, -3]}
        friction={1}
      >
        <CuboidCollider args={[1, 0.1, 1]} friction={1} restitution={0} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[2, 0.2, 2]} />
          <TileMaterial />
        </mesh>
      </RigidBody>

      {/* STEP 2 - Medium-low height */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[-8, 0.2, 0]}
        friction={1}
      >
        <CuboidCollider args={[1, 0.2, 1]} friction={1} restitution={0} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[2, 0.4, 2]} />
          <TileMaterial />
        </mesh>
      </RigidBody>

      {/* STEP 3 - Medium-high height */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[-8, 0.3, 3]}
        friction={1}
      >
        <CuboidCollider args={[1, 0.3, 1]} friction={1} restitution={0} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[2, 0.6, 2]} />
          <TileMaterial />
        </mesh>
      </RigidBody>

      {/* STEP 4 - Tallest height */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[-8, 0.4, 6]}
        friction={1}
      >
        <CuboidCollider args={[1, 0.4, 1]} friction={1} restitution={0} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[2, 0.8, 2]} />
          <TileMaterial />
        </mesh>
      </RigidBody>

      {/* ========== MINI STAIRCASE - 0.1 unit increments ========== */}
      {[...Array(25)].map((_, i) => (
        <RigidBody
          key={`mini-step-${i}`}
          type="fixed"
          colliders={false}
          position={[5, i * 0.1 + 0.05, -8 + i * 0.3]}
          friction={1}
        >
          <CuboidCollider args={[1, 0.05, 0.15]} friction={1} restitution={0} />
          <mesh castShadow receiveShadow>
            <boxGeometry args={[2, 0.1, 0.3]} />
            <TileMaterial />
          </mesh>
        </RigidBody>
      ))}

      {/* ========== ELEVATOR - Moves up and down ========== */}
      <RigidBody
        ref={elevatorRef}
        type="kinematicVelocity"
        colliders={false}
        position={[-15, 2.5, -10]}
        friction={2}
        restitution={0}
      >
        <CuboidCollider args={[1.5, 0.15, 1.5]} friction={2} restitution={0} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[3, 0.3, 3]} />
          <TileMaterial />
        </mesh>
      </RigidBody>

      {/* ========== CROUCH OBSTACLES - LOW BARRIERS ========== */}
      {/* Barrier bars - HORIZONTAL with hull collision (can duck under) */}
      {[25, 28, 31, 34].map((z, i) => (
        <RigidBody
          key={`barrier-bar-${i}`}
          type="fixed"
          colliders="hull"
          position={[-25, 1.2, z]}
          friction={0}
        >
          <mesh castShadow receiveShadow rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[0.15, 0.15, 4.4]} />
            <meshStandardMaterial
              color="#ffaa00"
              roughness={0.3}
              metalness={0.7}
            />
          </mesh>
        </RigidBody>
      ))}

      {/* Side posts for barriers - THESE have collision */}
      {[25, 28, 31, 34].map((z, i) => (
        <group key={`barrier-posts-${i}`}>
          {/* Left post */}
          <RigidBody type="fixed" colliders="cuboid" position={[-27.2, 0.7, z]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.2, 1.4, 0.2]} />
              <TileMaterial />
            </mesh>
          </RigidBody>
          {/* Right post */}
          <RigidBody type="fixed" colliders="cuboid" position={[-22.8, 0.7, z]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.2, 1.4, 0.2]} />
              <TileMaterial />
            </mesh>
          </RigidBody>
        </group>
      ))}

      {/* ========== NARROW BALANCE BEAM ========== */}
      {/* Elevated beam - 0.4m wide, 10m long, 1.5m high - Only top surface has collision */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[25, 1.5, -25]}
        friction={1}
      >
        <CuboidCollider args={[0.2, 0.1, 5]} friction={1} restitution={0} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.4, 0.2, 10]} />
          <TileMaterial />
        </mesh>
      </RigidBody>

      {/* Support pillars for beam */}
      <mesh castShadow receiveShadow position={[25, 0.75, -30]}>
        <boxGeometry args={[0.6, 1.5, 0.6]} />
        <TileMaterial />
      </mesh>
      <mesh castShadow receiveShadow position={[25, 0.75, -25]}>
        <boxGeometry args={[0.6, 1.5, 0.6]} />
        <TileMaterial />
      </mesh>
      <mesh castShadow receiveShadow position={[25, 0.75, -20]}>
        <boxGeometry args={[0.6, 1.5, 0.6]} />
        <TileMaterial />
      </mesh>

      {/* ========== CROUCH TUNNEL (CYLINDER) ========== */}
      {/* Main tunnel cylinder - WITH TRIMESH COLLISION (walkable inside!) */}
      <RigidBody
        type="fixed"
        colliders="trimesh"
        position={[25, 0.8, 25]}
        rotation={[0, 0, Math.PI / 2]}
        friction={0.5}
      >
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[1.0, 1.0, 10, 24, 1, true]} />
          <meshStandardMaterial
            color="#888888"
            roughness={0.8}
            metalness={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
      </RigidBody>

      {/* ========== LOW BRIDGE (Test Forced Crouch) ========== */}
      {/* Bridge deck - walkable surface */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[-30, 1.5, -30]}
        friction={1}
      >
        <CuboidCollider args={[3, 0.15, 2]} friction={1} restitution={0} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[6, 0.3, 4]} />
          <TileMaterial />
        </mesh>
      </RigidBody>

      {/* Bridge ceiling - LOW (1.3m clearance, forces crouch) */}
      <RigidBody
        type="fixed"
        colliders="hull"
        position={[-30, 2.6, -30]}
        friction={0}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[6, 0.2, 4]} />
          <meshStandardMaterial
            color="#6b5d4f"
            roughness={0.9}
            metalness={0.1}
          />
        </mesh>
      </RigidBody>

      {/* Bridge support pillars */}
      <mesh castShadow receiveShadow position={[-33, 0.75, -32]}>
        <boxGeometry args={[0.4, 1.5, 0.4]} />
        <TileMaterial />
      </mesh>
      <mesh castShadow receiveShadow position={[-27, 0.75, -32]}>
        <boxGeometry args={[0.4, 1.5, 0.4]} />
        <TileMaterial />
      </mesh>
      <mesh castShadow receiveShadow position={[-33, 0.75, -28]}>
        <boxGeometry args={[0.4, 1.5, 0.4]} />
        <TileMaterial />
      </mesh>
      <mesh castShadow receiveShadow position={[-27, 0.75, -28]}>
        <boxGeometry args={[0.4, 1.5, 0.4]} />
        <TileMaterial />
      </mesh>

      {/* ========== TRAMPOLINE / BOUNCE PAD ========== */}
      {/* Trampoline surface - HIGH restitution for bounce */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[30, 0.3, -20]}
        friction={0.5}
        restitution={2.5}
      >
        <CuboidCollider
          args={[1.5, 0.15, 1.5]}
          friction={0.5}
          restitution={2.5}
        />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[3, 0.3, 3]} />
          <meshStandardMaterial
            color="#00ff88"
            roughness={0.3}
            metalness={0.1}
            emissive="#00ff88"
            emissiveIntensity={0.2}
          />
        </mesh>
      </RigidBody>

      {/* Trampoline frame */}
      <mesh castShadow receiveShadow position={[30, 0.1, -20]}>
        <boxGeometry args={[3.4, 0.2, 3.4]} />
        <meshStandardMaterial color="#333333" roughness={0.8} metalness={0.3} />
      </mesh>

      {/* Trampoline support legs */}
      {[
        [28.5, -21.5],
        [31.5, -21.5],
        [28.5, -18.5],
        [31.5, -18.5],
      ].map(([x, z], i) => (
        <mesh key={`trampoline-leg-${i}`} position={[x, -0.1, z]}>
          <cylinderGeometry args={[0.1, 0.15, 0.4, 8]} />
          <meshStandardMaterial
            color="#333333"
            roughness={0.8}
            metalness={0.3}
          />
        </mesh>
      ))}

      {/* ========== MATERIAL SHOWCASE SPHERES ========== */}
      {enableMaterialSpheres && <SpheresMaterials />}

      {/* ========== SHADOW TEST PLANE ========== */}
      {/* Horizontal plane to test shadow casting onto grass below */}
      {enableShadowTestPlane && (
        <mesh
          castShadow
          receiveShadow={false}
          position={[0, shadowPlaneHeight, 0]}
          rotation={[0, 0, 0]}
        >
          <planeGeometry args={[shadowPlaneSize, shadowPlaneSize]} />
          <meshStandardMaterial
            color="#ff0000"
            side={THREE.DoubleSide}
            transparent={true}
            opacity={0.7}
            roughness={0.5}
            metalness={0.1}
          />
        </mesh>
      )}
    </group>
  );
};
