/*
 * GroundScatterTest Component - Testing with Basic Shapes
 *
 * Uses simple BoxGeometry and SphereGeometry to test BatchedMesh
 * without GLB file complexity
 */

import React, { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  extendBatchedMeshPrototype,
  createRadixSort,
} from "@three.ez/batched-mesh-extensions";

// Activate the BatchedMesh extensions
extendBatchedMeshPrototype();

interface GroundScatterTestProps {
  surfaceRef: React.RefObject<THREE.Mesh>;
  enabled?: boolean;
}

/**
 * Utility: Get a random point on the surface of a geometry
 */
function randomPointInGeometry(geom: THREE.BufferGeometry): THREE.Vector3 {
  const posAttr = geom.attributes.position as THREE.BufferAttribute;
  const index = geom.index ? geom.index.array : undefined;

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

  let u = Math.random();
  let v = Math.random();
  if (u + v > 1) {
    u = 1 - u;
    v = 1 - v;
  }
  const w = 1 - u - v;

  return new THREE.Vector3(
    a.x * u + b.x * v + c.x * w,
    a.y * u + b.y * v + c.y * w,
    a.z * u + b.z * v + c.z * w
  );
}

/**
 * Create BatchedMesh with basic geometry
 */
function createBasicBatchMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  count: number
): THREE.BatchedMesh {
  const vertexCount = geometry.attributes.position.count;
  const indexCount = geometry.index ? geometry.index.count : vertexCount;

  const batchedMesh = new THREE.BatchedMesh(
    count,
    vertexCount,
    indexCount,
    material
  );

  batchedMesh.customSort = createRadixSort(batchedMesh as THREE.BatchedMesh);
  batchedMesh.castShadow = true;
  batchedMesh.receiveShadow = true;

  const geometryId = batchedMesh.addGeometry(geometry);

  for (let j = 0; j < count; j++) {
    batchedMesh.addInstance(geometryId);
  }

  return batchedMesh;
}

/**
 * Spread instances in a SMALL AREA - NO rejection, direct placement!
 */
function spreadOverSurface(
  batch: THREE.BatchedMesh,
  surface: THREE.Mesh,
  minScale = 0.5,
  maxScale = 2.0,
  areaSize = 100
) {
  const m = new THREE.Matrix4();
  const surfaceY = surface.position.y;

  for (let i = 0; i < batch.instanceCount; i++) {
    // Direct random position in bounded area
    const x = (Math.random() - 0.5) * areaSize;
    const z = (Math.random() - 0.5) * areaSize;
    const y = surfaceY + 1; // 1 unit above ground so visible

    // Random Y rotation
    m.makeRotationY(Math.PI * 2 * Math.random());

    // Set position
    m.setPosition(x, y, z);

    // Random scale
    const s = minScale + Math.random() * (maxScale - minScale);
    m.scale(new THREE.Vector3(s, s, s));

    batch.setMatrixAt(i, m);
  }

  batch.computeBVH(THREE.WebGLCoordinateSystem);
}

export const GroundScatterTest = ({
  surfaceRef,
  enabled = true,
}: GroundScatterTestProps) => {
  const { scene } = useThree();
  const batchedMeshesRef = useRef<THREE.BatchedMesh[]>([]);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!enabled || !surfaceRef.current || isInitialized.current) return;

    const surface = surfaceRef.current;
    isInitialized.current = true;

    surface.updateMatrixWorld(true);

    // Create basic geometries - BIGGER and more visible!
    const boxGeometry = new THREE.BoxGeometry(1, 2, 1, 1, 2, 1); // Bigger box
    const sphereGeometry = new THREE.SphereGeometry(0.8, 8, 6); // Bigger sphere
    const coneGeometry = new THREE.ConeGeometry(0.6, 2, 6); // Bigger cone

    // Create materials
    const greenMaterial = new THREE.MeshStandardMaterial({
      color: 0x228b22,
      roughness: 0.8,
    });
    const redMaterial = new THREE.MeshStandardMaterial({
      color: 0xff4444,
      roughness: 0.6,
    });
    const yellowMaterial = new THREE.MeshStandardMaterial({
      color: 0xffff00,
      roughness: 0.7,
    });

    // Configuration - TIGHT clustering with BIGGER objects
    const objectsToSpread = [
      {
        name: "boxes (green)",
        geometry: boxGeometry,
        material: greenMaterial,
        count: 50, // Reduced to see them better
        minScale: 1.0,
        maxScale: 2.0,
        areaSize: 40, // Tight 40×40 area
      },
      {
        name: "spheres (red)",
        geometry: sphereGeometry,
        material: redMaterial,
        count: 30,
        minScale: 1.0,
        maxScale: 2.0,
        areaSize: 30, // Very tight 30×30 area
      },
      {
        name: "cones (yellow)",
        geometry: coneGeometry,
        material: yellowMaterial,
        count: 40,
        minScale: 1.0,
        maxScale: 2.0,
        areaSize: 35, // Tight 35×35 area
      },
    ];

    // Create and spread
    objectsToSpread.forEach((obj) => {
      const batchedMesh = createBasicBatchMesh(
        obj.geometry,
        obj.material,
        obj.count
      );

      spreadOverSurface(
        batchedMesh,
        surface,
        obj.minScale,
        obj.maxScale,
        obj.areaSize
      );

      scene.add(batchedMesh);
      batchedMeshesRef.current.push(batchedMesh);
    });

    // Cleanup
    return () => {
      batchedMeshesRef.current.forEach((mesh) => {
        scene.remove(mesh);
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      });
      batchedMeshesRef.current = [];
      isInitialized.current = false;
    };
  }, [enabled, surfaceRef, scene]);

  return null;
};
