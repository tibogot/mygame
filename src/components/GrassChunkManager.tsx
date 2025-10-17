import * as THREE from "three";
import { GrassGeometryConfig } from "./GrassGeometry";

export interface GrassChunkManagerConfig {
  grassCount: number;
  enableDynamicChunks: boolean;
  chunkSize: number;
  areaSize: number;
  grassScale: number;
  grassScaleMultiplier: number;
  grassHeight: number;
  grassHeightMultiplier: number;
  bladesPerCluster: number;
  maxDistance: number;
  highDetailDistance: number;
  mediumDetailDistance: number;
  shadowCasting: boolean;
  shadowReceiving: boolean;
  getGroundHeight?: (x: number, z: number) => number;
}

export interface ChunkData {
  offsets: Float32Array;
  scales: Float32Array;
  rotations: Float32Array;
  windInfluences: Float32Array;
  grassTypes: Float32Array;
  lodLevelsArr: Float32Array;
  colorVariations: Float32Array;
  tipColorVariations: Float32Array;
  instanceIndex: number;
}

/**
 * GrassChunkManager - Extracted Chunk Management Logic for Grass System
 *
 * This component contains the chunk management logic that was previously
 * embedded in SimonDevGrass11. This separation makes the main component
 * much cleaner and easier to debug.
 */
export class GrassChunkManager {
  private activeChunks = new Map<string, THREE.InstancedMesh>();
  private chunkPool: THREE.InstancedMesh[] = [];
  private geometries: {
    high: THREE.PlaneGeometry;
    medium: THREE.PlaneGeometry;
    low: THREE.PlaneGeometry;
  };
  private material: THREE.ShaderMaterial | null = null;
  private depthMaterial: THREE.ShaderMaterial | null = null;
  private grassPerChunk: number = 2000;
  private isRegenerating: boolean = false;

  constructor(
    private config: GrassChunkManagerConfig,
    geometries: {
      high: THREE.PlaneGeometry;
      medium: THREE.PlaneGeometry;
      low: THREE.PlaneGeometry;
    },
    material: THREE.ShaderMaterial,
    depthMaterial: THREE.ShaderMaterial
  ) {
    this.geometries = geometries;
    this.material = material;
    this.depthMaterial = depthMaterial;
    this.grassPerChunk = Math.floor(config.grassCount / 16); // Approximate chunks
  }

