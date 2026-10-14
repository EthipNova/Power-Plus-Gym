-- PowerPlus Gym: Persistent Trainer Session Attendance
-- Migration: 20261014120000_session_attendance.sql
-- Creates public.session_attendance table with RLS and helper functions.

-- 1. Helper Functions for Security & RLS --------------------------------------

CREATE OR REPLACE FUNCTION public.is_staff_or_owner()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('OWNER', 'ADMIN', 'STAFF')
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_session_trainer(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.aerobics_sessions s
    LEFT JOIN public.trainer_profiles tp ON s.trainer_id = tp.id
    WHERE s.id = p_session_id
      AND (
        (tp.user_id = auth.uid() AND tp.is_active = true)
        OR s.instructor_user_id = auth.uid()
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_enrolled_trainee(p_session_id UUID, p_customer_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.customers c
    WHERE c.id = p_customer_id
      AND c.aerobics_group_id = p_session_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_own_customer_record(p_customer_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.customers c
    WHERE c.id = p_customer_id
      AND c.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_staff_or_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_session_trainer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_enrolled_trainee(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_own_customer_record(UUID) TO authenticated;

-- 2. Create Table: session_attendance ---------------------------------------

CREATE TABLE IF NOT EXISTS public.session_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.aerobics_sessions(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Africa/Addis_Ababa')::date,
  status TEXT NOT NULL DEFAULT 'PRESENT' CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
  recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  CONSTRAINT session_attendance_unique_entry UNIQUE (session_id, customer_id, attendance_date)
);

-- 3. Indexes -----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_session_attendance_session_date
  ON public.session_attendance (session_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_session_attendance_customer
  ON public.session_attendance (customer_id);

CREATE INDEX IF NOT EXISTS idx_session_attendance_recorded_by
  ON public.session_attendance (recorded_by);

-- 4. Trigger for updated_at --------------------------------------------------

DROP TRIGGER IF EXISTS trg_session_attendance_updated_at ON public.session_attendance;
CREATE TRIGGER trg_session_attendance_updated_at
  BEFORE UPDATE ON public.session_attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 5. Row Level Security ------------------------------------------------------

ALTER TABLE public.session_attendance ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.session_attendance FROM anon;
REVOKE ALL ON public.session_attendance FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_attendance TO authenticated;

DROP POLICY IF EXISTS "session_attendance_select" ON public.session_attendance;
CREATE POLICY "session_attendance_select"
  ON public.session_attendance
  FOR SELECT
  TO authenticated
  USING (
    public.is_staff_or_owner()
    OR public.is_session_trainer(session_id)
    OR public.is_own_customer_record(customer_id)
  );

DROP POLICY IF EXISTS "session_attendance_insert" ON public.session_attendance;
CREATE POLICY "session_attendance_insert"
  ON public.session_attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_staff_or_owner()
    OR (
      public.is_session_trainer(session_id)
      AND public.is_enrolled_trainee(session_id, customer_id)
      AND recorded_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "session_attendance_update" ON public.session_attendance;
CREATE POLICY "session_attendance_update"
  ON public.session_attendance
  FOR UPDATE
  TO authenticated
  USING (
    public.is_staff_or_owner()
    OR (
      public.is_session_trainer(session_id)
      AND public.is_enrolled_trainee(session_id, customer_id)
      AND recorded_by = auth.uid()
    )
  )
  WITH CHECK (
    public.is_staff_or_owner()
    OR (
      public.is_session_trainer(session_id)
      AND public.is_enrolled_trainee(session_id, customer_id)
      AND recorded_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "session_attendance_delete" ON public.session_attendance;
CREATE POLICY "session_attendance_delete"
  ON public.session_attendance
  FOR DELETE
  TO authenticated
  USING (
    public.is_staff_or_owner()
  );
