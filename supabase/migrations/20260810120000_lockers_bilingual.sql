-- PowerPlus Gym — Phase 2 (Part 3)
-- Locker Management System + bilingual (EN / AM) preferences.
--
-- Schema target for the live demo, which runs on an in-memory reducer
-- (src/context/GymContext.tsx). Written to be idempotent and non-destructive:
-- every statement is CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS so
-- existing member, payment, steam and audit data is preserved.

-- 1. Lockers (physical inventory) --------------------------------------------
CREATE TABLE IF NOT EXISTS public.lockers (
  id              TEXT PRIMARY KEY,
  number          TEXT NOT NULL UNIQUE,
  section         TEXT NOT NULL DEFAULT 'MALE' CHECK (section IN ('MALE', 'FEMALE', 'FAMILY', 'STAFF')),
  size            TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (size IN ('SMALL', 'MEDIUM', 'LARGE')),
  status          TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'IN_USE', 'OUT_OF_SERVICE')),
  monthly_fee     INTEGER NOT NULL DEFAULT 200,
  key_tag         TEXT NOT NULL DEFAULT '',
  notes           TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lockers_status_idx ON public.lockers(status);
CREATE INDEX IF NOT EXISTS lockers_section_idx ON public.lockers(section);

-- 2. Locker assignments (issue / return / lost-key history) -------------------
CREATE TABLE IF NOT EXISTS public.locker_assignments (
  id              TEXT PRIMARY KEY,
  locker_id       TEXT NOT NULL REFERENCES public.lockers(id) ON DELETE CASCADE,
  member_id       TEXT NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  member_name     TEXT NOT NULL DEFAULT '',
  assigned_at     DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,
  returned_at     TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'returned', 'lost')),
  key_returned    BOOLEAN NOT NULL DEFAULT FALSE,
  lost_key_fee    INTEGER NOT NULL DEFAULT 0,
  issued_by       TEXT NOT NULL DEFAULT '',
  notes           TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS locker_assignments_locker_idx ON public.locker_assignments(locker_id);
CREATE INDEX IF NOT EXISTS locker_assignments_member_idx ON public.locker_assignments(member_id);
CREATE INDEX IF NOT EXISTS locker_assignments_status_idx ON public.locker_assignments(status);

-- A locker and a member may each hold at most ONE active assignment.
CREATE UNIQUE INDEX IF NOT EXISTS locker_assignments_one_active_locker_idx
  ON public.locker_assignments(locker_id) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS locker_assignments_one_active_member_idx
  ON public.locker_assignments(member_id) WHERE status = 'active';

-- 3. Bilingual support: global default + per-member override ------------------
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS default_language TEXT NOT NULL DEFAULT 'en'
  CHECK (default_language IN ('en', 'am'));
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en'
  CHECK (language IN ('en', 'am'));

-- 4. RLS: the demo is unauthenticated, so grant anon read/write on the new
--    tables — mirroring the convention used by the steam add-on migration.
ALTER TABLE public.lockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locker_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lockers_anon_all" ON public.lockers;
CREATE POLICY "lockers_anon_all" ON public.lockers FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "locker_assignments_anon_all" ON public.locker_assignments;
CREATE POLICY "locker_assignments_anon_all" ON public.locker_assignments FOR ALL TO anon USING (true) WITH CHECK (true);

-- 5. Locker inventory seed (idempotent, never overwrites live rows) -----------
INSERT INTO public.lockers (id, number, section, size, status, monthly_fee, key_tag)
VALUES
  ('lk1',  'A-01', 'MALE',   'SMALL',  'AVAILABLE', 150, 'K-101'),
  ('lk2',  'A-02', 'MALE',   'MEDIUM', 'IN_USE',    200, 'K-102'),
  ('lk3',  'A-03', 'MALE',   'MEDIUM', 'AVAILABLE', 200, 'K-103'),
  ('lk4',  'A-04', 'MALE',   'LARGE',  'OUT_OF_SERVICE', 300, 'K-104'),
  ('lk5',  'B-01', 'FEMALE', 'MEDIUM', 'IN_USE',    200, 'K-201'),
  ('lk6',  'B-02', 'FEMALE', 'MEDIUM', 'AVAILABLE', 200, 'K-202'),
  ('lk7',  'B-03', 'FEMALE', 'LARGE',  'AVAILABLE', 300, 'K-203'),
  ('lk8',  'F-01', 'FAMILY', 'LARGE',  'AVAILABLE', 350, 'K-301'),
  ('lk9',  'F-02', 'FAMILY', 'LARGE',  'IN_USE',    350, 'K-302'),
  ('lk10', 'S-01', 'STAFF',  'SMALL',  'AVAILABLE', 100, 'K-401')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.locker_assignments
  (id, locker_id, member_id, member_name, assigned_at, due_date, status, key_returned, lost_key_fee, issued_by, notes)
VALUES
  ('la1', 'lk2', 'm2', 'Tigist Alemu',  CURRENT_DATE - 20, CURRENT_DATE + 10, 'active', FALSE, 0, 'Selam', 'Mensuel'),
  ('la2', 'lk5', 'm5', 'Meron Fikru',   CURRENT_DATE - 45, CURRENT_DATE - 5,  'active', FALSE, 0, 'Selam', ''),
  ('la3', 'lk9', 'm3', 'Dawit Tesfaye', CURRENT_DATE - 90, NULL,              'active', FALSE, 0, 'Selam', 'Long terme'),
  ('la4', 'lk1', 'm4', 'Meron Fikru',   CURRENT_DATE - 120, CURRENT_DATE - 90, 'returned', TRUE, 0, 'Selam', ''),
  ('la5', 'lk4', 'm6', 'Abebe Kebede',  CURRENT_DATE - 60, CURRENT_DATE - 30, 'lost', FALSE, 300, 'Dawit Owner', 'Clé perdue — casier hors service')
ON CONFLICT (id) DO NOTHING;