  /**
   * Create chunk data for a specific area
   */
  private createChunkData(
    chunkX: number,
    chunkZ: number,
    grassCount: number,
    geometry: THREE.PlaneGeometry,
    bladesPerClusterValue: number,
    currentPlayerX: number,
    currentPlayerZ: number
  ): ChunkData {
    const {
      chunkSize,
      grassScale,
      grassScaleMultiplier,
      highDetailDistance,
      mediumDetailDistance,
      getGroundHeight,
    } = this.config;

    // Pre-allocate arrays for maximum efficiency
    const maxInstances = grassCount * bladesPerClusterValue;
    const offsets = new Float32Array(maxInstances * 3);
    const scales = new Float32Array(maxInstances);
    const rotations = new Float32Array(maxInstances);
    const windInfluences = new Float32Array(maxInstances);
    const grassTypes = new Float32Array(maxInstances);
    const lodLevelsArr = new Float32Array(maxInstances);
    const colorVariations = new Float32Array(maxInstances * 3);
    const tipColorVariations = new Float32Array(maxInstances * 3);

    let instanceIndex = 0;

    for (let idx = 0; idx < grassCount; idx++) {
      // Random position within chunk
      const localX = (Math.random() - 0.5) * chunkSize;
      const localZ = (Math.random() - 0.5) * chunkSize;
      const worldX = chunkX + localX;
      const worldZ = chunkZ + localZ;

      // Get ground height
      const groundHeight = getGroundHeight
        ? getGroundHeight(worldX, worldZ)
        : 0;

      // CRITICAL FIX: Always use FULL SCALE for all grass!
      // Let the SHADER handle ALL LOD scaling based on runtime distance.
      const scaleSeed = Math.sin(idx * 3.14159) * 12345.6789;
      const scaleValue = scaleSeed - Math.floor(scaleSeed);
      const scale =
        (0.6 + scaleValue * 0.8) * grassScale * grassScaleMultiplier;

      // LOD level for geometry complexity (this is still distance-based for chunk creation)
      const distFromPlayer = Math.sqrt(
        Math.pow(worldX - currentPlayerX, 2) +
          Math.pow(worldZ - currentPlayerZ, 2)
      );

      let lodLevel;
      if (distFromPlayer < highDetailDistance) {
        lodLevel = 0; // HIGH geometry detail
      } else if (distFromPlayer < mediumDetailDistance) {
        lodLevel = 1; // MEDIUM geometry detail
      } else {
        lodLevel = 2; // LOW geometry detail
      }

      const rotationSeed = Math.sin(idx * 2.71828) * 9876.5432;
      const windSeed = Math.sin(idx * 1.41421) * 2468.1357;
      const typeSeed = Math.sin(idx * 0.57721) * 1357.9246;

      // Color variations (shared by all blades in this cluster)
      const colorSeed1 = Math.sin(idx * 3.14159) * 11111.1111;
      const colorSeed2 = Math.sin(idx * 1.61803) * 22222.2222;
      const colorSeed3 = Math.sin(idx * 0.70711) * 33333.3333;

      const tipSeed1 = Math.sin(idx * 2.23607) * 44444.4444;
      const tipSeed2 = Math.sin(idx * 1.73205) * 55555.5555;
      const tipSeed3 = Math.sin(idx * 0.86603) * 66666.6666;

      // Create multiple blades at this position (cluster technique)
      for (let bladeIdx = 0; bladeIdx < bladesPerClusterValue; bladeIdx++) {
        // Same position for all blades in cluster
        offsets[instanceIndex * 3] = localX;
        offsets[instanceIndex * 3 + 1] = groundHeight;
        offsets[instanceIndex * 3 + 2] = localZ;

        // Same scale for all blades in cluster
        scales[instanceIndex] = scale;

        // Different rotation for each blade in cluster
        // Spread evenly: 0°, 120°, 240° for 3 blades
        const baseRotation =
          (rotationSeed - Math.floor(rotationSeed)) * Math.PI * 2;
        const clusterRotation =
          (bladeIdx / bladesPerClusterValue) * Math.PI * 2;
        rotations[instanceIndex] = baseRotation + clusterRotation;

        // Same wind influence for all blades in cluster
        windInfluences[instanceIndex] =
          0.3 + (windSeed - Math.floor(windSeed)) * 0.7;
        grassTypes[instanceIndex] = typeSeed - Math.floor(typeSeed);
        lodLevelsArr[instanceIndex] = lodLevel;

        // Same color variations for all blades in cluster
        colorVariations[instanceIndex * 3] =
          (colorSeed1 - Math.floor(colorSeed1) - 0.5) * 0.1;
        colorVariations[instanceIndex * 3 + 1] =
          (colorSeed2 - Math.floor(colorSeed2) - 0.5) * 0.2;
        colorVariations[instanceIndex * 3 + 2] =
          (colorSeed3 - Math.floor(colorSeed3) - 0.5) * 0.05;

        tipColorVariations[instanceIndex * 3] =
          (tipSeed1 - Math.floor(tipSeed1) - 0.5) * 0.2;
        tipColorVariations[instanceIndex * 3 + 1] =
          (tipSeed2 - Math.floor(tipSeed2) - 0.5) * 0.3;
        tipColorVariations[instanceIndex * 3 + 2] =
          (tipSeed3 - Math.floor(tipSeed3) - 0.5) * 0.1;

        instanceIndex++;
      }
    }

    return {
      offsets,
      scales,
      rotations,
      windInfluences,
      grassTypes,
      lodLevelsArr,
      colorVariations,
      tipColorVariations,
      instanceIndex,
    };
  }

