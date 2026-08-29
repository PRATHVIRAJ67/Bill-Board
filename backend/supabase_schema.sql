-- ====================================================================
-- THE BOARD - SUPABASE DATABASE SCHEMA
-- Execute this SQL in your Supabase SQL Editor (https://supabase.com)
-- ====================================================================

-- 1. Create 'spots' table for the 20 dynamic billboard panels
CREATE TABLE IF NOT EXISTS public.spots (
  id INT PRIMARY KEY,
  handle TEXT NOT NULL DEFAULT 'AVAILABLE',
  category TEXT DEFAULT 'Open',
  color TEXT DEFAULT '#003340',
  link_type TEXT DEFAULT 'website', -- 'website' | 'instagram' | 'telegram' | 'twitter' | 'custom'
  link_url TEXT DEFAULT '',
  claimed BOOLEAN DEFAULT false,
  price NUMERIC DEFAULT 25.00,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create 'transactions' table for Razorpay payment logs
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id INT REFERENCES public.spots(id),
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'completed', -- 'created' | 'completed' | 'failed'
  customer_handle TEXT,
  customer_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS) & Public Read Access
ALTER TABLE public.spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all spots
CREATE POLICY "Allow public read access to spots" 
  ON public.spots FOR SELECT 
  USING (true);

-- Allow public update to claimed spots
CREATE POLICY "Allow public update to spots" 
  ON public.spots FOR UPDATE 
  USING (true);

-- Allow public insert to spots
CREATE POLICY "Allow public insert to spots" 
  ON public.spots FOR INSERT 
  WITH CHECK (true);

-- Allow transaction logging
CREATE POLICY "Allow public insert to transactions" 
  ON public.transactions FOR INSERT 
  WITH CHECK (true);

-- 4. Enable Realtime for 'spots' table
ALTER PUBLICATION supabase_realtime ADD TABLE public.spots;

-- 5. Seed initial 20 empty/available spots (Structured Symmetrical Pricing: Center $125 Max, Sides $25 Min)
INSERT INTO public.spots (id, handle, category, color, link_type, link_url, claimed, price)
VALUES
  (1,  'AVAILABLE', 'Open', '#003340', 'website', '', false, 25),
  (2,  'AVAILABLE', 'Open', '#003340', 'website', '', false, 50),
  (3,  'AVAILABLE', 'Open', '#003340', 'website', '', false, 75),
  (4,  'AVAILABLE', 'Open', '#003340', 'website', '', false, 50),
  (5,  'AVAILABLE', 'Open', '#003340', 'website', '', false, 25),

  (6,  'AVAILABLE', 'Open', '#003340', 'website', '', false, 25),
  (7,  'AVAILABLE', 'Open', '#003340', 'website', '', false, 75),
  (8,  'AVAILABLE', 'Open', '#003340', 'website', '', false, 125), -- Center Prime Upper
  (9,  'AVAILABLE', 'Open', '#003340', 'website', '', false, 75),
  (10, 'AVAILABLE', 'Open', '#003340', 'website', '', false, 25),

  (11, 'AVAILABLE', 'Open', '#003340', 'website', '', false, 25),
  (12, 'AVAILABLE', 'Open', '#003340', 'website', '', false, 75),
  (13, 'AVAILABLE', 'Open', '#003340', 'website', '', false, 125), -- Center Prime Lower
  (14, 'AVAILABLE', 'Open', '#003340', 'website', '', false, 75),
  (15, 'AVAILABLE', 'Open', '#003340', 'website', '', false, 25),

  (16, 'AVAILABLE', 'Open', '#003340', 'website', '', false, 25),
  (17, 'AVAILABLE', 'Open', '#003340', 'website', '', false, 50),
  (18, 'AVAILABLE', 'Open', '#003340', 'website', '', false, 75),
  (19, 'AVAILABLE', 'Open', '#003340', 'website', '', false, 50),
  (20, 'AVAILABLE', 'Open', '#003340', 'website', '', false, 25)
ON CONFLICT (id) DO UPDATE SET claimed = false, handle = 'AVAILABLE', color = '#003340', price = EXCLUDED.price;
