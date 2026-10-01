import { memo, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { audioManager } from "@/lib/audioManager";
import { createCarMaterials, disposeMaterials, DRACO_URL, HERO_MODEL, TRAFFIC_MODEL } from "./carMaterials";
import { getContactShadowTexture, getRadialTexture } from "./textures";
import { disposeIt, useDisposable } from "./useDisposable";
import { CROSS_HALF_W, CROSS_STREETS, LANES_AWAY, LANES_ONCOMING, PARK_X, STREET_MIN, STREET_NEAR } from "./layout";
import { hero, scrollOffset, street, wrapZ } from "./motion";

const CAR_LENGTH = 4.5;
// Hero drive loop: from the composed start spot up the avenue, under the
// billboard, until it is lost in the haze, then re-enters from behind the lens.
const DRIVE_END = -400; // metres past the start (fully fogged out)
const DRIVE_RESPAWN = 16; // metres behind the start (behind the camera)
const HALF = CAR_LENGTH / 2;

useGLTF.preload(HERO_MODEL, DRACO_URL);
useGLTF.preload(TRAFFIC_MODEL, DRACO_URL);

/** Scale to CAR_LENGTH, centre on X/Z and put the tyre contact patch on y = 0. */
function normalizeInto(object) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const s = CAR_LENGTH / Math.max(size.x, size.z, 1e-3);
  const center = box.getCenter(new THREE.Vector3());
  return new THREE.Matrix4()
    .makeTranslation(-center.x * s, -box.min.y * s, -center.z * s)
    .multiply(new THREE.Matrix4().makeScale(s, s, s));
}

function usePlateTexture() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 72;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#e9e6da";
    ctx.fillRect(0, 0, 256, 72);
    ctx.strokeStyle = "#1b1b1b";
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 248, 64);
    ctx.fillStyle = "#101010";
    ctx.font = "700 34px 'Space Grotesk', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("THE BOARD", 128, 38);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, []);
  useDisposable(tex, disposeIt);
  return tex;
}

/* -------------------------------------------------------------- Hero car
 * Drives up the avenue toward the fixed billboard, passes under it and loops:
 * wheels turn at road speed, the body carries road texture, gentle pitch and
 * tiny steering corrections.
 */
export const HeroCar = memo(function HeroCar({ layout, clearcoat, reducedMotion, castShadow }) {
  const gltf = useGLTF(HERO_MODEL, DRACO_URL);
  const mats = useMemo(() => createCarMaterials({ paint: "#101c28", clearcoat }), [clearcoat]);
  useDisposable(mats, disposeMaterials);
  const plate = usePlateTexture();
  const contact = getContactShadowTexture();
  const glow = getRadialTexture();

  const { model, wheels } = useMemo(() => {
    const root = gltf.scene.clone(true);
    root.traverse((o) => {
      if (!o.isMesh) return;
      const m = mats[o.material?.name];
      if (m) o.material = m;
      o.castShadow = true;
      o.receiveShadow = true;
    });
    const pivot = new THREE.Group();
    pivot.add(root);
    root.applyMatrix4(normalizeInto(root));
    const wheels = ["wheel_fl", "wheel_fr", "wheel_rl", "wheel_rr"].map((n) => root.getObjectByName(n)).filter(Boolean);
    return { model: pivot, wheels };
  }, [gltf, mats]);

  useLayoutEffect(() => {
    model.traverse((o) => {
      if (o.isMesh) o.castShadow = castShadow;
    });
  }, [model, castShadow]);

  const body = useRef();
  const car = useRef();
  const audioClock = useRef(0);

  useFrame((state, delta) => {
    const b = body.current;
    if (!b || !car.current) return;
    const t = state.clock.elapsedTime;
    const k = reducedMotion ? 0.3 : 1;
    // the car itself moves; the street and billboard stay put
    hero.z -= Math.min(delta, 0.1) * street.speed;
    if (hero.z < DRIVE_END) hero.z = DRIVE_RESPAWN;
    car.current.position.z = layout.car.pos[2] + hero.z;
    // wheels roll at road speed (tyre radius ≈ 0.34 m)
    const spin = Math.min(delta, 0.1) * (street.speed / 0.34);
    for (let i = 0; i < wheels.length; i++) wheels[i].rotation.x += spin;
    // driving dynamics: road texture, suspension, pitch, micro steering, lane drift
    b.position.x = Math.sin(t * 0.37) * 0.07 * k;
    b.position.y = (Math.sin(t * 4.1) * 0.004 + Math.sin(t * 29) * 0.0012) * k;
    b.rotation.x = Math.sin(t * 1.7) * 0.0025 * k;
    b.rotation.z = Math.sin(t * 1.1) * 0.003 * k;
    b.rotation.y = Math.sin(t * 0.37 + 1.2) * 0.008 * k;

    audioClock.current += delta;
    if (audioClock.current > 0.25) {
      audioManager.update(audioClock.current, street.speed * 2, Math.sin(t * 0.5) > 0.6);
      audioClock.current = 0;
    }
  });

  return (
    <group ref={car} position={layout.car.pos} scale={layout.car.scale}>
      <group ref={body}>
        <primitive object={model} />
        <mesh position={[0, 0.5, HALF - 0.02]}>
          <planeGeometry args={[0.52, 0.146]} />
          <meshStandardMaterial map={plate} roughness={0.4} metalness={0.2} emissive="#ffffff" emissiveMap={plate} emissiveIntensity={0.08} />
        </mesh>
      </group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 0]} renderOrder={1}>
        <planeGeometry args={[2.5, 5.2]} />
        <meshBasicMaterial map={contact} transparent opacity={0.92} depthWrite={false} color="#000" />
      </mesh>
      {/* headlight throw on the tarmac ahead */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.014, -HALF - 5]} renderOrder={2}>
        <planeGeometry args={[4.6, 11]} />
        <meshBasicMaterial map={glow} color="#bcd7ff" transparent opacity={0.14} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.014, HALF + 0.6]} renderOrder={2}>
        <planeGeometry args={[2.2, 1.1]} />
        <meshBasicMaterial map={glow} color="#ff1830" transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
});

