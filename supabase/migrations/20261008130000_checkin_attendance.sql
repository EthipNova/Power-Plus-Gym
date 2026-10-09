-- ============================================================================
-- PowerPlus Gym — Check-In & Attendance Management Schema
-- File: supabase/migrations/20261008130000_checkin_attendance.sql
-- Ensures public.attendance table schema, indexes, and RLS policies for check-in.
-- Fully idempotent and non-destructive.
-- ============================================================================

-- 1. Base table definition (if not existing)
CREATE TABLE IF NOT EXISTS public.attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  checked_in_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_in_method VARCHAR NOT NULL DEFAULT 'MANUAL',
  recorded_by     UUID,
  notes           TEXT
);

-- 2. Indexes for fast query performance
CREATE INDEX IF NOT EXISTS idx_attendance_customer_id ON public.attendance (customer_id);
CREATE INDEX IF NOT EXISTS idx_attendance_checked_in_at ON public.attendance (checked_in_at DESC);

-- 3. Row Level Security Policies
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Allow reading attendance for staff & members
DROP POLICY IF EXISTS "attendance_read_policy" ON public.attendance;
CREATE POLICY "attendance_read_policy" ON public.attendance
  FOR SELECT TO anon, authenticated USING (true);

-- Allow inserting attendance records
DROP POLICY IF EXISTS "attendance_insert_policy" ON public.attendance;
CREATE POLICY "attendance_insert_policy" ON public.attendance
  FOR INSERT TO anon, authenticated WITH CHECK (
    customer_id IS NOT NULL
  );

-- Allow updating attendance records
DROP POLICY IF EXISTS "attendance_update_policy" ON public.attendance;
CREATE POLICY "attendance_update_policy" ON public.attendance
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
