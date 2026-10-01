import { HERO_SPEED, STREET_MIN, STREET_PERIOD } from "./layout";

/**
 * Shared street clock. The world (street, billboard, skyline) is fixed; `s` is
 * the street scroll offset and stays at 0, `speed` is the hero car's road speed.
 */
export const street = { s: 0, speed: HERO_SPEED };

/** Hero car's distance travelled along the avenue (negative z), updated by HeroCar. */
export const hero = { z: 0 };

/** Current scroll offset inside one street period, 0..STREET_PERIOD. */
export const scrollOffset = () => street.s % STREET_PERIOD;

/** Wrap a street-space z into the visible block [STREET_MIN, STREET_MIN + PERIOD). */
export const wrapZ = (z) => ((((z - STREET_MIN) % STREET_PERIOD) + STREET_PERIOD) % STREET_PERIOD) + STREET_MIN;
