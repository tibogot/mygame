import React, { useRef, useMemo, useEffect } from "react";
import { extend, useThree, useFrame } from "@react-three/fiber";
import { EffectComposer, RenderPass } from "postprocessing";
import { N8AOPostPass } from "n8ao";
import { useControls } from "leva";
import * as THREE from "three";

// Extend for JSX
extend({ EffectComposer, RenderPass, N8AOPostPass });

/**
 * Simple N8AO integration test
 */
export const N8AOEffectSimple = () => {
  const { gl, scene, camera, size } = useThree();
  const composer = useRef();
  const n8aoPass = useRef();

  const { enabled, aoRadius, intensity } = useControls("N8AO Simple Test", {
    enabled: { value: false, label: "Enable N8AO" },
    aoRadius: { value: 2, min: 0.1, max: 10, step: 0.1 },
    intensity: { value: 3, min: 1, max: 10, step: 0.5 },
  });

  // Setup composer
  useMemo(() => {
    if (!enabled) return null;

    const comp = new EffectComposer(gl);
    comp.addPass(new RenderPass(scene, camera));

    const n8ao = new N8AOPostPass(scene, camera, size.width, size.height);
    n8ao.configuration.aoRadius = 2;
    n8ao.configuration.intensity = 3;
    comp.addPass(n8ao);

    composer.current = comp;
    n8aoPass.current = n8ao;

    console.log("N8AO Simple: Setup complete");

    return comp;
  }, [enabled, gl, scene, camera, size]);

  // Update config
  useEffect(() => {
    if (n8aoPass.current && enabled) {
      n8aoPass.current.configuration.aoRadius = aoRadius;
      n8aoPass.current.configuration.intensity = intensity;
    }
  }, [enabled, aoRadius, intensity]);

  // Render
  useFrame(() => {
    if (composer.current && enabled) {
      composer.current.render();
    }
  }, 1);

  return null;
};

export default N8AOEffectSimple;
