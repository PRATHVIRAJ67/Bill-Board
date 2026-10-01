import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";
import { disposeIt, useDisposable } from "./useDisposable";
import {
  getAggregateNormal, getCrosswalkTexture, getMarkingsTexture, getPavingTextures, getRadialTexture,
  getRoadTextures, getStreetSignTexture, MARKING_CYCLE, PAVING_TILE, ROAD_TILE_LEN, STREET_SIGN_ROWS,
} from "./textures";
import { generateCity } from "./cityGen";
import { createFacadeMaterial } from "./facadeMaterial";
import { HAZE } from "./atmosphere";
import {
  BILLBOARD_Z, CROSS_HALF_W, CROSS_STREETS, CURB_H, LAMP_COUNT, LAMP_FIRST, LAMP_SPACING, LAMP_X, LAMP_Y,
  ROAD_HALF_W, SIDEWALK_OUT, STREET_FAR, STREET_MIN, STREET_NEAR, STREET_PERIOD, inCrossStreet,
} from "./layout";
import { scrollOffset, wrapZ } from "./motion";

const ROAD_LEN = STREET_NEAR - STREET_FAR;
const ROAD_CZ = (STREET_NEAR + STREET_FAR) / 2;

/** Renders its children twice, one street period apart, sliding with the drive. */
function Scrolling({ children }) {
  const a = useRef();
  const b = useRef();
  useFrame(() => {
    const o = scrollOffset();
    if (a.current) a.current.position.z = o;
    if (b.current) b.current.position.z = o - STREET_PERIOD;
  });
  return (
    <>
      <group ref={a}>{children}</group>
      <group ref={b}>{children}</group>
    </>
  );
}

/* ------------------------------------------------------------------ Road */

/*
 * drei's reflector multiplies the mirror image into the *diffuse* albedo, which
 * vanishes on dark asphalt. Re-route it as specular radiance weighted by Fresnel
 * and by the wetness map, so only damp tyre tracks and puddles mirror the lights
 * while dry aggregate stays matte. Real asphalt, not a mirror.
 */
function patchWetReflector(material) {
  if (!material || material.userData.wetPatched) return;
  const base = material.onBeforeCompile;
  material.onBeforeCompile = function (shader, renderer) {
    base.call(this, shader, renderer);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "diffuseColor.rgb = diffuseColor.rgb * ((1.0 - min(1.0, mirror)) + newMerge.rgb * mixStrength);",
        `diffuseColor.rgb *= (1.0 - min(1.0, mirror));
      vec3 wetReflection = max(merge.rgb, 0.0) * mixStrength;`
      )
      .replace(
        "#include <opaque_fragment>",
        `float wetNv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        float wetFresnel = 0.03 + 0.97 * pow(1.0 - wetNv, 5.0);
        float wetGloss = 1.0 - smoothstep(0.05, 0.62, roughnessFactor);
        outgoingLight += wetReflection * wetFresnel * wetGloss;
        #include <opaque_fragment>`
      );
  };
  material.customProgramCacheKey = () => "wet-reflector-v2";
  material.userData.wetPatched = true;
  material.needsUpdate = true;
}

function roadMaps(lowPower, anisotropy, lengthM, widthM = ROAD_HALF_W * 2) {
  const src = getRoadTextures(lowPower, anisotropy);
  const map = src.map.clone();
  const roughnessMap = src.roughnessMap.clone();
  const normalMap = getAggregateNormal(anisotropy).clone();
  [map, roughnessMap].forEach((t) => t.repeat.set(widthM / (ROAD_HALF_W * 2), lengthM / ROAD_TILE_LEN));
  normalMap.repeat.set(widthM / 2.2, lengthM / 2.2);
  [map, roughnessMap, normalMap].forEach((t) => (t.needsUpdate = true));
  return { map, roughnessMap, normalMap };
}

