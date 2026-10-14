-- PowerPlus Gym: Persistent Trainer Coaching Notes
-- Migration: 20261015120000_trainer_coaching_notes.sql
-- Creates public.trainer_coaching_notes table with RLS, helper function, and indexes.

-- 1. Helper Function: Validate Trainer Authorization for Customer -------------

CREATE OR REPLACE FUNCTION public.is_authorized_trainer_for_customer(p_customer_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.trainer_profiles tp ON tp.user_id = u.id
    JOIN public.aerobics_sessions s ON (s.trainer_id = tp.id OR s.instructor_user_id = u.id)
    JOIN public.customers c ON c.aerobics_group_id = s.id
    WHERE u.id = auth.uid()
      AND u.is_active = true
      AND tp.is_active = true
      AND c.id = p_customer_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_authorized_trainer_for_customer(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_authorized_trainer_for_customer(UUID) TO authenticated;

-- 2. Create Table: trainer_coaching_notes ------------------------------------

CREATE TABLE IF NOT EXISTS public.trainer_coaching_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES public.trainer_profiles(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  session_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Africa/Addis_Ababa')::date,
  workout_focus TEXT NOT NULL CHECK (char_length(trim(workout_focus)) > 0),
  notes TEXT NOT NULL CHECK (char_length(trim(notes)) > 0),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indexes -----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_coaching_notes_customer_history
  ON public.trainer_coaching_notes (customer_id, session_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coaching_notes_trainer_history
  ON public.trainer_coaching_notes (trainer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coaching_notes_created_by
  ON public.trainer_coaching_notes (created_by);

-- 4. Trigger for updated_at --------------------------------------------------

DROP TRIGGER IF EXISTS trg_trainer_coaching_notes_updated_at ON public.trainer_coaching_notes;
CREATE TRIGGER trg_trainer_coaching_notes_updated_at
  BEFORE UPDATE ON public.trainer_coaching_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 5. Row Level Security ------------------------------------------------------

ALTER TABLE public.trainer_coaching_notes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.trainer_coaching_notes FROM anon, PUBLIC;
GRANT SELECT, INSERT ON public.trainer_coaching_notes TO authenticated;

DROP POLICY IF EXISTS "trainer_coaching_notes_select" ON public.trainer_coaching_notes;
CREATE POLICY "trainer_coaching_notes_select"
  ON public.trainer_coaching_notes
  FOR SELECT
  TO authenticated
  USING (
    public.is_staff_or_owner()
    OR public.is_authorized_trainer_for_customer(customer_id)
  );

DROP POLICY IF EXISTS "trainer_coaching_notes_insert" ON public.trainer_coaching_notes;
CREATE POLICY "trainer_coaching_notes_insert"
  ON public.trainer_coaching_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_authorized_trainer_for_customer(customer_id)
    AND created_by = auth.uid()
    AND trainer_id IN (
      SELECT tp.id FROM public.trainer_profiles tp
      JOIN public.users u ON tp.user_id = u.id
      WHERE tp.user_id = auth.uid() AND tp.is_active = true AND u.is_active = true
    )
  );
