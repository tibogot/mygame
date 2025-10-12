import { KeyboardControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Experience } from "./components/Experience";
import { ControlsUI } from "./components/ControlsUI";
import * as THREE from "three";

const keyboardMap = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "backward", keys: ["ArrowDown", "KeyS"] },
  { name: "left", keys: ["ArrowLeft", "KeyA"] },
  { name: "right", keys: ["ArrowRight", "KeyD"] },
  { name: "run", keys: ["Shift"] },
  { name: "jump", keys: ["Space"] },
  { name: "dance", keys: ["KeyE"] }, // E key for dance
  { name: "walkBackward", keys: ["KeyQ"] }, // Q key for walk backward
  { name: "crouch", keys: ["ControlLeft", "ControlRight"] }, // Ctrl key for crouch
];

function App() {
  return (
    <KeyboardControls map={keyboardMap}>
      <ControlsUI />
      <Canvas
        shadows
        camera={{ position: [3, 3, 3], near: 0.1, fov: 40 }}
        style={{
          touchAction: "none",
        }}
        gl={{
          useLegacyLights: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
      >
        <Experience />
      </Canvas>
    </KeyboardControls>
  );
}

export default App;
