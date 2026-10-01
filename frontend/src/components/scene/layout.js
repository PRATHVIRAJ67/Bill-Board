import { GRID } from "../spotData";

/**
 * Responsive scene composition.
 *
 * The world is identical on every device; only the *photography* changes:
 * billboard scale/height, hero-car placement, camera position, look target and
 * lens. The vertical FOV is additionally solved so the full billboard always
 * fits horizontally (no more cropped boards in portrait).
 */

// Billboard local dimensions (group origin = screen centre, scale 1)
export const PANEL_W = GRID.colStep; // 3.62
export const PANEL_H = GRID.rowStep; // 1.92
export const PANEL_GAP = 0.07;
export const SCREEN_W = PANEL_W * GRID.cols; // 18.1
export const SCREEN_H = PANEL_H * GRID.rows; // 7.68
export const HOUSING_W = SCREEN_W + 0.9;
export const HOUSING_H = SCREEN_H + 0.9;

export const HERO_SPEED = 30; // m/s (~108 km/h): the hero car's speed along the fixed street
export const ROAD_Y = 0;
export const ROAD_HALF_W = 14;
export const BILLBOARD_Z = -28;

/* Street plan (metres). One-way-per-side city avenue:
   away lanes x<0, oncoming x>0, hero waits in the centre turn lane. */
export const CURB_H = 0.15;
export const SIDEWALK_OUT = 21; // sidewalk from |x| = ROAD_HALF_W .. SIDEWALK_OUT, frontage beyond
export const STREET_NEAR = 60; // street runs from z = +60 …
export const STREET_FAR = -900; // … to the horizon
export const CROSS_STREETS = [-64, -170, -290, -430]; // z centres of intersections
export const CROSS_HALF_W = 9;
export const LAMP_X = ROAD_HALF_W - 1.6; // lamp head x (pole at ROAD_HALF_W + 0.9)
export const LAMP_Y = 8.4;
export const LAMP_Z0 = 10;
export const LAMP_SPACING = 24;
export const LAMP_COUNT = 25; // per side — exactly one street period (600 m / 24 m)
export const LANES_AWAY = [-7.4, -3.7];
export const LANES_ONCOMING = [3.7, 7.4];
export const PARK_X = 11.6;

/* The street (road, kerbs, lamps, signals, parked cars, building rows) is one
   seamless 600 m block. It and the billboard stay put; the hero car drives
   along it (see HeroCar) and loops back once it is lost in the haze. */
export const STREET_PERIOD = 600;
export const STREET_MIN = STREET_NEAR - STREET_PERIOD; // -540
export const LAMP_FIRST = LAMP_Z0 + 48; // lamps at 58, 34, 10, -14 … (25 per period)

export const inCrossStreet = (z, pad = 0) => CROSS_STREETS.some((c) => Math.abs(z - c) < CROSS_HALF_W + pad);

const PRESETS = {
  portrait: {
    bb: { y: 8.9, s: 1.0 },
    car: { pos: [0, 0, 3.3], scale: 1.0 },
    cam: { pos: [0, 2.35, 11.2], look: [0, 2.0, -28], fov: 60 },
    fill: 0.94,
    bbScreenY: 0.3, // NDC height of the board's centre: sits right under the headline
    sweep: { radius: 21, y: 3.6, lookY: 7.6 },
    orbit: { target: [0, 7, -27], min: 16, max: 48 },
    focusFill: 0.68,
    focusShift: [0, -0.5],
  },
  landscapeMobile: {
    bb: { y: 14.4, s: 1.55 },
    car: { pos: [0, 0, 0.4], scale: 1.08 },
    cam: { pos: [0, 2.0, 8.6], look: [0, 4.6, -20], fov: 50 },
    fill: 0.62,
    sweep: { radius: 19, y: 3.0, lookY: 11 },
    orbit: { target: [0, 8, -28], min: 14, max: 42 },
    focusFill: 0.5,
    focusShift: [0.18, 0],
  },
  desktop: {
    bb: { y: 15.8, s: 1.75 },
    car: { pos: [0, 0, 1.9], scale: 1.12 },
    cam: { pos: [0, 1.95, 8.8], look: [0, 5.8, -18], fov: 56 },
    fill: 0.5,
    sweep: { radius: 19, y: 2.9, lookY: 12 },
    orbit: { target: [0, 9, -28], min: 14, max: 44 },
    focusFill: 0.46,
    focusShift: [0.2, 0],
  },
};

export function getLayout(width, height) {
  const aspect = width / Math.max(1, height);
  const key = aspect < 0.85 ? "portrait" : height <= 520 ? "landscapeMobile" : "desktop";
  const p = PRESETS[key];

  // Solve vertical FOV so the housing fits the requested share of the width.
  const dist = p.cam.pos[2] - BILLBOARD_Z;
  const halfW = (HOUSING_W * p.bb.s) / 2 / p.fill;
  const vFit = (2 * Math.atan(halfW / dist / aspect) * 180) / Math.PI;
  const fov = Math.min(78, Math.max(p.cam.fov, key === "portrait" ? vFit : p.cam.fov));

  let cam = p.cam;
  if (p.bbScreenY != null) {
    // Pitch the lens so the board lands at a designed screen height, whatever
    // the phone's aspect ratio (browser chrome, notches, foldables…).
    const halfV = (fov * Math.PI) / 360;
    const toBoard = Math.atan((p.bb.y - p.cam.pos[1]) / dist);
    const pitch = toBoard - Math.atan(p.bbScreenY * Math.tan(halfV));
    cam = { ...p.cam, look: [0, p.cam.pos[1] + Math.tan(pitch) * dist, BILLBOARD_Z] };
  }

  return { key, aspect, fov, ...p, cam };
}

/** World-space centre of panel `index` for a given layout. */
export function panelWorld(index, layout) {
  const col = index % GRID.cols;
  const row = Math.floor(index / GRID.cols);
  const s = layout.bb.s;
  const lx = -SCREEN_W / 2 + PANEL_W * (col + 0.5);
  const ly = SCREEN_H / 2 - PANEL_H * (row + 0.5);
  return [lx * s, layout.bb.y + ly * s, BILLBOARD_Z + 0.05 * s];
}
