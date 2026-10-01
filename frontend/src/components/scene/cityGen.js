import * as THREE from "three";
import {
  CROSS_STREETS, CROSS_HALF_W, SIDEWALK_OUT, STREET_MIN, STREET_NEAR,
} from "./layout";

/*
 * Procedural metropolis.
 *
 * Every building is assembled from architectural parts (podium, shaft tiers with
 * setbacks, cornices/parapets, balconies, fins, slab bands, rooftop plant,
 * masts) and written into ONE merged geometry. Per-vertex attributes tell the
 * facade shader what it is looking at:
 *   aFac  (u, v)   facade coordinates in metres, aligned to the building grid
 *   aBld  (bay, floorH, family, seed)
 *   aKind          0 windowed facade · 1 solid architecture · 2 shopfront podium
 *                  3 plant/metal · 4 crown light
 * Five architectural families × random proportions × per-building seeds keep
 * the street from ever repeating.
 */

export const FAMILY = { GLASS: 0, RESI: 1, STONE: 2, PANEL: 3, BRICK: 4 };

// Linear-space albedos (physically plausible: nothing is pure black).
const FAMILIES = [
  { bay: [1.5, 1.8], floor: [3.8, 4.2], walls: [[0.035, 0.04, 0.048], [0.06, 0.065, 0.075]] }, // curtain-wall office
  { bay: [3.0, 3.6], floor: [2.9, 3.1], walls: [[0.26, 0.25, 0.23], [0.4, 0.39, 0.36]] }, // concrete residential
  { bay: [2.3, 2.8], floor: [3.5, 3.9], walls: [[0.3, 0.26, 0.2], [0.45, 0.4, 0.32]] }, // limestone / art deco
  { bay: [1.8, 2.2], floor: [3.4, 3.7], walls: [[0.05, 0.052, 0.056], [0.1, 0.1, 0.105]] }, // dark composite panel
  { bay: [2.4, 2.9], floor: [3.1, 3.3], walls: [[0.18, 0.075, 0.05], [0.26, 0.12, 0.08]] }, // brick
];

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Builder {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.fac = [];
    this.bld = [];
    this.kind = [];
    this.cz = [];
    this.idx = [];
    this.n = 0;
    this.centerZ = 0; // footprint centre of the building being written (street wrap)
  }

  /** Quad with facade coordinates; p = 4 corners CCW seen from outside. */
  quad(p, nrm, uv, color, bld, kind) {
    const b = this.n;
    for (let i = 0; i < 4; i++) {
      this.pos.push(p[i][0], p[i][1], p[i][2]);
      this.nor.push(nrm[0], nrm[1], nrm[2]);
      this.col.push(color[0], color[1], color[2]);
      this.fac.push(uv[i][0], uv[i][1]);
      this.bld.push(bld[0], bld[1], bld[2], bld[3]);
      this.kind.push(kind);
      this.cz.push(this.centerZ);
    }
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    this.n += 4;
  }

  /**
   * Axis-aligned box. Facade u runs along each face from its own left edge,
   * v is height above `v0` so floors line up across setbacks.
   */
  box(x0, x1, y0, y1, z0, z1, color, bld, kind, v0 = 0, { top = true, faces = 15 } = {}) {
    const V = (y) => y - v0;
    // +z face (u along +x)
    if (faces & 1) this.quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], [[0, V(y0)], [x1 - x0, V(y0)], [x1 - x0, V(y1)], [0, V(y1)]], color, bld, kind);
    // -z face (u along -x)
    if (faces & 2) this.quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], [[0, V(y0)], [x1 - x0, V(y0)], [x1 - x0, V(y1)], [0, V(y1)]], color, bld, kind);
    // +x face (u along -z)
    if (faces & 4) this.quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], [[0, V(y0)], [z1 - z0, V(y0)], [z1 - z0, V(y1)], [0, V(y1)]], color, bld, kind);
    // -x face (u along +z)
    if (faces & 8) this.quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], [[0, V(y0)], [z1 - z0, V(y0)], [z1 - z0, V(y1)], [0, V(y1)]], color, bld, kind);
    if (top) this.quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], [[x0, z1], [x1, z1], [x1, z0], [x0, z0]], color, bld, kind === 0 || kind === 2 ? 1 : kind);
  }

  cylinder(cx, cz, r, y0, y1, color, bld, kind, seg = 10) {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 1) / seg) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const p0 = [cx + Math.cos(a0) * r, cz + Math.sin(a0) * r];
      const p1 = [cx + Math.cos(a1) * r, cz + Math.sin(a1) * r];
      this.quad([[p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]]].reverse(), [Math.cos(am), 0, Math.sin(am)], [[0, 0], [0, 0], [0, 0], [0, 0]], color, bld, kind);
    }
    // cap
    for (let i = 0; i < seg; i += 2) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 2) / seg) * Math.PI * 2;
      this.quad([[cx, y1, cz], [cx, y1, cz], [cx + Math.cos(a1) * r, y1, cz + Math.sin(a1) * r], [cx + Math.cos(a0) * r, y1, cz + Math.sin(a0) * r]], [0, 1, 0], [[0, 0], [0, 0], [0, 0], [0, 0]], color, bld, kind);
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute("aFac", new THREE.Float32BufferAttribute(this.fac, 2));
    g.setAttribute("aBld", new THREE.Float32BufferAttribute(this.bld, 4));
    g.setAttribute("aKind", new THREE.Float32BufferAttribute(this.kind, 1));
    g.setAttribute("aCz", new THREE.Float32BufferAttribute(this.cz, 1));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