export const Road = memo(function Road({ reflector, anisotropy, lowPower }) {
  const tex = useMemo(() => roadMaps(lowPower, anisotropy, ROAD_LEN), [lowPower, anisotropy]);
  const markings = useMemo(() => {
    const t = getMarkingsTexture(anisotropy).clone();
    t.repeat.set(1, ROAD_LEN / MARKING_CYCLE);
    t.needsUpdate = true;
    return t;
  }, [anisotropy]);
  const reflectorRef = useRef();
  useLayoutEffect(() => patchWetReflector(reflectorRef.current), [reflector]);

  // the tarmac and its paint slide toward the camera at road speed
  useFrame(() => {
    const s = scrollOffset();
    tex.map.offset.y = tex.roughnessMap.offset.y = (s / ROAD_TILE_LEN) % 1;
    tex.normalMap.offset.y = (s / 2.2) % 1;
    markings.offset.y = (s / MARKING_CYCLE) % 1;
  });

  const common = {
    map: tex.map,
    roughnessMap: tex.roughnessMap,
    roughness: 1,
    normalMap: tex.normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45),
    color: "#ffffff",
    metalness: 0,
  };

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, ROAD_CZ]} receiveShadow>
        <planeGeometry args={[ROAD_HALF_W * 2, ROAD_LEN]} />
        {reflector > 0 ? (
          <MeshReflectorMaterial
            ref={reflectorRef}
            key={reflector}
            resolution={reflector}
            blur={reflector >= 1024 ? [420, 120] : [260, 80]}
            mixBlur={1.6}
            mixStrength={0.8}
            mixContrast={1}
            mirror={0}
            depthScale={1.1}
            minDepthThreshold={0.25}
            maxDepthThreshold={1.3}
            depthToBlurRatioBias={0.3}
            envMapIntensity={0.35}
            {...common}
          />
        ) : (
          <meshStandardMaterial envMapIntensity={0.5} {...common} />
        )}
      </mesh>

      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, ROAD_CZ]} renderOrder={1}>
        <planeGeometry args={[ROAD_HALF_W * 2, ROAD_LEN]} />
        <meshStandardMaterial
          map={markings}
          transparent
          depthWrite={false}
          roughness={0.62}
          metalness={0}
          normalMap={tex.normalMap}
          normalScale={new THREE.Vector2(0.3, 0.3)}
          polygonOffset
          polygonOffsetFactor={-2}
        />
      </mesh>

      <Scrolling>
        <CrossStreets anisotropy={anisotropy} lowPower={lowPower} />
        <Sidewalks anisotropy={anisotropy} />
      </Scrolling>

      {/* ground plane under the blocks / alleys */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.03, ROAD_CZ]} receiveShadow>
        <planeGeometry args={[2400, ROAD_LEN + 800]} />
        <meshStandardMaterial color="#1a1b1d" roughness={0.95} />
      </mesh>
    </group>
  );
});

