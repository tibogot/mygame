import React from "react";
import { RigidBody, CuboidCollider } from "@react-three/rapier";

export const ParkourCourse = () => {
  return (
    <group>
      {/* LONG CONTINUOUS SLOPE - Perfect for testing!
          Starts at ground level (y=0) and goes up gradually
          15° angle - challenging but climbable */}
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
          <meshStandardMaterial
            color="#4a9eff"
            roughness={0.9}
            metalness={0.1}
          />
        </mesh>
      </RigidBody>

      {/* LONG DOWNWARD SLOPE - Test running down */}
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
          <meshStandardMaterial
            color="#50c878"
            roughness={0.9}
            metalness={0.1}
          />
        </mesh>
      </RigidBody>

      {/* TEST SLOPE 1 - Very gentle (5 degrees) - BLUE */}
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
          <meshStandardMaterial color="blue" roughness={0.8} />
        </mesh>
      </RigidBody>

      {/* TEST SLOPE 2 - Gentle (10 degrees) - GREEN */}
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
          <meshStandardMaterial color="green" roughness={0.8} />
        </mesh>
      </RigidBody>

      {/* TEST SLOPE 3 - Medium (20 degrees) - YELLOW */}
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
          <meshStandardMaterial color="yellow" roughness={0.8} />
        </mesh>
      </RigidBody>

      {/* TEST SLOPE 4 - Steep (30 degrees) - RED */}
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
          <meshStandardMaterial color="red" roughness={0.8} />
        </mesh>
      </RigidBody>

      {/* YELLOW STAIRS - Right side, normal step spacing */}
      {/* 10 steps, each 0.25m high and 0.5m deep */}
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
            <meshStandardMaterial color="yellow" roughness={0.8} />
          </mesh>
        </RigidBody>
      ))}

      {/* LANDING PLATFORM at top of yellow stairs */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[10, 2.5, 11.5]}
        friction={1}
      >
        <CuboidCollider args={[1.5, 0.15, 1]} friction={1} restitution={0} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[3, 0.3, 2]} />
          <meshStandardMaterial color="gold" roughness={0.7} metalness={0.3} />
        </mesh>
      </RigidBody>

      {/* BIG WALL 1 - Tall wall for jump testing (Front) */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[0, 2.5, 15]}
        friction={0}
      >
        <CuboidCollider args={[5, 2.5, 0.25]} friction={0} restitution={0} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[10, 5, 0.5]} />
          <meshStandardMaterial color="#8b4513" roughness={0.9} />
        </mesh>
      </RigidBody>

      {/* BIG WALL 2 - Tall wall (Left side) */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[-15, 2.5, 0]}
        friction={0}
      >
        <CuboidCollider args={[0.25, 2.5, 5]} friction={0} restitution={0} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.5, 5, 10]} />
          <meshStandardMaterial color="#696969" roughness={0.9} />
        </mesh>
      </RigidBody>

      {/* BIG WALL 3 - Tall wall (Right side) */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[15, 2.5, 0]}
        friction={0}
      >
        <CuboidCollider args={[0.25, 2.5, 5]} friction={0} restitution={0} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.5, 5, 10]} />
          <meshStandardMaterial color="#696969" roughness={0.9} />
        </mesh>
      </RigidBody>

      {/* BIG WALL 4 - Very tall wall (Behind spawn) */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[0, 3, -10]}
        friction={0}
      >
        <CuboidCollider args={[8, 3, 0.25]} friction={0} restitution={0} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[16, 6, 0.5]} />
          <meshStandardMaterial color="#556b2f" roughness={0.9} />
        </mesh>
      </RigidBody>

      {/* CORNER WALL - Test corner collisions */}
      <RigidBody
        type="fixed"
        colliders={false}
        position={[-10, 2, -5]}
        friction={0}
      >
        <CuboidCollider args={[0.25, 2, 3]} friction={0} restitution={0} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.5, 4, 6]} />
          <meshStandardMaterial color="#2f4f4f" roughness={0.9} />
        </mesh>
      </RigidBody>

      {/* ========== PHYSICS CUBES - PUSHABLE OBJECTS ========== */}

      {/* LIGHT CUBE 1 - Very easy to push (Green) - Mass: 1kg */}
      <RigidBody
        type="dynamic"
        colliders="cuboid"
        position={[-5, 0.5, 0]}
        mass={1}
        friction={0.5}
        restitution={0.1}
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
    </group>
  );
};
