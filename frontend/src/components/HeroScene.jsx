import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, OrbitControls, Text, MeshReflectorMaterial, useGLTF } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { SPOTS, GRID, panelWorldPosition } from "./spotData";
import { audioManager } from "@/lib/audioManager";

const cyan = "#00d9ff";

// Exact road surface Y coordinate in world space
const ROAD_SURFACE_Y = -0.03;

// Preload player Ferrari and 3 traffic GLB models
useGLTF.preload("/models/ferrari.glb", "https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
useGLTF.preload("/models/cars/carglb/source/car_glb.glb");
useGLTF.preload("/models/cars/mustang-cobra/source/2019 Ford Mustang Cobra Jet.glb");
useGLTF.preload("/models/cars/mustang-gt3/source/ford_mustang_gt3.glb");

// Model specifications for the 3 real imported GLBs with model-specific normalization
const TRAFFIC_MODELS = [
  { name: "carglb",        url: "/models/cars/carglb/source/car_glb.glb",                           rotY: Math.PI, targetLength: 4.4, groundOffset: 0.0 },
  { name: "mustang-cobra", url: "/models/cars/mustang-cobra/source/2019 Ford Mustang Cobra Jet.glb", rotY: Math.PI, targetLength: 4.6, groundOffset: 0.0 },
  { name: "mustang-gt3",   url: "/models/cars/mustang-gt3/source/ford_mustang_gt3.glb",              rotY: Math.PI, targetLength: 4.5, groundOffset: -0.42 },
];

/**
 * groundVehicleToRoad
 * -------------------
 * Adjusts group's Y position by calculating exact world bounding box
 * and aligning the lowest point with targetRoadY.
 */
function groundVehicleToRoad(group, targetRoadY = ROAD_SURFACE_Y) {
  if (!group) return targetRoadY;
  group.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(group);
  if (!isFinite(box.min.y)) return targetRoadY;
  const correction = targetRoadY - box.min.y;
  group.position.y += correction;
  return group.position.y;
}

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
  const lightsRef = useRef([]);

  const positions = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 9; i++) {
      arr.push({ x: -14.8, z: 8 - i * 13, side: -1 });
      arr.push({ x: 14.8, z: 8 - i * 13, side: 1 });
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    lightsRef.current.forEach((light) => {
      if (!light) return;
      light.position.z += delta * 24; // Scroll backward matching highway forward speed
      if (light.position.z > 14) {
        light.position.z -= 117; // Recycle back to horizon
      }
    });
  });

  return (
    <group>
      {positions.map((p, i) => (
        <group
          key={i}
          ref={(node) => { lightsRef.current[i] = node; }}
          position={[p.x, 0, p.z]}
        >
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

/**
 * buildTrafficScene
 * -----------------
 * Surgical Pipeline:
 * 1. Hide embedded shadow quads/planes inside raw GLTF models.
 * 2. Calculate scale factor over visible geometry.
 * 3. Search specifically for wheel/tire sub-meshes to find tire contact patch.
 * 4. Align tire bottom flush to local Y = 0 (applying model-specific groundOffset).
 */
function buildTrafficScene(gltf, modelInfo) {
  const cloned = gltf.scene.clone(true);

  // 1. Normalize Orientation
  cloned.rotation.y = modelInfo.rotY || 0;

  // 2. Material & Shadow optimization — hide fake embedded GLTF shadow planes
  cloned.traverse((child) => {
    if (!child.isMesh) return;
    
    const matName = (child.material?.name || child.name || "").toLowerCase();
    
    // Hide embedded static fake shadow planes from raw GLTF files (e.g. carglb ground quads)
    if (matName.includes("shadow") || matName.includes("fake_shadow") || matName.includes("plane_shadow") || matName.includes("ground_shadow")) {
      child.visible = false;
      return;
    }

    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = false;

    if (child.material) {
      child.material = child.material.clone();
      const mat = child.material;
      const isGlass = matName.includes("glass") || matName.includes("window") || matName.includes("wind");

      if (mat.envMapIntensity !== undefined) mat.envMapIntensity = 2.2;

      if (!isGlass) {
        mat.transparent = false;
        mat.opacity = 1.0;
        if (mat.roughness !== undefined) mat.roughness = Math.min(mat.roughness, 0.65);
      }
    }
  });

  // 3. Compute Bounding Box over VISIBLE solid vehicle meshes ONLY
  cloned.updateMatrix();
  cloned.updateMatrixWorld(true);
  const meshBox = new THREE.Box3();
  cloned.traverse((child) => {
    if (child.isMesh && child.visible && child.geometry) {
      child.updateMatrixWorld(true);
      meshBox.expandByObject(child);
    }
  });

  const size = new THREE.Vector3();
  meshBox.getSize(size);

  // 4. Normalize Scale based on target vehicle length
  const targetLength = modelInfo.targetLength || 4.4;
  const longestDim = Math.max(size.x, size.z);
  let scaleFactor = (longestDim > 0 && isFinite(longestDim)) ? targetLength / longestDim : 1.0;
  if (!isFinite(scaleFactor) || scaleFactor <= 0) scaleFactor = 1.0;
  cloned.scale.setScalar(scaleFactor);

  // 5. Force update matrixWorld after scale so child node Box3 calculations reflect scaled coordinates
  cloned.updateMatrix();
  cloned.updateMatrixWorld(true);

  // 6. Search for wheel/tire meshes first to get accurate tire contact patch
  let wheelMinY = Infinity;
  let allMinY = Infinity;

  cloned.traverse((child) => {
    if (child.isMesh && child.visible && child.geometry) {
      child.updateMatrixWorld(true);
      const box = new THREE.Box3();
      box.setFromObject(child);
      if (isFinite(box.min.y)) {
        if (box.min.y < allMinY) allMinY = box.min.y;
        const name = (child.name || child.material?.name || "").toLowerCase();
        if (name.includes("wheel") || name.includes("tire") || name.includes("rim") || name.includes("tyre") || name.includes("rubber") || name.includes("rad")) {
          if (box.min.y < wheelMinY) wheelMinY = box.min.y;
        }
      }
    }
  });

  const scaledMeshBox = new THREE.Box3();
  cloned.traverse((child) => {
    if (child.isMesh && child.visible && child.geometry) {
      child.updateMatrixWorld(true);
      scaledMeshBox.expandByObject(child);
    }
  });

  const bottomY = isFinite(wheelMinY) ? wheelMinY : (isFinite(allMinY) ? allMinY : (isFinite(scaledMeshBox.min.y) ? scaledMeshBox.min.y : 0));
  const centerX = (scaledMeshBox.min.x + scaledMeshBox.max.x) / 2;
  const centerZ = (scaledMeshBox.min.z + scaledMeshBox.max.z) / 2;

  // Center car horizontally and align tires flush to local Y = 0
  const groundOffset = modelInfo.groundOffset || 0.0;
  cloned.position.set(
    -centerX,
    -bottomY + groundOffset,
    -centerZ
  );

  const pivot = new THREE.Group();
  pivot.add(cloned);
  return pivot;
}

function GLBTrafficCar({ modelIndex }) {
  const modelInfo = TRAFFIC_MODELS[modelIndex % TRAFFIC_MODELS.length];
  const gltf = useGLTF(modelInfo.url);
  const halfLen = (modelInfo.targetLength || 4.4) / 2;

  const scene = useMemo(
    () => buildTrafficScene(gltf, modelInfo),
    [gltf, modelInfo]
  );

  return (
    <group>
      {/* Pivot group with local Y=0 at tire contact patch */}
      <primitive object={scene} />

      {/* Headlights: Controlled, realistic intensity (Front = -Z) */}
      <pointLight position={[-0.55, 0.5, -halfLen - 0.1]} intensity={3.2} distance={8} color="#fff4e0" castShadow={false} />
      <pointLight position={[0.55, 0.5, -halfLen - 0.1]} intensity={3.2} distance={8} color="#fff4e0" castShadow={false} />

      {/* Taillights: Subtle red glow (Rear = +Z) */}
      <pointLight position={[-0.5, 0.48, halfLen + 0.1]} intensity={2.2} distance={4.5} color="#d91e18" castShadow={false} />
      <pointLight position={[0.5, 0.48, halfLen + 0.1]} intensity={2.2} distance={4.5} color="#d91e18" castShadow={false} />

      {/* Subtle Fill / Rim Light for 75% visual brightness relative to hero car */}
      <pointLight position={[0, 1.2, 0]} intensity={2.5} distance={4} color="#7a9ab0" castShadow={false} />

      {/* Soft Contact Shadow directly underneath tires (1mm above asphalt) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[1.9, 4.2]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------- Traffic Pooling System */
const TRAFFIC_LANES = [-6.8, -4.2, 2.4, 6.4];

function Traffic() {
  const POOL_SIZE = 6;
  const vehiclesRef = useRef([]);

  const poolData = useMemo(() => {
    const arr = [];
    const initialZ = [-30, -50, -70, -40, -60, -80];
    for (let i = 0; i < POOL_SIZE; i++) {
      const lane = TRAFFIC_LANES[i % TRAFFIC_LANES.length];
      const targetSpeed = 12 + (i % 3) * 2.2;
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
    vehiclesRef.current.forEach((veh, i) => {
      if (!veh) return;
      const data = poolData[i];

      // 1. Speed & Distance cruise logic
      let cruiseSpeed = data.targetSpeed;
      poolData.forEach((other, idx) => {
        if (idx !== i && other.lane === data.lane && other.z < data.z) {
          const dist = data.z - other.z;
          if (dist > 0 && dist < 20) {
            cruiseSpeed = Math.min(cruiseSpeed, other.speed * 0.9);
          }
        }
      });
      data.speed = THREE.MathUtils.damp(data.speed, cruiseSpeed, 1.8, delta);
      // Relative motion: hero car drives at 24.0 units/sec forward, traffic moves relative to hero
      data.z += delta * (24.0 - data.speed);

      // 2. Recycling at camera rear boundary
      if (data.z > 14) {
        let newZ = -92 - Math.random() * 20;
        let newLane = TRAFFIC_LANES[Math.floor(Math.random() * TRAFFIC_LANES.length)];
        const inSameLane = poolData.filter((v, idx) => idx !== i && v.lane === newLane);
        const tooClose = inSameLane.some((v) => Math.abs(v.z - newZ) < 22);
        if (tooClose) newZ -= 25;

        data.z = newZ;
        data.lane = newLane;
        data.targetSpeed = 12 + Math.random() * 6;
        data.speed = data.targetSpeed * 0.8;
      }

      // 3. Smooth lane positioning — locked 100% to ROAD_SURFACE_Y
      veh.position.x = THREE.MathUtils.damp(veh.position.x, data.lane, 6, delta);
      veh.position.z = data.z;
      veh.position.y = ROAD_SURFACE_Y;
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

/* ------------------------------------------------------------ Car (hero GLB - DYNAMIC DRIVING SIMULATION) */
function Car({ isMobile, isPortrait = true }) {
  const isMobilePortrait = isMobile && isPortrait;
  const isMobileLandscape = isMobile && !isPortrait;

  const position = isMobilePortrait ? [0, 0, 3.8] : isMobileLandscape ? [0, 0, 2.0] : [-1.25, 0, 1.8];
  const scale = isMobilePortrait ? 1.08 : isMobileLandscape ? 1.12 : 1.18;

  const gltf = useGLTF("/models/ferrari.glb", "https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
  const wheelsRef = useRef([]);

  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);

    // Log ALL node names so we know exact wheel identifiers in this GLB
    const allNames = [];
    cloned.traverse((child) => {
      if (child.name) allNames.push(`${child.type}: ${child.name} (mat: ${child.material?.name || "-"})`);

      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const name = (child.name || "").toLowerCase();
        const matName = (child.material?.name || "").toLowerCase();

        if (name.includes("body") || matName.includes("body") || matName.includes("paint") || matName.includes("car")) {
          child.material = new THREE.MeshStandardMaterial({
            color: "#182430", metalness: 0.94, roughness: 0.14, envMapIntensity: 2.6,
          });
        } else if (name.includes("glass") || matName.includes("glass")) {
          child.material = new THREE.MeshStandardMaterial({
            color: "#050b12", metalness: 0.96, roughness: 0.05, transparent: true, opacity: 0.88,
          });
        } else if (name.includes("rim") || name.includes("wheel") || matName.includes("rim")) {
          child.material = new THREE.MeshStandardMaterial({
            color: "#9ab0be", metalness: 0.98, roughness: 0.16,
          });
        }
      }
    });
    console.log("[Ferrari GLB Nodes]", allNames.join("\n"));
    return cloned;
  }, [gltf]);

  // Target exact 4 wheel parent nodes in Ferrari GLB: wheel_fl, wheel_fr, wheel_rl, wheel_rr
  useEffect(() => {
    if (!scene) return;
    const fl = scene.getObjectByName("wheel_fl");
    const fr = scene.getObjectByName("wheel_fr");
    const rl = scene.getObjectByName("wheel_rl");
    const rr = scene.getObjectByName("wheel_rr");

    const wheelNodes = [fl, fr, rl, rr].filter(Boolean);
    wheelsRef.current = wheelNodes;
  }, [scene]);

  const groupRef = useRef();
  useFrame((state, delta) => {
    if (groupRef.current) {
      const t = state.clock.elapsedTime;
      const heroSpeed = 32.0; // Highway cruising speed

      // 1. Rotate all 4 exact Ferrari wheel parent nodes (wheel_fl, wheel_fr, wheel_rl, wheel_rr)
      const wheelRad = delta * (heroSpeed / 0.34);
      wheelsRef.current.forEach((w) => {
        w.rotation.x += wheelRad;
      });

      // 2. Realistic driving micro-dynamics (V8 engine vibe + suspension + pitch + steering micro-sway)
      const engineVibe = Math.sin(t * 34) * 0.0012;
      const suspensionY = Math.sin(t * 4.2) * 0.0022;
      const pitchX = Math.sin(t * 1.8) * 0.002;
      const steerZ = Math.sin(t * 1.2) * 0.003;
      const swayOffset = Math.sin(t * 0.8) * (isMobile ? 0.04 : 0.08);
      const swayX = position[0] + swayOffset;

      groupRef.current.position.x = swayX;
      groupRef.current.position.y = position[1] + suspensionY + engineVibe;
      groupRef.current.rotation.x = pitchX;
      groupRef.current.rotation.z = steerZ;

      // 3. Supercar audio engine update (V8 engine RPM + Turbo spool + Road noise)
      audioManager.update(delta, heroSpeed, Math.sin(t * 0.5) > 0.6);
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
        <boxGeometry args={[3.6, 1.9, 0.08]} />
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
          <planeGeometry args={[3.5, 1.8]} />
          <meshBasicMaterial color={cyan} transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}
      {spot.claimed && (
        <mesh position={[0, 0, 0.045]}>
          <planeGeometry args={[3.44, 1.74]} />
          <meshBasicMaterial color={spot.color || "#42616a"} transparent opacity={isDimmed ? 0.18 : 0.35} depthWrite={false} />
        </mesh>
      )}
      <Text position={[-1.58, 0.72, 0.09]} fontSize={0.22} color="#dbe7e9" anchorX="left" anchorY="middle">
        {String(spot.id).padStart(2, "0")}
      </Text>
      {spot.claimed ? (
        <Text position={[0, -0.12, 0.09]} fontSize={0.32} color="#ffffff" anchorX="center" anchorY="middle" maxWidth={3.3}>
          {spot.handle}
        </Text>
      ) : (
        <>
          <Text position={[0, 0.25, 0.09]} fontSize={0.22} color={cyan} anchorX="center" anchorY="middle" letterSpacing={0.08}>
            AVAILABLE
          </Text>
          <Text position={[0, -0.22, 0.09]} fontSize={0.48} color="#ffffff" anchorX="center" anchorY="middle">
            {priceLabel}
          </Text>
        </>
      )}
    </group>
  );
}

function Panels({ spots = SPOTS, hoveredId, selectedId, onHover, onSelect }) {
  const spotsList = (spots && spots.length > 0) ? spots : SPOTS;
  return (
    <group position={[0, GRID.panelsY, GRID.panelsZ]}>
      {spotsList.map((spot, i) => (
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
function Billboard({ spots = SPOTS, hoveredId, selectedId, onHover, onSelect, isMobile, isPortrait = true }) {
  const lamps = useMemo(() => [-12, -8, -4, 0, 4, 8, 12], []);
  const isMobilePortrait = isMobile && isPortrait;
  const isMobileLandscape = isMobile && !isPortrait;

  const bbPos = isMobilePortrait ? [0, 2.1, -26] : isMobileLandscape ? [0, 1.4, -28] : [0, 1.2, -28];
  const bbScale = isMobilePortrait ? 1.02 : isMobileLandscape ? 1.55 : 1.85;

  return (
    <group position={bbPos} scale={bbScale}>
      <mesh position={[0, 8.2, 0]} castShadow>
        <boxGeometry args={[21.4, 9.8, 0.45]} />
        <meshStandardMaterial color="#0a1015" metalness={0.84} roughness={0.24} />
      </mesh>
      <mesh position={[0, 8.2, 0.26]}>
        <boxGeometry args={[20.8, 9.2, 0.06]} />
        <meshStandardMaterial color="#04080c" metalness={0.5} roughness={0.3} emissive="#021a26" emissiveIntensity={0.35} />
      </mesh>

      <mesh position={[0, 13.1, 0.36]}><boxGeometry args={[21.5, 0.14, 0.07]} /><meshBasicMaterial color={cyan} toneMapped={false} /></mesh>
      <mesh position={[0, 3.3, 0.36]}><boxGeometry args={[21.5, 0.14, 0.07]} /><meshBasicMaterial color={cyan} toneMapped={false} /></mesh>
      <mesh position={[-10.75, 8.2, 0.36]}><boxGeometry args={[0.14, 9.9, 0.07]} /><meshBasicMaterial color={cyan} toneMapped={false} /></mesh>
      <mesh position={[10.75, 8.2, 0.36]}><boxGeometry args={[0.14, 8.7, 0.07]} /><meshBasicMaterial color={cyan} toneMapped={false} /></mesh>

      {[-10.4, 10.4].map((x) => (
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
      <mesh position={[0, 2.2, 0]} castShadow><boxGeometry args={[17.2, 0.55, 0.76]} /><meshStandardMaterial color="#1e2a32" metalness={0.9} /></mesh>
      <mesh position={[0, 14.8, 0]} castShadow><boxGeometry args={[21.8, 0.48, 0.8]} /><meshStandardMaterial color="#1e2a32" metalness={0.9} /></mesh>

      {lamps.map((x, i) => (
        <group key={i} position={[x, 13.5, 0.16]}>
          <mesh><boxGeometry args={[0.08, 0.72, 0.08]} /><meshStandardMaterial color="#28353f" metalness={0.88} roughness={0.32} /></mesh>
          <mesh position={[0, -0.3, 0.26]} rotation={[0.92, 0, 0]}><boxGeometry args={[0.68, 0.18, 0.42]} /><meshStandardMaterial color="#28353f" metalness={0.88} roughness={0.32} /></mesh>
          <mesh position={[0, -0.48, 0.44]}><sphereGeometry args={[0.14, 12, 8]} /><meshBasicMaterial color="#fff8e0" toneMapped={false} /></mesh>
        </group>
      ))}
      <Panels spots={spots} hoveredId={hoveredId} selectedId={selectedId} onHover={onHover} onSelect={onSelect} />
    </group>
  );
}

/* ------------------------------------------------------------ SceneCamera */
function SceneCamera({ cameraMode = "cinematic", isMobile, isPortrait = true, zoomStep, selectedId, resetTick }) {
  const { camera } = useThree();
  const elapsed = useRef(0);
  const isMobilePortrait = isMobile && isPortrait;
  const isMobileLandscape = isMobile && !isPortrait;

  const currentLookAt = useRef(new THREE.Vector3(0, isMobilePortrait ? 4.7 : isMobileLandscape ? 5.0 : 5.2, -18));
  
  useEffect(() => { elapsed.current = 0; }, [cameraMode, resetTick]);

  useFrame((_, delta) => {
    elapsed.current += delta;
    const zoomOffset = zoomStep === 1 ? -3.5 : zoomStep === 2 ? 3.5 : 0;

    if (selectedId != null) {
      const idx = SPOTS.findIndex((s) => s.id === selectedId);
      if (idx >= 0) {
        const [px, py, pz] = panelWorldPosition(idx);
        const fx = px * (isMobilePortrait ? 0.35 : 0.55);
        const fy = py + (isMobilePortrait ? 0.7 : 0.4);
        const fz = pz + (isMobilePortrait ? 11.5 : 6);
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

    if (cameraMode === "sweep") {
      // 360° Panoramic City & Billboard Sweep Flyover
      const radius = isMobilePortrait ? 18 : 16;
      const angle = elapsed.current * 0.25;
      const camY = (isMobilePortrait ? 3.2 : 2.5) + Math.sin(elapsed.current * 0.3) * (isMobilePortrait ? 0.6 : 0.8);
      const targetX = Math.sin(angle) * radius;
      const targetZ = Math.cos(angle) * radius + (isMobilePortrait ? -12 : -10) + zoomOffset;

      camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX, 2.2, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 2.2, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, camY, 2.2, delta);
      currentLookAt.current.set(0, isMobilePortrait ? 5.2 : 5.8, isMobilePortrait ? -27 : -28);
      camera.lookAt(currentLookAt.current);
    } else if (cameraMode === "cinematic") {
      // Classic Ferrari Rear View facing Billboard directly
      if (isMobilePortrait) {
        const targetZ = 10.2 + zoomOffset;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, 0, 3.5, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 3.5, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, 2.0 + Math.sin(elapsed.current * 0.22) * 0.04, 3.5, delta);
        currentLookAt.current.set(0, 4.7, -18);
        camera.lookAt(currentLookAt.current);
      } else if (isMobileLandscape) {
        const targetZ = 7.8 + zoomOffset;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, 0, 3.5, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 3.5, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, 1.8 + Math.sin(elapsed.current * 0.22) * 0.04, 3.5, delta);
        currentLookAt.current.set(0, 5.0, -18);
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
export default function HeroScene({ cameraMode = "cinematic", isMobile, isPortrait = true, zoomStep = 0, hoveredId, selectedId, onHover, onSelect, resetTick = 0, spots = SPOTS }) {
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
      <Car isMobile={isMobile} isPortrait={isPortrait} />
      <Billboard spots={spots} hoveredId={hoveredId} selectedId={selectedId} onHover={onHover} onSelect={onSelect} isMobile={isMobile} isPortrait={isPortrait} />
      <SceneCamera cameraMode={cameraMode} isMobile={isMobile} isPortrait={isPortrait} zoomStep={zoomStep} selectedId={selectedId} resetTick={resetTick} />
      <OrbitControls
        enabled={cameraMode === "orbit" && selectedId == null}
        enablePan={false}
        minDistance={isMobile ? (isPortrait ? 14 : 10) : 12}
        maxDistance={isMobile ? (isPortrait ? 32 : 28) : 30}
        maxPolarAngle={isMobile ? (isPortrait ? 1.48 : 1.5) : 1.52}
        minPolarAngle={isMobile ? (isPortrait ? 0.9 : 0.8) : 0.8}
        target={isMobile ? (isPortrait ? [0, 6.0, -27] : [0, 6.5, -28]) : [0, 8, -30]}
      />

      <EffectComposer disableNormalPass multisampling={0}>
        <Bloom intensity={0.55} luminanceThreshold={0.82} radius={0.65} />
        <Vignette eskil={false} offset={0.12} darkness={0.55} />
      </EffectComposer>
    </>
  );
}
