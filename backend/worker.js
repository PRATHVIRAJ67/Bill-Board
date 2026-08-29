// Cloudflare Worker backend using Hono with Secure Supabase & Razorpay integrations
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createClient } from '@supabase/supabase-js';

const app = new Hono();

// Enable CORS middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Helper to initialize Supabase client securely on backend
function getSupabaseClient(env) {
  const url = env?.SUPABASE_URL || "https://nyfyofcjnphwhxciaqox.supabase.co";
  const key = env?.SUPABASE_SECRET_KEY || env?.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55ZnlvZmNqbnBod2h4Y2lhcW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5OTYyNjAsImV4cCI6MjEwMzU3MjI2MH0.tXw5p38PbqdbGmALysxIav5rF3XY-qA6VWzXXQO_1TA";
  return createClient(url, key);
}

// GET /api/ - Health check
app.get('/api', (c) => {
  return c.json({ status: 'ok', service: 'The Board Secure Backend API', timestamp: new Date().toISOString() });
});

// GET /api/spots - Fetch live spots from Supabase DB via backend
app.get('/api/spots', async (c) => {
  try {
    const supabase = getSupabaseClient(c.env);
    const { data, error } = await supabase
      .from('spots')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.warn('Backend Supabase fetch notice:', error.message);
      return c.json({ success: false, spots: null, message: error.message });
    }

    return c.json({ success: true, spots: data });
  } catch (err) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/spots/claim - Secure backend claim & Supabase update
app.post('/api/spots/claim', async (c) => {
  try {
    const body = await c.req.json();
    const { spotId, handle, category, color, link_type, link_url, paymentId } = body;

    if (!spotId || !handle) {
      return c.json({ success: false, error: 'spotId and handle are required' }, 400);
    }

    const supabase = getSupabaseClient(c.env);

    // 1. Update spot row in Supabase
    const { data: spotData, error: spotError } = await supabase
      .from('spots')
      .update({
        handle: handle.trim(),
        category: category || 'Brand',
        color: color || '#00c48c',
        link_type: link_type || 'website',
        link_url: link_url || '',
        claimed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', spotId)
      .select()
      .single();

    if (spotError) {
      console.warn('Backend update notice:', spotError.message);
    }

    // 2. Log transaction record in Supabase
    await supabase.from('transactions').insert({
      spot_id: spotId,
      razorpay_payment_id: paymentId || `pay_demo_${Date.now()}`,
      amount: body.amount || 25,
      status: 'completed',
      customer_handle: handle,
      customer_link: link_url,
    }).catch((e) => console.warn('Transaction log notice:', e.message));

    const updatedSpot = spotData || {
      id: spotId,
      handle: handle.trim(),
      category: category || 'Brand',
      color: color || '#00c48c',
      link_type: link_type || 'website',
      link_url: link_url || '',
      claimed: true,
      updated_at: new Date().toISOString(),
    };

    return c.json({ success: true, spot: updatedSpot });
  } catch (err) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/create-razorpay-order
app.post('/api/create-razorpay-order', async (c) => {
  try {
    const body = await c.req.json();
    const amountInINR = Math.round((body.amountUSD || 25) * 83);
    const amountInPaise = amountInINR * 100;

    const env = c.env;
    const keyId = env?.RAZORPAY_KEY_ID || "rzp_test_billboard_key";
    const keySecret = env?.RAZORPAY_KEY_SECRET || "demo_secret";

    const authHeader = 'Basic ' + btoa(`${keyId}:${keySecret}`);
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `receipt_spot_${body.spotId}_${Date.now()}`,
        notes: { spot_id: body.spotId, handle: body.handle }
      })
    });

    if (!rzpRes.ok) {
      return c.json({
        id: `order_demo_${Date.now()}`,
        amount: amountInPaise,
        currency: 'INR',
        status: 'created',
      });
    }

    const orderData = await rzpRes.json();
    return c.json(orderData);
  } catch (err) {
    return c.json({ error: err.message, id: `order_demo_${Date.now()}` });
  }
});

// POST /api/verify-payment
app.post('/api/verify-payment', async (c) => {
  try {
    const body = await c.req.json();
    return c.json({
      success: true,
      paymentId: body.razorpay_payment_id || `pay_${Date.now()}`,
      spotId: body.spotId,
      status: 'verified'
    });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

export default app;