/* ------------------------------------------------------------- Traffic
 * Two-way avenue: away lanes (tail-lights), oncoming lanes (headlights toward
 * the lens) and parked cars along both kerbs — instanced: one draw call per
 * material for every car on the street.
 */
const PAINTS = [
  "#e7e6e1", "#8f979f", "#23282e", "#6e0b10", "#0e2342", "#0a0a0b", "#b0121b", "#c99a00", "#3b4a3f", "#5d5f63",
  "#d4d8dc", "#ff5a00", "#1d4fd6", "#0b5d3b", "#f0f0f0", "#c41e3a", "#2b2d42", "#e8b100", "#7a0c8c", "#00838f",
];
const MAX_MOVING = 24;
const LANE_COUNT = 4; // two away, two oncoming
const MIN_GAP = 14; // metres bumper to bumper at respawn
const randSpeed = () => 18 + Math.random() * 12; // 65–108 km/h
const MAX_PARKED = 16;
const MAX_CARS = MAX_MOVING + MAX_PARKED;
const AWAY_END = -320;
const SPAWN_BEHIND = 30;

function buildTrafficParts(scene) {
  scene.updateMatrixWorld(true);
  const byMat = new Map();
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes.position) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", o.geometry.attributes.position.clone());
    if (o.geometry.index) g.setIndex(o.geometry.index.clone());
    g.applyMatrix4(o.matrixWorld);
    const key = o.material?.name || "plastic_gray";
    if (!byMat.has(key)) byMat.set(key, []);
    byMat.get(key).push(g);
  });
  const parts = [];
  const all = new THREE.Group();
  for (const [name, list] of byMat) {
    const geometry = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    if (!geometry) continue;
    parts.push({ name, geometry });
    all.add(new THREE.Mesh(geometry));
  }
  const norm = normalizeInto(all);
  parts.forEach((p) => {
    p.geometry.applyMatrix4(norm);
    p.geometry.computeVertexNormals();
    p.geometry.computeBoundingSphere();
  });
  return parts;
}

function parkedSlots(count) {
  // deterministic kerbside parking, clear of intersections
  const out = [];
  let seed = 11;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const side of [-1, 1]) {
    let z = side < 0 ? -4 : 4;
    let n = 0;
    const gap = (STREET_NEAR - STREET_MIN) / Math.max(1, Math.ceil(count / 2));
    while (n < Math.ceil(count / 2) && z > STREET_MIN + 6) {
      z -= gap * (0.6 + r() * 0.8);
      if (CROSS_STREETS.some((c) => Math.abs(z - c) < CROSS_HALF_W + 5)) continue;
      out.push({ x: side * (PARK_X + (r() - 0.5) * 0.25), z, yaw: side > 0 ? Math.PI : 0, paint: Math.floor(r() * PAINTS.length) });
      n++;
    }
  }
  return out.slice(0, count);
}

