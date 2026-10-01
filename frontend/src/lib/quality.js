import { create } from "zustand";

/**
 * Adaptive quality system
 * -----------------------
 * 1. A static probe (GPU string, memory, cores, screen) picks a starting tier.
 * 2. At runtime the QualityController (inside the Canvas) watches real frame
 *    times: it first trades render resolution (dynamic DPR), and only when the
 *    resolution floor is reached does it step the tier down, turning off the
 *    single most expensive features of that tier. It never flaps back up a tier
 *    (each tier switch recompiles shaders), but DPR recovers when headroom returns.
 *
 * Every tier is designed to look intentional: lower tiers lose expensive
 * *passes* (planar reflections, shadow maps, MSAA), never the art direction.
 */

export const TIER_NAMES = ["low", "medium", "high", "ultra"];

export const TIERS = [
  {
    // low — integrated / old mobile GPUs, software renderers
    name: "low",
    interiors: false,      // parallax room interiors behind windows
    areaLight: false,      // billboard as a real rect area light
    lampLights: 0,         // real spot lights at the nearest street lamps
    cityDetail: 0,         // 0..2 balconies / fins / rooftop plant density
    parked: 6,
    dprMin: 0.7,
    dprMax: 1.25,
    shadows: false,
    shadowMapSize: 0,
    reflector: 0,          // 0 = physically based wet asphalt w/o planar reflection
    msaa: 2,               // WebGL2 MSAA is resolved on-tile on mobile GPUs: cheap
    smaa: false,
    bloomLevels: 5,
    bloomScale: 0.5,
    clearcoat: false,
    traffic: 6,
    trafficShadows: false, // moving cars cast into the shadow map (they always have contact shadows)
    facadeSize: 512,
    atlasCell: 288,
    envRes: 128,
    haze: false,
    grain: false,
  },
  {
    // medium — mid-range phones (Adreno 6xx, Mali-G7x), UHD graphics
    name: "medium",
    interiors: true,
    areaLight: true,
    lampLights: 2,
    cityDetail: 1,
    parked: 10,
    dprMin: 0.85,
    dprMax: 1.6,
    shadows: true,
    shadowMapSize: 1024,
    reflector: 256,
    msaa: 4,
    smaa: false,
    bloomLevels: 6,
    bloomScale: 0.75,
    clearcoat: true,
    traffic: 10,
    trafficShadows: false,
    facadeSize: 1024,
    atlasCell: 384,
    envRes: 128,
    haze: true,
    grain: false,
  },
  {
    // high — flagship phones, Apple silicon iPhones/iPads, Iris Xe, laptops
    name: "high",
    interiors: true,
    areaLight: true,
    lampLights: 4,
    cityDetail: 2,
    parked: 14,
    dprMin: 1,
    dprMax: 2,
    shadows: true,
    shadowMapSize: 2048,
    reflector: 512,
    msaa: 4,
    smaa: false,
    bloomLevels: 7,
    bloomScale: 1,
    clearcoat: true,
    traffic: 14,
    trafficShadows: false,
    facadeSize: 1024,
    atlasCell: 512,
    envRes: 256,
    haze: true,
    grain: true,
  },
  {
    // ultra — discrete desktop GPUs, Apple M-series
    name: "ultra",
    interiors: true,
    areaLight: true,
    lampLights: 6,
    cityDetail: 2,
    parked: 16,
    dprMin: 1,
    dprMax: 2,
    shadows: true,
    shadowMapSize: 2048,
    reflector: 1024,
    msaa: 4,
    smaa: false,
    bloomLevels: 8,
    bloomScale: 1,
    clearcoat: true,
    traffic: 24,
    trafficShadows: true,
    facadeSize: 2048,
    atlasCell: 640,
    envRes: 256,
    haze: true,
    grain: true,
  },
];

function readGpuString() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return { renderer: "", webgl2: false, maxTexture: 0 };
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const info = {
      renderer: String(renderer || ""),
      webgl2: typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext,
      maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0,
    };
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return info;
  } catch {
    return { renderer: "", webgl2: false, maxTexture: 0 };
  }
}

