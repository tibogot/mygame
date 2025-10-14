import React, { useMemo, useRef, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OctahedralImpostor } from "../octahedral-impostor/core/octahedralImpostor";
import { MeshBasicMaterial } from "three";

/**
 * PROPER OCTAHEDRAL IMPOSTOR
 *
 * Using the actual agargaro/octahedral-impostor implementation
 *
 * IMPORTANT: Currently using tree.glb from the repository
 * (/octahedral-impostor-main/public/tree.glb)
 *
 * This ensures we're testing with the EXACT same assets
 * as the original repository for proper debugging!
 */

interface MountainImpostorProperProps {
  position?: [number, number, number];
  scale?: number;
  useImpostor?: boolean;
  modelPath?: string;
}

export const MountainImpostorProper: React.FC<MountainImpostorProperProps> = ({
  position = [0, 0, 0],
  scale = 1,
  useImpostor = true,
  modelPath = "/octahedral-impostor-main/public/tree.glb", // Use repository's tree model
}) => {
  const { scene: treeScene } = useGLTF(modelPath);
  const { gl } = useThree();
  const impostorRef = useRef<OctahedralImpostor | null>(null);
  const meshRef = useRef<THREE.Object3D>(null);

  // Clone and prepare the tree model (same as repository example)
  const preparedMesh = useMemo(() => {
    const cloned = treeScene.clone();

    // Center the model
    const box = new THREE.Box3().setFromObject(cloned);
    const center = new THREE.Vector3();
    box.getCenter(center);

    cloned.children.forEach((child) => {
      child.position.sub(center);
    });

    // Apply basic material for impostor baking
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const oldMaterial = mesh.material as THREE.MeshStandardMaterial;

        // Use MeshBasicMaterial with solid color if no texture
        const materialConfig: any = {
          alphaTest: oldMaterial.map ? 0.5 : 0,
          transparent: false,
        };

        if (oldMaterial.map) {
          materialConfig.map = oldMaterial.map;
        } else {
          materialConfig.color = "#8B7355"; // Brown rock color
        }

        mesh.material = new MeshBasicMaterial(materialConfig);

        if (mesh.material.map) {
          mesh.material.map.generateMipmaps = false;
        }
      }
    });

    return cloned;
  }, [treeScene]);

  // Create impostor
  const impostor = useMemo(() => {
    if (!useImpostor || !gl) {
      console.log("🏔️ Impostor disabled, using full 3D model");
      return null;
    }

    console.log("🚀 Creating octahedral impostor...");
    console.log("Target mesh:", preparedMesh);
    console.log("Renderer:", gl);

    try {
      const imp = new OctahedralImpostor({
        renderer: gl,
        target: preparedMesh,
        useHemiOctahedron: true,
        transparent: false,
        spritesPerSide: 8,
        textureSize: 2048,
        alphaClamp: 0.4,
        baseType: MeshBasicMaterial,
      });

      console.log("✅ Impostor created successfully!", imp);
      return imp;
    } catch (error) {
      console.error("❌ Failed to create impostor:", error);
      return null;
    }
  }, [gl, preparedMesh, useImpostor]);

  // Update impostor position and scale
  useEffect(() => {
    if (impostor) {
      impostor.position.set(...position);
      impostor.scale.multiplyScalar(scale);
    }
  }, [impostor, position, scale]);

  // Render impostor or fallback to 3D model
  if (useImpostor && impostor) {
    return <primitive object={impostor} ref={impostorRef} />;
  }

  // Fallback: render full 3D model with proper materials
  const fullTree = useMemo(() => {
    const cloned = treeScene.clone();
    const box = new THREE.Box3().setFromObject(cloned);
    const center = new THREE.Vector3();
    box.getCenter(center);

    cloned.children.forEach((child) => {
      child.position.sub(center);
    });

    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshStandardMaterial({
          color: "#8B7355",
          roughness: 0.9,
          metalness: 0.1,
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    return cloned;
  }, [treeScene]);

  return (
    <primitive
      ref={meshRef}
      object={fullTree}
      position={position}
      scale={scale}
    />
  );
};

export default MountainImpostorProper;
