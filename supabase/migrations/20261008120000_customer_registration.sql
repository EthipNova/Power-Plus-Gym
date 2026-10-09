-- ============================================================================
-- PowerPlus Gym — Customer Registration & Constraints
-- File: supabase/migrations/20261008120000_customer_registration.sql
-- Ensures public.customers table schema, validation constraints, and indexes.
-- Completely idempotent and non-destructive.
-- ============================================================================

-- 1. Base table definition (if not existing)
CREATE TABLE IF NOT EXISTS public.customers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code  VARCHAR NOT NULL,
  first_name     VARCHAR NOT NULL,
  last_name      VARCHAR NOT NULL,
  phone          VARCHAR NOT NULL,
  email          VARCHAR,
  status         VARCHAR NOT NULL DEFAULT 'ACTIVE',
  customer_type  VARCHAR NOT NULL DEFAULT 'REGULAR',
  join_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Unique Constraints (Idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customers_customer_code_key'
  ) THEN
    ALTER TABLE public.customers ADD CONSTRAINT customers_customer_code_key UNIQUE (customer_code);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customers_phone_key'
  ) THEN
    ALTER TABLE public.customers ADD CONSTRAINT customers_phone_key UNIQUE (phone);
  END IF;
END $$;

-- Unique index for email
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_unique 
  ON public.customers (lower(email)) 
  WHERE email IS NOT NULL AND email <> '';

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers (phone);
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers (status);
CREATE INDEX IF NOT EXISTS idx_customers_type ON public.customers (customer_type);

-- 3. Row Level Security Policies
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "steam_demo_customers_read" ON public.customers;
CREATE POLICY "steam_demo_customers_read" ON public.customers
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "steam_demo_customers_insert" ON public.customers;
CREATE POLICY "steam_demo_customers_insert" ON public.customers
  FOR INSERT TO anon, authenticated WITH CHECK (
    first_name IS NOT NULL AND trim(first_name) <> '' AND
    last_name IS NOT NULL AND trim(last_name) <> '' AND
    phone IS NOT NULL AND trim(phone) <> '' AND
    email IS NOT NULL AND trim(email) <> ''
  );

DROP POLICY IF EXISTS "steam_demo_customers_update" ON public.customers;
CREATE POLICY "steam_demo_customers_update" ON public.customers
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
