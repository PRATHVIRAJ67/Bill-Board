import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { disposeIt, useDisposable } from "./useDisposable";
import { GRID } from "../spotData";
import { audioManager } from "@/lib/audioManager";
import { createAtlas, drawAtlas, ensureAtlasFonts, createPlaqueTexture } from "./billboardAtlas";
import { getRadialTexture } from "./textures";
import {
  BILLBOARD_Z, HOUSING_H, HOUSING_W, PANEL_GAP, PANEL_H, PANEL_W, SCREEN_H, SCREEN_W,
} from "./layout";

const COUNT = GRID.cols * GRID.rows;

const ledVertex = /* glsl */ `
attribute vec2 aCell;
attribute vec3 aState;
varying vec2 vUv;
varying vec2 vCell;
varying vec3 vState;
varying vec3 vViewPos;
varying vec3 vViewNormal;
void main() {
  vUv = uv;
  vCell = aCell;
  vState = aState;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  vViewNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * mv;
}`;

const ledFragment = /* glsl */ `
uniform sampler2D uAtlas;
uniform vec2 uGrid;
uniform vec2 uLeds;
uniform float uTime;
uniform float uBrightness;
uniform float uAspect;
varying vec2 vUv;
varying vec2 vCell;
varying vec3 vState;   // x: brightness offset, y: selection frame, z: unused
varying vec3 vViewPos;
varying vec3 vViewNormal;

void main() {
  vec2 uv = mix(vec2(0.004), vec2(0.996), vUv);
  vec2 auv = vec2((vCell.x + uv.x) / uGrid.x, 1.0 - (vCell.y + 1.0 - uv.y) / uGrid.y);
  vec3 col = texture2D(uAtlas, auv).rgb;

  // Physical LED structure: round emitters on a black mask. Mean-preserving,
  // and faded out (via screen-space derivatives) before it can alias/moire.
  vec2 led = vUv * uLeds;
  vec2 f = fract(led) - 0.5;
  float fw = max(fwidth(led.x), fwidth(led.y));
  float emitter = 1.0 - smoothstep(0.34 - fw, 0.34 + fw, length(f));
  float resolvable = 1.0 - smoothstep(0.12, 0.42, fw);
  float ledMask = mix(1.0, emitter * 2.4 + 0.1, resolvable);

  // LED modules lose brightness off-axis
  float ndv = clamp(dot(normalize(vViewNormal), normalize(-vViewPos)), 0.0, 1.0);
  float angle = mix(0.5, 1.0, pow(ndv, 0.7));

  vec3 emit = col * ledMask * uBrightness * max(0.0, 1.0 + vState.x) * angle;

  // module bevel / seam
  vec2 e2 = min(vUv, 1.0 - vUv) * vec2(uAspect, 1.0);
  float edge = min(e2.x, e2.y);
  emit *= 0.55 + 0.45 * smoothstep(0.0, 0.02, edge);

  // selection frame
  float frame = (1.0 - smoothstep(0.012, 0.032, edge)) * vState.y;
  emit += vec3(0.7, 0.95, 1.0) * frame * 3.2;

  // gentle refresh shimmer
  emit *= 1.0 + 0.03 * sin(vUv.y * 6.2831 + uTime * 2.1 + vCell.x * 1.7 + vCell.y);

  // protective glass: faint fresnel sheen of the night sky
  emit += vec3(0.035, 0.05, 0.07) * pow(1.0 - ndv, 4.0);

  gl_FragColor = vec4(emit, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function LedScreen({ spots, atlasCell, hoveredId, selectedId, onHover, onSelect, anisotropy }) {
  const mesh = useRef();
  const [fontsReady, setFontsReady] = useState(false);
  const atlas = useMemo(() => createAtlas(atlasCell), [atlasCell]);
  useDisposable(atlas.texture, disposeIt);

  useEffect(() => {
    let alive = true;
    ensureAtlasFonts().then(() => alive && setFontsReady(true));
    return () => {
      alive = false;
    };
  }, []);

  // Redraw only when visible content changes (not on every poll).
  const signature = spots
    .map((s) => `${s.id}|${s.claimed ? 1 : 0}|${s.handle || ""}|${s.category || ""}|${s.color}|${s.price}`)
    .join(";");
  useEffect(() => {
    atlas.texture.anisotropy = anisotropy;
    drawAtlas(atlas, spots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atlas, signature, fontsReady, anisotropy]);

  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(PANEL_W - PANEL_GAP, PANEL_H - PANEL_GAP);
    const cell = new Float32Array(COUNT * 2);
    for (let i = 0; i < COUNT; i++) {
      cell[i * 2] = i % GRID.cols;
      cell[i * 2 + 1] = Math.floor(i / GRID.cols);
    }
    g.setAttribute("aCell", new THREE.InstancedBufferAttribute(cell, 2));
    g.setAttribute("aState", new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 3), 3));
    return g;
  }, []);
  useDisposable(geometry, disposeIt);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: ledVertex,
        fragmentShader: ledFragment,
        uniforms: {
          uAtlas: { value: atlas.texture },
          uGrid: { value: new THREE.Vector2(GRID.cols, GRID.rows) },
          uLeds: { value: new THREE.Vector2(176, 92) },
          uTime: { value: 0 },
          uBrightness: { value: 1.55 },
          uAspect: { value: (PANEL_W - PANEL_GAP) / (PANEL_H - PANEL_GAP) },
        },
      }),
    [atlas]
  );
  useDisposable(material, disposeIt);

  const anim = useMemo(() => Array.from({ length: COUNT }, () => ({ z: 0, glow: 0, frame: 0 })), []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3() }), []);
  const stateRef = useRef({ hoveredId, selectedId, spots });
  stateRef.current = { hoveredId, selectedId, spots };

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    for (let i = 0; i < COUNT; i++) {
      tmp.p.set(-SCREEN_W / 2 + PANEL_W * ((i % GRID.cols) + 0.5), SCREEN_H / 2 - PANEL_H * (Math.floor(i / GRID.cols) + 0.5), 0);
      m.setMatrixAt(i, tmp.m.makeTranslation(tmp.p.x, tmp.p.y, 0));
    }
    m.instanceMatrix.needsUpdate = true;
  }, [tmp]);

  useFrame((state, delta) => {
    const m = mesh.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    material.uniforms.uTime.value = t;
    const { hoveredId: hov, selectedId: sel, spots: list } = stateRef.current;
    const attr = m.geometry.attributes.aState;
    const focusId = sel ?? hov;
    for (let i = 0; i < COUNT; i++) {
      const spot = list[i];
      const id = spot?.id;
      const isSel = id === sel;
      const isHov = id === hov;
      const dimmed = focusId != null && id !== focusId;
      const breathe = spot && !spot.claimed ? Math.sin(t * 1.4 + i * 0.73) * 0.06 : 0;
      const target = isSel ? 0.35 : isHov ? 0.45 : dimmed ? -0.45 : breathe;
      const a = anim[i];
      a.glow = THREE.MathUtils.damp(a.glow, target, 7, delta);
      a.frame = THREE.MathUtils.damp(a.frame, isSel ? 1 : isHov ? 0.55 : 0, 9, delta);
      a.z = THREE.MathUtils.damp(a.z, isSel ? 0.24 : isHov ? 0.12 : 0, 8, delta);
      attr.array[i * 3] = a.glow;
      attr.array[i * 3 + 1] = a.frame;
      tmp.p.set(-SCREEN_W / 2 + PANEL_W * ((i % GRID.cols) + 0.5), SCREEN_H / 2 - PANEL_H * (Math.floor(i / GRID.cols) + 0.5), a.z);
      m.setMatrixAt(i, tmp.m.makeTranslation(tmp.p.x, tmp.p.y, tmp.p.z));
    }
    attr.needsUpdate = true;
    m.instanceMatrix.needsUpdate = true;
  });

  const hovered = useRef(null);
  const spotAt = (e) => (e.instanceId != null ? stateRef.current.spots[e.instanceId] : null);

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, COUNT]}
      frustumCulled={false}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        e.stopPropagation();
        const spot = spotAt(e);
        if (!spot || hovered.current === spot.id) return;
        hovered.current = spot.id;
        onHover(spot.id);
        audioManager.playHover(spot.id);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(e) => {
        if (e.pointerType !== "mouse") return;
        hovered.current = null;
        onHover(null);
        document.body.style.cursor = "";
      }}
      onClick={(e) => {
        if (e.delta > 12) return; // a drag / orbit gesture, not a tap
        e.stopPropagation();
        const spot = spotAt(e);
        if (!spot) return;
        audioManager.playSelect();
        onSelect(spot.id);
      }}
    />
  );
}

/* Steel & concrete that hold the screen up, built in world units so the columns
   always stand on the sidewalks, clear of the carriageway, at any screen scale. */
const steelMat = new THREE.MeshStandardMaterial({ color: "#6f757b", metalness: 0.55, roughness: 0.5 });
const darkSteel = new THREE.MeshStandardMaterial({ color: "#2c3136", metalness: 0.7, roughness: 0.45 });
const concrete = new THREE.MeshStandardMaterial({ color: "#6d6c68", metalness: 0, roughness: 0.92 });

function Members({ members, material }) {
  // members: [x0,y0,z0, x1,y1,z1, thickness] → one instanced draw call
  const ref = useRef();
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const mid = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    members.forEach((mb, i) => {
      a.set(mb[0], mb[1], mb[2]);
      b.set(mb[3], mb[4], mb[5]);
      mid.addVectors(a, b).multiplyScalar(0.5);
      dir.subVectors(b, a);
      const len = dir.length();
      q.setFromUnitVectors(up, dir.normalize());
      m.compose(mid, q, new THREE.Vector3(mb[6], len, mb[6]));
      ref.current.setMatrixAt(i, m);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [members]);
  return (
    <instancedMesh ref={ref} args={[undefined, material, members.length]} castShadow receiveShadow frustumCulled={false}>
      <boxGeometry />
    </instancedMesh>
  );
}

function Structure({ layout }) {
  const glow = getRadialTexture();
  const s = layout.bb.s;
  const cabinetBack = BILLBOARD_Z - 1.45 * s;
  const top = layout.bb.y + (HOUSING_H / 2) * s;
  const bottom = layout.bb.y - (HOUSING_H / 2) * s;
  const colX = Math.max(15.6, (HOUSING_W / 2) * s * 0.7);
  const z = cabinetBack - 0.9;
  const chordTop = layout.bb.y + HOUSING_H * s * 0.32;
  const chordBot = layout.bb.y - HOUSING_H * s * 0.32;

  const members = useMemo(() => {
    const out = [];
    // truss chords
    for (const y of [chordTop, chordBot]) out.push([-colX, y, z, colX, y, z, 0.32]);
    // posts + alternating diagonals (Warren truss)
    const bays = Math.max(6, Math.round((colX * 2) / 3.2));
    for (let i = 0; i <= bays; i++) {
      const x = -colX + (i / bays) * colX * 2;
      out.push([x, chordBot, z, x, chordTop, z, 0.16]);
      if (i < bays) {
        const x2 = -colX + ((i + 1) / bays) * colX * 2;
        out.push(i % 2 ? [x, chordBot, z, x2, chordTop, z] : [x, chordTop, z, x2, chordBot, z]);
        out[out.length - 1].push(0.12);
      }
    }
    // brackets from truss to the cabinet back
    for (let i = 0; i <= 4; i++) {
      const x = (-0.42 + (i / 4) * 0.84) * HOUSING_W * s;
      for (const y of [chordTop, chordBot]) out.push([x, y, z, x, y, cabinetBack, 0.18]);
    }
    // knee braces column → chord
    for (const sx of [-1, 1]) {
      out.push([sx * colX, chordBot - 3.2, z, sx * (colX - 3.2), chordBot, z, 0.2]);
    }
    return out;
  }, [colX, z, chordTop, chordBot, cabinetBack, s]);

  const ladder = useMemo(() => {
    const out = [];
    const x = colX + 0.75;
    for (let y = 2.4; y < bottom - 0.5; y += 0.32) out.push([x - 0.22, y, z, x + 0.22, y, z, 0.035]);
    return out;
  }, [colX, bottom, z]);

  return (
    <group>
      {[-colX, colX].map((x) => (
        <group key={x} position={[x, 0, z]}>
          {/* I-section column: web + two flanges */}
          <mesh position={[0, top / 2, 0]} material={steelMat} castShadow receiveShadow>
            <boxGeometry args={[0.12, top, 0.9]} />
          </mesh>
          {[-0.43, 0.43].map((fz) => (
            <mesh key={fz} position={[0, top / 2, fz]} material={steelMat} castShadow receiveShadow>
              <boxGeometry args={[0.95, top, 0.07]} />
            </mesh>
          ))}
          {/* base plate on a concrete footing */}
          <mesh position={[0, 0.2 + 0.03, 0]} material={darkSteel} receiveShadow>
            <boxGeometry args={[1.4, 0.06, 1.4]} />
          </mesh>
          <mesh position={[0, 0.1, 0]} material={concrete} receiveShadow>
            <boxGeometry args={[2.3, 0.2 + 0.15, 2.3]} />
          </mesh>
          {/* ground-mounted flood washing the column face */}
          <mesh position={[0, 0.45, 0.62]}>
            <boxGeometry args={[0.5, 0.25, 0.3]} />
            <meshStandardMaterial color="#1d2024" metalness={0.6} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.58, 0.62]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[0.42, 0.22]} />
            <meshBasicMaterial color={[4, 3.4, 2.6]} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.2, 0.475]} renderOrder={2}>
            <planeGeometry args={[1.5, 18]} />
            <meshBasicMaterial map={glow} color="#ffd9ad" transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          {/* cap plate */}
          <mesh position={[0, top + 0.05, 0]} material={darkSteel}>
            <boxGeometry args={[1.1, 0.1, 1.1]} />
          </mesh>
        </group>
      ))}
      <Members members={members} material={steelMat} />
      {/* rungs + stiles of the maintenance ladder */}
      <Members members={ladder} material={darkSteel} />
      {[-0.24, 0.24].map((o) => (
        <mesh key={o} position={[colX + 0.75 + o, (bottom + 2.2) / 2, z]} material={darkSteel}>
          <boxGeometry args={[0.05, bottom - 2.2, 0.06]} />
        </mesh>
      ))}
    </group>
  );
}

function Housing({ haze }) {
  const plaque = useMemo(() => createPlaqueTexture(), []);
  useDisposable(plaque, disposeIt);
  const glow = getRadialTexture();
  useEffect(() => {
    let alive = true;
    ensureAtlasFonts().then(() => {
      if (!alive) return;
      const fresh = createPlaqueTexture();
      plaque.image = fresh.image;
      plaque.needsUpdate = true;
    });
    return () => {
      alive = false;
    };
  }, [plaque]);

  const bezel = 0.26;
  const bw = SCREEN_W + bezel * 2;
  const bh = SCREEN_H + bezel * 2;

  return (
    <group>
      {/* deep cabinet (LED modules, PSUs, cooling) */}
      <RoundedBox args={[HOUSING_W, HOUSING_H, 1.4]} radius={0.12} smoothness={3} position={[0, 0, -0.72]} castShadow receiveShadow>
        <meshStandardMaterial color="#262b30" metalness={0.55} roughness={0.5} />
      </RoundedBox>
      {/* rain hood */}
      <mesh position={[0, HOUSING_H / 2 + 0.06, -0.55]} castShadow>
        <boxGeometry args={[HOUSING_W + 0.35, 0.12, 1.9]} />
        <meshStandardMaterial color="#30363c" metalness={0.6} roughness={0.45} />
      </mesh>
      {/* anodised bezel frame, proud of the modules — catches the screen glow */}
      {[
        [0, (bh - bezel) / 2, bw, bezel],
        [0, -(bh - bezel) / 2, bw, bezel],
        [-(bw - bezel) / 2, 0, bezel, bh - bezel * 2],
        [(bw - bezel) / 2, 0, bezel, bh - bezel * 2],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.04]} castShadow>
          <boxGeometry args={[w, h, 0.14]} />
          <meshStandardMaterial color="#4a5158" metalness={0.85} roughness={0.28} />
        </mesh>
      ))}
      {/* recessed black LED mask behind the modules */}
      <mesh position={[0, 0, -0.012]}>
        <planeGeometry args={[SCREEN_W + 0.1, SCREEN_H + 0.1]} />
        <meshBasicMaterial color="#010203" />
      </mesh>
      {/* restrained edge light */}
      {[1, -1].map((d) => (
        <mesh key={d} position={[0, d * (bh / 2 + 0.02), 0.09]}>
          <boxGeometry args={[bw - 0.3, 0.025, 0.02]} />
          <meshBasicMaterial color={[0.9, 1.25, 1.4]} toneMapped={false} />
        </mesh>
      ))}
      {/* plaque */}
      <mesh position={[0, -(bh - bezel) / 2, 0.115]}>
        <planeGeometry args={[6, 0.17]} />
        <meshBasicMaterial map={plaque} color={[0.9, 1.05, 1.15]} toneMapped={false} />
      </mesh>
      {/* service catwalk and work lights (no guard rail: it would cross the bottom row of panels) */}
      <group position={[0, -HOUSING_H / 2 - 0.62, 0.55]}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={[HOUSING_W - 0.3, 0.08, 1.9]} />
          <meshStandardMaterial color="#3b4147" metalness={0.7} roughness={0.6} />
        </mesh>
        {[-0.3, 0, 0.3].map((f) => (
          <mesh key={f} position={[f * HOUSING_W, -0.08, 0.2]}>
            <boxGeometry args={[0.5, 0.06, 0.2]} />
            <meshBasicMaterial color={[2.4, 2.0, 1.5]} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* light scattering in the humid air around a bright screen */}
      {haze && (
        <mesh position={[0, 0, -1.6]} renderOrder={-1}>
          <planeGeometry args={[HOUSING_W * 2.2, HOUSING_H * 3.2]} />
          <meshBasicMaterial map={glow} color="#4d9bd6" transparent opacity={0.07} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} />
        </mesh>
      )}
    </group>
  );
}

export const Billboard = memo(function Billboard({ layout, spots, hoveredId, selectedId, onHover, onSelect, atlasCell, haze, anisotropy }) {
  const s = layout.bb.s;
  return (
    <>
      <group position={[0, layout.bb.y, BILLBOARD_Z]} scale={s}>
        <Housing haze={haze} />
        <LedScreen
          spots={spots}
          atlasCell={atlasCell}
          hoveredId={hoveredId}
          selectedId={selectedId}
          onHover={onHover}
          onSelect={onSelect}
          anisotropy={anisotropy}
        />
      </group>
      <Structure layout={layout} />
    </>
  );
});
