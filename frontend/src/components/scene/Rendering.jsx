import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, ToneMapping, SMAA, Noise } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { useQuality } from "@/lib/quality";
import { getWindowCardTexture } from "./textures";
import { BILLBOARD_Z, LAMP_SPACING, LAMP_X, LAMP_Y, LAMP_Z0, SCREEN_H, SCREEN_W, STREET_MIN, inCrossStreet } from "./layout";
import { hero, scrollOffset, wrapZ } from "./motion";

let rectLib = false;

/* ---------------------------------------------------------------- Lighting
 * Night cinematography, physically lit:
 *  - the LED screen is a real rect area light (tier ≥ medium): it lights road,
 *    cars, structure and facades with true area-light speculars on wet asphalt
 *  - real spot lights at the street lamps nearest the lens (count per tier);
 *    farther lamps are carried by the facade shader + painted pools
 *  - faint cool moonlight for shadow shape, cool hemisphere ambient
 *  - image-based lighting baked once from cards that mirror this street
 *    (screen, lamp rows, lit window walls) so paint and glass reflect the city
 */
export const Lighting = memo(function Lighting({ layout, shadows, shadowMapSize, envRes, areaLight, lampLights }) {
  const key = useRef();
  const target = useRef();
  const rect = useRef();
  const [cx, , cz] = layout.car.pos;
  const s = layout.bb.s;
  const windows = getWindowCardTexture();

  if (areaLight && !rectLib) {
    RectAreaLightUniformsLib.init();
    rectLib = true;
  }

  useLayoutEffect(() => {
    if (key.current && target.current) key.current.target = target.current;
  }, []);
  // the shadow frustum is only ±10 m: keep it over the moving car
  useFrame(() => {
    if (key.current) key.current.position.z = cz + 16 + hero.z;
    if (target.current) target.current.position.z = cz - 2 + hero.z;
  });
  useLayoutEffect(() => {
    rect.current?.lookAt(0, layout.bb.y * 0.25, 20);
  }, [areaLight, layout.bb.y]);

  useEffect(() => {
    const l = key.current;
    if (!l) return;
    l.castShadow = shadows;
    if (shadows && l.shadow.mapSize.x !== shadowMapSize) {
      l.shadow.mapSize.set(shadowMapSize, shadowMapSize);
      l.shadow.map?.dispose();
      l.shadow.map = null;
    }
  }, [shadows, shadowMapSize]);

  // real lights ride on the lamps nearest the lens (slot 0 = the lamp passing
  // beside the car, then ahead); handed from lamp to lamp with smooth fades
  const spots = useMemo(() => {
    const out = [];
    for (let i = 0; out.length < lampLights; i++) for (const side of [-1, 1]) if (out.length < lampLights) out.push({ side, slot: i });
    return out;
  }, [lampLights]);
  const slots = Math.ceil(lampLights / 2);

  return (
    <>
      <hemisphereLight args={["#34485e", "#0b0c0e", 0.32]} />
      {/* moonlight through thin overcast: cool, soft, gives the car a grounded shadow */}
      <directionalLight
        ref={key}
        position={[cx - 10, 30, cz + 16]}
        intensity={0.45}
        color="#aebfda"
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-camera-near={1}
        shadow-camera-far={90}
      />
      <object3D ref={target} position={[cx, 0, cz - 2]} />

      {areaLight && (
        <rectAreaLight
          ref={rect}
          position={[0, layout.bb.y, BILLBOARD_Z + 0.35 * s]}
          width={SCREEN_W * s}
          height={SCREEN_H * s}
          intensity={5.5}
          color="#b8d2ff"
        />
      )}

      {spots.map((l) => (
        <SpotLamp key={`${l.side}${l.slot}`} x={l.side * LAMP_X} side={l.side} slot={l.slot} slots={slots} />
      ))}

      <Environment resolution={envRes} frames={1} environmentIntensity={1}>
        <color attach="background" args={["#030507"]} />
        {/* the billboard */}
        <Lightformer form="rect" intensity={2.2} color="#9fcfff" position={[0, 15, -28]} scale={[30, 13, 1]} />
        <Lightformer form="rect" intensity={1.1} color="#ffd36b" position={[-8, 18, -27.5]} scale={[7, 3.5, 1]} />
        <Lightformer form="rect" intensity={1.1} color="#ff5b8a" position={[8, 13, -27.5]} scale={[7, 3.5, 1]} />
        {/* the street walls: lit windows reflected in paint and glass */}
        <Lightformer form="rect" intensity={1.6} map={windows} position={[-22, 16, -20]} rotation-y={Math.PI / 2} scale={[110, 30, 1]} />
        <Lightformer form="rect" intensity={1.6} map={windows} position={[22, 16, -20]} rotation-y={-Math.PI / 2} scale={[110, 30, 1]} />
        {/* lamp rows */}
        {[-1, 1].map((side) =>
          [0, 1, 2, 3, 4].map((i) => (
            <Lightformer key={`${side}${i}`} form="rect" intensity={8} color="#ffc98a" position={[side * LAMP_X, LAMP_Y, LAMP_Z0 - i * LAMP_SPACING]} rotation-x={Math.PI / 2} scale={[0.9, 0.35, 1]} />
          ))
        )}
        {/* light-polluted horizon down the avenue, overcast sky above */}
        <Lightformer form="rect" intensity={0.35} color="#4a4038" position={[0, 12, -120]} scale={[160, 24, 1]} />
        <Lightformer form="rect" intensity={0.2} color="#2a3a4c" position={[0, 40, 0]} rotation-x={Math.PI / 2} scale={[120, 120, 1]} />
      </Environment>
    </>
  );
});

