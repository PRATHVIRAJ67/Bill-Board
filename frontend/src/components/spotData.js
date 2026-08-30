// 20 physical spots on the billboard (5 columns x 4 rows).
// Ordered strictly by amount descending: Spot 1 is highest amount ($125)
const SPOT_PRICES = [
  125, 100, 100,  85,  85,  // Row 1 (Top / Highest Tier: Spot 1 is #1 $125)
   75,  75,  75,  65,  65,  // Row 2 (Upper Tier: $75–$65)
   50,  50,  50,  40,  40,  // Row 3 (Mid Tier: $50–$40)
   35,  35,  25,  25,  25,  // Row 4 (Base Tier: $35–$25)
];

const DUMMY_SPONSORS = [
  { handle: "@super_brand",  category: "AI Platform", color: "#ffd700", link_type: "website",   link_url: "https://superbrand.ai" },
  { handle: "@quantum_flow", category: "SaaS",        color: "#00d9ff", link_type: "website",   link_url: "https://quantumflow.dev" },
  { handle: "@hyper_studios",category: "Creative",    color: "#ff5b6a", link_type: "website",   link_url: "https://hyperstudios.design" },
  { handle: "@cyber_pulse",  category: "DevTool",     color: "#2f7dff", link_type: "website",   link_url: "https://cyberpulse.io" },
  { handle: "@solarpunk",    category: "Web3",        color: "#00c48c", link_type: "website",   link_url: "https://solarpunk.org" },
  { handle: "@apex_gaming",  category: "Esports",     color: "#ff9c3a", link_type: "twitter",   link_url: "https://x.com/apexgaming" },
  { handle: "@syntax_labs",  category: "AI Labs",     color: "#ac6bff", link_type: "website",   link_url: "https://syntaxlabs.ai" },
  { handle: "@pixel_wave",   category: "Art",         color: "#ff6f47", link_type: "instagram", link_url: "https://instagram.com/pixelwave" },
  { handle: "@vortex_audio", category: "Music",       color: "#69ffcc", link_type: "telegram",  link_url: "https://t.me/vortexaudio" },
  { handle: "@prism_core",   category: "Tech",        color: "#e056fd", link_type: "website",   link_url: "https://prismcore.com" },
  { handle: "@echo_media",   category: "Media",       color: "#f0932b", link_type: "website",   link_url: "https://echomedia.co" },
  { handle: "@nova_agency",  category: "Agency",      color: "#00b894", link_type: "website",   link_url: "https://novaagency.io" },
  { handle: "@glitch_sub",   category: "Culture",     color: "#e84393", link_type: "telegram",  link_url: "https://t.me/glitchsub" },
  { handle: "@orbit_network",category: "Community",   color: "#0984e3", link_type: "twitter",   link_url: "https://x.com/orbitnet" },
  { handle: "@alpha_forge",  category: "Crypto",      color: "#fdcb6e", link_type: "website",   link_url: "https://alphaforge.xyz" },
  { handle: "@zenith_app",   category: "Mobile App",  color: "#6c5ce7", link_type: "website",   link_url: "https://zenithapp.io" },
  { handle: "@pulse_beat",   category: "Sound",       color: "#d63031", link_type: "website",   link_url: "https://pulsebeat.fm" },
  { handle: "@neon_district",category: "Metaverse",   color: "#00cec9", link_type: "website",   link_url: "https://neondistrict.city" },
  { handle: "@byte_craft",   category: "Indie Dev",   color: "#badc58", link_type: "twitter",   link_url: "https://x.com/bytecraft" },
  { handle: "@chrono_space", category: "SpaceTech",   color: "#74b9ff", link_type: "website",   link_url: "https://chronospace.io" },
];

export const SPOTS = Array.from({ length: 20 }, (_, i) => {
  const id = i + 1;
  const price = SPOT_PRICES[i] || 25;
  const dummy = DUMMY_SPONSORS[i];

  return {
    id,
    handle: dummy.handle,
    category: dummy.category,
    color: dummy.color,
    link_type: dummy.link_type,
    link_url: dummy.link_url,
    claimed: true,
    price,
  };
});

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
