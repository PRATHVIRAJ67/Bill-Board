import { Suspense, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import * as THREE from "three";
import { useQuality } from "@/lib/quality";
import HeroScene from "./HeroScene";

function ProgressReporter({ onProgress }) {
  const progress = useProgress((s) => s.progress);
  useEffect(() => onProgress?.(progress), [progress, onProgress]);
  return null;
}

/**
 * Lazily loaded so the page shell, copy and CTA paint before three.js arrives.
 * Rendering is paused entirely (`frameloop="never"`) while the hero is off-screen.
 */
export default function HeroCanvas({ active = true, onProgress, ...sceneProps }) {
  // Nothing is drawn until every shader has compiled in the background
  // (KHR_parallel_shader_compile): drawing earlier would force the driver to
  // link each program synchronously, one after another, freezing the page.
  const running = active && sceneProps.ready;
  const initialDpr = useRef(useQuality.getState().dpr).current;
  return (
    <>
      <ProgressReporter onProgress={onProgress} />
      <Canvas
        dpr={initialDpr}
        frameloop={running ? "always" : "never"}
        shadows="soft"
        gl={{
          antialias: false, // AA is done in the composer (MSAA/SMAA per tier)
          alpha: false,
          stencil: false,
          depth: true,
          powerPreference: "high-performance",
        }}
        camera={{ fov: 56, near: 0.1, far: 1600, position: [0, 9, 26] }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NoToneMapping; // tone mapping happens once, in post
          gl.debug.checkShaderErrors = import.meta.env.DEV; // the info-log query blocks on link
          window.__boardGL = gl; // field debugging: renderer info / programs
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <Suspense fallback={null}>
          <HeroScene {...sceneProps} />
        </Suspense>
      </Canvas>
    </>
  );
}
