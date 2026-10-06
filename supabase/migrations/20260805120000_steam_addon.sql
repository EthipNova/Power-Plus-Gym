-- Steam (Soap Bath / Hammam) Add-on for PowerPlus Gym
-- Conceptual schema migration. The live demo runs on an in-memory reducer
-- (src/context/GymContext.tsx); this file documents the target PostgreSQL
-- schema and is written to be idempotent and non-destructive so existing
-- customer data is preserved.

-- 1. Steam access passes (package or per-visit)
CREATE TABLE IF NOT EXISTS steam_access (
  id              TEXT PRIMARY KEY,
  customer_id     TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('package', 'per_visit')),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  remaining_visits INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Expiring Soon', 'Expired')),
  payment_id      TEXT REFERENCES payments(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS steam_access_customer_idx ON steam_access(customer_id);
CREATE INDEX IF NOT EXISTS steam_access_status_idx ON steam_access(status);

-- 2. Steam usage / entry log
CREATE TABLE IF NOT EXISTS steam_usage (
  id              TEXT PRIMARY KEY,
  customer_id     TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  steam_access_id TEXT REFERENCES steam_access(id) ON DELETE SET NULL,
  recorded_by     TEXT NOT NULL,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes           TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS steam_usage_customer_idx ON steam_usage(customer_id);
CREATE INDEX IF NOT EXISTS steam_usage_access_idx ON steam_usage(steam_access_id);

-- 3. Payments: allow service_type = STEAM (extend existing type constraint
--    without dropping rows). Existing membership/renewal/adjustment rows stay valid.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_type_check;
ALTER TABLE payments ADD CONSTRAINT payments_type_check
  CHECK (type IN ('membership', 'renewal', 'adjustment', 'steam'));

-- 4. Settings: steam configuration (idempotent column adds)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS steam_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS steam_model TEXT NOT NULL DEFAULT 'both'
  CHECK (steam_model IN ('package', 'per_visit', 'both'));
ALTER TABLE settings ADD COLUMN IF NOT EXISTS steam_package_price INTEGER NOT NULL DEFAULT 1500;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS steam_package_days INTEGER NOT NULL DEFAULT 30;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS steam_package_visits INTEGER NOT NULL DEFAULT 10;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS steam_per_visit_price INTEGER NOT NULL DEFAULT 300;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS steam_expiring_soon_days INTEGER NOT NULL DEFAULT 5;

-- 5. RLS: demo is unauthenticated, grant anon read/write on the new tables.
ALTER TABLE steam_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE steam_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "steam_access_anon_all" ON steam_access;
CREATE POLICY "steam_access_anon_all" ON steam_access FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "steam_usage_anon_all" ON steam_usage;
CREATE POLICY "steam_usage_anon_all" ON steam_usage FOR ALL TO anon USING (true) WITH CHECK (true);
