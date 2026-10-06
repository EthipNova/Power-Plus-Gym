-- ============================================================================
-- PowerPlus Gym — Steam (Soap Bath) Add-on
-- Extends the EXISTING schema (customers uuid, payments, services, plans...).
--   * public.steam_access   -> a sold soap-bath pass (package or per-visit)
--   * public.steam_usage    -> one row per soap-bath session used
--   * public.payments       -> service_type = 'STEAM' + service_id linkage
--   * public.settings       -> gym + steam configuration block
-- Additive only, idempotent, never drops existing data.
-- ============================================================================

-- 1. settings (gym configuration incl. steam add-on prices / validity) -------
create table if not exists public.settings (
  id text primary key default 'gym',
  gym_name text not null default 'Power Plus Gym',
  tagline text,
  email text,
  phone text,
  address text,
  inactivity_threshold_days integer not null default 14,
  currency text not null default 'Br',
  steam_enabled boolean not null default true,
  steam_package_price numeric(10,2) not null default 800,
  steam_per_visit_price numeric(10,2) not null default 150,
  steam_package_visits integer not null default 10,
  steam_validity_days integer not null default 30,
  steam_expiring_soon_days integer not null default 7,
  steam_session_minutes integer not null default 45,
  updated_at timestamptz not null default now()
);

-- 2. payments: distinguish STEAM revenue and link the sold service ----------
alter table public.payments add column if not exists service_type varchar not null default 'MEMBERSHIP';
alter table public.payments add column if not exists service_id uuid references public.services(id) on delete set null;

do $$
declare c record;
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_service_type_check') then
    alter table public.payments add constraint payments_service_type_check
      check (service_type in ('MEMBERSHIP','STEAM','TRAINER','OTHER'));
  end if;
  -- widen the existing payment_method check so gym wallets (Telebirr/CBE) are valid
  for c in
    select conname from pg_constraint
    where conrelid = 'public.payments'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%payment_method%'
  loop
    execute format('alter table public.payments drop constraint %I', c.conname);
  end loop;
  alter table public.payments add constraint payments_payment_method_check
    check (payment_method in ('CASH','ONLINE_CARD','CARD','TELEBIRR','CBE_BIRR','OTHER'));
end $$;

