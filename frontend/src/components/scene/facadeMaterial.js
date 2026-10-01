import * as THREE from "three";
import { LAMP_FIRST, LAMP_SPACING, LAMP_X, LAMP_Y, STREET_MIN, STREET_PERIOD } from "./layout";

/*
 * Architectural facade shader (MeshStandardMaterial + injected code, so it keeps
 * PBR lighting, shadows, IBL, the billboard's area light and fog).
 *
 * - windows are recessed openings with reveals, mullions and transoms
 * - behind the glass, an "interior mapping" ray-box trace renders real rooms
 *   (back wall, ceiling fixtures, floor, desk partitions, curtains/blinds) with
 *   true parallax — windows have depth instead of being glowing stickers
 * - believable occupancy: whole office floors on/off, scattered residential,
 *   2700K / 3500K / 5000K sources, TV flicker, dark floors
 * - walls get weathering, slab lines and grime streaks, family-specific roughness
 * - street lamps light the facades analytically with inverse-square falloff
 * - sub-pixel window grids fade to their average so distant towers never shimmer
 */

const VERT_DECL = /* glsl */ `
attribute vec2 aFac;
attribute vec4 aBld;
attribute float aKind;
attribute float aCz;
uniform float uScroll;
varying vec2 vFac;
varying vec4 vBld;
varying float vKind;
varying vec3 vWPos;
varying vec3 vWN;
`;

const VERT_BODY = /* glsl */ `
#ifdef FAC_SCROLL
  // the street block drives past: each building (keyed on its centre, so it
  // never tears) wraps from behind the camera to the far end inside the haze
  float facWrapped = mod(aCz + uScroll - ${STREET_MIN.toFixed(1)}, ${STREET_PERIOD.toFixed(1)}) + ${STREET_MIN.toFixed(1)};
  transformed.z += facWrapped - aCz;
#endif
vFac = aFac;
vBld = aBld;
vKind = aKind;
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWN = normalize(mat3(modelMatrix) * objectNormal);
`;

const FRAG_DECL = /* glsl */ `
varying vec2 vFac;
varying vec4 vBld;
varying float vKind;
varying vec3 vWPos;
varying vec3 vWN;
uniform float uTime;
uniform float uScroll;
uniform float uWinI;
uniform vec3 uLampCol;
uniform float uLampI;
uniform vec3 uBBPos;
uniform vec3 uBBCol;
uniform float uBBI;

float fHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float fNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fHash(i), fHash(i + vec2(1.0, 0.0)), f.x), mix(fHash(i + vec2(0.0, 1.0)), fHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec3 fRoomColor(float r, float style) {
  vec3 warm = vec3(1.0, 0.64, 0.34);    // 2700K
  vec3 neutral = vec3(1.0, 0.8, 0.58);  // 3500K
  vec3 cool = vec3(0.74, 0.85, 1.0);    // 5000K
  if (style < 0.5) return mix(cool, neutral, step(0.78, r));
  if (style < 1.5) return mix(warm, neutral, step(0.72, r));
  return r < 0.45 ? neutral : (r < 0.8 ? warm : cool);
}
`;

