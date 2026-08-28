// 30 physical spots on the billboard. 17 claimed / 13 available to match the
// live status ticker. Categories/colors are demo identities only — clearly
// fictional. Ordering matches the physical 6-column x 5-row panel layout
// (index 0 = row 0 col 0 = top-left).
export const SPOTS = [
  { id: 1,  handle: "@cyber_nexus",       category: "Community", color: "#2f7dff", claimed: true },
  { id: 2,  handle: "@pixel_wave",        category: "Creator",   color: "#e75858", claimed: true },
  { id: 3,  price: 25,                                                             claimed: false },
  { id: 4,  handle: "@strata_app",        category: "SaaS",      color: "#f8b04a", claimed: true },
  { id: 5,  handle: "@neon_foundry",      category: "Brand",     color: "#00c48c", claimed: true },
  { id: 6,  price: 35,                                                             claimed: false },
  { id: 7,  handle: "@hyperion_ai",       category: "AI",        color: "#ff5b6a", claimed: true },
  { id: 8,  handle: "@syntax_labs",       category: "DevTool",   color: "#ac6bff", claimed: true },
  { id: 9,  price: 25,                                                             claimed: false },
  { id: 10, handle: "@lunar_craft",       category: "Game",      color: "#4ba6ff", claimed: true },
  { id: 11, handle: "@vortex_cloud",      category: "Cloud",     color: "#3b9dff", claimed: true },
  { id: 12, price: 30,                                                             claimed: false },
  { id: 13, handle: "@flux_ai",           category: "AI",        color: "#ff9c3a", claimed: true },
  { id: 14, price: 50,                                                             claimed: false },
  { id: 15, handle: "@pulse_audio",       category: "Music",     color: "#7be3a1", claimed: true },
  { id: 16, handle: "@apex_realm",        category: "Game",      color: "#a05cff", claimed: true },
  { id: 17, handle: "@orbit_saas",        category: "SaaS",      color: "#ff4c6a", claimed: true },
  { id: 18, price: 25,                                                             claimed: false },
  { id: 19, price: 60,                                                             claimed: false },
  { id: 20, handle: "@chrono_game",       category: "Game",      color: "#5cd1a4", claimed: true },
  { id: 21, price: 75,                                                             claimed: false },
  { id: 22, handle: "@glitch_subculture", category: "Culture",   color: "#69ffcc", claimed: true },
  { id: 23, handle: "@prism_design",      category: "Design",    color: "#ff6f47", claimed: true },
  { id: 24, price: 250,                                                            claimed: false },
  { id: 25, price: 190,                                                            claimed: false },
  { id: 26, handle: "@vector_lab",        category: "Studio",    color: "#dedede", claimed: true },
  { id: 27, price: 40,                                                             claimed: false },
  { id: 28, price: 45,                                                             claimed: false },
  { id: 29, price: 25,                                                             claimed: false },
  { id: 30, handle: "@alt_future",        category: "Media",     color: "#8be04e", claimed: true },
];

// Grid geometry constants shared between panel rendering and camera focus.
export const BILLBOARD_SCALE = 1.6;
export const GRID = {
  cols: 6,
  rows: 5,
  colStep: 3.08,
  rowStep: 1.48,
  originX: -7.7,
  originY: 3.25,
  // Billboard group placement in world space.
  billboardZ: -30,
  panelsY: 8.2,
  panelsZ: 0.42,
};

export function panelWorldPosition(index) {
  const col = index % GRID.cols;
  const row = Math.floor(index / GRID.cols);
  // Panels live inside the scaled Billboard group, so their world
  // coordinates depend on BILLBOARD_SCALE for x/y and add billboardZ for z.
  const x = BILLBOARD_SCALE * (GRID.originX + col * GRID.colStep);
  const y = BILLBOARD_SCALE * (GRID.panelsY + GRID.originY - row * GRID.rowStep);
  const z = GRID.billboardZ + BILLBOARD_SCALE * GRID.panelsZ;
  return [x, y, z];
}