function tierFromGpu(renderer, isMobile) {
  const r = renderer.toLowerCase();
  if (!r) return isMobile ? 1 : 2;
  if (/swiftshader|llvmpipe|softpipe|basic render|microsoft basic/.test(r)) return 0;

  // Mobile GPUs
  const adreno = r.match(/adreno\D*(\d{3})/);
  if (adreno) {
    const n = Number(adreno[1]);
    if (n >= 730) return 3;
    if (n >= 650) return 2;
    if (n >= 610) return 1;
    return 0;
  }
  const mali = r.match(/mali-?\s*([gt])(\d+)/);
  if (mali) {
    const n = Number(mali[2]);
    if (mali[1] === "t") return 0;
    if (n >= 710) return 2;
    if (n >= 76) return 1;
    return 0;
  }
  if (/immortalis|xclipse/.test(r)) return 2;
  if (/powervr/.test(r)) return 0;
  if (/apple gpu/.test(r)) return isMobile ? 2 : 3; // Safari masks the exact chip
  if (/apple m\d/.test(r)) return 3;

  // Desktop GPUs
  if (/nvidia|geforce|rtx|gtx|quadro|radeon (rx|pro)|\brx \d{3,4}|arc\b/.test(r)) {
    if (/gtx (6|7|9)\d\d|gt \d{3}|mx\d{3}/.test(r)) return 2;
    return 3;
  }
  if (/radeon/.test(r)) return 2; // integrated Vega / 680M etc.
  if (/iris|xe graphics/.test(r)) return 2;
  if (/intel/.test(r)) return 1;
  return isMobile ? 1 : 2;
}

export function detectInitialTier() {
  if (typeof window === "undefined") return { tier: 2, forced: false, gpu: "" };

  const params = new URLSearchParams(window.location.search);
  const forcedName = params.get("quality");
  const forcedIdx = TIER_NAMES.indexOf(forcedName || "");
  const { renderer, webgl2, maxTexture } = readGpuString();
  if (forcedIdx >= 0) return { tier: forcedIdx, forced: true, gpu: renderer };

  const ua = navigator.userAgent || "";
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  const isMobile = coarse || /Android|iPhone|iPad|Mobile/i.test(ua);

  let tier = tierFromGpu(renderer, isMobile);

  if (!webgl2) tier = Math.min(tier, 0);
  if (maxTexture && maxTexture < 4096) tier = Math.min(tier, 1);

  const mem = navigator.deviceMemory; // Chrome only
  if (mem && mem <= 2) tier = Math.min(tier, 0);
  else if (mem && mem <= 4) tier = Math.min(tier, isMobile ? 1 : 2);

  const cores = navigator.hardwareConcurrency || 8;
  if (cores <= 2) tier = Math.min(tier, 0);
  else if (cores <= 4 && isMobile) tier = Math.min(tier, 1);

  if (navigator.connection?.saveData) tier = Math.min(tier, 1);

  return { tier: Math.max(0, Math.min(3, tier)), forced: false, gpu: renderer };
}

const initial = detectInitialTier();
const startDpr = (tier) => {
  const t = TIERS[tier];
  const device = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return Math.max(t.dprMin, Math.min(t.dprMax, device));
};

// Debug overrides, e.g. ?quality=high&q.shadows=0&q.reflector=512
function withOverrides(settings) {
  if (typeof window === "undefined") return settings;
  const out = { ...settings };
  new URLSearchParams(window.location.search).forEach((v, k) => {
    if (!k.startsWith("q.")) return;
    const key = k.slice(2);
    if (!(key in out)) return;
    out[key] = typeof out[key] === "boolean" ? v === "1" || v === "true" : Number(v);
  });
  return out;
}

export const useQuality = create((set, get) => ({
  tier: initial.tier,
  forced: initial.forced,
  gpu: initial.gpu,
  dpr: startDpr(initial.tier),
  settings: withOverrides(TIERS[initial.tier]),
  setDpr: (dpr) => {
    const { settings } = get();
    const device = window.devicePixelRatio || 1;
    const max = Math.min(settings.dprMax, Math.max(1, device));
    const next = Math.round(Math.max(settings.dprMin, Math.min(max, dpr)) * 100) / 100;
    if (next !== get().dpr) set({ dpr: next });
  },
  stepDown: () => {
    const { tier } = get();
    if (tier <= 0) return false;
    const next = tier - 1;
    const s = TIERS[next];
    // Restart the new tier at a comfortable resolution so it has headroom.
    set({ tier: next, settings: s, dpr: Math.min(get().dpr, Math.max(s.dprMin, s.dprMax * 0.85)) });
    return true;
  },
}));

export const useTier = (key) => useQuality((s) => s.settings[key]);

// Handy for field debugging: window.__boardQuality.getState()
if (typeof window !== "undefined") window.__boardQuality = useQuality;
