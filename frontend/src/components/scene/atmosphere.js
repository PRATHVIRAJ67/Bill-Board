import * as THREE from "three";

/*
 * Atmospheric perspective for every built-in material (patched once, globally).
 *
 * Replaces three's uniform fog with analytic height fog: dense humid air at street
 * level that thins with altitude (Beer-Lambert integrated along the view ray),
 * plus in-scattering — the haze picks up warm city light pollution toward the
 * horizon and a cool glow in the direction of the giant LED screen.
 * `fogDensity` (FogExp2) drives the ground-level density.
 */

export const HAZE = {
  base: new THREE.Color("#0f1822"),      // ambient night air
  horizon: new THREE.Color("#2a2622"),   // sodium / LED light pollution near the ground
  screen: new THREE.Color("#3b6a8f"),    // forward scattering around the billboard
  falloff: 0.022,                         // 1/m density decay with height
  screenPos: [0, 15, -28],
};

let installed = false;
export function installAtmosphere() {
  if (installed) return;
  installed = true;
  const c = (col) => `vec3(${col.r.toFixed(4)}, ${col.g.toFixed(4)}, ${col.b.toFixed(4)})`;

  THREE.ShaderChunk.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogWorld;
#endif`;

  THREE.ShaderChunk.fog_vertex = /* glsl */ `
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogWorld = cameraPosition + transpose(mat3(viewMatrix)) * mvPosition.xyz;
#endif`;

  THREE.ShaderChunk.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vFogWorld;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif`;

  THREE.ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  {
    vec3 fRay = vFogWorld - cameraPosition;
    float fDist = length(fRay);
    vec3 fDir = fRay / max(fDist, 1e-4);
    #ifdef FOG_EXP2
      float fDensity = fogDensity;
    #else
      float fDensity = 1.0 / max(fogFar, 1.0);
    #endif
    const float fB = ${HAZE.falloff.toFixed(4)};
    float fY = max(cameraPosition.y, 0.0);
    float fRd = fDir.y * fB * fDist;
    float fOptical = fDensity * exp(-fY * fB) * fDist * (abs(fRd) > 1e-4 ? (1.0 - exp(-fRd)) / fRd : 1.0);
    float fAmount = 1.0 - exp(-fOptical);

    vec3 fToScreen = normalize(vec3(${HAZE.screenPos.join(", ")}) - cameraPosition);
    float fScreen = pow(max(dot(fDir, fToScreen), 0.0), 10.0);
    float fLow = exp(-max(fDir.y, 0.0) * 10.0);
    vec3 fCol = fogColor + ${c(HAZE.horizon)} * 0.55 * fLow + ${c(HAZE.screen)} * fScreen * 0.9;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fCol, fAmount);
  }
#endif`;
}