const SPOT_I = 320;
const NEAR_EDGE = LAMP_Z0 + 12; // slot 0 spans [NEAR_EDGE - spacing, NEAR_EDGE)

function SpotLamp({ x, side, slot, slots }) {
  const light = useRef();
  const target = useRef();
  useLayoutEffect(() => {
    if (light.current && target.current) light.current.target = target.current;
  }, []);
  useFrame(() => {
    const L = light.current;
    if (!L) return;
    // lamps sit on LAMP_Z0 + scroll + 24k: find the one inside this slot
    const phase = (((scrollOffset() + LAMP_Z0 - NEAR_EDGE) % LAMP_SPACING) + LAMP_SPACING) % LAMP_SPACING;
    const z = NEAR_EDGE - LAMP_SPACING + phase - slot * LAMP_SPACING;
    L.position.z = z;
    target.current.position.z = z - 1;
    // fade out as it passes behind the lens, fade in at the far slot
    let w = 1;
    if (slot === 0) w *= 1 - THREE.MathUtils.smoothstep(z, NEAR_EDGE - 8, NEAR_EDGE);
    if (slot === slots - 1) w *= THREE.MathUtils.smoothstep(z, NEAR_EDGE - LAMP_SPACING * (slot + 1), NEAR_EDGE - LAMP_SPACING * (slot + 1) + 8);
    // no lamp at intersections → no light
    const base = wrapZ(z - scrollOffset());
    if (inCrossStreet(base, 2) || base < STREET_MIN) w = 0;
    L.intensity = SPOT_I * w;
  });
  return (
    <>
      <spotLight
        ref={light}
        position={[x, LAMP_Y - 0.1, 0]}
        angle={1.1}
        penumbra={0.85}
        decay={2}
        distance={60}
        intensity={SPOT_I}
        color="#ffc58a"
      />
      <object3D ref={target} position={[x - side * 3, 0, -1]} />
    </>
  );
}

/* --------------------------------------------------------------- Post FX */
export const Effects = memo(function Effects({ msaa, smaa, bloomLevels, bloomScale, grain }) {
  return (
    <EffectComposer multisampling={msaa} frameBufferType={THREE.HalfFloatType} enableNormalPass={false}>
      <Bloom
        mipmapBlur
        levels={bloomLevels}
        intensity={0.6}
        luminanceThreshold={1.0}
        luminanceSmoothing={0.35}
        radius={0.72}
        resolutionScale={bloomScale}
      />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <Vignette offset={0.3} darkness={0.55} />
      {grain ? <Noise opacity={0.06} blendFunction={BlendFunction.OVERLAY} /> : <></>}
      {smaa ? <SMAA /> : <></>}
    </EffectComposer>
  );
});

/* ------------------------------------------------------ Quality controller
 * Frame-time driven: dynamic resolution first, feature tier second.
 */
export function QualityController() {
  const setDpr = useThree((s) => s.setDpr);
  const dpr = useQuality((s) => s.dpr);
  useEffect(() => setDpr(dpr), [dpr, setDpr]);

  const acc = useRef({ last: 0, warm: 0, sum: 0, frames: 0, slow: 0, fast: 0, before: 0, verify: 0, capped: false });

  useFrame(() => {
    const a = acc.current;
    const now = performance.now();
    const dt = now - a.last;
    a.last = now;
    if (!dt || dt > 250) {
      // first frame, tab switch or frameloop resume — restart the window
      a.sum = a.frames = 0;
      return;
    }
    if (a.warm < 3000) {
      a.warm += dt; // skip shader compilation / texture upload hitches
      return;
    }
    a.sum += dt;
    a.frames++;
    if (a.sum < 1000) return;
    const avg = a.sum / a.frames;
    a.sum = a.frames = 0;

    const q = useQuality.getState();
    if (q.forced || a.capped) return;

    // After a tier drop, verify it helped; if not we are vsync/thermal capped.
    if (a.verify) {
      if (--a.verify === 0 && avg > a.before * 0.93) a.capped = true;
      return;
    }

    if (avg > 21.5) {
      a.fast = 0;
      if (q.dpr > q.settings.dprMin + 0.01) {
        q.setDpr(q.dpr * (avg > 33 ? 0.8 : 0.9));
      } else if (++a.slow >= 2) {
        a.slow = 0;
        a.before = avg;
        if (q.stepDown()) {
          a.warm = 0;
          a.verify = 3;
        }
      }
    } else if (avg < 17.2) {
      a.slow = 0;
      if (++a.fast >= 3) {
        a.fast = 0;
        q.setDpr(q.dpr + 0.1);
      }
    } else {
      a.slow = 0;
      a.fast = 0;
    }
  });
  return null;
}