export const Traffic = memo(function Traffic({ count, parked, clearcoat, castShadow }) {
  const gltf = useGLTF(TRAFFIC_MODEL, DRACO_URL);
  const mats = useMemo(() => createCarMaterials({ paint: "#ffffff", clearcoat, lod: true }), [clearcoat]);
  useDisposable(mats, disposeMaterials);
  const parts = useMemo(() => buildTrafficParts(gltf.scene), [gltf]);
  useDisposable(parts, (list) => list.forEach((p) => p.geometry.dispose()));
  const contact = getContactShadowTexture();
  const glow = getRadialTexture();

  const meshes = useRef([]);
  const shadows = useRef();
  const washes = useRef();

  // Busy avenue: active cars are dealt round-robin over the four lanes and
  // spread evenly along the visible stretch, so the road is full from frame one.
  const moving = useMemo(() => {
    const active = Math.min(count, MAX_MOVING);
    const perLane = Math.max(1, Math.ceil(active / LANE_COUNT));
    const span = SPAWN_BEHIND - AWAY_END;
    return Array.from({ length: MAX_MOVING }, (_, i) => {
      const l = i % LANE_COUNT;
      const oncoming = l % 2 === 1;
      const lane = (oncoming ? LANES_ONCOMING : LANES_AWAY)[l >> 1];
      const k = Math.floor(i / LANE_COUNT);
      const z = SPAWN_BEHIND - ((k + 0.5 + (l * 0.23)) / perLane) * span;
      const speed = randSpeed();
      return { dir: oncoming ? 1 : -1, lane, z, speed, target: speed };
    });
  }, [count]);
  const parkedList = useMemo(() => parkedSlots(Math.min(parked, MAX_PARKED)), [parked]);
  // Instances are packed: [0, nMoving) moving cars, then the parked cars. Only
  // these are drawn, so unused slots cost nothing on lower tiers.
  const nMoving = Math.min(count, MAX_MOVING);
  const nDrawn = nMoving + parkedList.length;

  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      p: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      turn: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI),
      flat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
      s: new THREE.Vector3(1, 1, 1),
      zero: new THREE.Vector3(0, 0, 0),
      c: new THREE.Color(),
      up: new THREE.Vector3(0, 1, 0),
    }),
    []
  );

  const makePts = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX_MOVING * 2 * 3), 3));
    return g;
  };
  const headGeo = useMemo(makePts, []);
  const tailGeo = useMemo(makePts, []);
  useDisposable(headGeo, disposeIt);
  useDisposable(tailGeo, disposeIt);

  // paint + static parked transforms
  useLayoutEffect(() => {
    const bodyIdx = parts.findIndex((p) => p.name === "Body_Color");
    const body = meshes.current[bodyIdx];
    if (body) {
      for (let i = 0; i < nDrawn; i++) {
        const paint = i < nMoving ? PAINTS[(i * 7) % PAINTS.length] : PAINTS[parkedList[i - nMoving].paint];
        body.setColorAt(i, tmp.c.set(paint));
      }
      body.instanceColor.needsUpdate = true;
    }
    for (let j = 0; j < parkedList.length; j++) {
      const slot = parkedList[j];
      const i = nMoving + j;
      tmp.q.setFromAxisAngle(tmp.up, slot.yaw + ((j % 3) - 1) * 0.02);
      tmp.m.compose(tmp.p.set(slot.x, 0, slot.z), tmp.q, tmp.s.set(1, 1, 1));
      meshes.current.forEach((mesh) => mesh?.setMatrixAt(i, tmp.m));
      if (shadows.current) {
        tmp.m.compose(tmp.p.set(slot.x, 0.011, slot.z), tmp.flat, tmp.s.set(2.3, 5.1, 1));
        shadows.current.setMatrixAt(i, tmp.m);
      }
    }
  }, [parts, tmp, mats, parkedList, nMoving, nDrawn]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    // parked cars ride with the street block
    const so = scrollOffset();
    for (let j = 0; j < parkedList.length; j++) {
      const slot = parkedList[j];
      const i = nMoving + j;
      const z = wrapZ(slot.z + so);
      tmp.q.setFromAxisAngle(tmp.up, slot.yaw + ((j % 3) - 1) * 0.02);
      tmp.m.compose(tmp.p.set(slot.x, 0, z), tmp.q, tmp.s.set(1, 1, 1));
      for (let k = 0; k < meshes.current.length; k++) meshes.current[k]?.setMatrixAt(i, tmp.m);
      tmp.m.compose(tmp.p.set(slot.x, 0.011, z), tmp.flat, tmp.s.set(2.3, 5.1, 1));
      shadows.current?.setMatrixAt(i, tmp.m);
    }
    const head = headGeo.attributes.position.array;
    const tail = tailGeo.attributes.position.array;
    let hn = 0;
    let tn = 0;
    let wn = 0;
    for (let i = 0; i < nMoving; i++) {
      const d = moving[i];
      const active = i < count;
      if (active) {
        // keep distance to the car ahead in the same lane
        let cruise = d.target;
        for (let j = 0; j < nMoving; j++) {
          const o = moving[j];
          if (j === i || o.lane !== d.lane) continue;
          const gap = (o.z - d.z) * d.dir;
          if (gap > 0 && gap < Math.max(16, d.speed * 0.9)) cruise = Math.min(cruise, o.speed * 0.95);
        }
        d.speed = THREE.MathUtils.damp(d.speed, cruise, 2.2, delta);
        // world-space: the street is fixed, cars drive along it
        d.z += d.dir * d.speed * delta;
        if (d.z < AWAY_END || d.z > SPAWN_BEHIND) {
          // left the visible stretch → re-enter at the start of its lane
          // (behind the lens for away traffic, deep in the haze for oncoming),
          // never on top of a car already in that lane
          d.z = d.dir < 0 ? SPAWN_BEHIND + Math.random() * 20 : AWAY_END - Math.random() * 40;
          for (let j = 0; j < nMoving; j++) {
            const o = moving[j];
            if (j !== i && o.lane === d.lane && Math.abs(o.z - d.z) < MIN_GAP) {
              d.z = o.z - d.dir * MIN_GAP;
              j = -1; // re-check against everyone after shifting
            }
          }
          d.target = randSpeed();
          d.speed = d.target;
        }
      }
      const sc = active ? tmp.s.set(1, 1, 1) : tmp.zero;
      tmp.m.compose(tmp.p.set(d.lane, 0, d.z), d.dir > 0 ? tmp.turn : tmp.q.identity(), sc);
      for (let k = 0; k < meshes.current.length; k++) meshes.current[k]?.setMatrixAt(i, tmp.m);
      tmp.m.compose(tmp.p.set(d.lane, 0.011, d.z), tmp.flat, active ? tmp.s.set(2.3, 5.1, 1) : tmp.zero);
      shadows.current?.setMatrixAt(i, tmp.m);

      if (d.dir > 0) {
        // oncoming: headlight throw ahead on the wet road + lens flares toward the camera
        tmp.m.compose(tmp.p.set(d.lane, 0.015, d.z + HALF + 5.2), tmp.flat, active ? tmp.s.set(1, 1, 1) : tmp.zero);
        washes.current?.setMatrixAt(wn++, tmp.m);
        if (active) {
          for (const sx of [-0.62, 0.62]) {
            head[hn++] = d.lane + sx;
            head[hn++] = 0.68;
            head[hn++] = d.z + HALF - 0.05;
          }
        }
      } else if (active) {
        for (const sx of [-0.6, 0.6]) {
          tail[tn++] = d.lane + sx;
          tail[tn++] = 0.74;
          tail[tn++] = d.z + HALF + 0.05;
        }
      }
    }
    headGeo.setDrawRange(0, hn / 3);
    tailGeo.setDrawRange(0, tn / 3);
    headGeo.attributes.position.needsUpdate = true;
    tailGeo.attributes.position.needsUpdate = true;
    for (let k = 0; k < meshes.current.length; k++) {
      const mesh = meshes.current[k];
      if (!mesh) continue;
      mesh.count = nDrawn;
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (shadows.current) {
      shadows.current.count = nDrawn;
      shadows.current.instanceMatrix.needsUpdate = true;
    }
    if (washes.current) {
      washes.current.count = wn;
      washes.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {parts.map((p, k) => (
        <instancedMesh
          key={p.name}
          ref={(el) => { meshes.current[k] = el; }}
          args={[p.geometry, mats[p.name] || mats.plastic_gray, MAX_CARS]}
          castShadow={castShadow}
          receiveShadow
          frustumCulled={false}
        />
      ))}
      <instancedMesh ref={shadows} args={[undefined, undefined, MAX_CARS]} frustumCulled={false} renderOrder={1}>
        <planeGeometry />
        <meshBasicMaterial map={contact} color="#000" transparent opacity={0.85} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={washes} args={[undefined, undefined, MAX_MOVING]} frustumCulled={false} renderOrder={2}>
        <planeGeometry args={[4.2, 11]} />
        <meshBasicMaterial map={glow} color="#d9e6ff" transparent opacity={0.13} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <points geometry={headGeo} frustumCulled={false} renderOrder={4}>
        <pointsMaterial map={glow} size={0.95} sizeAttenuation color={[2.6, 2.5, 2.3]} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
      <points geometry={tailGeo} frustumCulled={false} renderOrder={4}>
        <pointsMaterial map={glow} size={0.7} sizeAttenuation color={[2.4, 0.12, 0.1]} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
    </group>
  );
});
