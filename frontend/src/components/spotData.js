// 20 physical spots on the billboard (5 columns x 4 rows).
// Ordered strictly by amount descending: Spot 1 is highest amount ($125)
const SPOT_PRICES = [
  125, 100, 100,  85,  85,  // Row 1 (Top / Highest Tier: Spot 1 is #1 $125)
   75,  75,  75,  65,  65,  // Row 2 (Upper Tier: $75–$65)
   50,  50,  50,  40,  40,  // Row 3 (Mid Tier: $50–$40)
   35,  35,  25,  25,  25,  // Row 4 (Base Tier: $35–$25)
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
