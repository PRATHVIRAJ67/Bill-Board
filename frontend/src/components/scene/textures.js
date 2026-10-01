import * as THREE from "three";

/*
 * Procedural textures, generated once per size and cached (no network, no
 * texture larger than the quality tier allows).
 */

const cache = new Map();
function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

function canvas(w, h = w) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tileable value-noise fBm on a w×h grid (period = lattice size). */
function tileableNoise(w, h, baseCells, octaves, seed) {
  const out = new Float32Array(w * h);
  const rand = seeded(seed);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const cx = baseCells << o;
    const cy = Math.max(1, Math.round((baseCells * h) / w)) << o;
    const lattice = new Float32Array(cx * cy);
    for (let i = 0; i < lattice.length; i++) lattice[i] = rand();
    for (let y = 0; y < h; y++) {
      const fy = (y / h) * cy;
      const y0 = Math.floor(fy);
      const ty = fy - y0;
      const sy = ty * ty * (3 - 2 * ty);
      const r0 = (y0 % cy) * cx;
      const r1 = ((y0 + 1) % cy) * cx;
      for (let x = 0; x < w; x++) {
        const fx = (x / w) * cx;
        const x0 = Math.floor(fx);
        const tx = fx - x0;
        const sx = tx * tx * (3 - 2 * tx);
        const c0 = x0 % cx;
        const c1 = (x0 + 1) % cx;
        const a = lattice[r0 + c0] + (lattice[r0 + c1] - lattice[r0 + c0]) * sx;
        const b = lattice[r1 + c0] + (lattice[r1 + c1] - lattice[r1 + c0]) * sx;
        out[y * w + x] += (a + (b - a) * sy) * amp;
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function finish(tex, { srgb = false, repeat = true, aniso = 8 } = {}) {
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = aniso;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function heightToNormal(height, w, h, strength) {
  const c = canvas(w, h);
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = height[y * w + ((x - 1 + w) % w)];
      const r = height[y * w + ((x + 1) % w)];
      const u = height[((y - 1 + h) % h) * w + x];
      const d = height[((y + 1) % h) * w + x];
      const nx = (l - r) * strength;
      const ny = (d - u) * strength;
      const len = Math.hypot(nx, ny, 1);
      const i = (y * w + x) * 4;
      img.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/* ---------------------------------------------------------------- Road
 * Macro maps span the full carriageway (x −14..14 m) and a 56 m length:
 * lane-aligned wear only makes sense in road space, not in a tiny tile.
 */
export const ROAD_TILE_LEN = 56;
const ROAD_W = 28;
const WHEEL_LANES = [-7.4, -3.7, 0, 3.7, 7.4];

export function getRoadTextures(lowPower, aniso) {
  return cached(`road-${lowPower ? 1 : 0}`, () => {
    const w = lowPower ? 512 : 1024;
    const h = w * 2;
    const pxX = (x) => ((x + ROAD_W / 2) / ROAD_W) * w;
    const mX = (m) => (m / ROAD_W) * w;
    const mY = (m) => (m / ROAD_TILE_LEN) * h;
    const macro = tileableNoise(w, h, 3, 4, 101);
    const mid = tileableNoise(w, h, 24, 3, 202);
    const spots = tileableNoise(w, h, 64, 2, 303);

    const alb = canvas(w, h);
    const rough = canvas(w, h);
    const a = alb.getContext("2d");
    const r = rough.getContext("2d");
    const aImg = a.createImageData(w, h);
    const rImg = r.createImageData(w, h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const xm = (x / w) * ROAD_W - ROAD_W / 2;
        // wheel paths: rubber-darkened, traffic-polished
        let track = 0;
        let drip = 0;
        for (const c of WHEEL_LANES) {
          const dx = xm - c;
          track = Math.max(track, Math.exp(-(((Math.abs(dx) - 0.82) / 0.3) ** 2)));
          drip = Math.max(drip, Math.exp(-((dx / 0.35) ** 2)));
        }
        track *= 0.65 + 0.35 * mid[i];
        drip *= Math.max(0, spots[i] - 0.58) * 3;
        // gutter: grime + standing water against the curb
        const g = Math.max(0, (Math.abs(xm) - 12.9) / 1.1);
        const gutter = Math.min(1, g * g);
        const puddle = Math.max(THREE.MathUtils.smoothstep(macro[i], 0.64, 0.78) * 0.9, gutter * THREE.MathUtils.smoothstep(macro[i], 0.35, 0.6));
        const tone = 0.085 + macro[i] * 0.05 + mid[i] * 0.03 - track * 0.025 - drip * 0.035 - gutter * 0.02;
        const v = Math.max(0.02, tone) * (1 - puddle * 0.25);
        const k = i * 4;
        aImg.data[k] = Math.min(255, v * 255 * 1.02);
        aImg.data[k + 1] = v * 255;
        aImg.data[k + 2] = v * 255 * 0.97;
        aImg.data[k + 3] = 255;
        // roughness: dry 0.72, damp polished tracks ~0.45, puddles 0.07
        let rv = 0.7 + mid[i] * 0.1 - track * 0.24 - gutter * 0.25;
        rv = THREE.MathUtils.lerp(rv, 0.07, puddle);
        rImg.data[k] = rImg.data[k + 1] = rImg.data[k + 2] = Math.max(0, Math.min(255, rv * 255));
        rImg.data[k + 3] = 255;
      }
    }
    a.putImageData(aImg, 0, 0);
    r.putImageData(rImg, 0, 0);

    const rand = seeded(7);
    // utility-cut patches (newer, darker, smoother asphalt with sealed seams)
    for (let p = 0; p < 5; p++) {
      const x0 = pxX(-12 + rand() * 20);
      const y0 = rand() * h;
      const pw = mX(1.2 + rand() * 3.5);
      const ph = mY(1.5 + rand() * 5);
      a.fillStyle = `rgba(14,14,15,${0.5 + rand() * 0.3})`;
      a.fillRect(x0, y0, pw, ph);
      r.fillStyle = "rgba(140,140,140,0.5)";
      r.fillRect(x0, y0, pw, ph);
      a.strokeStyle = "rgba(6,6,6,0.9)";
      a.lineWidth = Math.max(1.5, w / 420);
      a.strokeRect(x0, y0, pw, ph);
      r.strokeStyle = "rgba(50,50,50,0.9)";
      r.lineWidth = Math.max(2, w / 300);
      r.strokeRect(x0, y0, pw, ph);
    }
    // cracks: branching random walks, sealed with glossy tar
    const crack = (x, y, len, ang, width) => {
      a.beginPath();
      r.beginPath();
      a.moveTo(x, y);
      r.moveTo(x, y);
      for (let s = 0; s < len; s++) {
        ang += (rand() - 0.5) * 0.9;
        x += Math.cos(ang) * (w / 180);
        y += Math.sin(ang) * (w / 180);
        a.lineTo(x, y);
        r.lineTo(x, y);
        if (rand() < 0.04 && width > 1) crack(x, y, len * 0.4, ang + (rand() - 0.5) * 2, width * 0.6);
      }
      a.strokeStyle = "rgba(8,8,8,0.7)";
      a.lineWidth = width * 0.8;
      a.stroke();
      r.strokeStyle = "rgba(225,225,225,0.85)";
      r.lineWidth = width * 1.4;
      r.stroke();
    };
    for (let c = 0; c < 16; c++) crack(rand() * w, rand() * h, 20 + rand() * 60, rand() * Math.PI * 2, Math.max(1, w / 520) * (0.8 + rand()));
    for (const lx of [-5.55, -1.85, 1.85, 5.55]) crack(pxX(lx + 0.3), rand() * h, 110, Math.PI / 2, Math.max(1, w / 700));
    // manhole covers
    for (let m = 0; m < 2; m++) {
      const cx = pxX((rand() < 0.5 ? -1 : 1) * (1.5 + rand() * 5));
      const cy = rand() * h;
      const rad = mX(0.35);
      a.fillStyle = "rgb(22,22,23)";
      a.beginPath();
      a.arc(cx, cy, rad, 0, Math.PI * 2);
      a.fill();
      a.strokeStyle = "rgb(42,42,44)";
      a.lineWidth = rad * 0.15;
      a.stroke();
      r.fillStyle = "rgb(100,100,100)";
      r.beginPath();
      r.arc(cx, cy, rad, 0, Math.PI * 2);
      r.fill();
    }
    // gutter drain grates
    for (const side of [-1, 1]) {
      const gx = pxX(side * 13.55) - mX(0.3);
      const gy = mY(20 + rand() * 20);
      a.fillStyle = "rgb(8,8,8)";
      a.fillRect(gx, gy, mX(0.6), mY(0.9));
      a.fillStyle = "rgb(38,38,38)";
      for (let s = 0; s < 7; s++) a.fillRect(gx, gy + (mY(0.9) / 7) * s, mX(0.6), Math.max(1, mY(0.03)));
    }

    return {
      map: finish(new THREE.CanvasTexture(alb), { srgb: true, aniso }),
      roughnessMap: finish(new THREE.CanvasTexture(rough), { aniso }),
    };
  });
}

/** Close-up aggregate relief, tiled every ~2 m. */
export function getAggregateNormal(aniso) {
  return cached("aggregate", () => {
    const s = 512;
    const grain = tileableNoise(s, s, 96, 2, 23);
    const pebbles = tileableNoise(s, s, 24, 2, 29);
    const height = new Float32Array(s * s);
    for (let i = 0; i < height.length; i++) height[i] = grain[i] * 0.7 + pebbles[i] * 0.5;
    return finish(new THREE.CanvasTexture(heightToNormal(height, s, s, 3.2)), { aniso });
  });
}

/* ------------------------------------------------------------ Markings
 * Full carriageway width, one 12 m dash cycle. Two-way avenue with a
 * double-yellow median lane and parking lanes.
 */
export const MARKING_CYCLE = 12;
export function getMarkingsTexture(aniso) {
  return cached("markings", () => {
    const w = 2048;
    const h = 256;
    const c = canvas(w, h);
    const ctx = c.getContext("2d");
    const px = (x) => ((x + 14) / 28) * w;
    const lw = (m) => (m / 28) * w;
    const lh = (m) => (m / MARKING_CYCLE) * h;
    ctx.fillStyle = "#f4f4f2";
    for (const x of [-5.55, 5.55]) ctx.fillRect(px(x) - lw(0.075), 0, lw(0.15), lh(3));
    for (const x of [-9.25, 9.25]) ctx.fillRect(px(x) - lw(0.075), 0, lw(0.15), h);
    for (const side of [-1, 1]) ctx.fillRect(Math.min(px(side * 9.25), px(side * 10.1)), lh(6), lw(0.85), lh(0.12)); // stall ticks
    ctx.fillStyle = "#e0b43c";
    for (const s of [-1, 1]) for (const o of [1.72, 1.98]) ctx.fillRect(px(s * o) - lw(0.06), 0, lw(0.12), h);
    // wear: paint thins randomly and flakes
    const img = ctx.getImageData(0, 0, w, h);
    const rand = seeded(5);
    const nw = w / 4;
    const noise = tileableNoise(nw, h / 4, 16, 3, 44);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4 + 3;
        if (!img.data[i]) continue;
        const n = noise[(y >> 2) * nw + (x >> 2)];
        img.data[i] *= Math.min(1, Math.max(0, (n - 0.2) * 2.2)) * (0.75 + rand() * 0.25);
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = finish(new THREE.CanvasTexture(c), { srgb: true, aniso });
    tex.wrapS = THREE.ClampToEdgeWrapping;
    return tex;
  });
}

export function getCrosswalkTexture(aniso) {
  return cached("crosswalk", () => {
    const w = 1024;
    const h = 128;
    const c = canvas(w, h);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#f2f2ef";
    const stripes = 14;
    for (let i = 0; i < stripes; i++) ctx.fillRect((w / stripes) * i + w / stripes / 4, 0, w / stripes / 2, h * 0.78);
    ctx.fillRect(0, h * 0.9, w, h * 0.1); // stop line
    const img = ctx.getImageData(0, 0, w, h);
    const nw = w / 4;
    const noise = tileableNoise(nw, h / 4, 20, 3, 91);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4 + 3;
      if (img.data[i]) img.data[i] *= Math.min(1, Math.max(0, (noise[(y >> 2) * nw + (x >> 2)] - 0.18) * 2));
    }
    ctx.putImageData(img, 0, 0);
    return finish(new THREE.CanvasTexture(c), { srgb: true, aniso, repeat: false });
  });
}

/* -------------------------------------------------------------- Sidewalk
 * One texture = 3 m × 3 m (2×2 concrete slabs).
 */
export const PAVING_TILE = 3;
export function getPavingTextures(aniso) {
  return cached("paving", () => {
    const s = 512;
    const n = tileableNoise(s, s, 8, 4, 303);
    const alb = canvas(s);
    const rough = canvas(s);
    const a = alb.getContext("2d");
    const r = rough.getContext("2d");
    const aImg = a.createImageData(s, s);
    const rImg = r.createImageData(s, s);
    const rand = seeded(9);
    const slabTone = [0.95 + rand() * 0.1, 0.9 + rand() * 0.12, 0.95 + rand() * 0.1, 0.92 + rand() * 0.1];
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const i = y * s + x;
      const sx = x % (s / 2);
      const sy = y % (s / 2);
      const joint = sx < 3 || sy < 3;
      const slab = (x < s / 2 ? 0 : 1) + (y < s / 2 ? 0 : 2);
      const v = joint ? 0.06 : (0.2 + n[i] * 0.09) * slabTone[slab];
      const k = i * 4;
      aImg.data[k] = v * 255;
      aImg.data[k + 1] = v * 255 * 0.99;
      aImg.data[k + 2] = v * 255 * 0.96;
      aImg.data[k + 3] = 255;
      const rv = joint ? 0.95 : 0.6 + n[i] * 0.22 - Math.max(0, n[i] - 0.66) * 1.4;
      rImg.data[k] = rImg.data[k + 1] = rImg.data[k + 2] = Math.max(20, Math.min(255, rv * 255));
      rImg.data[k + 3] = 255;
    }
    a.putImageData(aImg, 0, 0);
    r.putImageData(rImg, 0, 0);
    for (let d = 0; d < 40; d++) {
      a.fillStyle = `rgba(20,20,20,${0.12 + rand() * 0.22})`;
      a.beginPath();
      a.arc(rand() * s, rand() * s, 1 + rand() * 4, 0, Math.PI * 2);
      a.fill();
    }
    return {
      map: finish(new THREE.CanvasTexture(alb), { srgb: true, aniso }),
      roughnessMap: finish(new THREE.CanvasTexture(rough), { aniso }),
    };
  });
}

/* ---------------------------------------------------------------- Glows */
export function getRadialTexture() {
  return cached("radial", () => {
    const s = 128;
    const c = canvas(s);
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.55)");
    g.addColorStop(0.6, "rgba(255,255,255,0.12)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    return finish(new THREE.CanvasTexture(c), { repeat: false, aniso: 1 });
  });
}

/** Soft rounded-rectangle ambient occlusion blob under a car (length along V). */
export function getContactShadowTexture() {
  return cached("contact", () => {
    const w = 128;
    const h = 256;
    const c = canvas(w, h);
    const ctx = c.getContext("2d");
    ctx.filter = "blur(14px)";
    ctx.fillStyle = "rgba(0,0,0,0.95)";
    const rr = 26;
    const x = 26, y = 26, ww = w - 52, hh = h - 52;
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + ww, y, x + ww, y + hh, rr);
    ctx.arcTo(x + ww, y + hh, x, y + hh, rr);
    ctx.arcTo(x, y + hh, x, y, rr);
    ctx.arcTo(x, y, x + ww, y, rr);
    ctx.fill();
    ctx.filter = "blur(8px)";
    for (const [cx, cy] of [[34, 62], [94, 62], [34, 198], [94, 198]]) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, 12, 26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    return finish(new THREE.CanvasTexture(c), { repeat: false, aniso: 1 });
  });
}

/** Street-name blades for the signal masts. */
const STREETS = ["MERIDIAN AV", "5TH ST", "HARBOR BLVD", "LUMEN ST"];
export const STREET_SIGN_ROWS = STREETS.length;
export function getStreetSignTexture() {
  return cached("signs", () => {
    const c = canvas(512, 256);
    const ctx = c.getContext("2d");
    STREETS.forEach((name, i) => {
      const y = i * 64;
      ctx.fillStyle = "#0f5a34";
      ctx.fillRect(0, y, 512, 64);
      ctx.strokeStyle = "#e8efe9";
      ctx.lineWidth = 3;
      ctx.strokeRect(5, y + 5, 502, 54);
      ctx.fillStyle = "#eef4ef";
      ctx.font = "600 34px 'Inter', 'Arial', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(name, 256, y + 34);
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  });
}

/** Random lit-window card used by environment light-formers (car reflections). */
export function getWindowCardTexture() {
  return cached("windowcard", () => {
    const w = 256;
    const h = 128;
    const c = canvas(w, h);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    const rand = seeded(77);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 40; x++) {
      if (rand() > 0.34) continue;
      const warm = rand() < 0.7;
      const l = 120 + rand() * 135;
      ctx.fillStyle = warm ? `rgb(${l | 0},${(l * 0.72) | 0},${(l * 0.45) | 0})` : `rgb(${(l * 0.75) | 0},${(l * 0.85) | 0},${l | 0})`;
      ctx.fillRect(x * 6.4 + 1, y * 8 + 2, 4.4, 4.5);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}
