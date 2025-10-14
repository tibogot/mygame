import React, { useMemo } from "react";
import * as THREE from "three";
import { InstancedMesh2Trees } from "./InstancedMesh2Trees";

/**
 * IMPOSTOR FOREST
 *
 * Demonstrates rendering thousands of trees using billboard impostors
 *
 * Performance: 1000+ trees at 60 FPS!
 */

interface ImpostorForestProps {
  centerPosition?: [number, number, number];
  radius?: number;
  minRadius?: number;
  treeCount?: number;
  modelPath?: string;
  enableImpostor?: boolean;
  useInstancing?: boolean;
  useLOD?: boolean;
  lodDistances?: { mid: number; low: number };
  simplificationRatios?: { mid: number; low: number };
  leavesOpacity?: number;
  leavesAlphaTest?: number;
  terrainMesh?: THREE.Mesh | null; // NEW: Optional terrain mesh for height sampling
}

/**
 * Get random point on the surface of a geometry (SAME as GroundScatterBatched!)
 */
function randomPointInGeometry(
  geom: THREE.BufferGeometry,
  mesh: THREE.Mesh
): THREE.Vector3 {
  const posAttr = geom.attributes.position as THREE.BufferAttribute;
  const index = geom.index ? geom.index.array : undefined;

  // Pick random triangle
  const triCount = index ? index.length / 3 : posAttr.count / 3;
  const triIndex = Math.floor(Math.random() * triCount);

  const getVertex = (i: number, target: THREE.Vector3) => {
    const idx = index ? index[i] : i;
    target.fromBufferAttribute(posAttr, idx);
    return target;
  };

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();

  getVertex(triIndex * 3 + 0, a);
  getVertex(triIndex * 3 + 1, b);
  getVertex(triIndex * 3 + 2, c);

  // Random barycentric coords
  let u = Math.random();
  let v = Math.random();
  if (u + v > 1) {
    u = 1 - u;
    v = 1 - v;
  }
  const w = 1 - u - v;

  // Interpolate point
  const point = new THREE.Vector3(
    a.x * u + b.x * v + c.x * w,
    a.y * u + b.y * v + c.y * w,
    a.z * u + b.z * v + c.z * w
  );

  // Transform to world space
  point.applyMatrix4(mesh.matrixWorld);

  return point;
}

export const ImpostorForest: React.FC<ImpostorForestProps> = ({
  centerPosition = [0, 0, 0],
  radius = 100,
  minRadius = 50,
  treeCount = 100,
  modelPath = "/octahedral-impostor-main/public/tree.glb",
  enableImpostor = true,
  useInstancing = true,
  useLOD = true,
  lodDistances = { mid: 100, low: 180 },
  simplificationRatios = { mid: 0.5, low: 0.2 },
  leavesOpacity = 1.0,
  leavesAlphaTest = 0.5,
  terrainMesh = null,
}) => {
  // Generate random tree positions - TERRAIN-AWARE!
  const treeInstances = useMemo(() => {
    console.log(`🌲 Generating ${treeCount} tree positions...`);

    if (terrainMesh) {
      console.log(`   🗺️ Using TERRAIN for tree placement!`);

      const instances = [];

      // Sample random points on terrain surface
      for (let i = 0; i < treeCount; i++) {
        const point = randomPointInGeometry(terrainMesh.geometry, terrainMesh);

        // Check if point is in the ring area (distance from center)
        const dx = point.x - centerPosition[0];
        const dz = point.z - centerPosition[2];
        const distance = Math.sqrt(dx * dx + dz * dz);

        // Only add if in ring (between minRadius and radius)
        if (distance >= minRadius && distance <= radius) {
          instances.push({
            position: [point.x, point.y, point.z] as [number, number, number],
            scale: 0.8 + Math.random() * 0.4, // Random scale 0.8-1.2
            rotation: Math.random() * Math.PI * 2, // Random rotation
          });
        } else {
          // Try again (retry until we get enough trees in ring)
          i--;
        }
      }

      console.log(`✅ ${instances.length} trees placed ON TERRAIN!`);
      console.log(`   Ring: ${minRadius}m to ${radius}m from center`);
      return instances;
    } else {
      // Fallback: Flat ring placement (original)
      console.log(`   Ring: ${minRadius}m to ${radius}m from center (FLAT)`);

      const instances = [];

      for (let i = 0; i < treeCount; i++) {
        // Random position in a RING (between minRadius and radius)
        const angle = Math.random() * Math.PI * 2;
        const distance = minRadius + Math.random() * (radius - minRadius);

        const x = centerPosition[0] + Math.cos(angle) * distance;
        const z = centerPosition[2] + Math.sin(angle) * distance;
        const y = centerPosition[1];

        instances.push({
          position: [x, y, z] as [number, number, number],
          scale: 0.8 + Math.random() * 0.4, // Random scale 0.8-1.2
          rotation: Math.random() * Math.PI * 2, // Random rotation
        });
      }

      console.log(`✅ ${treeCount} tree positions generated in flat ring!`);
      console.log(
        `   No trees within ${minRadius}m of center (keeps center clear)`
      );
      return instances;
    }
  }, [centerPosition, radius, minRadius, treeCount, terrainMesh]);

  // Use InstancedMesh2 from @three.ez/instanced-mesh
  // This is THE PROPER WAY - same author as octahedral-impostor!
  return (
    <InstancedMesh2Trees
      modelPath={modelPath}
      treePositions={treeInstances}
      useLOD={useLOD}
      lodDistances={lodDistances}
      simplificationRatios={simplificationRatios}
      leavesOpacity={leavesOpacity}
      leavesAlphaTest={leavesAlphaTest}
    />
  );
};

export default ImpostorForest;
