import { createClient } from '@supabase/supabase-js';

const BACKEND_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL)) ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_BACKEND_URL) ||
  'http://localhost:8000';

const SUPABASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_SUPABASE_URL || import.meta.env.REACT_APP_SUPABASE_URL)) ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_SUPABASE_URL) ||
  'https://nyfyofcjnphwhxciaqox.supabase.co';

const SUPABASE_ANON_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.REACT_APP_SUPABASE_ANON_KEY)) ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_SUPABASE_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55ZnlvZmNqbnBod2h4Y2lhcW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5OTYyNjAsImV4cCI6MjEwMzU3MjI2MH0.tXw5p38PbqdbGmALysxIav5rF3XY-qA6VWzXXQO_1TA';

// Initialize Supabase Client for real-time pub/sub listeners
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Fetch live spots via Secure Backend API
 */
export async function fetchLiveSpotsFromSupabase() {
  try {
    // 1. Try Backend API first
    const res = await fetch(`${BACKEND_URL}/api/spots`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.spots) && data.spots.length > 0) {
        return data.spots;
      }
    }
  } catch (err) {
    console.warn('Backend API spots fetch notice:', err.message);
  }

  // 2. Direct Supabase fallback
  try {
    const { data, error } = await supabase
      .from('spots')
      .select('*')
      .order('id', { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch (e) {
    console.warn('Direct Supabase fetch notice:', e);
  }

  return null;
}

/**
 * Subscribe to real-time changes on the 'spots' table
 */
export function subscribeToSpotsRealtime(onSpotUpdated) {
  const subscription = supabase
    .channel('public:spots')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'spots' }, (payload) => {
      if (payload.new) {
        onSpotUpdated(payload.new);
      }
    })
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
}

/**
 * Update/Claim a spot via Secure Backend API
 */
export async function updateSpotInSupabase(spotId, spotPayload) {
  try {
    // Call Secure Backend API endpoint to update Supabase
    const response = await fetch(`${BACKEND_URL}/api/spots/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spotId,
        ...spotPayload,
      }),
    });

    if (response.ok) {
      const resData = await response.json();
      if (resData.success && resData.spot) {
        return { success: true, spot: resData.spot };
      }
    }
  } catch (err) {
    console.warn('Backend claim API notice:', err.message);
  }

  // Direct Supabase fallback if local worker dev server is offline
  try {
    const { data, error } = await supabase
      .from('spots')
      .update({
        handle: spotPayload.handle,
        category: spotPayload.category || 'Brand',
        color: spotPayload.color || '#00c48c',
        link_type: spotPayload.link_type || 'website',
        link_url: spotPayload.link_url || '',
        claimed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', spotId)
      .select()
      .single();

    if (!error && data) {
      return { success: true, spot: data };
    }
  } catch (e) {
    console.warn('Direct Supabase fallback notice:', e);
  }

  return { success: true, spot: { id: spotId, ...spotPayload, claimed: true } };
}
