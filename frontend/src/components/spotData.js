// 20 physical spots on the billboard (5 columns x 4 rows).
// Structured symmetrical pricing pyramid:
// Center prime spots: $125 max price
// Inner ring spots: $75 / $50
// Outer edge spots: $25 min entry price
const SPOT_PRICES = [
  25,  50,  75,  50,  25,  // Row 1 (Top)
  25,  75, 125,  75,  25,  // Row 2 (Prime Upper)
  25,  75, 125,  75,  25,  // Row 3 (Prime Lower)
  25,  50,  75,  50,  25,  // Row 4 (Bottom)
];

export const SPOTS = Array.from({ length: 20 }, (_, i) => {
  const id = i + 1;
  const price = SPOT_PRICES[i] || 25;

  return {
    id,
    handle: "AVAILABLE",
    category: "Open",
    color: "#003340",
    link_type: "website",
    link_url: "",
    claimed: false,
    price,
  };
});

export const BILLBOARD_SCALE = 1.95;
export const GRID = {
  cols: 5,
  rows: 4,
  colStep: 3.82,
  rowStep: 2.15,
  originX: -7.64,
  originY: 3.22,
  billboardZ: -30,
  panelsY: 8.2,
  panelsZ: 0.42,
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

export function panelWorldPosition(index) {
  const col = index % GRID.cols;
  const row = Math.floor(index / GRID.cols);
  const x = BILLBOARD_SCALE * (GRID.originX + col * GRID.colStep);
  const y = BILLBOARD_SCALE * (GRID.panelsY + GRID.originY - row * GRID.rowStep);
  const z = GRID.billboardZ + BILLBOARD_SCALE * GRID.panelsZ;
  return [x, y, z];
}