const lerp = (a, b, t) => a + (b - a) * t;
const mixColor = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const snap = (v, step) => Math.max(step, Math.round(v / step) * step);

/**
 * One building. (x0..x1, z0..z1) is the footprint, `street` is the axis of the
 * street-facing face (+x / -x) that receives the richest detail.
 */
function building(B, rand, spec, out) {
  const { family, height, podium, street, detail } = spec;
  const F = FAMILIES[family];
  const bay = lerp(F.bay[0], F.bay[1], rand());
  const floorH = lerp(F.floor[0], F.floor[1], rand());
  const seed = rand() * 97 + 1;
  const wall = mixColor(F.walls[0], F.walls[1], rand());
  const bld = [bay, floorH, family, seed];
  const solidTone = mixColor(wall, [0.5, 0.5, 0.5], family === FAMILY.GLASS || family === FAMILY.PANEL ? 0.12 : 0.05);
  const metal = [0.16, 0.17, 0.18];

  let { x0, x1, z0, z1 } = spec;
  // snap footprint to whole bays so every face ends on a pier, not half a window
  const w = snap(x1 - x0, bay);
  const d = snap(z1 - z0, bay);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  B.centerZ = cz;
  x0 = cx - w / 2;
  x1 = cx + w / 2;
  z0 = cz - d / 2;
  z1 = cz + d / 2;

  let y = 0;
  // ---- podium: double-height retail with signage band
  if (podium) {
    const ph = 5.2;
    B.box(x0, x1, 0, ph, z0, z1, mixColor(wall, [0.08, 0.08, 0.08], 0.5), [4.2, ph, family, seed], 2, 0);
    // canopy / fascia ledge
    const o = 0.45;
    B.box(x0 - (street > 0 ? 0 : o), x1 + (street > 0 ? o : 0), ph, ph + 0.35, z0 - 0.05, z1 + 0.05, solidTone, bld, 1, 0);
    y = ph + 0.35;
  }

  // ---- shaft with setbacks
  const tiers = height > 90 ? 3 : height > 45 ? (rand() < 0.7 ? 2 : 1) : rand() < 0.35 ? 2 : 1;
  let tx0 = x0, tx1 = x1, tz0 = z0, tz1 = z1;
  const floorsTotal = Math.max(2, Math.round((height - y) / floorH));
  let floorsLeft = floorsTotal;
  for (let t = 0; t < tiers; t++) {
    const share = t === tiers - 1 ? floorsLeft : Math.max(2, Math.round(floorsLeft * lerp(0.55, 0.75, rand())));
    floorsLeft -= share;
    const y1 = y + share * floorH;
    B.box(tx0, tx1, y, y1, tz0, tz1, wall, bld, 0, podium ? 5.55 : 0);

    // street-face articulation
    const faceX = street > 0 ? tx1 : tx0;
    const dir = street > 0 ? 1 : -1;
    if (detail >= 1 && family === FAMILY.RESI && t === 0) {
      // balconies every floor, slightly inset from the corners
      for (let f = 1; f < share; f++) {
        const fy = y + f * floorH;
        const zz0 = tz0 + bay * 0.5;
        const zz1 = tz1 - bay * 0.5;
        const bx0 = dir > 0 ? faceX : faceX - 1.25;
        const bx1 = dir > 0 ? faceX + 1.25 : faceX;
        B.box(bx0, bx1, fy - 0.12, fy + 0.06, zz0, zz1, solidTone, bld, 1);
        const rx0 = dir > 0 ? faceX + 1.17 : faceX - 1.25;
        const rx1 = dir > 0 ? faceX + 1.25 : faceX - 1.17;
        B.box(rx0, rx1, fy + 0.06, fy + 1.0, zz0, zz1, mixColor(solidTone, [0.02, 0.025, 0.03], 0.55), bld, 1, 0, { top: true });
      }
    }
    if (detail >= 1 && (family === FAMILY.STONE || family === FAMILY.PANEL) && t === 0) {
      // vertical fins / pilasters on every other pier
      const step = bay * (family === FAMILY.STONE ? 2 : 1);
      for (let zz = tz0; zz <= tz1 + 1e-3; zz += step) {
        const fx0 = dir > 0 ? faceX : faceX - 0.35;
        const fx1 = dir > 0 ? faceX + 0.35 : faceX;
        B.box(fx0, fx1, y, y1, zz - 0.14, zz + 0.14, family === FAMILY.STONE ? mixColor(wall, [1, 1, 1], 0.08) : metal, bld, family === FAMILY.STONE ? 1 : 3, 0, { top: true });
      }
    }
    if (detail >= 2 && (family === FAMILY.GLASS || family === FAMILY.PANEL) && t === 0) {
      // slab-edge bands give the curtain wall its horizontal rhythm
      for (let f = 1; f < share; f += family === FAMILY.GLASS ? 1 : 2) {
        const fy = y + f * floorH;
        const fx0 = dir > 0 ? faceX : faceX - 0.18;
        const fx1 = dir > 0 ? faceX + 0.18 : faceX;
        B.box(fx0, fx1, fy - 0.1, fy + 0.12, tz0, tz1, metal, bld, 3, 0, { top: true });
      }
    }

    // cornice / parapet crowning the tier
    const oh = family === FAMILY.STONE || family === FAMILY.BRICK ? 0.35 : 0.15;
    B.box(tx0 - oh, tx1 + oh, y1, y1 + 0.3, tz0 - oh, tz1 + oh, solidTone, bld, 1);
    B.box(tx0, tx1, y1 + 0.3, y1 + 1.1, tz0, tz1, solidTone, bld, 1, 0, { top: true });
    y = y1 + 0.3;

    // setback for next tier
    const insetX = snap(lerp(1, 4, rand()), bay);
    const insetZ = snap(lerp(1, 4, rand()), bay);
    if (tx1 - tx0 - insetX * 2 < bay * 3 || tz1 - tz0 - insetZ * 2 < bay * 3) break;
    tx0 += insetX;
    tx1 -= insetX;
    tz0 += insetZ;
    tz1 -= insetZ;
  }

  // ---- roof: plant, water tanks, masts, crown lighting
  const roofY = y + 0.8;
  const rw = tx1 - tx0;
  const rd = tz1 - tz0;
  const plant = detail === 0 ? 1 : 2 + Math.floor(rand() * (detail + 2));
  for (let i = 0; i < plant; i++) {
    const pw = lerp(1.5, Math.min(7, rw * 0.5), rand());
    const pd = lerp(1.5, Math.min(7, rd * 0.5), rand());
    const px = lerp(tx0 + pw / 2 + 0.6, tx1 - pw / 2 - 0.6, rand());
    const pz = lerp(tz0 + pd / 2 + 0.6, tz1 - pd / 2 - 0.6, rand());
    const ph = lerp(1.2, 3.2, rand());
    B.box(px - pw / 2, px + pw / 2, y, y + ph, pz - pd / 2, pz + pd / 2, metal, bld, 3, 0);
  }
  if ((family === FAMILY.RESI || family === FAMILY.BRICK) && rand() < 0.7) {
    const r = lerp(1.1, 1.8, rand());
    const tx = lerp(tx0 + r + 0.5, tx1 - r - 0.5, rand());
    const tz = lerp(tz0 + r + 0.5, tz1 - r - 0.5, rand());
    B.box(tx - r * 0.8, tx + r * 0.8, y, y + 2.2, tz - r * 0.8, tz + r * 0.8, metal, bld, 3, 0, { top: false });
    B.cylinder(tx, tz, r, y + 2.2, y + 5.4, [0.2, 0.14, 0.09], bld, 3);
  }
  if (height > 55 && rand() < 0.65) {
    const mh = lerp(8, 26, rand());
    const mx = (tx0 + tx1) / 2 + (rand() - 0.5) * rw * 0.3;
    const mz = (tz0 + tz1) / 2 + (rand() - 0.5) * rd * 0.3;
    B.box(mx - 0.18, mx + 0.18, y, y + mh, mz - 0.18, mz + 0.18, metal, bld, 3, 0);
    B.box(mx - 0.9, mx + 0.9, y + mh * 0.55, y + mh * 0.55 + 0.12, mz - 0.06, mz + 0.06, metal, bld, 3, 0);
    out.beacons.push([mx, y + mh + 0.25, mz, cz]);
  } else if (height > 40) {
    out.beacons.push([tx0 + 0.5, roofY + 0.3, tz0 + 0.5, cz]);
  }
  if (family === FAMILY.GLASS && height > 70 && rand() < 0.6) {
    // architectural crown wash: a thin lit band under the parapet
    B.box(tx0 - 0.02, tx1 + 0.02, y - 1.6, y - 1.1, tz0 - 0.02, tz1 + 0.02, [0.9, 0.95, 1.0], bld, 4, 0, { top: false });
  }
}