function CrossStreets({ anisotropy, lowPower }) {
  const len = 900;
  const tex = useMemo(() => roadMaps(lowPower, anisotropy, len, CROSS_HALF_W * 2), [lowPower, anisotropy]);
  const zebra = getCrosswalkTexture(anisotropy);
  return (
    <group>
      {CROSS_STREETS.map((z) => (
        <group key={z}>
          <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, -0.025, z]} receiveShadow>
            <planeGeometry args={[CROSS_HALF_W * 2, len]} />
            <meshStandardMaterial map={tex.map} roughnessMap={tex.roughnessMap} normalMap={tex.normalMap} normalScale={new THREE.Vector2(0.45, 0.45)} roughness={1} envMapIntensity={0.5} />
          </mesh>
          {[1, -1].map((s) => (
            <mesh key={s} rotation={[-Math.PI / 2, 0, s > 0 ? 0 : Math.PI]} position={[0, 0.008, z + s * (CROSS_HALF_W + 1.9)]} renderOrder={1}>
              <planeGeometry args={[ROAD_HALF_W * 2 - 0.6, 3.6]} />
              <meshStandardMaterial map={zebra} transparent depthWrite={false} roughness={0.6} polygonOffset polygonOffsetFactor={-2} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/* Sidewalk slabs with curbs, broken at each intersection — one street period. */
function Sidewalks({ anisotropy }) {
  const paving = getPavingTextures(anisotropy);
  const width = SIDEWALK_OUT - ROAD_HALF_W;
  const maps = useMemo(() => {
    const cuts = [...CROSS_STREETS].sort((a, b) => b - a);
    const segments = [];
    let start = STREET_NEAR;
    for (const c of cuts) {
      segments.push([start, c + CROSS_HALF_W]);
      start = c - CROSS_HALF_W;
    }
    segments.push([start, STREET_MIN]);
    return segments.map(([z0, z1]) => {
      const len = z0 - z1;
      const m = paving.map.clone();
      const r = paving.roughnessMap.clone();
      [m, r].forEach((t) => {
        t.repeat.set(width / PAVING_TILE, len / PAVING_TILE);
        t.needsUpdate = true;
      });
      return { m, r, len, cz: (z0 + z1) / 2 };
    });
  }, [paving, width]);

  return (
    <group>
      {[-1, 1].map((side) =>
        maps.map(({ m, r, len, cz }, i) => (
          <group key={`${side}${i}`}>
            <mesh rotation-x={-Math.PI / 2} position={[side * (ROAD_HALF_W + width / 2), CURB_H, cz]} receiveShadow>
              <planeGeometry args={[width, len]} />
              <meshStandardMaterial map={m} roughnessMap={r} roughness={1} envMapIntensity={0.5} />
            </mesh>
            {/* granite curb */}
            <mesh position={[side * (ROAD_HALF_W + 0.15), CURB_H / 2, cz]} receiveShadow>
              <boxGeometry args={[0.3, CURB_H, len]} />
              <meshStandardMaterial color="#6c6f73" roughness={0.78} />
            </mesh>
          </group>
        ))
      )}
    </group>
  );
}

/* ----------------------------------------------------------- Streetlights
 * Modern LED cobra-heads, one street period of them, riding with the drive.
 */
export const LAMPS = Array.from({ length: LAMP_COUNT }, (_, i) => LAMP_FIRST - i * LAMP_SPACING)
  .filter((z) => !inCrossStreet(z, 2))
  .flatMap((z) => [-1, 1].map((side) => ({ side, z })));

const beamVertex = /* glsl */ `
varying float vY;
varying vec3 vN;
varying vec3 vV;
void main() {
  vY = uv.y;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const beamFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vY;
varying vec3 vN;
varying vec3 vV;
void main() {
  float core = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);
  float fall = pow(clamp(vY, 0.0, 1.0), 1.6); // MSAA can extrapolate uv < 0: pow(neg) = NaN on NVIDIA
  gl_FragColor = vec4(uColor * core * fall * uOpacity, 1.0);
}`;

function LampSet({ beams, beamMat }) {
  const refs = useRef({});
  const glow = getRadialTexture();

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3(1, 1, 1);
    const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const tilt = (side) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -side * 0.08));
    const place = (key, fn) => {
      const mesh = refs.current[key];
      if (!mesh) return;
      LAMPS.forEach((l, i) => {
        sc.set(1, 1, 1);
        fn(l, p, q, sc);
        mesh.setMatrixAt(i, m.compose(p, q, sc));
      });
      mesh.count = LAMPS.length;
      mesh.instanceMatrix.needsUpdate = true;
    };
    const px = (l) => l.side * (ROAD_HALF_W + 0.9);
    const hx = (l) => l.side * LAMP_X;
    place("base", (l, p, q) => { p.set(px(l), CURB_H + 0.3, l.z); q.identity(); });
    place("pole", (l, p, q) => { p.set(px(l), 4.6, l.z); q.identity(); });
    place("arm", (l, p, q) => { p.set((px(l) + hx(l)) / 2, LAMP_Y + 0.3, l.z); q.copy(tilt(l.side)); });
    place("head", (l, p, q) => { p.set(hx(l), LAMP_Y + 0.12, l.z); q.identity(); });
    place("lens", (l, p, q) => { p.set(hx(l), LAMP_Y + 0.03, l.z); q.copy(flat); });
    place("beam", (l, p, q) => { p.set(hx(l), LAMP_Y / 2, l.z); q.identity(); });
    place("pool", (l, p, q, s) => { p.set(hx(l) + l.side * 0.6, 0.012, l.z); q.copy(flat); s.set(1.25, 1, 1); });
  }, [beams]);

  const set = (k) => (el) => { refs.current[k] = el; };
  const n = LAMPS.length;
  return (
    <group>
      <instancedMesh ref={set("base")} args={[undefined, undefined, n]} frustumCulled={false} receiveShadow>
        <cylinderGeometry args={[0.2, 0.26, 0.6, 12]} />
        <meshStandardMaterial color="#3a3f44" metalness={0.8} roughness={0.38} />
      </instancedMesh>
      <instancedMesh ref={set("pole")} args={[undefined, undefined, n]} castShadow frustumCulled={false}>
        <cylinderGeometry args={[0.075, 0.13, 9.2, 12]} />
        <meshStandardMaterial color="#3a3f44" metalness={0.8} roughness={0.38} />
      </instancedMesh>
      <instancedMesh ref={set("arm")} args={[undefined, undefined, n]} frustumCulled={false}>
        <boxGeometry args={[2.7, 0.08, 0.1]} />
        <meshStandardMaterial color="#3a3f44" metalness={0.8} roughness={0.38} />
      </instancedMesh>
      <instancedMesh ref={set("head")} args={[undefined, undefined, n]} frustumCulled={false}>
        <boxGeometry args={[0.95, 0.12, 0.4]} />
        <meshStandardMaterial color="#2d3236" metalness={0.75} roughness={0.32} />
      </instancedMesh>
      <instancedMesh ref={set("lens")} args={[undefined, undefined, n]} frustumCulled={false}>
        <planeGeometry args={[0.8, 0.3]} />
        <meshBasicMaterial color={[7, 5.2, 3.4]} toneMapped={false} side={THREE.DoubleSide} />
      </instancedMesh>
      {beams && (
        <instancedMesh ref={set("beam")} args={[undefined, undefined, n]} frustumCulled={false} renderOrder={3} material={beamMat}>
          <cylinderGeometry args={[0.3, 3.2, LAMP_Y, 24, 1, true]} />
        </instancedMesh>
      )}
      <instancedMesh ref={set("pool")} args={[undefined, undefined, n]} frustumCulled={false} renderOrder={2}>
        <planeGeometry args={[9, 9]} />
        <meshBasicMaterial map={glow} color="#ffb877" transparent opacity={0.09} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

export const Streetlights = memo(function Streetlights({ beams }) {
  const beamMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: beamVertex,
        fragmentShader: beamFragment,
        uniforms: { uColor: { value: new THREE.Color("#ffcf9a") }, uOpacity: { value: 0.055 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );
  useDisposable(beamMat, disposeIt);
  return (
    <Scrolling>
      <LampSet beams={beams} beamMat={beamMat} />
    </Scrolling>
  );
});

/* -------------------------------------------------------- Traffic signals */
const SIGNALS = CROSS_STREETS.flatMap((z, i) => [
  // far side, facing away-lane traffic → the lenses face the camera
  { x: -(ROAD_HALF_W + 1.2), z: z - CROSS_HALF_W - 1.2, face: 1, sign: i % STREET_SIGN_ROWS },
  // near side for oncoming traffic → we see the backs
  { x: ROAD_HALF_W + 1.2, z: z + CROSS_HALF_W + 1.2, face: -1, sign: (i + 1) % STREET_SIGN_ROWS },
]);
const ARM = 9;

function SignBlade({ texture, row, position, rotationY }) {
  const map = useMemo(() => {
    const t = texture.clone();
    t.repeat.set(1, 1 / STREET_SIGN_ROWS);
    t.offset.set(0, 1 - (row + 1) / STREET_SIGN_ROWS);
    t.needsUpdate = true;
    return t;
  }, [texture, row]);
  return (
    <mesh position={position} rotation-y={rotationY}>
      <planeGeometry args={[2.6, 0.34]} />
      <meshStandardMaterial map={map} roughness={0.5} side={THREE.DoubleSide} />
    </mesh>
  );
}

function SignalSet({ red, amber, green, signTex }) {
  return (
    <group>
      {SIGNALS.map((s, i) => {
        const dir = -Math.sign(s.x); // arm reaches over the road
        const rotY = s.face > 0 ? 0 : Math.PI;
        return (
          <group key={i}>
            <mesh position={[s.x, 3.6, s.z]} castShadow>
              <cylinderGeometry args={[0.11, 0.15, 7.2, 12]} />
              <meshStandardMaterial color="#26292c" metalness={0.7} roughness={0.45} />
            </mesh>
            <mesh position={[s.x + (dir * ARM) / 2, 6.9, s.z]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.07, 0.1, ARM, 10]} />
              <meshStandardMaterial color="#26292c" metalness={0.7} roughness={0.45} />
            </mesh>
            <SignBlade texture={signTex} row={s.sign} position={[s.x + dir * 2.4, 7.35, s.z]} rotationY={rotY} />
            {[ARM, ARM * 0.5].map((off) => (
              <group key={off} position={[s.x + dir * off, 6.2, s.z]} rotation-y={rotY}>
                <mesh>
                  <boxGeometry args={[0.42, 1.2, 0.32]} />
                  <meshStandardMaterial color="#1a1c1f" roughness={0.55} metalness={0.3} />
                </mesh>
                {[[red, 0.38], [amber, 0], [green, -0.38]].map(([mat, y], k) => (
                  <mesh key={k} position={[0, y, 0.165]} material={mat}>
                    <circleGeometry args={[0.12, 16]} />
                  </mesh>
                ))}
              </group>
            ))}
          </group>
        );
      })}
    </group>
  );
}

export const Signals = memo(function Signals() {
  const red = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  const amber = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  const green = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  const signTex = getStreetSignTexture();
  useFrame(({ clock }) => {
    // 20 s cycle: green 12, amber 3, red 5
    const t = clock.elapsedTime % 20;
    const g = t < 12 ? 1 : 0;
    const a = t >= 12 && t < 15 ? 1 : 0;
    const r = t >= 15 ? 1 : 0;
    red.color.setRGB(0.04 + r * 5.5, 0.01 + r * 0.25, 0.01);
    amber.color.setRGB(0.05 + a * 5.2, 0.03 + a * 2.2, 0);
    green.color.setRGB(0, 0.03 + g * 4.2, 0.02 + g * 2.4);
  });
  return (
    <Scrolling>
      <SignalSet red={red} amber={amber} green={green} signTex={signTex} />
    </Scrolling>
  );
});

/* ---------------------------------------------------------------- City
 * Street block (both building rows) drives past and wraps inside the haze;
 * the far skyline stays put with the billboard.
 */
export const City = memo(function City({ detail, interiors, areaLight, bbY }) {
  const gen = useMemo(() => generateCity({ detail }), [detail]);
  useDisposable(gen.street, disposeIt);
  useDisposable(gen.statics, disposeIt);
  const streetMat = useMemo(() => createFacadeMaterial({ interiors, scroll: true }), [interiors]);
  const staticMat = useMemo(() => createFacadeMaterial({ interiors }), [interiors]);
  useDisposable(streetMat, disposeIt);
  useDisposable(staticMat, disposeIt);

  useEffect(() => {
    for (const mat of [streetMat, staticMat]) {
      const u = mat.userData.uniforms;
      u.uBBI.value = areaLight ? 0 : 5200;
      u.uBBPos.value.set(0, bbY, BILLBOARD_Z + 1);
    }
  }, [streetMat, staticMat, areaLight, bbY]);

  const beacons = useMemo(() => [...gen.staticBeacons, ...gen.streetBeacons], [gen]);
  const beaconRef = useRef();
  const beaconMat = useRef();
  const m4 = useMemo(() => new THREE.Matrix4(), []);
  useLayoutEffect(() => {
    beacons.forEach((b, i) => beaconRef.current.setMatrixAt(i, m4.makeTranslation(b[0], b[1], b[2])));
    beaconRef.current.count = beacons.length;
    beaconRef.current.instanceMatrix.needsUpdate = true;
  }, [beacons, m4]);

  useFrame(({ clock }) => {
    const s = scrollOffset();
    for (const mat of [streetMat, staticMat]) {
      mat.userData.uniforms.uTime.value = clock.elapsedTime;
      mat.userData.uniforms.uScroll.value = s;
    }
    // rooftop beacons ride with their buildings (same wrap as the shader)
    const mesh = beaconRef.current;
    if (mesh) {
      for (let i = gen.staticBeacons.length; i < beacons.length; i++) {
        const [x, y, z, cz] = beacons[i];
        mesh.setMatrixAt(i, m4.makeTranslation(x, y, z + wrapZ(cz + s) - cz));
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    // aviation obstruction lights: slow synchronised pulse
    const on = Math.max(0, Math.sin(clock.elapsedTime * 1.4));
    if (beaconMat.current) beaconMat.current.color.setRGB(0.3 + on * 6, 0.02, 0.02);
  });

  return (
    <group>
      <mesh geometry={gen.street} material={streetMat} receiveShadow frustumCulled={false} />
      <mesh geometry={gen.statics} material={staticMat} receiveShadow />
      <instancedMesh ref={beaconRef} args={[undefined, undefined, Math.max(1, beacons.length)]} frustumCulled={false}>
        <sphereGeometry args={[0.22, 8, 6]} />
        <meshBasicMaterial ref={beaconMat} toneMapped={false} />
      </instancedMesh>
    </group>
  );
});

/* ----------------------------------------------------------------- Sky
 * Overcast city night: a low cloud deck lit orange-grey from below by the city,
 * horizon matched to the atmosphere so skyline and sky blend seamlessly.
 */
const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const skyFragment = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uScreen;
uniform vec3 uScreenDir;
varying vec3 vDir;
float sHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float sNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sHash(i), sHash(i + vec2(1.0, 0.0)), f.x), mix(sHash(i + vec2(0.0, 1.0)), sHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.2, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(smoothstep(-0.02, 0.6, h), 0.6));
  col += uGlow * exp(-max(h, 0.0) * 9.0);
  if (h > 0.02) {
    vec2 uv = d.xz / d.y * 0.9;
    float c = sNoise(uv * 1.3) * 0.55 + sNoise(uv * 3.1) * 0.3 + sNoise(uv * 7.7) * 0.15;
    c = smoothstep(0.42, 0.85, c) * smoothstep(0.02, 0.25, h) * (1.0 - smoothstep(0.5, 0.95, h));
    col += uGlow * 0.9 * c;
  }
  col += uScreen * pow(max(dot(d, uScreenDir), 0.0), 12.0) * 0.8;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const FOG_COLOR = `#${HAZE.base.getHexString()}`;

export const Sky = memo(function Sky() {
  const material = useMemo(() => {
    const horizon = HAZE.base.clone().add(HAZE.horizon.clone().multiplyScalar(0.55));
    return new THREE.ShaderMaterial({
      vertexShader: skyVertex,
      fragmentShader: skyFragment,
      uniforms: {
        uZenith: { value: new THREE.Color("#020409") },
        uHorizon: { value: horizon },
        uGlow: { value: new THREE.Color("#1c1a19") },
        uScreen: { value: HAZE.screen.clone() },
        uScreenDir: { value: new THREE.Vector3(...HAZE.screenPos).normalize() },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
  }, []);
  useDisposable(material, disposeIt);
  return (
    <mesh material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[400, 48, 24]} />
    </mesh>
  );
});