-- 3. steam_access -----------------------------------------------------------
create table if not exists public.steam_access (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  type varchar not null default 'package',
  start_date date not null default current_date,
  end_date date not null default current_date,
  remaining_visits integer not null default 0 check (remaining_visits >= 0),
  total_visits integer not null default 0 check (total_visits >= 0),
  status varchar not null default 'Active',
  payment_id uuid references public.payments(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  price numeric(10,2) not null default 0 check (price >= 0),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'steam_access_type_check') then
    alter table public.steam_access add constraint steam_access_type_check
      check (type in ('package','per-visit'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'steam_access_status_check') then
    alter table public.steam_access add constraint steam_access_status_check
      check (status in ('Active','Expiring Soon','Expired'));
  end if;
end $$;

-- 4. steam_usage (tracking entries) ----------------------------------------
create table if not exists public.steam_usage (
  id uuid primary key default gen_random_uuid(),
  access_id uuid not null references public.steam_access(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  used_at timestamptz not null default now(),
  visits_used integer not null default 1 check (visits_used > 0),
  remaining_after integer not null default 0 check (remaining_after >= 0),
  logged_by varchar,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists steam_access_customer_idx on public.steam_access(customer_id);
create index if not exists steam_access_payment_idx on public.steam_access(payment_id);
create index if not exists steam_usage_access_idx on public.steam_usage(access_id);
create index if not exists steam_usage_customer_idx on public.steam_usage(customer_id);
create index if not exists payments_service_type_idx on public.payments(service_type);

-- 5. RLS — this demo has no login flow, so the anon role is granted access ---
alter table public.settings enable row level security;
alter table public.steam_access enable row level security;
alter table public.steam_usage enable row level security;

drop policy if exists "steam_demo_settings" on public.settings;
create policy "steam_demo_settings" on public.settings for all to anon, authenticated using (true) with check (true);

drop policy if exists "steam_demo_customers_read" on public.customers;
create policy "steam_demo_customers_read" on public.customers for select to anon, authenticated using (true);
drop policy if exists "steam_demo_customers_insert" on public.customers;
create policy "steam_demo_customers_insert" on public.customers for insert to anon, authenticated with check (true);
drop policy if exists "steam_demo_customers_update" on public.customers;
create policy "steam_demo_customers_update" on public.customers for update to anon, authenticated using (true) with check (true);

drop policy if exists "steam_demo_payments_read" on public.payments;
create policy "steam_demo_payments_read" on public.payments for select to anon, authenticated using (true);
drop policy if exists "steam_demo_payments_insert" on public.payments;
create policy "steam_demo_payments_insert" on public.payments for insert to anon, authenticated with check (true);

drop policy if exists "steam_demo_services_read" on public.services;
create policy "steam_demo_services_read" on public.services for select to anon, authenticated using (true);
drop policy if exists "steam_demo_services_insert" on public.services;
create policy "steam_demo_services_insert" on public.services for insert to anon, authenticated with check (true);

drop policy if exists "steam_demo_steam_access" on public.steam_access;
create policy "steam_demo_steam_access" on public.steam_access for all to anon, authenticated using (true) with check (true);

drop policy if exists "steam_demo_steam_usage" on public.steam_usage;
create policy "steam_demo_steam_usage" on public.steam_usage for all to anon, authenticated using (true) with check (true);

-- 6. Seed data (ON CONFLICT DO NOTHING — existing customer data is preserved)
insert into public.settings (id) values ('gym') on conflict (id) do nothing;

insert into public.customers (id, customer_code, first_name, last_name, phone, email, status) values
  ('11111111-1111-1111-1111-111111111101', 'PP-001', 'Abebe', 'Kebede', '0911223344', 'abebe@gmail.com', 'ACTIVE'),
  ('11111111-1111-1111-1111-111111111102', 'PP-002', 'Tigist', 'Alemu', '0922334455', 'tigist@yahoo.com', 'ACTIVE'),
  ('11111111-1111-1111-1111-111111111103', 'PP-003', 'Dawit', 'Tesfaye', '0933445566', 'dawit.t@gmail.com', 'ACTIVE'),
  ('11111111-1111-1111-1111-111111111104', 'PP-004', 'Hana', 'Girma', '0944556677', 'hana.g@gmail.com', 'ACTIVE'),
  ('11111111-1111-1111-1111-111111111105', 'PP-005', 'Yonas', 'Bekele', '0955667788', 'yonas.b@hotmail.com', 'ACTIVE'),
  ('11111111-1111-1111-1111-111111111106', 'PP-006', 'Meron', 'Fikru', '0966778899', 'meron.f@gmail.com', 'ACTIVE'),
  ('11111111-1111-1111-1111-111111111107', 'PP-007', 'Solomon', 'Haile', '0977889900', 'sol.h@gmail.com', 'ACTIVE'),
  ('11111111-1111-1111-1111-111111111108', 'PP-008', 'Rahel', 'Tadesse', '0988990011', 'rahel.t@gmail.com', 'ACTIVE')
on conflict (id) do nothing;

insert into public.services (id, name, description, price, is_active) values
  ('22222222-2222-2222-2222-222222222201', 'Steam Package (10 sessions)', 'Soap bath / steam room bundle of 10 sessions', 800, true),
  ('22222222-2222-2222-2222-222222222202', 'Steam Single Soap Bath', 'One-off soap bath / steam room session', 150, true)
on conflict (id) do nothing;

insert into public.payments (id, customer_id, amount, payment_method, payment_status, service_type, service_id, notes, paid_at) values
  ('44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111101', 800, 'TELEBIRR', 'PAID', 'STEAM', '22222222-2222-2222-2222-222222222201', 'Steam package (10 sessions)', now() - interval '20 days'),
  ('44444444-4444-4444-4444-444444444402', '11111111-1111-1111-1111-111111111105', 800, 'CARD', 'PAID', 'STEAM', '22222222-2222-2222-2222-222222222201', 'Steam package (10 sessions)', now() - interval '28 days'),
  ('44444444-4444-4444-4444-444444444403', '11111111-1111-1111-1111-111111111104', 150, 'CASH', 'PAID', 'STEAM', '22222222-2222-2222-2222-222222222202', 'Steam single session', now() - interval '2 days'),
  ('44444444-4444-4444-4444-444444444404', '11111111-1111-1111-1111-111111111108', 800, 'CBE_BIRR', 'PAID', 'STEAM', '22222222-2222-2222-2222-222222222201', 'Steam package (5 sessions)', now() - interval '40 days'),
  ('44444444-4444-4444-4444-444444444405', '11111111-1111-1111-1111-111111111102', 150, 'TELEBIRR', 'PAID', 'STEAM', '22222222-2222-2222-2222-222222222202', 'Steam single session', now())
on conflict (id) do nothing;

insert into public.steam_access (id, customer_id, type, start_date, end_date, remaining_visits, total_visits, status, payment_id, service_id, price) values
  ('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111101', 'package', current_date - 20, current_date + 10, 7, 10, 'Active', '44444444-4444-4444-4444-444444444401', '22222222-2222-2222-2222-222222222201', 800),
  ('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111105', 'package', current_date - 28, current_date + 3, 1, 10, 'Expiring Soon', '44444444-4444-4444-4444-444444444402', '22222222-2222-2222-2222-222222222201', 800),
  ('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111104', 'per-visit', current_date - 2, current_date - 2, 0, 1, 'Expired', '44444444-4444-4444-4444-444444444403', '22222222-2222-2222-2222-222222222202', 150),
  ('33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111108', 'package', current_date - 40, current_date - 10, 0, 5, 'Expired', '44444444-4444-4444-4444-444444444404', '22222222-2222-2222-2222-222222222201', 800),
  ('33333333-3333-3333-3333-333333333305', '11111111-1111-1111-1111-111111111102', 'per-visit', current_date, current_date, 1, 1, 'Active', '44444444-4444-4444-4444-444444444405', '22222222-2222-2222-2222-222222222202', 150)
on conflict (id) do nothing;

insert into public.steam_usage (id, access_id, customer_id, used_at, visits_used, remaining_after, logged_by, note) values
  ('55555555-5555-5555-5555-555555555501', '33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111101', now() - interval '15 days', 1, 9, 'Selam', 'Evening session'),
  ('55555555-5555-5555-5555-555555555502', '33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111101', now() - interval '8 days', 1, 8, 'Selam', ''),
  ('55555555-5555-5555-5555-555555555503', '33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111101', now() - interval '3 days', 1, 7, 'Selam', 'After leg day'),
  ('55555555-5555-5555-5555-555555555504', '33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111105', now() - interval '4 days', 1, 3, 'Selam', ''),
  ('55555555-5555-5555-5555-555555555505', '33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111105', now() - interval '1 day', 1, 1, 'Selam', 'Last session of pack'),
  ('55555555-5555-5555-5555-555555555506', '33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111108', now() - interval '30 days', 1, 2, 'Selam', ''),
  ('55555555-5555-5555-5555-555555555507', '33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111108', now() - interval '22 days', 1, 0, 'Selam', 'Pack completed')
on conflict (id) do nothing;