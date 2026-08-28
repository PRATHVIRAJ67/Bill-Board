import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";
import { SPOTS, GRID, panelWorldPosition } from "./spotData";

const cyan = "#00d9ff";

/* ------------------------------------------------- Window-lights texture */
// Baked canvas texture used across the city — thousands of scattered
// office-window lights without any instancing cost.
function useCityFacadeTexture() {
  return useMemo(() => {
    const size = 256;
    const cvs = document.createElement("canvas");
    cvs.width = cvs.height = size;
    const ctx = cvs.getContext("2d");
    ctx.fillStyle = "#050a0f";
    ctx.fillRect(0, 0, size, size);
    // Random windows
    const cols = 24, rows = 40;
    for (let y = 0; y < rows; y++) {
      const floorOff = Math.random() < 0.18; // some floors go dark
      for (let x = 0; x < cols; x++) {
        if (floorOff && Math.random() < 0.85) continue;
        if (Math.random() < 0.42) continue;
        const brightness = Math.random();
        const warm = Math.random() < 0.75;
        const hue = warm ? "255, 232, 178" : "180, 214, 232";
        ctx.fillStyle = `rgba(${hue}, ${0.35 + brightness * 0.65})`;
        const px = (size / cols) * x + 2;
        const py = (size / rows) * y + 1;
        ctx.fillRect(px, py, (size / cols) - 4, (size / rows) - 2);
      }
    }
    const tex = new THREE.CanvasTexture(cvs);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    return tex;
  }, []);
}

/* ------------------------------------------------- Wet reflective road */
function WetRoad({ isMobile }) {
  const markings = useRef([]);
  useFrame((_, delta) =>
    markings.current.forEach((line) => {
      if (line) {
        line.position.z += delta * 26;
        if (line.position.z > 18) line.position.z -= 106;
      }
    })
  );
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, -34]} receiveShadow>
        <planeGeometry args={[38, 140]} />
        <MeshReflectorMaterial
          blur={isMobile ? [200, 100] : [420, 120]}
          resolution={isMobile ? 256 : 512}
          mixBlur={1.2}
          mixStrength={isMobile ? 3.4 : 4.2}
          depthScale={1.1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          roughness={0.62}
          metalness={0.55}
          color="#080d12"
          mirror={0.55}
        />
      </mesh>
      {/* Lane markings */}
      {[-9, -3, 3, 9].map((x) => (
        <group key={x}>
          {Array.from({ length: 14 }, (_, i) => (
            <mesh
              key={i}
              ref={(node) => { markings.current.push(node); }}
              position={[x, 0.005, -i * 8 - 1]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[0.14, 3.4]} />
              <meshBasicMaterial color="#f0f6f8" transparent opacity={0.75} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Concrete barriers on both sides */}
      <mesh position={[-13.2, 0.55, -34]} receiveShadow>
        <boxGeometry args={[0.5, 1.1, 130]} />
        <meshStandardMaterial color="#1a252d" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[13.2, 0.55, -34]} receiveShadow>
        <boxGeometry args={[0.5, 1.1, 130]} />
        <meshStandardMaterial color="#1a252d" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* Subtle reflective puddles */}
      {[-6, 4, -2, 8].map((x, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, -0.024, -12 - i * 8]}>
          <planeGeometry args={[3, 1.2]} />
          <meshBasicMaterial color={cyan} transparent opacity={0.05} />
        </mesh>
      ))}
    </>
  );
}

