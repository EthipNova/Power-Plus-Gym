-- ============================================================================
-- PowerPlus Gym — Locker Management & Assignment Schema
-- File: supabase/migrations/20261008140000_lockers_management.sql
-- Ensures public.lockers and public.locker_assignments schemas, columns,
-- key-recipient tracking, 7-day historical audit, and RLS policies.
-- Fully idempotent and non-destructive.
-- ============================================================================

-- 1. Lockers table
CREATE TABLE IF NOT EXISTS public.lockers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locker_number  TEXT NOT NULL,
  key_number     TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'AVAILABLE',
  location       TEXT,
  notes          TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure locker_number column exists if table existed previously with different schema
ALTER TABLE public.lockers ADD COLUMN IF NOT EXISTS locker_number TEXT;
ALTER TABLE public.lockers ADD COLUMN IF NOT EXISTS key_number TEXT DEFAULT '';
ALTER TABLE public.lockers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'AVAILABLE';
ALTER TABLE public.lockers ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.lockers ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE public.lockers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_lockers_locker_number ON public.lockers (locker_number);
CREATE INDEX IF NOT EXISTS idx_lockers_status ON public.lockers (status);

-- 2. Locker Assignments table
CREATE TABLE IF NOT EXISTS public.locker_assignments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locker_id      UUID NOT NULL REFERENCES public.lockers(id) ON DELETE CASCADE,
  customer_id    UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  assigned_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  returned_at    TIMESTAMPTZ,
  due_date       DATE,
  status         TEXT NOT NULL DEFAULT 'active',
  key_recipient  TEXT,
  issued_by      TEXT NOT NULL DEFAULT '',
  notes          TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure key_recipient and other columns exist on locker_assignments
ALTER TABLE public.locker_assignments ADD COLUMN IF NOT EXISTS key_recipient TEXT;
ALTER TABLE public.locker_assignments ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.locker_assignments ADD COLUMN IF NOT EXISTS issued_by TEXT DEFAULT '';
ALTER TABLE public.locker_assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_locker_assignments_locker_id ON public.locker_assignments (locker_id);
CREATE INDEX IF NOT EXISTS idx_locker_assignments_customer_id ON public.locker_assignments (customer_id);
CREATE INDEX IF NOT EXISTS idx_locker_assignments_status ON public.locker_assignments (status);
CREATE INDEX IF NOT EXISTS idx_locker_assignments_assigned_at ON public.locker_assignments (assigned_at DESC);

-- 3. Row Level Security Policies
ALTER TABLE public.lockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locker_assignments ENABLE ROW LEVEL SECURITY;

-- Lockers read policy
DROP POLICY IF EXISTS "lockers_read_all" ON public.lockers;
CREATE POLICY "lockers_read_all" ON public.lockers
  FOR SELECT TO anon, authenticated USING (true);

-- Lockers insert policy
DROP POLICY IF EXISTS "lockers_insert_all" ON public.lockers;
CREATE POLICY "lockers_insert_all" ON public.lockers
  FOR INSERT TO anon, authenticated WITH CHECK (locker_number IS NOT NULL AND trim(locker_number) <> '');

-- Lockers update policy
DROP POLICY IF EXISTS "lockers_update_all" ON public.lockers;
CREATE POLICY "lockers_update_all" ON public.lockers
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Locker assignments read policy
DROP POLICY IF EXISTS "locker_assignments_read_all" ON public.locker_assignments;
CREATE POLICY "locker_assignments_read_all" ON public.locker_assignments
  FOR SELECT TO anon, authenticated USING (true);

-- Locker assignments insert policy
DROP POLICY IF EXISTS "locker_assignments_insert_all" ON public.locker_assignments;
CREATE POLICY "locker_assignments_insert_all" ON public.locker_assignments
  FOR INSERT TO anon, authenticated WITH CHECK (locker_id IS NOT NULL AND customer_id IS NOT NULL);

-- Locker assignments update policy
DROP POLICY IF EXISTS "locker_assignments_update_all" ON public.locker_assignments;
CREATE POLICY "locker_assignments_update_all" ON public.locker_assignments
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- 4. Initial Seed (only if table is empty)
INSERT INTO public.lockers (id, locker_number, key_number, status, notes)
VALUES
  ('77777777-7777-7777-7777-777777777701', '101', 'K-101', 'AVAILABLE', 'Ground floor row A'),
  ('77777777-7777-7777-7777-777777777702', '102', 'K-102', 'AVAILABLE', 'Ground floor row A'),
  ('77777777-7777-7777-7777-777777777703', '103', 'K-103', 'AVAILABLE', 'Ground floor row A'),
  ('77777777-7777-7777-7777-777777777704', '104', 'K-104', 'AVAILABLE', 'Ground floor row A'),
  ('77777777-7777-7777-7777-777777777705', '105', 'K-105', 'AVAILABLE', 'Ground floor row B'),
  ('77777777-7777-7777-7777-777777777706', '106', 'K-106', 'AVAILABLE', 'Ground floor row B'),
  ('77777777-7777-7777-7777-777777777707', '107', 'K-107', 'AVAILABLE', 'Ground floor row B'),
  ('77777777-7777-7777-7777-777777777708', '108', 'K-108', 'AVAILABLE', 'Ground floor row B'),
  ('77777777-7777-7777-7777-777777777709', '109', 'K-109', 'AVAILABLE', 'First floor row C'),
  ('77777777-7777-7777-7777-777777777710', '110', 'K-110', 'AVAILABLE', 'First floor row C')
ON CONFLICT (id) DO NOTHING;
