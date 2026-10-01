import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useQuality } from "@/lib/quality";
import { SPOTS } from "./spotData";
import { getLayout } from "./scene/layout";
import { Billboard } from "./scene/Billboard";
import { CameraRig } from "./scene/CameraRig";
import { Effects, Lighting, QualityController } from "./scene/Rendering";
import { HeroCar, Traffic } from "./scene/Vehicles";
import { City, FOG_COLOR, Road, Signals, Sky, Streetlights } from "./scene/World";
import { installAtmosphere } from "./scene/atmosphere";
import { street } from "./scene/motion";
import { HERO_SPEED } from "./scene/layout";

// height fog + in-scattering replaces three's flat fog for every material
installAtmosphere();

/** Sets the hero car's road speed before anything else reads it this frame.
 *  The street itself no longer scrolls: the billboard and city are fixed. */
function StreetClock({ reducedMotion }) {
  useFrame(() => {
    street.speed = reducedMotion ? HERO_SPEED * 0.5 : HERO_SPEED;
  }, -1);
  return null;
}

/** Compiles every shader up front, then reports ready after a few real frames. */
function SceneReady({ onReady }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    let cancelled = false;
    let fired = false;
    const done = () => {
      if (fired) return;
      fired = true;
      let frames = 0;
      const tick = () => {
        if (cancelled) return;
        if (++frames >= 3) onReady?.();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    // Compile against an offscreen target: frames are drawn into the composer's
    // HDR buffer (linear output), so programs compiled for the canvas (sRGB
    // output) would all be recompiled — synchronously — on the first frame.
    const probe = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(probe);
    const compile = gl.compileAsync ? gl.compileAsync(scene, camera) : Promise.resolve(gl.compile(scene, camera));
    gl.setRenderTarget(prev);
    compile.finally(() => probe.dispose());
    compile.then(done, done);
    // never let a slow driver hold the loader hostage
    const failsafe = setTimeout(done, 25000);
    return () => {
      cancelled = true;
      clearTimeout(failsafe);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function HeroScene({
  cameraMode = "cinematic",
  zoomStep = 0,
  hoveredId,
  selectedId,
  onHover,
  onSelect,
  resetTick = 0,
  spots = SPOTS,
  reducedMotion = false,
  ready = false,
  onReady,
}) {
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const gl = useThree((s) => s.gl);
  const q = useQuality((s) => s.settings);
  const layout = useMemo(() => getLayout(width, height), [width, height]);
  const anisotropy = useMemo(() => Math.min(16, gl.capabilities.getMaxAnisotropy()), [gl]);
  const list = spots && spots.length ? spots : SPOTS;
  const selectedIndex = selectedId == null ? -1 : list.findIndex((s) => s.id === selectedId);

  return (
    <>
      <color attach="background" args={[FOG_COLOR]} />
      <fogExp2 attach="fog" args={[FOG_COLOR, 0.0058]} />

      <Sky />
      <Lighting layout={layout} shadows={q.shadows} shadowMapSize={q.shadowMapSize || 1024} envRes={q.envRes} areaLight={q.areaLight} lampLights={q.lampLights} />
      <Road reflector={q.reflector} anisotropy={anisotropy} lowPower={q.name === "low" || q.name === "medium"} />
      <City detail={q.cityDetail} interiors={q.interiors} areaLight={q.areaLight} bbY={layout.bb.y} />
      <StreetClock reducedMotion={reducedMotion} />
      <Streetlights beams={q.haze} />
      <Signals />
      <Traffic count={q.traffic} parked={q.parked} clearcoat={q.clearcoat} castShadow={q.shadows && q.trafficShadows} />
      <HeroCar layout={layout} clearcoat={q.clearcoat} reducedMotion={reducedMotion} castShadow={q.shadows} />
      <Billboard
        layout={layout}
        spots={list}
        hoveredId={hoveredId}
        selectedId={selectedId}
        onHover={onHover}
        onSelect={onSelect}
        atlasCell={q.atlasCell}
        haze={q.haze}
        anisotropy={anisotropy}
      />

      <CameraRig
        layout={layout}
        cameraMode={cameraMode}
        zoomStep={zoomStep}
        selectedIndex={selectedIndex}
        resetTick={resetTick}
        reducedMotion={reducedMotion}
        ready={ready}
      />
      <Effects msaa={q.msaa} smaa={q.smaa} bloomLevels={q.bloomLevels} bloomScale={q.bloomScale} grain={q.grain} />
      <QualityController />
      <SceneReady onReady={onReady} />
    </>
  );
}