export function generateCity({ detail = 2, seed = 20260930 } = {}) {
  const rand = rng(seed);
  // S: the street block that scrolls past the car and wraps (one street period)
  // F: the far city — skyline and back blocks — which stays put like the billboard
  const S = new Builder();
  const F = new Builder();
  const streetOut = { beacons: [] };
  const staticOut = { beacons: [] };

  const pickFamily = (weights) => {
    let r = rand() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < weights.length; i++) if ((r -= weights[i]) <= 0) return i;
    return 0;
  };

  // ---- street wall: continuous frontage with alleys, broken by cross streets
  for (const side of [-1, 1]) {
    let z = STREET_NEAR;
    while (z - 12 > STREET_MIN) {
      const wz = Math.min(lerp(12, 30, rand()), z - STREET_MIN - 0.5);
      const z1 = z;
      const z0 = z - wz;
      const cross = CROSS_STREETS.find((c) => z0 < c + CROSS_HALF_W + 1 && z1 > c - CROSS_HALF_W - 1);
      if (cross !== undefined) {
        z = cross - CROSS_HALF_W - 1.01; // jump over the intersection
        continue;
      }
      const family = pickFamily([1.2, 3, 2.4, 1.6, 2]);
      const tall = rand() < 0.3;
      const height = tall ? lerp(60, 130, rand()) : lerp(16, 48, rand());
      const depth = lerp(14, 26, rand());
      const front = SIDEWALK_OUT + (rand() < 0.3 ? lerp(0.5, 3, rand()) : 0);
      const xA = side * front;
      const xB = side * (front + depth);
      building(S, rand, {
        family,
        height,
        podium: rand() < 0.85,
        street: -side,
        detail,
        x0: Math.min(xA, xB),
        x1: Math.max(xA, xB),
        z0,
        z1,
      }, streetOut);
      z = z0 - (rand() < 0.4 ? lerp(1.5, 4, rand()) : 0.3); // alleys
    }
  }

  // ---- second row: taller commercial towers peeking over the street wall
  for (const side of [-1, 1]) {
    let z = STREET_NEAR - 4;
    while (z - 26 > STREET_MIN) {
      const wz = Math.min(lerp(22, 40, rand()), z - STREET_MIN - 2);
      const x = side * lerp(52, 78, rand());
      const depth = lerp(20, 32, rand());
      if (!CROSS_STREETS.some((c) => Math.abs(c - (z - wz / 2)) < wz / 2 + CROSS_HALF_W)) {
        building(S, rand, {
          family: pickFamily([4, 0.8, 1.2, 3, 0.3]),
          height: lerp(55, 170, rand()),
          podium: false,
          street: -side,
          detail: Math.min(detail, 1),
          x0: Math.min(x, x + side * depth),
          x1: Math.max(x, x + side * depth),
          z0: z - wz,
          z1: z,
        }, streetOut);
      }
      z -= wz + lerp(4, 16, rand());
    }
  }

  // ---- skyline: massive towers beyond the wrap seam, receding into haze
  const skyline = detail === 0 ? 60 : 110;
  for (let i = 0; i < skyline; i++) {
    const far = rand();
    const z = lerp(-640, -1250, far);
    let x = (rand() < 0.5 ? -1 : 1) * lerp(20, 120 + far * 420, rand());
    const w = lerp(24, 50, rand());
    if (Math.abs(x) < 26 + w / 2) x = Math.sign(x || 1) * (26 + w / 2);
    building(F, rand, {
      family: pickFamily([5, 0.5, 1.2, 3, 0.2]),
      height: lerp(90, 320, Math.pow(rand(), 1.4)),
      podium: false,
      street: -Math.sign(x),
      detail: 0,
      x0: x - w / 2,
      x1: x + w / 2,
      z0: z - w / 2,
      z1: z + w / 2,
    }, staticOut);
  }

  // ---- blocks behind the street rows (seen in flyby/orbit)
  for (let i = 0; i < 26; i++) {
    const x = (i % 2 ? 1 : -1) * lerp(125, 220, rand());
    const z = lerp(80, -560, rand());
    const w = lerp(20, 36, rand());
    building(F, rand, {
      family: pickFamily([3, 1, 1, 2, 0.5]),
      height: lerp(40, 160, rand()),
      podium: false,
      street: -Math.sign(x),
      detail: 0,
      x0: x - w / 2,
      x1: x + w / 2,
      z0: z - w / 2,
      z1: z + w / 2,
    }, staticOut);
  }

  return {
    street: S.build(),
    statics: F.build(),
    streetBeacons: streetOut.beacons,
    staticBeacons: staticOut.beacons,
  };
}
