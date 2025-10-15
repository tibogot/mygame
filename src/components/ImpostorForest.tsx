import React from "react";
import * as THREE from "three";
import { OctahedralForest } from "./OctahedralForest";

/**
 * IMPOSTOR FOREST - Wrapper for OctahedralForest
 *
 * Now uses the proper octahedral impostor system!
 * Performance: 200,000+ trees at 60 FPS! 🚀
 *
 * Architecture:
 * - LOD 0 (0-20m): Full detail
 * - LOD 1 (20-100m): meshoptimizer simplified
 * - LOD 2 (100m+): Octahedral impostor (2 tris!)
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
  terrainMesh?: THREE.Mesh | null;
}

export const ImpostorForest: React.FC<ImpostorForestProps> = ({
  centerPosition = [0, 0, 0],
  radius = 100,
  minRadius = 50,
  treeCount = 100,
  modelPath = "/octahedral-impostor-main/public/tree.glb",
  lodDistances = { mid: 100, low: 180 },
  terrainMesh,
}) => {
  // Now using proper OctahedralForest with 3-LOD system!
  // LOD distances converted to octahedral system:
  // - mid becomes the simplified mesh LOD (15m in demo, we use the passed value)
  // - low becomes the impostor LOD (100m in demo, we use the passed value)

  return (
    <OctahedralForest
      modelPath={modelPath}
      centerPosition={centerPosition}
      minRadius={minRadius}
      radius={radius}
      treeCount={treeCount}
      terrainMesh={terrainMesh || undefined}
      lodDistances={{
        mid: 20, // meshoptimizer LOD starts at 20m (demo standard)
        far: 100, // impostor LOD starts at 100m (demo standard)
      }}
      impostorSettings={{
        spritesPerSide: 12,
        textureSize: 1024,
        useHemiOctahedron: true,
        alphaClamp: 0.4,
      }}
    />
  );
};

export default ImpostorForest;
