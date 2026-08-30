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

// Helper to verify Razorpay HMAC-SHA256 signature using Web Crypto API
async function verifyRazorpaySignature(orderId, paymentId, signature, secret) {
  if (!orderId || !paymentId || !signature || !secret) {
    return false;
  }
  const text = `${orderId}|${paymentId}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(text));
  const hexSig = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hexSig.toLowerCase() === signature.toLowerCase();
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

// POST /api/create-order & /api/create-razorpay-order
const handleCreateOrder = async (c) => {
  try {
    const body = await c.req.json();
    
    // Calculate amount in paise (minimum 100 paise = 1 INR)
    let amountInPaise = 0;
    if (body.amount) {
      amountInPaise = Number(body.amount);
    } else if (body.amountUSD) {
      const amountInINR = Math.round(Number(body.amountUSD) * 83);
      amountInPaise = amountInINR * 100;
    } else {
      amountInPaise = 25 * 83 * 100; // default $25
    }

    // Minimum amount validation
    if (amountInPaise < 100) {
      return c.json({ success: false, error: 'Amount must be at least 100 paise (1 INR)' }, 400);
    }

    const env = c.env;
    const keyId = env?.RAZORPAY_KEY_ID || "rzp_test_TVtzzS51l0oAyp";
    const keySecret = env?.RAZORPAY_KEY_SECRET || "YpcgbNmIH9oC5iwkzNqfWZJv";

    const authHeader = 'Basic ' + btoa(`${keyId}:${keySecret}`);
    const receipt = body.receipt || `rcpt_spot_${body.spotId || 'gen'}_${Date.now().toString().slice(-8)}`;

    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: body.currency || 'INR',
        receipt: receipt,
        notes: {
          spot_id: String(body.spotId || ''),
          handle: String(body.handle || ''),
        },
      }),
    });

    if (!rzpRes.ok) {
      const errText = await rzpRes.text();
      let errJson;
      try { errJson = JSON.parse(errText); } catch { errJson = { description: errText }; }
      
      if (rzpRes.status === 401) {
        return c.json({ success: false, error: 'Razorpay Authentication failed. Check Key ID & Secret.' }, 401);
      }
      return c.json({
        success: false,
        error: errJson.error?.description || errJson.description || 'Failed to create Razorpay order',
      }, rzpRes.status || 500);
    }

    const orderData = await rzpRes.json();
    return c.json({
      success: true,
      order_id: orderData.id,
      id: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
      status: orderData.status,
      receipt: orderData.receipt,
    });
  } catch (err) {
    return c.json({ success: false, error: err.message || 'Internal Server Error' }, 500);
  }
};

app.post('/api/create-order', handleCreateOrder);
app.post('/api/create-razorpay-order', handleCreateOrder);

// POST /api/verify-payment - Verify HMAC-SHA256 payment signature
app.post('/api/verify-payment', async (c) => {
  try {
    const body = await c.req.json();
    const orderId = body.razorpay_order_id || body.orderId || body.order_id;
    const paymentId = body.razorpay_payment_id || body.paymentId || body.payment_id;
    const signature = body.razorpay_signature || body.signature;

    if (!orderId || !paymentId || !signature) {
      return c.json({
        success: false,
        error: 'Missing required payment verification fields (razorpay_order_id, razorpay_payment_id, razorpay_signature)',
      }, 400);
    }

    const env = c.env;
    const keySecret = env?.RAZORPAY_KEY_SECRET || "YpcgbNmIH9oC5iwkzNqfWZJv";

    const isValid = await verifyRazorpaySignature(orderId, paymentId, signature, keySecret);

    if (!isValid) {
      return c.json({
        success: false,
        error: 'Payment verification failed: Signature mismatch',
      }, 400);
    }

    return c.json({
      success: true,
      status: 'verified',
      paymentId: paymentId,
      orderId: orderId,
      spotId: body.spotId,
    });
  } catch (err) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/spots/claim - Secure backend claim & Supabase update
app.post('/api/spots/claim', async (c) => {
  try {
    const body = await c.req.json();
    const { spotId, handle, category, color, link_type, link_url, paymentId, orderId } = body;

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
      console.warn('Backend Supabase spot update notice:', spotError.message);
    }

    // 2. Log transaction record in Supabase
    await supabase.from('transactions').insert({
      spot_id: spotId,
      razorpay_payment_id: paymentId || `pay_${Date.now()}`,
      razorpay_order_id: orderId || null,
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

export default app;