  /**
   * Create a single chunk mesh
   */
  private createChunkMesh(
    chunkGeometry: THREE.PlaneGeometry
  ): THREE.InstancedMesh | null {
    if (!this.material || !this.depthMaterial) {
      return null;
    }

    const chunkData = this.createChunkData(
      0,
      0,
      this.grassPerChunk,
      chunkGeometry,
      this.config.bladesPerCluster,
      0,
      0
    );

    // Clone geometry for this chunk
    const chunkGeo = chunkGeometry.clone();
    chunkGeo.setAttribute(
      "offset",
      new THREE.InstancedBufferAttribute(
        chunkData.offsets.slice(0, chunkData.instanceIndex * 3),
        3
      )
    );
    chunkGeo.setAttribute(
      "scale",
      new THREE.InstancedBufferAttribute(
        chunkData.scales.slice(0, chunkData.instanceIndex),
        1
      )
    );
    chunkGeo.setAttribute(
      "rotation",
      new THREE.InstancedBufferAttribute(
        chunkData.rotations.slice(0, chunkData.instanceIndex),
        1
      )
    );
    chunkGeo.setAttribute(
      "windInfluence",
      new THREE.InstancedBufferAttribute(
        chunkData.windInfluences.slice(0, chunkData.instanceIndex),
        1
      )
    );
    chunkGeo.setAttribute(
      "grassType",
      new THREE.InstancedBufferAttribute(
        chunkData.grassTypes.slice(0, chunkData.instanceIndex),
        1
      )
    );
    chunkGeo.setAttribute(
      "lodLevel",
      new THREE.InstancedBufferAttribute(
        chunkData.lodLevelsArr.slice(0, chunkData.instanceIndex),
        1
      )
    );
    chunkGeo.setAttribute(
      "colorVariation",
      new THREE.InstancedBufferAttribute(
        chunkData.colorVariations.slice(0, chunkData.instanceIndex * 3),
        3
      )
    );
    chunkGeo.setAttribute(
      "tipColorVariation",
      new THREE.InstancedBufferAttribute(
        chunkData.tipColorVariations.slice(0, chunkData.instanceIndex * 3),
        3
      )
    );

    // Create chunk mesh
    const chunkMesh = new THREE.InstancedMesh(
      chunkGeo,
      this.material,
      chunkData.instanceIndex
    );

    // Enable optimizations
    chunkMesh.frustumCulled = false; // TODO: Re-enable for far chunks later
    chunkMesh.castShadow = this.config.shadowCasting;
    chunkMesh.receiveShadow = this.config.shadowReceiving;
    chunkMesh.customDepthMaterial = this.depthMaterial;

    // Set generous bounding box to prevent incorrect culling
    const boundingBox = new THREE.Box3();
    boundingBox.setFromCenterAndSize(
      new THREE.Vector3(0, 3, 0),
      new THREE.Vector3(
        this.config.chunkSize * 1.2,
        8,
        this.config.chunkSize * 1.2
      )
    );
    chunkMesh.geometry.boundingBox = boundingBox;

    return chunkMesh;
  }

  /**
   * Update chunk manager configuration
   */
  public updateConfig(newConfig: Partial<GrassChunkManagerConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.grassPerChunk = Math.floor(this.config.grassCount / 16);
  }

  /**
   * Update materials
   */
  public updateMaterials(
    material: THREE.ShaderMaterial,
    depthMaterial: THREE.ShaderMaterial
  ) {
    this.material = material;
    this.depthMaterial = depthMaterial;
  }

  /**
   * Get or create chunk from pool
   */
  public getChunk(chunkKey: string): THREE.InstancedMesh | null {
    // Try to get from pool first
    if (this.chunkPool.length > 0) {
      const chunk = this.chunkPool.pop()!;
      this.activeChunks.set(chunkKey, chunk);
      return chunk;
    }

    // Create new chunk if pool is empty
    const chunk = this.createChunkMesh(this.geometries.medium); // Default to medium detail
    if (chunk) {
      this.activeChunks.set(chunkKey, chunk);
    }
    return chunk;
  }

  /**
   * Return chunk to pool
   */
  public returnChunk(chunkKey: string) {
    const chunk = this.activeChunks.get(chunkKey);
    if (chunk) {
      this.activeChunks.delete(chunkKey);
      this.chunkPool.push(chunk);
    }
  }

  /**
   * Get all active chunks
   */
  public getActiveChunks(): Map<string, THREE.InstancedMesh> {
    return this.activeChunks;
  }

  /**
   * Clear all chunks
   */
  public clearChunks() {
    // Clear active chunks
    this.activeChunks.forEach((chunk) => {
      chunk.geometry.dispose();
    });
    this.activeChunks.clear();

    // Clear pool
    this.chunkPool.forEach((chunk) => {
      chunk.geometry.dispose();
    });
    this.chunkPool = [];
  }

  /**
   * Cleanup resources
   */
  public dispose() {
    this.clearChunks();
  }
}

export default GrassChunkManager;
