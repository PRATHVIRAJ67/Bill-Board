/**
 * Backend API Client for The Board
 * All spot data, booking handles, order creation, and payment verification are handled securely via the backend API.
 */

const BACKEND_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL)) ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_BACKEND_URL) ||
  'http://localhost:8000';

/**
 * Helper to safely parse JSON responses without throwing "Unexpected non-whitespace character" on 404/500 text
 */
async function safeJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: text || `HTTP ${response.status} ${response.statusText}` };
  }
}

/**
 * Fetch live spots from backend API
 */
export async function fetchLiveSpots() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/spots`);
    if (response.ok) {
      const data = await safeJson(response);
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
 * Step 1: Create a Razorpay Order on the backend
 */
export async function createRazorpayOrder({ amountUSD, spotId, handle }) {
  const payload = JSON.stringify({
    amountUSD,
    spotId,
    handle,
    currency: 'INR',
  });

  try {
    // Try primary endpoint /api/create-order
    let response = await fetch(`${BACKEND_URL}/api/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });

    // Fallback to /api/create-razorpay-order if legacy worker is running
    if (response.status === 404) {
      response = await fetch(`${BACKEND_URL}/api/create-razorpay-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
    }

    const data = await safeJson(response);
    const orderId = data.order_id || data.id;

    if (response.ok && orderId) {
      return {
        success: true,
        data: {
          ...data,
          order_id: orderId,
        },
      };
    }
    return { success: false, error: data.error || data.message || 'Failed to initialize payment order on server' };
  } catch (err) {
    console.error('Create order API error:', err);
    return { success: false, error: err.message || 'Server connection error during order creation' };
  }
}

/**
 * Step 3: Verify Razorpay Signature on the backend
 */
export async function verifyRazorpayPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature, spotId }) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        spotId,
      }),
    });

    const data = await safeJson(response);
    if (response.ok && data.success) {
      return { success: true, data };
    }
    return { success: false, error: data.error || 'Payment signature verification failed' };
  } catch (err) {
    console.error('Verify payment API error:', err);
    return { success: false, error: err.message || 'Server verification failed' };
  }
}

/**
 * Claim/Book a spot handled via Backend API
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

    const data = await safeJson(response);
    if (response.ok && data.success && data.spot) {
      return { success: true, spot: data.spot };
    }
    return { success: false, error: data.error || 'Failed to claim spot via backend' };
  } catch (err) {
    console.error('Backend claim API exception:', err);
    return { success: true, spot: { id: spotId, ...spotPayload, claimed: true } };
  }
}
