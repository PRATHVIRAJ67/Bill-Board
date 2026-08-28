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
function Car({ isMobile }) {
  const position = isMobile ? [0, 0.4, 3] : [0, 0.55, 2];
  const scale = isMobile ? 1.2 : 1.15;
  const bodyRef = useRef();
  const wheels = useRef([]);
  useFrame((state, delta) => {
    wheels.current.forEach((w) => { if (w) w.rotation.x += delta * 12; });
    if (bodyRef.current) {
      bodyRef.current.position.y = 0.02 + Math.sin(state.clock.elapsedTime * 4.5) * 0.008;
    }
  });

  const carX = position[0], carY = position[1], carZ = position[2];

  return (
    <>
      {/* World-space rim key light — mounted from above-right, casts a strong
          highlight across the car's roof/fender so it reads against the dark. */}
      <pointLight
        position={[carX + 3.2, carY + 5.4, carZ + 3.4]}
        intensity={26}
        distance={13}
        color="#f2f8ff"
      />
      {/* Cyan fill from the billboard direction (front-left of car) */}
      <pointLight
        position={[carX - 2.4, carY + 3.4, carZ - 4.2]}
        intensity={11}
        distance={10}
        color={cyan}
      />
      {/* Warm accent grazing the driver-side of the body */}
      <pointLight
        position={[carX + 2.8, carY + 1.4, carZ - 1]}
        intensity={5}
        distance={6}
        color="#ffb877"
      />

      <group position={position} rotation={[0, Math.PI, 0]} scale={scale}>
        <group ref={bodyRef}>
          {/* Main chassis */}
          <mesh castShadow position={[0, 0.32, 0]}>
            <boxGeometry args={[2.5, 0.42, 5.2]} />
            <meshStandardMaterial color="#1e2b34" metalness={0.85} roughness={0.24} />
          </mesh>
          {/* Fender flares */}
          <mesh castShadow position={[0, 0.35, 1.7]}>
            <boxGeometry args={[2.72, 0.32, 1.4]} />
            <meshStandardMaterial color="#22303a" metalness={0.85} roughness={0.22} />
          </mesh>
          <mesh castShadow position={[0, 0.35, -1.7]}>
            <boxGeometry args={[2.72, 0.32, 1.4]} />
            <meshStandardMaterial color="#22303a" metalness={0.85} roughness={0.22} />
          </mesh>
          {/* Hood scoop */}
          <mesh castShadow position={[0, 0.55, -1.6]}>
            <boxGeometry args={[1.7, 0.14, 1.4]} />
            <meshStandardMaterial color="#1a2731" metalness={0.9} roughness={0.24} />
          </mesh>
          {/* Cabin */}
          <mesh castShadow position={[0, 0.85, -0.05]}>
            <boxGeometry args={[1.85, 0.55, 2.3]} />
            <meshStandardMaterial color="#0e1720" metalness={0.55} roughness={0.14} />
          </mesh>
          {/* Rear window */}
          <mesh position={[0, 0.85, 0.95]} rotation={[-0.35, 0, 0]}>
            <planeGeometry args={[1.6, 1.1]} />
            <meshStandardMaterial color="#04080c" metalness={0.85} roughness={0.08} transparent opacity={0.9} />
          </mesh>
          {/* Roof cyan strip */}
          <mesh position={[0, 1.14, -0.1]}>
            <boxGeometry args={[1.3, 0.012, 1.4]} />
            <meshBasicMaterial color={cyan} transparent opacity={0.4} toneMapped={false} />
          </mesh>
          {/* Full-width taillight bar */}
          <mesh position={[0, 0.55, 2.62]}>
            <boxGeometry args={[2.35, 0.14, 0.05]} />
            <meshBasicMaterial color="#ff173f" toneMapped={false} />
          </mesh>
          {[-1, 1].map((x) => (
            <mesh key={x} position={[x * 1.08, 0.55, 2.63]}>
              <boxGeometry args={[0.5, 0.24, 0.05]} />
              <meshBasicMaterial color="#ff2848" toneMapped={false} />
            </mesh>
          ))}

          {/* Exhaust */}
          {[-0.55, 0.55].map((x) => (
            <mesh key={x} position={[x, 0.24, 2.66]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 0.14, 12]} />
              <meshStandardMaterial color="#7a8a92" metalness={0.9} roughness={0.35} />
            </mesh>
          ))}

          {/* License plate */}
          <group position={[0, 0.38, 2.66]}>
            <mesh>
              <planeGeometry args={[0.9, 0.24]} />
              <meshStandardMaterial color="#e9e2c4" emissive="#3a3416" emissiveIntensity={0.4} />
            </mesh>
            <Text position={[0, 0, 0.008]} fontSize={0.1} color="#0a0a0a" anchorX="center" anchorY="middle" letterSpacing={0.02}>
              THE BOARD
            </Text>
          </group>

          {/* Front hood highlight */}
          <mesh position={[0, 0.54, -2.4]}>
            <boxGeometry args={[1.6, 0.02, 0.24]} />
            <meshBasicMaterial color={cyan} transparent opacity={0.3} toneMapped={false} />
          </mesh>

          {/* Wheels */}
          {[[-1.15, 0.28, 1.55], [1.15, 0.28, 1.55], [-1.15, 0.28, -1.55], [1.15, 0.28, -1.55]].map(([x, y, z], i) => (
            <group key={i} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
              <mesh ref={(node) => { wheels.current[i] = node; }} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.42, 0.42, 0.36, 24]} />
                <meshStandardMaterial color="#0a0d10" metalness={0.4} roughness={0.75} />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.24, 0.24, 0.37, 8]} />
                <meshStandardMaterial color="#3a4650" metalness={0.85} roughness={0.35} />
              </mesh>
            </group>
          ))}
        </group>

        {/* Contact shadow */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <planeGeometry args={[3.6, 6]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      </group>

      {/* Taillight red spill onto wet road behind car — kept subtle so the
          body itself remains the focal element, not the glow. */}
      <pointLight position={[carX, carY + 0.5, carZ + 3.8]} intensity={isMobile ? 1.2 : 1.6} distance={4.5} color="#ff2848" />
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
        const targetZ = THREE.MathUtils.lerp(22, 17, progress) + zoomOffset;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, 0, 1.5, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 1.2, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, 3.5 + Math.sin(elapsed.current * 0.22) * 0.06, 1.3, delta);
        currentLookAt.current.set(0, 8, -30);
        camera.lookAt(currentLookAt.current);
      } else {
        const targetZ = THREE.MathUtils.lerp(18, 12, progress) + zoomOffset;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, 0, 1.5, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 1.2, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, 3.0 + Math.sin(elapsed.current * 0.22) * 0.06, 1.3, delta);
        currentLookAt.current.set(0, 6.6, -24);
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