const FRAG_BODY = /* glsl */ `
vec3 facN = normalize(vWN);
float facKind = floor(vKind + 0.5);
int fam = int(vBld.z + 0.5);
float bay = vBld.x;
float floorH = vBld.y;
float seed = vBld.w;
vec3 wallAlbedo = diffuseColor.rgb; // vertex colour = per-building wall albedo

float facRough = 0.8;
float facMetal = 0.0;
vec3 facEmit = vec3(0.0);

// family parameters
float winW = 0.5, winH = 0.55, sill = 0.25, style = 1.0, litBase = 0.4, darkFloor = 0.1, wallRough = 0.8, wallMetal = 0.0, transom = 0.0;
vec3 glassTint = vec3(0.05, 0.06, 0.065);
if (fam == 0)      { winW = 0.93; winH = 0.8;  sill = 0.12; style = 0.0; litBase = 0.6;  darkFloor = 0.38; wallRough = 0.28; wallMetal = 0.65; glassTint = vec3(0.04, 0.07, 0.075); }
else if (fam == 1) { winW = 0.5;  winH = 0.56; sill = 0.27; style = 1.0; litBase = 0.36; darkFloor = 0.06; wallRough = 0.88; }
else if (fam == 2) { winW = 0.42; winH = 0.62; sill = 0.2;  style = 2.0; litBase = 0.42; darkFloor = 0.14; wallRough = 0.72; transom = 1.0; }
else if (fam == 3) { winW = 0.84; winH = 0.44; sill = 0.3;  style = 0.0; litBase = 0.5;  darkFloor = 0.3;  wallRough = 0.42; wallMetal = 0.35; glassTint = vec3(0.035, 0.045, 0.05); }
else               { winW = 0.4;  winH = 0.56; sill = 0.26; style = 1.0; litBase = 0.4;  darkFloor = 0.08; wallRough = 0.92; transom = 1.0; }
bool shop = facKind > 1.5 && facKind < 2.5;
if (shop) { winW = 0.9; winH = 0.68; sill = 0.05; style = 2.0; litBase = 0.82; darkFloor = 0.0; transom = 0.0; glassTint = vec3(0.05); }

// surface weathering (metres-scaled, independent of the window grid)
float n1 = fNoise(vFac * 0.35 + seed);
float n2 = fNoise(vFac * vec2(2.7, 0.22) + seed * 3.1); // vertical rain streaks
float n3 = fNoise(vFac * 6.0);
float weather = 0.78 + 0.3 * n1 + 0.08 * n3;
weather *= mix(0.82, 1.0, n2);
weather *= mix(0.72, 1.0, smoothstep(0.0, 3.5, vWPos.y)); // street grime
vec3 albedo = wallAlbedo * weather;
facRough = clamp(wallRough + (n3 - 0.5) * 0.12 + (1.0 - n2) * 0.06, 0.08, 1.0);
facMetal = wallMetal;

bool roof = facN.y > 0.5;
if (roof) {
  albedo = wallAlbedo * 0.45 * (0.8 + 0.4 * n3);
  facRough = 0.94;
  facMetal = 0.0;
} else if (facKind > 3.5) {
  // crown wash light
  albedo = vec3(0.05);
  facEmit = vec3(0.85, 0.92, 1.0) * 0.9;
} else if (facKind > 2.5) {
  // plant, fins, slab edges: painted / galvanised steel
  albedo = wallAlbedo * (0.85 + 0.3 * n3);
  facRough = 0.42 + n3 * 0.2;
  facMetal = 0.7;
} else if (facKind < 0.5 || shop) {
  vec2 cellF = vec2(vFac.x / bay, vFac.y / floorH);
  vec2 cid = floor(cellF);
  vec2 f = fract(cellF);
  vec2 fw = max(fwidth(cellF), vec2(1e-4));
  float lod = smoothstep(0.1, 0.42, max(fw.x, fw.y)); // 1 = window grid below pixel size

  float hx = winW * 0.5;
  float mx = smoothstep(hx + fw.x, hx - fw.x, abs(f.x - 0.5));
  float my = smoothstep(sill - fw.y, sill + fw.y, f.y) * smoothstep(sill + winH + fw.y, sill + winH - fw.y, f.y);
  float win = mx * my;

  // metric distance to the opening's edge → reveal shadow & frame
  float edgeM = min((hx - abs(f.x - 0.5)) * bay, min(f.y - sill, sill + winH - f.y) * floorH);
  float frame = win * (1.0 - smoothstep(0.035, 0.07, edgeM));
  float revealOut = (1.0 - win) * (1.0 - smoothstep(0.0, 0.16, -edgeM)) * step(-0.4, edgeM); // shadowed jamb outside the glass

  // slab line / structural division every floor
  float slab = 1.0 - smoothstep(0.0, 0.05 + fw.y, abs(f.y - 0.0) * floorH / floorH);
  albedo *= 1.0 - 0.18 * slab * (1.0 - win);
  albedo *= 1.0 - 0.45 * revealOut;

  // occupancy
  float fr = fHash(vec2(cid.y, seed));
  float rr = fHash(cid + seed * 1.37);
  float rr2 = fHash(cid.yx * 1.7 + seed * 3.1);
  float rr3 = fHash(cid * 2.3 + seed * 0.7);
  bool darkFl = fr < darkFloor;
  float lit;
  if (style < 0.5) lit = (!darkFl && fr > 0.42 && rr < 0.93) || (!darkFl && rr < 0.12) ? 1.0 : 0.0; // whole office floors
  else lit = (!darkFl && rr < litBase) ? 1.0 : 0.0;
  vec3 lc = fRoomColor(rr2, style) * mix(0.35, 1.0, rr3) * uWinI * (shop ? 2.2 : 1.0);

  vec3 V = normalize(vWPos - cameraPosition);
  float ndv = clamp(dot(facN, -V), 0.0, 1.0);
  float F = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
  vec3 interior;

#ifdef FAC_INTERIORS
  {
    // ray-box trace through a room of bay × floorH × 5.5m
    vec3 T = vec3(facN.z, 0.0, -facN.x);
    vec3 d = vec3(dot(V, T) / bay, V.y / floorH, -dot(V, facN) / 5.5);
    d = sign(d) * max(abs(d), vec3(1e-4));
    vec3 p = vec3(f, 0.0);
    vec3 tv = (step(0.0, d) - p) / d;
    float t = min(min(tv.x, tv.y), tv.z);
    vec3 h = p + d * t;
    vec3 base = lit > 0.5 ? lc : vec3(0.0035, 0.0042, 0.0058);
    vec3 col;
    if (t == tv.z) col = base * 0.8 * (0.55 + 0.45 * h.y);
    else if (t == tv.x) col = base * 0.5 * (0.6 + 0.4 * h.y);
    else if (d.y < 0.0) col = base * 0.28 * (1.0 - 0.4 * h.z);
    else {
      col = base * 1.0;
      if (style < 0.5 && lit > 0.5) col += lc * 1.4 * step(abs(fract(h.z * 2.5) - 0.5), 0.12) * step(abs(h.x - 0.5), 0.32);
    }
    col *= mix(1.0, 0.55, h.z);
    // desks / sofas silhouetted against the lit back of the room
    float tp = 0.42 / d.z;
    vec2 pp = p.xy + d.xy * tp;
    if (tp < t && pp.y < 0.28 && pp.y > 0.0 && pp.x > 0.08 && pp.x < 0.92) col *= 0.14;
    interior = col;
  }
#else
  interior = lit > 0.5 ? lc * 0.62 : vec3(0.003, 0.0038, 0.005);
#endif

  // window dressing
  float wy = (f.y - sill) / max(winH, 1e-3);
  float wx = (f.x - (0.5 - hx)) / max(winW, 1e-3);
  if (style > 0.5 && rr2 > 0.48) {
    float cover = 0.25 + 0.55 * fHash(cid + 11.0);
    float curtain = smoothstep(1.0 - cover - 0.02, 1.0 - cover, wy) + step(0.82, rr2) * (1.0 - smoothstep(0.18, 0.2, wx));
    interior = mix(interior, lit > 0.5 ? lc * vec3(0.5, 0.42, 0.34) : vec3(0.004), clamp(curtain, 0.0, 1.0));
  } else if (style < 0.5 && rr2 < 0.22) {
    interior *= 0.5 + 0.5 * step(0.45, fract(wy * 16.0)); // blinds
  }
  if (lit < 0.5 && style > 0.5 && rr3 < 0.05) {
    interior += vec3(0.25, 0.35, 0.7) * (0.55 + 0.45 * sin(uTime * 6.0 + seed + cid.x * 3.0) * sin(uTime * 2.3 + cid.y)) * 0.12; // TV
  }
  if (transom > 0.5) interior *= 1.0 - 0.85 * (1.0 - smoothstep(0.0, 0.03 + fw.y * floorH, abs(wy - 0.78) * winH * floorH));
  // glass edge falloff inside the reveal
  interior *= mix(0.55, 1.0, smoothstep(0.02, 0.2, edgeM));

  // shopfront signage band
  if (shop && f.y > 0.8 && f.y < 0.95) {
    float sgn = fHash(vec2(cid.x, seed * 5.0));
    if (sgn < 0.4) {
      vec3 sc = sgn < 0.12 ? vec3(1.0, 0.82, 0.55) : sgn < 0.22 ? vec3(0.8, 0.9, 1.0) : sgn < 0.3 ? vec3(1.0, 0.18, 0.1) : sgn < 0.36 ? vec3(1.0, 0.5, 0.12) : vec3(0.15, 0.8, 0.7);
      float letters = step(0.45, fNoise(vec2(f.x * 22.0, cid.x * 7.0 + (f.y > 0.87 ? 1.0 : 0.0) * 3.0))) * step(abs(f.x - 0.5), 0.34) * step(abs(f.y - 0.875), 0.045);
      facEmit += sc * (0.25 + 1.4 * letters) * (1.0 - lod);
      albedo = mix(albedo, vec3(0.03), 0.8);
    }
  }

  // spandrel glass on curtain walls
  bool spandrel = fam == 0 && !shop && win < 0.5;
  vec3 glassAlb = glassTint * (0.3 + 0.25 * rr3); // coatings / dirt differ pane to pane
  vec3 wallA = spandrel ? glassTint * 0.55 : albedo;
  float wallR = spandrel ? 0.12 + n3 * 0.06 : facRough;
  float wallM = spandrel ? 0.45 : facMetal;

  // assemble opening vs wall, then fade to the average when sub-pixel
  vec3 openEmit = interior * (1.0 - F) * 0.9;
  vec3 frameCol = mix(vec3(0.03, 0.032, 0.035), wallAlbedo, 0.25);
  vec3 openAlb = mix(glassAlb, frameCol, frame);
  float openR = mix(0.05 + 0.2 * fHash(cid + seed * 4.7) + n3 * 0.03, 0.4, frame); // pane tilt / grime breaks up reflections
  float openM = mix(0.0, 0.6, frame);
  openEmit *= 1.0 - frame;

  float area = winW * winH;
  vec3 avgEmit = fRoomColor(0.5, style) * uWinI * (shop ? 2.2 : 1.0) * 0.5 * (style < 0.5 ? 0.55 : litBase) * (1.0 - darkFloor) * area * 0.7;
  float openAmt = mix(win, area, lod);
  albedo = mix(wallA, openAlb, openAmt);
  facRough = mix(wallR, openR, openAmt);
  facMetal = mix(wallM, openM, openAmt);
  facEmit += mix(openEmit * win, avgEmit, lod);
}
diffuseColor.rgb = albedo;

// street lamps (analytic, inverse square, downward-biased luminaire)
vec3 facLampE = vec3(0.0);
{
  float side = sign(vWPos.x);
  // lamps repeat every LAMP_SPACING and move with the street
  float lampZ0 = ${LAMP_FIRST.toFixed(1)} + mod(uScroll, ${LAMP_SPACING.toFixed(1)});
  float i0 = floor((lampZ0 - vWPos.z) / ${LAMP_SPACING.toFixed(1)} + 0.5);
  for (int k = -1; k <= 1; k++) {
    float i = i0 + float(k);
    vec3 L = vec3(side * ${LAMP_X.toFixed(2)}, ${LAMP_Y.toFixed(2)}, lampZ0 - i * ${LAMP_SPACING.toFixed(1)}) - vWPos;
    float d2 = dot(L, L);
    vec3 l = L * inversesqrt(d2);
    float lobe = mix(0.12, 1.0, smoothstep(-0.1, 0.7, l.y));
    facLampE += uLampCol * uLampI * max(dot(facN, l), 0.0) * lobe / (d2 + 4.0);
  }
  // billboard spill (only when the real area light is disabled)
  vec3 Lb = uBBPos - vWPos;
  float db = dot(Lb, Lb);
  vec3 lb = Lb * inversesqrt(db);
  facLampE += uBBCol * uBBI * max(dot(facN, lb), 0.0) * smoothstep(0.0, 0.5, -lb.z) / (db + 60.0);
}
`;

export function createFacadeMaterial({ interiors, scroll = false }) {
  const uniforms = {
    uTime: { value: 0 },
    uScroll: { value: 0 },
    uWinI: { value: 1.25 },
    uLampCol: { value: new THREE.Color("#ffc58a") },
    uLampI: { value: 70 },
    uBBPos: { value: new THREE.Vector3(0, 15, -28) },
    uBBCol: { value: new THREE.Color("#a9cfff") },
    uBBI: { value: 0 },
  };
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.8,
    metalness: 0,
    envMapIntensity: 0.3,
  });
  m.defines = {};
  if (interiors) m.defines.FAC_INTERIORS = "";
  if (scroll) m.defines.FAC_SCROLL = "";
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERT_DECL}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${VERT_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAG_DECL}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${FRAG_BODY}`)
      .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nroughnessFactor = facRough;\nmetalnessFactor = facMetal;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += facEmit;")
      .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\nreflectedLight.directDiffuse += material.diffuseColor * facLampE;");
  };
  m.customProgramCacheKey = () => `facade-v2-${interiors ? 1 : 0}-${scroll ? 1 : 0}`;
  m.userData.uniforms = uniforms;
  return m;
}
