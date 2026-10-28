-- ============================================================================
-- PowerPlus Gym: Customer Categories Management
-- Migration: 20261028120000_customer_categories.sql
-- Creates public.customer_categories table with RLS policies and default seeds.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customer_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_categories_key ON public.customer_categories (key);

-- Trigger for updated_at if function exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    DROP TRIGGER IF EXISTS trg_customer_categories_updated_at ON public.customer_categories;
    CREATE TRIGGER trg_customer_categories_updated_at
      BEFORE UPDATE ON public.customer_categories
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Row Level Security
ALTER TABLE public.customer_categories ENABLE ROW LEVEL SECURITY;

-- Allow public / anon read access for website and portal
DROP POLICY IF EXISTS "customer_categories_select" ON public.customer_categories;
CREATE POLICY "customer_categories_select" ON public.customer_categories
  FOR SELECT TO anon, authenticated USING (true);

-- Allow authenticated or staff/owner to insert
DROP POLICY IF EXISTS "customer_categories_insert" ON public.customer_categories;
CREATE POLICY "customer_categories_insert" ON public.customer_categories
  FOR INSERT TO anon, authenticated WITH CHECK (
    label IS NOT NULL AND trim(label) <> '' AND
    key IS NOT NULL AND trim(key) <> ''
  );

-- Allow update
DROP POLICY IF EXISTS "customer_categories_update" ON public.customer_categories;
CREATE POLICY "customer_categories_update" ON public.customer_categories
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Allow delete for non-system categories
DROP POLICY IF EXISTS "customer_categories_delete" ON public.customer_categories;
CREATE POLICY "customer_categories_delete" ON public.customer_categories
  FOR DELETE TO anon, authenticated USING (is_system = false);

-- Seed default canonical categories if not already present
INSERT INTO public.customer_categories (key, label, description, is_system)
VALUES 
  ('REGULAR', 'Standard', 'Full gym access during opening hours.', true),
  ('STUDENT', 'Student', 'Reduced rate with a valid student ID. Off-peak access (before 4:00 PM) + weekends.', true),
  ('MUSLIM', 'Women''s Hours (Muslim)', 'Access reserved for the women''s hours from 9:00 AM to 4:00 PM, main hall privatized.', true),
  ('AEROBICS', 'Aerobics & Dance', 'Access during aerobics and dance class slots (5:00 PM – 9:00 PM).', true)
ON CONFLICT (key) DO UPDATE
SET 
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  is_system = EXCLUDED.is_system;
