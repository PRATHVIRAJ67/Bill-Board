import * as THREE from "three";
import { GRID } from "../spotData";

/**
 * Renders all 20 spots into one canvas atlas → one texture, one draw call.
 * Content is laid out like real DOOH creative: strong hierarchy, safe margins,
 * ink colour chosen by luminance so every brand colour stays legible.
 */

const FONT_SANS = "'Space Grotesk', 'Inter', system-ui, sans-serif";
const FONT_MONO = "'DM Mono', 'JetBrains Mono', ui-monospace, monospace";

export async function ensureAtlasFonts() {
  if (!document.fonts?.load) return;
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load(`700 64px ${FONT_SANS}`),
        document.fonts.load(`500 32px ${FONT_MONO}`),
      ]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* fall back to system fonts */
  }
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function luminance([r, g, b]) {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

function fitText(ctx, text, maxW, size, weight, family) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxW && s > 8) {
    s -= 1;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

function drawCell(ctx, spot, x, y, w, h) {
  const base = hexToRgb(spot.color || "#00c48c");
  const lum = luminance(base);
  const darkInk = lum > 0.42;
  const ink = darkInk ? [10, 14, 20] : [255, 255, 255];
  const u = w / 100;

  // background: lit from top-left like a real LED module's gamma curve
  const g = ctx.createLinearGradient(x, y, x + w * 0.6, y + h);
  g.addColorStop(0, rgb(mix(base, [255, 255, 255], 0.14)));
  g.addColorStop(0.55, rgb(base));
  g.addColorStop(1, rgb(mix(base, [0, 0, 0], spot.claimed ? 0.5 : 0.38)));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  // soft diagonal light sweep
  const sweep = ctx.createLinearGradient(x, y, x + w, y + h);
  sweep.addColorStop(0.35, "rgba(255,255,255,0)");
  sweep.addColorStop(0.5, "rgba(255,255,255,0.08)");
  sweep.addColorStop(0.65, "rgba(255,255,255,0)");
  ctx.fillStyle = sweep;
  ctx.fillRect(x, y, w, h);

  ctx.textBaseline = "middle";
  const pad = 6 * u;

  // top row
  ctx.fillStyle = rgb(ink, 0.9);
  ctx.textAlign = "left";
  ctx.font = `500 ${7 * u}px ${FONT_MONO}`;
  ctx.fillText(`#${String(spot.id).padStart(2, "0")}`, x + pad, y + pad + 3 * u);

  ctx.textAlign = "right";
  if (!spot.claimed) {
    ctx.font = `500 ${7 * u}px ${FONT_MONO}`;
    ctx.fillText(`$${spot.price}`, x + w - pad, y + pad + 3 * u);
  } else {
    ctx.font = `500 ${5.2 * u}px ${FONT_MONO}`;
    ctx.fillText("● LIVE", x + w - pad, y + pad + 3 * u);
  }

  // headline
  const headline = spot.claimed ? spot.handle || "@yourbrand" : "+ YOUR BRAND";
  ctx.textAlign = "center";
  ctx.fillStyle = rgb(ink);
  const size = fitText(ctx, headline, w - pad * 2.4, 15 * u, 700, FONT_SANS);
  ctx.font = `700 ${size}px ${FONT_SANS}`;
  if (!darkInk) {
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 2 * u;
  }
  ctx.fillText(headline, x + w / 2, y + h * 0.5);
  ctx.shadowBlur = 0;

  // footer
  const footer = spot.claimed ? (spot.category || "BRAND").toUpperCase() : "CLAIM SPOT  ↗";
  ctx.font = `500 ${5 * u}px ${FONT_MONO}`;
  const fy = y + h - pad - 2.4 * u;
  if (!spot.claimed) {
    const tw = ctx.measureText(footer).width + 7 * u;
    const th = 8.4 * u;
    ctx.strokeStyle = rgb(ink, 0.75);
    ctx.lineWidth = Math.max(1, 0.6 * u);
    ctx.beginPath();
    ctx.roundRect?.(x + w / 2 - tw / 2, fy - th / 2, tw, th, th / 2);
    ctx.stroke();
  }
  ctx.fillStyle = rgb(ink, 0.88);
  ctx.fillText(footer, x + w / 2, fy + 0.3 * u);
}

export function createAtlas(cellW) {
  const cellH = Math.round(cellW * (GRID.rowStep / GRID.colStep));
  const c = document.createElement("canvas");
  c.width = cellW * GRID.cols;
  c.height = cellH * GRID.rows;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return { canvas: c, texture: tex, cellW, cellH };
}

export function drawAtlas(atlas, spots) {
  const ctx = atlas.canvas.getContext("2d");
  const { cellW, cellH } = atlas;
  ctx.clearRect(0, 0, atlas.canvas.width, atlas.canvas.height);
  spots.slice(0, GRID.cols * GRID.rows).forEach((spot, i) => {
    const col = i % GRID.cols;
    const row = Math.floor(i / GRID.cols);
    ctx.save();
    ctx.beginPath();
    ctx.rect(col * cellW, row * cellH, cellW, cellH);
    ctx.clip();
    drawCell(ctx, spot, col * cellW, row * cellH, cellW, cellH);
    ctx.restore();
  });
  atlas.texture.needsUpdate = true;
}

/** Small emissive plaque under the screen. */
export function createPlaqueTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 48;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 1024, 48);
  ctx.fillStyle = "#cfefff";
  ctx.font = `500 22px ${FONT_MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("THE BOARD  ·  THE INTERNET'S BILLBOARD  ·  20 LIFETIME SPOTS", 512, 25);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
