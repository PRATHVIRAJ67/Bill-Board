import * as THREE from "three";

export const DRACO_URL = "https://www.gstatic.com/draco/versioned/decoders/1.5.7/";
export const HERO_MODEL = "/models/ferrari.glb";
export const TRAFFIC_MODEL = "/models/ferrari-lod.glb"; // interior stripped, 28k tris

/**
 * The source GLB ships every material as the same flat default (metal 0.2 /
 * rough 0.8), so each one is re-authored here by name into a physically
 * plausible counterpart. Lights are HDR emissive so they bloom and show up in
 * the wet-road reflection without costing a real light each.
 */
export function createCarMaterials({ paint = "#ffffff", clearcoat = true, lod = false }) {
  const Paint = clearcoat ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const paintMat = new Paint({
    color: paint,
    metalness: clearcoat ? 0.6 : 0.72,
    roughness: clearcoat ? 0.34 : 0.24,
    envMapIntensity: 1.35,
    ...(clearcoat ? { clearcoat: 1, clearcoatRoughness: 0.035 } : {}),
  });

  const std = (p) => new THREE.MeshStandardMaterial(p);
  const mats = {
    Body_Color: paintMat,
    Glass_Gray: std({
      color: "#06090c",
      metalness: 0.9,
      roughness: 0.03,
      envMapIntensity: 1.6,
      transparent: !lod,
      opacity: lod ? 1 : 0.82,
    }),
    Taillight_Glass: std({ color: "#2a0003", emissive: "#ff1a2a", emissiveIntensity: 3.4, roughness: 0.18, metalness: 0.1 }),
    Projector_Glass: std({ color: "#1b1f24", emissive: "#e8f3ff", emissiveIntensity: 6, roughness: 0.1 }),
    Turn_Signal_LED: std({ color: "#2a0a00", emissive: "#ff5a12", emissiveIntensity: 0.45, roughness: 0.2 }),
    Tires: std({ color: "#0b0b0c", metalness: 0, roughness: 0.86 }),
    metal_gray: std({ color: "#8a9096", metalness: 1, roughness: 0.3 }),
    metal_chrome: std({ color: "#e4eaef", metalness: 1, roughness: 0.06, envMapIntensity: 1.3 }),
    Carbon_Fiber: std({ color: "#15171a", metalness: 0.55, roughness: 0.26 }),
    plastic_gray: std({ color: "#141619", metalness: 0.1, roughness: 0.62 }),
    Leather: std({ color: "#1c1c1f", metalness: 0, roughness: 0.72 }),
    Leather_red: std({ color: "#5c1414", metalness: 0, roughness: 0.66 }),
    Interior_dark: std({ color: "#101112", metalness: 0.1, roughness: 0.8 }),
    Interior_light: std({ color: "#34363a", metalness: 0.1, roughness: 0.7 }),
    Carpet: std({ color: "#0e0e10", metalness: 0, roughness: 1 }),
    Ferrari_Yellow: std({ color: "#f2c200", metalness: 0.3, roughness: 0.35 }),
    _0098_DodgerBlue: std({ color: "#1e90ff", metalness: 0.3, roughness: 0.35 }),
  };
  return mats;
}

export function disposeMaterials(mats) {
  Object.values(mats).forEach((m) => m.dispose());
}
