import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, OrbitControls, Text, MeshReflectorMaterial, useGLTF } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { SPOTS, GRID, panelWorldPosition } from "./spotData";

const cyan = "#00d9ff";

// Exact road surface Y coordinate in world space
const ROAD_SURFACE_Y = -0.03;

// Preload player Ferrari and 3 traffic GLB models
useGLTF.preload("/models/ferrari.glb", "https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
useGLTF.preload("/models/cars/carglb/source/car_glb.glb");
useGLTF.preload("/models/cars/mustang-cobra/source/2019 Ford Mustang Cobra Jet.glb");
useGLTF.preload("/models/cars/mustang-gt3/source/ford_mustang_gt3.glb");

const TRAFFIC_MODELS = [
  { name: "carglb", url: "/models/cars/carglb/source/car_glb.glb", rotY: Math.PI, yOffset: 0.0, targetLength: 4.4 },
  { name: "mustang-cobra", url: "/models/cars/mustang-cobra/source/2019 Ford Mustang Cobra Jet.glb", rotY: Math.PI, yOffset: 0.0, targetLength: 4.4 },
  { name: "mustang-gt3", url: "/models/cars/mustang-gt3/source/ford_mustang_gt3.glb", rotY: Math.PI, yOffset: 0.0, targetLength: 4.4 },
];

/* ------------------------------------------------- Window-lights texture */
function useCityFacadeTexture() {
  return useMemo(() => {
    const size = 256;
    const cvs = document.createElement("canvas");
    cvs.width = cvs.height = size;
    const ctx = cvs.getContext("2d");
    ctx.fillStyle = "#05090e";
    ctx.fillRect(0, 0, size, size);
    
    const cols = 28, rows = 44;
    for (let y = 0; y < rows; y++) {
      const floorOff = Math.random() < 0.2;
      for (let x = 0; x < cols; x++) {
        if (floorOff && Math.random() < 0.8) continue;
        if (Math.random() < 0.38) continue;
        const brightness = Math.random();
        const warm = Math.random() < 0.72;
        const hue = warm ? "255, 235, 185" : "175, 220, 240";
        ctx.fillStyle = `rgba(${hue}, ${0.4 + brightness * 0.6})`;
        const px = (size / cols) * x + 2;
        const py = (size / rows) * y + 1;
        ctx.fillRect(px, py, (size / cols) - 4, (size / rows) - 2);
      }
    }
    const tex = new THREE.CanvasTexture(cvs);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    return tex;
  }, []);
}

/* ------------------------------------------------- Wet reflective road */
function WetRoad({ isMobile }) {
  const markings = useRef([]);
  useFrame((_, delta) =>
    markings.current.forEach((line) => {
      if (line) {
        line.position.z += delta * 32;
        if (line.position.z > 20) line.position.z -= 130;
      }
    })
  );

  return (
    <>
      {/* Dark wet asphalt extending continuously from +50 to -170 past billboard */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, ROAD_SURFACE_Y, -60]} receiveShadow>
        <planeGeometry args={[44, 220]} />
        <MeshReflectorMaterial
          blur={isMobile ? [200, 80] : [340, 80]}
          resolution={isMobile ? 384 : 768}
          mixBlur={0.82}
          mixStrength={isMobile ? 6.5 : 9.0}
          depthScale={1.2}
          minDepthThreshold={0.25}
          maxDepthThreshold={1.6}
          roughness={0.32}
          metalness={0.78}
          color="#060a0f"
          mirror={0.8}
        />
      </mesh>

      {/* Dashed lane markings */}
      {[-9, -3, 3, 9].map((x) => (
        <group key={x}>
          {Array.from({ length: 18 }, (_, i) => (
            <mesh
              key={i}
              ref={(node) => { if (node && !markings.current.includes(node)) markings.current.push(node); }}
              position={[x, ROAD_SURFACE_Y + 0.006, -i * 7.5 - 2]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[0.16, 3.6]} />
              <meshBasicMaterial color="#f2f8fa" transparent opacity={0.8} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Concrete side barriers */}
      <mesh position={[-14.2, 0.6, -50]} receiveShadow>
        <boxGeometry args={[0.6, 1.2, 180]} />
        <meshStandardMaterial color="#17222a" metalness={0.5} roughness={0.55} />
      </mesh>
      <mesh position={[14.2, 0.6, -50]} receiveShadow>
        <boxGeometry args={[0.6, 1.2, 180]} />
        <meshStandardMaterial color="#17222a" metalness={0.5} roughness={0.55} />
      </mesh>

      {/* Wet reflections / puddle accents */}
      {[-7, 5, -3, 9, 1].map((x, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, ROAD_SURFACE_Y + 0.002, -10 - i * 9]}>
          <planeGeometry args={[3.6, 1.5]} />
          <meshBasicMaterial color={cyan} transparent opacity={0.06} />
        </mesh>
      ))}
    </>
  );
}

/* --------------------------------------------------------- Streetlights */
function Streetlights() {
  const positions = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 9; i++) {
      arr.push({ x: -14.8, z: -4 - i * 13, side: -1 });
      arr.push({ x: 14.8, z: -4 - i * 13, side: 1 });
    }
    return arr;
  }, []);

  return (
    <group>
      {positions.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh position={[0, 3.5, 0]}>
            <cylinderGeometry args={[0.07, 0.1, 7.0, 8]} />
            <meshStandardMaterial color="#121a20" metalness={0.75} roughness={0.45} />
          </mesh>
          <mesh position={[-p.side * 1.3, 6.7, 0]}>
            <boxGeometry args={[2.6, 0.09, 0.14]} />
            <meshStandardMaterial color="#121a20" metalness={0.75} roughness={0.45} />
          </mesh>
          <mesh position={[-p.side * 2.4, 6.55, 0]} rotation={[0, 0, -p.side * 0.15]}>
            <boxGeometry args={[0.6, 0.18, 0.45]} />
            <meshStandardMaterial color="#202a32" metalness={0.8} roughness={0.35} />
          </mesh>
          <mesh position={[-p.side * 2.4, 6.44, 0]}>
            <boxGeometry args={[0.52, 0.06, 0.36]} />
            <meshBasicMaterial color="#ffe8c2" toneMapped={false} />
          </mesh>
          <mesh position={[-p.side * 2.4, 3.6, 0]}>
            <coneGeometry args={[1.6, 5.8, 8, 1, true]} />
            <meshBasicMaterial color="#ffd899" transparent opacity={0.04} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-p.side * 2.4, 0.006, 0]}>
            <circleGeometry args={[2.8, 24]} />
            <meshBasicMaterial color="#ffd490" transparent opacity={0.1} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------- City */
function City() {
  const facade = useCityFacadeTexture();
  const buildings = useMemo(() => {
    const rng = (n) => {
      const s = Math.sin(n * 91.37) * 43758.5453;
      return s - Math.floor(s);
    };
    const arr = [];
    for (let i = 0; i < 28; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (24 + rng(i) * 12);
      const z = -4 - (i * 4.4) - rng(i + 30) * 4;
      const w = 4 + rng(i + 80) * 4.5;
      const h = 8 + rng(i + 120) * 22;
      const d = 4 + rng(i + 160) * 5.5;
      arr.push({ x, z, w, h, d, tier: "near" });
    }
    for (let i = 0; i < 38; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (38 + rng(i + 250) * 28);
      const z = -28 - rng(i + 350) * 65;
      const w = 5 + rng(i + 450) * 9;
      const h = 16 + rng(i + 550) * 34;
      const d = 5 + rng(i + 650) * 9;
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
              color={b.tier === "near" ? "#0a131b" : "#060d14"}
              roughness={0.82}
              metalness={0.18}
              map={facade}
              emissiveMap={facade}
              emissive="#ffefbe"
              emissiveIntensity={b.tier === "near" ? 0.28 : 0.4}
            />
          </mesh>
          {b.tier === "near" && i % 4 === 0 && (
            <mesh position={[0, b.h / 2 + 0.45, 0]}>
              <boxGeometry args={[0.08, 0.7, 0.08]} />
              <meshBasicMaterial color="#ff203a" />
            </mesh>
          )}
        </group>
      ))}
      <mesh position={[0, 14, -98]}>
        <planeGeometry args={[260, 70]} />
        <meshBasicMaterial color="#081420" transparent opacity={0.6} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------- GLB Traffic Car */
function GLBTrafficCar({ modelIndex }) {
  const modelInfo = TRAFFIC_MODELS[modelIndex % TRAFFIC_MODELS.length];
  const gltf = useGLTF(modelInfo.url);

  const { scene } = useMemo(() => {
    const cloned = gltf.scene.clone(true);

    // Pivot wrapper to apply correct forward rotation per model
    const pivot = new THREE.Group();
    cloned.rotation.y = modelInfo.rotY || 0;
    pivot.add(cloned);

    // Compute bounding box strictly over visible meshes to find tire contact
    const rotatedBox = new THREE.Box3();
    pivot.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
        if (child.material) {
          child.material.envMapIntensity = 2.5;
          const matName = (child.material.name || child.name || "").toLowerCase();
          if (!matName.includes("glass") && !matName.includes("window") && !matName.includes("trans")) {
            child.material.transparent = false;
            child.material.opacity = 1.0;
          }
        }
        rotatedBox.expandByObject(child);
      }
    });

    const rotatedSize = new THREE.Vector3();
    rotatedBox.getSize(rotatedSize);
    const rotatedCenter = new THREE.Vector3();
    rotatedBox.getCenter(rotatedCenter);

    // Safe scale factor computation
    const maxDim = Math.max(rotatedSize.x, rotatedSize.z, rotatedSize.y);
    const targetLength = modelInfo.targetLength || 4.4;
    let scaleFactor = (maxDim > 0 && isFinite(maxDim)) ? targetLength / maxDim : 1.0;
    if (!isFinite(scaleFactor) || scaleFactor <= 0) scaleFactor = 1.0;

    // Position cloned scene inside pivot so tire contact point is at local y = 0
    const offX = isFinite(rotatedCenter.x) ? -rotatedCenter.x * scaleFactor : 0;
    const offY = isFinite(rotatedBox.min.y) ? -rotatedBox.min.y * scaleFactor : 0;
    const offZ = isFinite(rotatedCenter.z) ? -rotatedCenter.z * scaleFactor : 0;

    cloned.position.set(offX, offY, offZ);
    cloned.scale.setScalar(scaleFactor);

    return { scene: pivot };
  }, [gltf, modelInfo]);

  return (
    <group>
      <primitive object={scene} />

      {/* Ground Contact Shadow sitting directly on road surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[2.0, 4.4]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.68} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------- Traffic Pooling System */
// 4 safe highway lane centers completely clearing hero supercar at x = -1.25
const TRAFFIC_LANES = [-6.8, -4.2, 2.4, 6.4];

function Traffic() {
  const POOL_SIZE = 6;
  const vehiclesRef = useRef([]);

  // Fixed vehicle pool initialized once with proper spacing
  const poolData = useMemo(() => {
    const arr = [];
    const initialZ = [-22, -42, -62, -32, -52, -72];
    for (let i = 0; i < POOL_SIZE; i++) {
      const lane = TRAFFIC_LANES[i % TRAFFIC_LANES.length];
      const targetSpeed = 13 + (i % 3) * 2.5;
      arr.push({
        modelIndex: i % TRAFFIC_MODELS.length,
        lane,
        z: initialZ[i],
        speed: targetSpeed * 0.8,
        targetSpeed,
      });
    }
    return arr;
  }, []);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;

    vehiclesRef.current.forEach((veh, i) => {
      if (!veh) return;
      const data = poolData[i];

      // Safe following distance check: detect car ahead in same lane
      let cruiseSpeed = data.targetSpeed;
      poolData.forEach((other, idx) => {
        if (idx !== i && other.lane === data.lane && other.z < data.z) {
          const dist = data.z - other.z; // Distance ahead to car in front
          if (dist > 0 && dist < 20) {
            cruiseSpeed = Math.min(cruiseSpeed, other.speed * 0.9);
          }
        }
      });

      // Smooth acceleration / speed buildup
      data.speed = THREE.MathUtils.damp(data.speed, cruiseSpeed, 1.8, delta);

      // Frame-rate independent delta time motion: traveling AWAY from camera towards billboard (-Z direction)
      data.z -= delta * data.speed;

      // Safe recycling: recycle when vehicle reaches dark city horizon (z < -92)
      if (data.z < -92) {
        let newZ = 18 + Math.random() * 12;
        let newLane = TRAFFIC_LANES[Math.floor(Math.random() * TRAFFIC_LANES.length)];

        // Prevent longitudinal collision overlap with other vehicles in the same lane
        const inSameLane = poolData.filter((v, idx) => idx !== i && v.lane === newLane);
        const tooClose = inSameLane.some((v) => Math.abs(v.z - newZ) < 22);
        if (tooClose) {
          newZ += 25;
        }

        data.z = newZ;
        data.lane = newLane;
        data.targetSpeed = 13 + Math.random() * 5;
        data.speed = data.targetSpeed * 0.4;
      }

      // Smooth lane positioning
      veh.position.x = THREE.MathUtils.damp(veh.position.x, data.lane, 6, delta);
      veh.position.z = data.z;

      // Tires sit EXACTLY on top of the road surface at ROAD_SURFACE_Y (-0.03) with micro-suspension
      veh.position.y = ROAD_SURFACE_Y + Math.sin(time * 7 + i * 1.5) * 0.002;
    });
  });

  return (
    <group>
      {poolData.map((d, i) => (
        <group
          key={i}
          ref={(node) => { vehiclesRef.current[i] = node; }}
          position={[d.lane, ROAD_SURFACE_Y, d.z]}
        >
          <GLBTrafficCar modelIndex={d.modelIndex} />
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------ Car (hero GLB - UNCHANGED) */
function Car({ isMobile }) {
  const position = isMobile ? [-0.4, 0, 4.6] : [-1.25, 0, 1.8];
  const scale = isMobile ? 0.95 : 1.18;

  const gltf = useGLTF("/models/ferrari.glb", "https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const name = (child.name || "").toLowerCase();
        const matName = (child.material?.name || "").toLowerCase();

        if (name.includes("body") || matName.includes("body") || matName.includes("paint") || matName.includes("car")) {
          child.material = new THREE.MeshStandardMaterial({
            color: "#182430",
            metalness: 0.94,
            roughness: 0.14,
            envMapIntensity: 2.6,
          });
        } else if (name.includes("glass") || matName.includes("glass")) {
          child.material = new THREE.MeshStandardMaterial({
            color: "#050b12",
            metalness: 0.96,
            roughness: 0.05,
            transparent: true,
            opacity: 0.88,
          });
        } else if (name.includes("rim") || name.includes("wheel") || matName.includes("rim")) {
          child.material = new THREE.MeshStandardMaterial({
            color: "#9ab0be",
            metalness: 0.98,
            roughness: 0.16,
          });
        }
      }
    });
    return cloned;
  }, [gltf]);

  const groupRef = useRef();
  useFrame((state) => {
    if (groupRef.current) {
      const t = state.clock.elapsedTime;
      groupRef.current.position.y = position[1] + Math.sin(t * 4.8) * 0.005;
      groupRef.current.rotation.z = Math.sin(t * 3.2) * 0.002;
    }
  });

  const [px, py, pz] = position;

  return (
    <>
      <pointLight position={[px + 3.8, py + 5.0, pz + 3.0]} intensity={45} distance={16} color="#eaf4ff" />
      <pointLight position={[px - 2.2, py + 3.2, pz - 4.0]} intensity={25} distance={12} color={cyan} />
      <pointLight position={[px + 2.8, py + 1.6, pz - 0.5]} intensity={12} distance={7} color="#ffb066" />
      <pointLight position={[px, py + 1.0, pz]} intensity={2.8} distance={4.0} color="#4a6a7e" />

      <group ref={groupRef} position={position} rotation={[0, 0, 0]} scale={scale * 0.92}>
        <primitive object={scene} />

        <group position={[0, 0.45, 2.15]} rotation={[0, 0, 0]}>
          <mesh>
            <planeGeometry args={[0.72, 0.2]} />
            <meshStandardMaterial color="#eae4ca" emissive="#3d371a" emissiveIntensity={0.5} />
          </mesh>
          <Text position={[0, 0, 0.008]} fontSize={0.08} color="#080808" anchorX="center" anchorY="middle" letterSpacing={0.02}>
            THE BOARD
          </Text>
        </group>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <planeGeometry args={[2.8, 4.6]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.65} depthWrite={false} />
        </mesh>
      </group>

      <pointLight position={[px, py + 0.35, pz + 1.8]} intensity={isMobile ? 1.4 : 2.2} distance={5.2} color="#ff1638" />
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
  const lamps = useMemo(() => [-12, -8, -4, 0, 4, 8, 12], []);
  return (
    <group position={[0, 1.2, -28]} scale={1.72}>
      <mesh position={[0, 8.2, 0]} castShadow>
        <boxGeometry args={[20.2, 8.8, 0.45]} />
        <meshStandardMaterial color="#0a1015" metalness={0.84} roughness={0.24} />
      </mesh>
      <mesh position={[0, 8.2, 0.26]}>
        <boxGeometry args={[19.6, 8.2, 0.06]} />
        <meshStandardMaterial color="#04080c" metalness={0.5} roughness={0.3} emissive="#021a26" emissiveIntensity={0.35} />
      </mesh>

      <mesh position={[0, 12.5, 0.36]}><boxGeometry args={[20.3, 0.14, 0.07]} /><meshBasicMaterial color={cyan} toneMapped={false} /></mesh>
      <mesh position={[0, 3.9, 0.36]}><boxGeometry args={[20.3, 0.14, 0.07]} /><meshBasicMaterial color={cyan} toneMapped={false} /></mesh>
      <mesh position={[-10.15, 8.2, 0.36]}><boxGeometry args={[0.14, 8.7, 0.07]} /><meshBasicMaterial color={cyan} toneMapped={false} /></mesh>
      <mesh position={[10.15, 8.2, 0.36]}><boxGeometry args={[0.14, 8.7, 0.07]} /><meshBasicMaterial color={cyan} toneMapped={false} /></mesh>

      {[-9.8, 9.8].map((x) => (
        <mesh key={x} position={[x, 5.1, 0]} castShadow>
          <boxGeometry args={[0.55, 14.5, 0.9]} />
          <meshStandardMaterial color="#24323a" metalness={0.92} roughness={0.28} />
        </mesh>
      ))}

      {[-6, 0, 6].map((x) => (
        <group key={x} position={[x, 2.2, 0]}>
          <mesh rotation={[0, 0, 0.35]}><boxGeometry args={[0.1, 2.5, 0.16]} /><meshStandardMaterial color="#18242e" metalness={0.88} roughness={0.32} /></mesh>
          <mesh rotation={[0, 0, -0.35]}><boxGeometry args={[0.1, 2.5, 0.16]} /><meshStandardMaterial color="#18242e" metalness={0.88} roughness={0.32} /></mesh>
        </group>
      ))}
      <mesh position={[0, 1.2, 0]} castShadow><boxGeometry args={[1.3, 1.5, 1.4]} /><meshStandardMaterial color="#18242c" metalness={0.88} /></mesh>
      <mesh position={[0, 2.2, 0]} castShadow><boxGeometry args={[16.2, 0.55, 0.76]} /><meshStandardMaterial color="#1e2a32" metalness={0.9} /></mesh>
      <mesh position={[0, 14.8, 0]} castShadow><boxGeometry args={[20.8, 0.48, 0.8]} /><meshStandardMaterial color="#1e2a32" metalness={0.9} /></mesh>

      {lamps.map((x, i) => (
        <group key={i} position={[x, 13.5, 0.16]}>
          <mesh><boxGeometry args={[0.08, 0.72, 0.08]} /><meshStandardMaterial color="#28353f" metalness={0.88} roughness={0.32} /></mesh>
          <mesh position={[0, -0.3, 0.26]} rotation={[0.92, 0, 0]}><boxGeometry args={[0.68, 0.18, 0.42]} /><meshStandardMaterial color="#28353f" metalness={0.88} roughness={0.32} /></mesh>
          <mesh position={[0, -0.48, 0.44]}><sphereGeometry args={[0.14, 12, 8]} /><meshBasicMaterial color="#fff8e0" toneMapped={false} /></mesh>
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
  const currentLookAt = useRef(new THREE.Vector3(0, isMobile ? 6.8 : 5.2, isMobile ? -20 : -18));
  
  useEffect(() => { if (!cinematic) elapsed.current = 12; }, [cinematic]);
  useEffect(() => { elapsed.current = 0; }, [resetTick]);

  useFrame((_, delta) => {
    elapsed.current += delta;
    const zoomOffset = zoomStep === 1 ? -3.5 : zoomStep === 2 ? 3.5 : 0;

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
        const targetZ = 24.5 + zoomOffset;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, 0, 3.5, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 3.5, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, 0.85 + Math.sin(elapsed.current * 0.22) * 0.04, 3.5, delta);
        currentLookAt.current.set(0, 0.8, -20);
        camera.lookAt(currentLookAt.current);
      } else {
        const targetZ = 7.8 + zoomOffset;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, 0, 3.5, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 3.5, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, 1.85 + Math.sin(elapsed.current * 0.22) * 0.04, 3.5, delta);
        currentLookAt.current.set(0, 5.2, -18);
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
      <Environment preset="night" environmentIntensity={1.5} />
      <ambientLight intensity={0.28} color="#94bbcc" />
      <hemisphereLight args={["#527690", "#050912", 0.4]} />
      <directionalLight
        position={[-12, 20, 14]}
        intensity={1.2}
        color="#d2f5ff"
        castShadow={!isMobile}
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[0, 11, -30]} intensity={28} distance={30} color={cyan} />

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
        minDistance={isMobile ? 18 : 12}
        maxDistance={isMobile ? 36 : 30}
        maxPolarAngle={isMobile ? 1.42 : 1.52}
        minPolarAngle={isMobile ? 1.05 : 0.8}
        target={[0, isMobile ? 8 : 8, -30]}
      />

      <EffectComposer disableNormalPass multisampling={0}>
        <Bloom intensity={0.55} luminanceThreshold={0.82} radius={0.65} />
        <Vignette eskil={false} offset={0.12} darkness={0.55} />
      </EffectComposer>
    </>
  );
}
