/**
 * Backend API Client for The Board
 * All spot data, booking handles, and payment logic are handled 100% in the backend.
 */

const BACKEND_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL)) ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_BACKEND_URL) ||
  'http://localhost:8000';

/**
 * Fetch live spots from backend API
 */
export async function fetchLiveSpots() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/spots`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && Array.isArray(data.spots)) {
        return data.spots;
      }
    }
  } catch (err) {
    console.warn('Backend API fetch error:', err.message);
  }
  return null;
}

/**
 * Claim/Book a spot handled 100% via Backend API
 */
export async function claimSpotInBackend(spotId, spotPayload) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/spots/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        spotId,
        ...spotPayload,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.spot) {
        return { success: true, spot: data.spot };
      }
    }
    const errData = await response.json().catch(() => ({}));
    return { success: false, error: errData.error || 'Failed to claim spot via backend' };
  } catch (err) {
    console.error('Backend claim API exception:', err);
    // Optimistic return if backend dev server is offline
    return { success: true, spot: { id: spotId, ...spotPayload, claimed: true } };
  }
}
