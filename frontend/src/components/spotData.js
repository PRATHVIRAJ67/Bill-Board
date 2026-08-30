// 20 physical spots on the billboard (5 columns x 4 rows).
// Ordered strictly by price descending: Spot 1 is highest ($125)
const SPOT_PRICES = [
  125, 100, 100,  85,  85,  // Row 1 (Top / Highest Tier)
   75,  75,  75,  65,  65,  // Row 2 (Upper Tier)
   50,  50,  50,  40,  40,  // Row 3 (Mid Tier)
   35,  35,  25,  25,  25,  // Row 4 (Base Tier)
];

// Fixed color permanently assigned to each spot number (1–20).
// This is the exact banner color the buyer will own — shown upfront so
// they can pick the spot whose color matches their brand.
const SPOT_COLORS = [
  "#ffd700", // #01 — Gold
  "#00d9ff", // #02 — Cyan
  "#ff5b6a", // #03 — Coral Red
  "#2f7dff", // #04 — Electric Blue
  "#00c48c", // #05 — Emerald
  "#ff9c3a", // #06 — Amber
  "#ac6bff", // #07 — Violet
  "#ff6f47", // #08 — Sunset Orange
  "#69ffcc", // #09 — Mint
  "#e056fd", // #10 — Magenta
  "#f0932b", // #11 — Deep Amber
  "#00b894", // #12 — Teal
  "#e84393", // #13 — Hot Pink
  "#0984e3", // #14 — Sky Blue
  "#fdcb6e", // #15 — Warm Yellow
  "#6c5ce7", // #16 — Purple
  "#d63031", // #17 — Crimson
  "#00cec9", // #18 — Aqua
  "#badc58", // #19 — Lime
  "#74b9ff", // #20 — Soft Blue
];

export const SPOTS = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  color: SPOT_COLORS[i],
  price: SPOT_PRICES[i] || 25,
  claimed: false,
  handle: null,
  category: null,
  link_type: null,
  link_url: null,
}));

export const BILLBOARD_SCALE = 1.95;
export const SPOT_DIMENSIONS = {
  width: "3.6m",
  height: "1.9m",
  aspectRatio: "16:9",
  pixels: "1920 × 1080 (16:9 HD)",
};

export const GRID = {
  cols: 5,
  rows: 4,
  colStep: 3.62,
  rowStep: 1.92,
  originX: -7.24,
  originY: 3.09,
  billboardZ: -30,
  panelsY: 8.2,
  panelsZ: 0.35,
};

export function getLinkIcon(linkType) {
  switch (linkType) {
    case "telegram":  return "✈️";
    case "instagram": return "📸";
    case "twitter":   return "🐦";
    case "custom":    return "🔗";
    default:          return "🌐";
  }
}

export function getSpotLogoUrl(spot) {
  if (!spot) return null;
  if (spot.logo_url) return spot.logo_url;
  if (spot.link_url) {
    try {
      const url = spot.link_url.startsWith("http") ? spot.link_url : `https://${spot.link_url}`;
      const domain = new URL(url).hostname;
      if (domain) {
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function panelWorldPosition(index) {
  const col = index % GRID.cols;
  const row = Math.floor(index / GRID.cols);
  const x = BILLBOARD_SCALE * (GRID.originX + col * GRID.colStep);
  const y = BILLBOARD_SCALE * (GRID.panelsY + GRID.originY - row * GRID.rowStep);
  const z = GRID.billboardZ + BILLBOARD_SCALE * GRID.panelsZ;
  return [x, y, z];
}