/* --------------------------------------------------------- Streetlights */
function Streetlights() {
  const positions = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 8; i++) {
      arr.push({ x: -14, z: -8 - i * 12, side: -1 });
      arr.push({ x: 14, z: -8 - i * 12, side: 1 });
    }
    return arr;
  }, []);
  return (
    <group>
      {positions.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          {/* Pole */}
          <mesh position={[0, 3.2, 0]}>
            <cylinderGeometry args={[0.06, 0.09, 6.4, 8]} />
            <meshStandardMaterial color="#141c22" metalness={0.7} roughness={0.5} />
          </mesh>
          {/* Arm */}
          <mesh position={[-p.side * 1.2, 6.2, 0]}>
            <boxGeometry args={[2.4, 0.08, 0.12]} />
            <meshStandardMaterial color="#141c22" metalness={0.7} roughness={0.5} />
          </mesh>
          {/* Lamp housing */}
          <mesh position={[-p.side * 2.2, 6.05, 0]} rotation={[0, 0, -p.side * 0.15]}>
            <boxGeometry args={[0.55, 0.16, 0.4]} />
            <meshStandardMaterial color="#242e35" metalness={0.75} roughness={0.4} />
          </mesh>
          {/* Bulb */}
          <mesh position={[-p.side * 2.2, 5.94, 0]}>
            <boxGeometry args={[0.48, 0.06, 0.32]} />
            <meshBasicMaterial color="#ffe6b8" toneMapped={false} />
          </mesh>
          {/* Cheap volumetric light cone (transparent plane) */}
          <mesh position={[-p.side * 2.2, 3.4, 0]}>
            <coneGeometry args={[1.4, 5.4, 8, 1, true]} />
            <meshBasicMaterial color="#ffdda0" transparent opacity={0.045} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          {/* Ground pool of light on wet asphalt */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-p.side * 2.2, 0.005, 0]}>
            <circleGeometry args={[2.4, 20]} />
            <meshBasicMaterial color="#ffd9a0" transparent opacity={0.09} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------- City */
function City() {
  const facade = useCityFacadeTexture();
  // Two rows of buildings on each side, plus a distant skyline.
  const buildings = useMemo(() => {
    const rng = (n) => {
      // deterministic pseudo-random to avoid re-render drift
      const s = Math.sin(n * 91.37) * 43758.5453;
      return s - Math.floor(s);
    };
    const arr = [];
    // Near-side buildings (lining the highway)
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (22 + rng(i) * 10);
      const z = -6 - (i * 4.5) - rng(i + 40) * 3;
      const w = 3 + rng(i + 90) * 4;
      const h = 6 + rng(i + 130) * 18;
      const d = 3 + rng(i + 170) * 5;
      arr.push({ x, z, w, h, d, tier: "near" });
    }
    // Far skyline buildings
    for (let i = 0; i < 34; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (36 + rng(i + 300) * 26);
      const z = -30 - rng(i + 400) * 60;
      const w = 4 + rng(i + 500) * 8;
      const h = 14 + rng(i + 600) * 28;
      const d = 4 + rng(i + 700) * 8;
      arr.push({ x, z, w, h, d, tier: "far" });
    }
    return arr;
  }, []);
  return (
    <group>
      {buildings.map((b, i) => (
        <group key={i} position={[b.x, b.h / 2 - 0.2, b.z]}>
          <mesh castShadow={b.tier === "near"}>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <meshStandardMaterial
              color={b.tier === "near" ? "#0b141d" : "#080f16"}
              roughness={0.85}
              metalness={0.15}
              map={facade}
              emissiveMap={facade}
              emissive="#fff2c8"
              emissiveIntensity={b.tier === "near" ? 0.22 : 0.35}
            />
          </mesh>
          {b.tier === "near" && i % 5 === 0 && (
            <mesh position={[0, b.h / 2 + 0.4, 0]}>
              <boxGeometry args={[0.06, 0.6, 0.06]} />
              <meshBasicMaterial color="#ff2a44" />
            </mesh>
          )}
        </group>
      ))}
      {/* Distant atmospheric haze plane */}
      <mesh position={[0, 12, -95]}>
        <planeGeometry args={[240, 60]} />
        <meshBasicMaterial color="#0d1a26" transparent opacity={0.55} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------- Traffic (cars) */
function Traffic() {
  const cars = useRef([]);
  useFrame((_, delta) =>
    cars.current.forEach((car, i) => {
      if (car) {
        car.position.z += delta * (10 + (i % 3) * 2);
        if (car.position.z > 16) car.position.z -= 112;
      }
    })
  );
  return (
    <group>
      {Array.from({ length: 11 }, (_, i) => (
        <group
          key={i}
          ref={(node) => { cars.current[i] = node; }}
          position={[(i % 4 - 1.5) * 3.8, 0.3, -i * 10 - 12]}
        >
          <mesh castShadow>
            <boxGeometry args={[1.35, 0.5, 2.9]} />
            <meshStandardMaterial color={i % 3 === 0 ? "#1a2530" : "#0d151b"} metalness={0.85} roughness={0.22} />
          </mesh>
          <mesh position={[0, 0.5, 0.4]}>
            <boxGeometry args={[1.15, 0.42, 1.5]} />
            <meshStandardMaterial color="#050a0f" metalness={0.35} roughness={0.15} />
          </mesh>
          <mesh position={[0, 0.5, 1.35]}>
            <boxGeometry args={[1.1, 0.09, 0.06]} />
            <meshBasicMaterial color="#ff2a48" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------ Car (hero) */
const CAR_LENGTH = 4.8;
const CAR_WIDTH = 1.98;

// Sculpted side-profile silhouette of a low-slung supercar. Extruded across
// the car's width to produce a real 3D body (not a box primitive).
function useSuperCarBodyGeom() {
  return useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-2.4, 0.18);
    s.lineTo(-2.35, 0.42);                                    // front bumper
    s.bezierCurveTo(-2.35, 0.55, -2.15, 0.6, -1.95, 0.6);    // nose curve
    s.lineTo(-1.05, 0.62);                                    // hood
    s.bezierCurveTo(-0.5, 0.63, -0.15, 0.68, 0.05, 1.1);     // hood → windshield
    s.lineTo(0.75, 1.18);                                     // roof top
    s.bezierCurveTo(1.1, 1.15, 1.35, 1.05, 1.55, 0.92);      // rear window
    s.bezierCurveTo(1.9, 0.85, 2.2, 0.78, 2.35, 0.68);       // rear deck
    s.lineTo(2.4, 0.42);                                      // rear bumper top
    s.lineTo(2.4, 0.18);                                      // rear bottom
    s.lineTo(-2.4, 0.18);                                     // close
    const g = new THREE.ExtrudeGeometry(s, {
      depth: CAR_WIDTH,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.08,
      bevelSegments: 5,
      curveSegments: 14,
      steps: 1,
    });
    g.translate(0, 0, -CAR_WIDTH / 2);
    g.computeVertexNormals();
    return g;
  }, []);
}

// 5-spoke wheel with rim + brake caliper visible.
// Cylinder default axis is Y; rotating by X=π/2 puts the axle along Z (the
// car's width axis in group-local space). Spin uses local Y after rotation
// which corresponds to the car's forward/back axis after the initial tilt.
function Wheel({ position, spinRef }) {
  return (
    <group position={position} rotation={[Math.PI / 2, 0, 0]}>
      <group ref={spinRef}>
        {/* Tire */}
        <mesh castShadow>
          <cylinderGeometry args={[0.42, 0.42, 0.32, 28]} />
          <meshStandardMaterial color="#0a0d10" metalness={0.35} roughness={0.85} />
        </mesh>
        {/* Rim disc */}
        <mesh position={[0, 0.17, 0]}>
          <cylinderGeometry args={[0.28, 0.28, 0.02, 20]} />
          <meshStandardMaterial color="#2a3540" metalness={0.9} roughness={0.28} />
        </mesh>
        {/* Hub */}
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.04, 12]} />
          <meshStandardMaterial color="#7a8a95" metalness={0.9} roughness={0.3} />
        </mesh>
        {/* 5 spokes */}
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[0, 0.175, 0]} rotation={[0, (i * Math.PI * 2) / 5, 0]}>
            <boxGeometry args={[0.04, 0.02, 0.5]} />
            <meshStandardMaterial color="#4a5560" metalness={0.9} roughness={0.32} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Car({ isMobile }) {
  // Chase-cam foreground per the AAA reference — lower-left composition.
  const position = isMobile ? [-0.3, 0, 5] : [-0.5, 0, 5];
  const scale = isMobile ? 1.0 : 1.05;
  const bodyGeom = useSuperCarBodyGeom();
  const groupRef = useRef();
  const wheelRefs = [useRef(), useRef(), useRef(), useRef()];

  useFrame((state, delta) => {
    wheelRefs.forEach((r) => { if (r.current) r.current.rotation.y += delta * 22; });
    if (groupRef.current) {
      const t = state.clock.elapsedTime;
      groupRef.current.position.y = position[1] + Math.sin(t * 5) * 0.008;
    }
  });

  const [px, py, pz] = position;

  return (
    <>
      {/* Cinematic rim key light — glances across the roof / rear haunches */}
      <pointLight position={[px + 3.6, py + 5.8, pz + 3.4]} intensity={45} distance={16} color="#eaf6ff" />
      {/* Cyan billboard fill from the front */}
      <pointLight position={[px - 2.6, py + 3.4, pz - 4.6]} intensity={22} distance={12} color={cyan} />
      {/* Warm streetlight side-graze */}
      <pointLight position={[px + 3.2, py + 1.6, pz - 0.5]} intensity={10} distance={7} color="#ffb877" />
      {/* Under-body ambient fill so the car isn't a silhouette on black road */}
      <pointLight position={[px, py + 1.4, pz]} intensity={2} distance={4} color="#5a7b8f" />

      <group
        ref={groupRef}
        position={position}
        rotation={[0, -Math.PI / 2, 0]}
        scale={scale}
      >
        {/* Main body (sculpted extrude) — dark metallic paint with soft rim gloss */}
        <mesh geometry={bodyGeom} castShadow>
          <meshStandardMaterial color="#3a4d5a" metalness={0.9} roughness={0.22} envMapIntensity={1.4} />
        </mesh>

        {/* Rear haunches — bulging shoulders above rear wheels */}
        {[-1, 1].map((s) => (
          <mesh key={s} castShadow position={[1.35, 0.65, s * (CAR_WIDTH / 2 - 0.05)]}>
            <sphereGeometry args={[0.5, 12, 8, 0, Math.PI]} />
            <meshStandardMaterial color="#374a56" metalness={0.9} roughness={0.22} />
          </mesh>
        ))}
        {/* Front fender flares */}
        {[-1, 1].map((s) => (
          <mesh key={`ff${s}`} castShadow position={[-1.55, 0.55, s * (CAR_WIDTH / 2 - 0.05)]}>
            <sphereGeometry args={[0.4, 12, 8, 0, Math.PI]} />
            <meshStandardMaterial color="#334652" metalness={0.9} roughness={0.24} />
          </mesh>
        ))}

        {/* Side rocker panels (blackened lower cladding) */}
        {[-1, 1].map((s) => (
          <mesh key={`rk${s}`} position={[0, 0.32, s * (CAR_WIDTH / 2 + 0.008)]}>
            <boxGeometry args={[3.4, 0.14, 0.03]} />
            <meshStandardMaterial color="#050a0d" roughness={0.7} metalness={0.35} />
          </mesh>
        ))}

        {/* Windshield glass overlay */}
        <mesh position={[-0.22, 0.94, 0]} rotation={[0, 0, -0.7]}>
          <boxGeometry args={[0.85, 0.05, CAR_WIDTH - 0.18]} />
          <meshStandardMaterial color="#040a10" metalness={0.9} roughness={0.05} transparent opacity={0.85} />
        </mesh>
        {/* Rear window glass */}
        <mesh position={[1.05, 0.99, 0]} rotation={[0, 0, 0.5]}>
          <boxGeometry args={[0.7, 0.05, CAR_WIDTH - 0.22]} />
          <meshStandardMaterial color="#03080c" metalness={0.9} roughness={0.05} transparent opacity={0.88} />
        </mesh>
        {/* Roof cyan LED accent */}
        <mesh position={[0.35, 1.22, 0]}>
          <boxGeometry args={[0.65, 0.01, 0.55]} />
          <meshBasicMaterial color={cyan} transparent opacity={0.55} toneMapped={false} />
        </mesh>

        {/* Front headlight strips (arrow-shaped LED) */}
        {[-1, 1].map((s) => (
          <mesh key={`hl${s}`} position={[-2.28, 0.5, s * 0.65]}>
            <boxGeometry args={[0.05, 0.06, 0.45]} />
            <meshBasicMaterial color="#eaf6ff" toneMapped={false} />
          </mesh>
        ))}
        {/* Full-width rear taillight bar */}
        <mesh position={[2.4, 0.6, 0]}>
          <boxGeometry args={[0.04, 0.08, CAR_WIDTH - 0.2]} />
          <meshBasicMaterial color="#ff1638" toneMapped={false} />
        </mesh>
        {/* Sculpted taillight caps (Y-shaped LEDs) */}
        {[-1, 1].map((s) => (
          <mesh key={`tc${s}`} position={[2.41, 0.6, s * (CAR_WIDTH / 2 - 0.32)]}>
            <boxGeometry args={[0.04, 0.2, 0.5]} />
            <meshBasicMaterial color="#ff2f52" toneMapped={false} />
          </mesh>
        ))}
        {/* Split rear diffuser fins */}
        {[-0.4, -0.13, 0.13, 0.4].map((z, i) => (
          <mesh key={i} position={[2.28, 0.22, z]}>
            <boxGeometry args={[0.32, 0.02, 0.05]} />
            <meshStandardMaterial color="#0a0f14" metalness={0.4} roughness={0.7} />
          </mesh>
        ))}
        {/* Exhaust tips (quad) */}
        {[-0.62, -0.22, 0.22, 0.62].map((z, i) => (
          <mesh key={i} position={[2.42, 0.28, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.075, 0.075, 0.12, 12]} />
            <meshStandardMaterial color="#8b9aa0" metalness={0.95} roughness={0.28} />
          </mesh>
        ))}
        {/* License plate */}
        <group position={[2.44, 0.4, 0]} rotation={[0, Math.PI / 2, 0]}>
          <mesh>
            <planeGeometry args={[0.85, 0.22]} />
            <meshStandardMaterial color="#e9e2c4" emissive="#3a3416" emissiveIntensity={0.5} />
          </mesh>
          <Text position={[0, 0, 0.008]} fontSize={0.09} color="#0a0a0a" anchorX="center" anchorY="middle" letterSpacing={0.02}>
            THE BOARD
          </Text>
        </group>

        {/* Wheels — placed at each corner along the car's length (X) axis */}
        <Wheel position={[-1.55, 0.42, CAR_WIDTH / 2 - 0.02]} spinRef={wheelRefs[0]} />
        <Wheel position={[-1.55, 0.42, -CAR_WIDTH / 2 + 0.02]} spinRef={wheelRefs[1]} />
        <Wheel position={[1.55, 0.42, CAR_WIDTH / 2 - 0.02]} spinRef={wheelRefs[2]} />
        <Wheel position={[1.55, 0.42, -CAR_WIDTH / 2 + 0.02]} spinRef={wheelRefs[3]} />

        {/* Contact shadow */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <planeGeometry args={[3.8, 6]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.55} depthWrite={false} />
        </mesh>
      </group>

      {/* Taillight red spill (world-space so it reflects in the wet mirror) */}
      <pointLight position={[px, py + 0.5, pz + 3.4]} intensity={isMobile ? 1.4 : 1.9} distance={5} color="#ff2848" />
    </>
  );
}

/* ---------------------------------------------------- InteractivePanel */
function InteractivePanel({ spot, index, hoveredId, selectedId, onHover, onSelect }) {
  const groupRef = useRef();
  const glowRef = useRef();
  const isHovered = hoveredId === spot.id;
  const isSelected = selectedId === spot.id;
  const isDimmed = hoveredId !== null && !isHovered;
  const col = index % GRID.cols;
  const row = Math.floor(index / GRID.cols);
  const x = GRID.originX + col * GRID.colStep;
  const y = GRID.originY - row * GRID.rowStep;

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const targetZ = isSelected ? 0.34 : isHovered ? 0.22 : 0;
    groupRef.current.position.z = THREE.MathUtils.damp(groupRef.current.position.z, targetZ, 6, delta);
    if (glowRef.current) {
      const t = state.clock.elapsedTime;
      const pulse = spot.claimed ? 0 : 0.4 + Math.sin(t * 1.8 + index * 0.7) * 0.25;
      const target = isSelected ? 1.4 : isHovered ? 1.1 : pulse;
      const mat = glowRef.current.material;
      mat.opacity = THREE.MathUtils.damp(mat.opacity, target * 0.6, 5, delta);
    }
  });

  const priceLabel = spot.price ? `$${spot.price}` : null;
  return (
    <group
      ref={groupRef}
      position={[x, y, 0]}
      onPointerOver={(e) => { e.stopPropagation(); onHover(spot.id); document.body.style.cursor = "pointer"; }}
      onPointerOut={(e) => { e.stopPropagation(); onHover(null); document.body.style.cursor = ""; }}
      onClick={(e) => { e.stopPropagation(); onSelect(spot.id); }}
    >
      <mesh castShadow>
        <boxGeometry args={[2.88, 1.3, 0.08]} />
        <meshStandardMaterial
          color={isDimmed ? "#050a0d" : "#0a1115"}
          metalness={0.7}
          roughness={0.24}
          emissive={spot.claimed ? "#071016" : "#003340"}
          emissiveIntensity={isDimmed ? 0.15 : isHovered ? 1.1 : spot.claimed ? 0.28 : 0.6}
        />
      </mesh>
      {!spot.claimed && (
        <mesh ref={glowRef} position={[0, 0, 0.05]}>
          <planeGeometry args={[2.78, 1.2]} />
          <meshBasicMaterial color={cyan} transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}
      {spot.claimed && (
        <mesh position={[0, 0, 0.045]}>
          <planeGeometry args={[2.72, 1.15]} />
          <meshBasicMaterial color={spot.color || "#42616a"} transparent opacity={isDimmed ? 0.18 : 0.32} depthWrite={false} />
        </mesh>
      )}
      <Text position={[-1.28, 0.48, 0.09]} fontSize={0.16} color="#dbe7e9" anchorX="left" anchorY="middle">
        {String(spot.id).padStart(2, "0")}
      </Text>
      {spot.claimed ? (
        <Text position={[0, -0.16, 0.09]} fontSize={0.19} color="#f1f8f9" anchorX="center" anchorY="middle" maxWidth={2.5}>
          {spot.handle}
        </Text>
      ) : (
        <>
          <Text position={[0, 0.1, 0.09]} fontSize={0.15} color={cyan} anchorX="center" anchorY="middle" letterSpacing={0.08}>
            AVAILABLE
          </Text>
          <Text position={[0, -0.22, 0.09]} fontSize={0.32} color="#ffffff" anchorX="center" anchorY="middle">
            {priceLabel}
          </Text>
        </>
      )}
    </group>
  );
}

function Panels({ hoveredId, selectedId, onHover, onSelect }) {
  return (
    <group position={[0, GRID.panelsY, GRID.panelsZ]}>
      {SPOTS.map((spot, i) => (
        <InteractivePanel
          key={spot.id}
          spot={spot}
          index={i}
          hoveredId={hoveredId}
          selectedId={selectedId}
          onHover={onHover}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

/* ---------------------------------------------------------------- Billboard */
function Billboard({ hoveredId, selectedId, onHover, onSelect }) {
  const lamps = useMemo(() => [-8, -5, -2, 1, 4, 7], []);
  return (
    <group position={[0, 0, -38]}>
      <mesh position={[0, 8.2, 0]} castShadow>
        <boxGeometry args={[20, 8.7, 0.42]} />
        <meshStandardMaterial color="#0b1115" metalness={0.82} roughness={0.26} />
      </mesh>
      <mesh position={[0, 8.2, 0.25]}>
        <boxGeometry args={[19.4, 8.1, 0.06]} />
        <meshStandardMaterial color="#05090d" metalness={0.45} roughness={0.32} emissive="#021823" emissiveIntensity={0.32} />
      </mesh>
      {/* Cyan edge frame */}
      <mesh position={[0, 12.4, 0.35]}><boxGeometry args={[20.1, 0.08, 0.05]} /><meshBasicMaterial color={cyan} toneMapped={false} /></mesh>
      <mesh position={[0, 4.0, 0.35]}><boxGeometry args={[20.1, 0.08, 0.05]} /><meshBasicMaterial color={cyan} toneMapped={false} /></mesh>
      <mesh position={[-10.05, 8.2, 0.35]}><boxGeometry args={[0.08, 8.5, 0.05]} /><meshBasicMaterial color={cyan} toneMapped={false} /></mesh>
      <mesh position={[10.05, 8.2, 0.35]}><boxGeometry args={[0.08, 8.5, 0.05]} /><meshBasicMaterial color={cyan} toneMapped={false} /></mesh>

      {/* Vertical columns */}
      {[-9.8, 9.8].map((x) => (
        <mesh key={x} position={[x, 5.1, 0]} castShadow>
          <boxGeometry args={[0.5, 14, 0.85]} />
          <meshStandardMaterial color="#27343b" metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
      {/* X-braces below panels */}
      {[-6, 0, 6].map((x) => (
        <group key={x} position={[x, 2.2, 0]}>
          <mesh rotation={[0, 0, 0.35]}><boxGeometry args={[0.09, 2.4, 0.15]} /><meshStandardMaterial color="#1a2530" metalness={0.85} roughness={0.35} /></mesh>
          <mesh rotation={[0, 0, -0.35]}><boxGeometry args={[0.09, 2.4, 0.15]} /><meshStandardMaterial color="#1a2530" metalness={0.85} roughness={0.35} /></mesh>
        </group>
      ))}
      <mesh position={[0, 1.2, 0]} castShadow><boxGeometry args={[1.2, 1.4, 1.3]} /><meshStandardMaterial color="#1b252c" metalness={0.85} /></mesh>
      <mesh position={[0, 2.2, 0]} castShadow><boxGeometry args={[15.8, 0.5, 0.72]} /><meshStandardMaterial color="#202c33" metalness={0.9} /></mesh>
      <mesh position={[0, 14.7, 0]} castShadow><boxGeometry args={[20.5, 0.45, 0.76]} /><meshStandardMaterial color="#202c33" metalness={0.9} /></mesh>

      {/* Overhead lamps */}
      {lamps.map((x, i) => (
        <group key={i} position={[x, 13.4, 0.15]}>
          <mesh><boxGeometry args={[0.07, 0.7, 0.07]} /><meshStandardMaterial color="#2b3841" metalness={0.85} roughness={0.35} /></mesh>
          <mesh position={[0, -0.28, 0.24]} rotation={[0.9, 0, 0]}><boxGeometry args={[0.55, 0.14, 0.35]} /><meshStandardMaterial color="#2b3841" metalness={0.85} roughness={0.35} /></mesh>
          <mesh position={[0, -0.44, 0.4]}><sphereGeometry args={[0.11, 12, 8]} /><meshBasicMaterial color="#fff6db" toneMapped={false} /></mesh>
        </group>
      ))}
      <Panels hoveredId={hoveredId} selectedId={selectedId} onHover={onHover} onSelect={onSelect} />
    </group>
  );
}

/* ------------------------------------------------------------ SceneCamera */
function SceneCamera({ cinematic, isMobile, zoomStep, selectedId, resetTick }) {
  const { camera } = useThree();
  const elapsed = useRef(0);
  const currentLookAt = useRef(new THREE.Vector3(0, isMobile ? 8 : 4.1, isMobile ? -30 : -25));
  useEffect(() => { if (!cinematic) elapsed.current = 12; }, [cinematic]);
  useEffect(() => { elapsed.current = 0; }, [resetTick]);
  useFrame((_, delta) => {
    elapsed.current += delta;
    const progress = Math.min(elapsed.current / 15, 1);
    const zoomOffset = zoomStep === 1 ? -3 : zoomStep === 2 ? 3 : 0;

    if (selectedId != null) {
      const idx = SPOTS.findIndex((s) => s.id === selectedId);
      if (idx >= 0) {
        const [px, py, pz] = panelWorldPosition(idx);
        const fx = px * 0.55, fy = py + (isMobile ? 0.6 : 0.4), fz = pz + (isMobile ? 9 : 6);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, fx, 2.4, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, fy, 2.4, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, fz, 2.4, delta);
        currentLookAt.current.x = THREE.MathUtils.damp(currentLookAt.current.x, px, 2.4, delta);
        currentLookAt.current.y = THREE.MathUtils.damp(currentLookAt.current.y, py, 2.4, delta);
        currentLookAt.current.z = THREE.MathUtils.damp(currentLookAt.current.z, pz, 2.4, delta);
        camera.lookAt(currentLookAt.current);
        return;
      }
    }
    if (cinematic) {
      if (isMobile) {
        // Mobile chase-cam: pulled up and slightly back so both the car
        // (foreground) and billboard (mid) remain in the tall portrait frame.
        const targetZ = THREE.MathUtils.lerp(20, 15, progress) + zoomOffset;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, 0, 1.5, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 1.2, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, 3.4 + Math.sin(elapsed.current * 0.22) * 0.06, 1.3, delta);
        currentLookAt.current.set(0, 5.5, -22);
        camera.lookAt(currentLookAt.current);
      } else {
        const targetZ = THREE.MathUtils.lerp(17, 11.5, progress) + zoomOffset;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, 0.3, 1.5, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 1.2, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, 3.3 + Math.sin(elapsed.current * 0.22) * 0.06, 1.3, delta);
        currentLookAt.current.set(-0.3, 2.4, -14);
        camera.lookAt(currentLookAt.current);
      }
    }
  });
  return null;
}

/* -------------------------------------------------------------- HeroScene */
export default function HeroScene({ cinematic, isMobile, zoomStep = 0, hoveredId, selectedId, onHover, onSelect, resetTick = 0 }) {
  return (
    <>
      <ambientLight intensity={0.22} color="#8fb8c7" />
      <hemisphereLight args={["#4a6b82", "#050810", 0.35]} />
      <directionalLight
        position={[-10, 18, 12]}
        intensity={0.95}
        color="#c9f3ff"
        castShadow={!isMobile}
        shadow-mapSize={[1024, 1024]}
      />
      {/* Billboard back glow */}
      <pointLight position={[0, 10, -29]} intensity={22} distance={26} color={cyan} />

      {selectedId != null && (() => {
        const idx = SPOTS.findIndex((s) => s.id === selectedId);
        if (idx < 0) return null;
        const [px, py, pz] = panelWorldPosition(idx);
        return (
          <>
            <pointLight position={[px, py + 0.2, pz + 1.5]} intensity={6} distance={5} color="#ffffff" />
            <pointLight position={[px, py, pz + 0.6]} intensity={4} distance={3} color={cyan} />
          </>
        );
      })()}

      <WetRoad isMobile={isMobile} />
      <City />
      <Streetlights />
      <Traffic />
      <Car isMobile={isMobile} />
      <Billboard hoveredId={hoveredId} selectedId={selectedId} onHover={onHover} onSelect={onSelect} />
      <SceneCamera cinematic={cinematic} isMobile={isMobile} zoomStep={zoomStep} selectedId={selectedId} resetTick={resetTick} />
      <OrbitControls
        enabled={!cinematic && selectedId == null}
        enablePan={false}
        minDistance={isMobile ? 16 : 8}
        maxDistance={isMobile ? 30 : 24}
        maxPolarAngle={isMobile ? 1.42 : 1.52}
        minPolarAngle={isMobile ? 1.05 : 0.8}
        target={[0, isMobile ? 5.5 : 5.2, isMobile ? -32 : -29]}
      />
    </>
  );
}
