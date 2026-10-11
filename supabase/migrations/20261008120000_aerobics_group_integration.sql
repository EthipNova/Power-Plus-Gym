-- PowerPlus Gym: Aerobics Group Minimal Integration
-- Adds aerobics group linkage to customers and trainer/days to aerobics_sessions

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS aerobics_group_id UUID
  REFERENCES public.aerobics_sessions(id)
  ON DELETE SET NULL;

ALTER TABLE public.aerobics_sessions
  ADD COLUMN IF NOT EXISTS trainer_id UUID
  REFERENCES public.trainer_profiles(id)
  ON DELETE SET NULL;

ALTER TABLE public.aerobics_sessions
  ADD COLUMN IF NOT EXISTS days TEXT[] DEFAULT '{}';
