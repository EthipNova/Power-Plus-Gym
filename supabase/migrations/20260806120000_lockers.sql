-- PowerPlus Gym Phase 2 (Part 3) — Locker Management System
-- Tables: lockers, locker_assignments, locker_audit_log
-- Public anon read/write policies with DB-level conflict constraints.

create table if not exists public.lockers (
  id          uuid primary key default gen_random_uuid(),
  number      text not null,
  section     text not null default 'General',
  key_tag     text not null default '',
  status      text not null default 'AVAILABLE',
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint lockers_status_check
    check (status in ('AVAILABLE', 'IN_USE', 'OUT_OF_SERVICE')),
  constraint lockers_section_check
    check (section in ('Men', 'Women', 'VIP', 'General'))
);

-- A locker is unique per (number, section).
create unique index if not exists lockers_number_section_uidx
  on public.lockers (number, section);

create unique index if not exists lockers_key_tag_uidx
  on public.lockers (key_tag)
  where key_tag <> '';

create table if not exists public.locker_assignments (
  id             uuid primary key default gen_random_uuid(),
  locker_id      uuid not null references public.lockers (id) on delete cascade,
  member_id      text not null,
  member_name    text not null default '',
  assigned_at    timestamptz not null default now(),
  due_date       date,
  returned_at    timestamptz,
  status         text not null default 'active',
  key_returned   boolean not null default false,
  lost_key_fee   numeric(12, 2) not null default 0,
  issued_by      text not null default '',
  notes          text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint locker_assignments_status_check
    check (status in ('active', 'returned', 'lost'))
);

-- Conflict guards: at most one ACTIVE assignment per locker and per member.
create unique index if not exists locker_assignments_active_locker_uidx
  on public.locker_assignments (locker_id)
  where status = 'active';

create unique index if not exists locker_assignments_active_member_uidx
  on public.locker_assignments (member_id)
  where status = 'active';

create index if not exists locker_assignments_member_idx
  on public.locker_assignments (member_id);

create table if not exists public.locker_audit_log (
  id          uuid primary key default gen_random_uuid(),
  action      text not null,
  actor       text not null default '',
  locker_id   uuid,
  member_id   text,
  details     text not null default '',
  created_at  timestamptz not null default now()
);

-- Keep updated_at fresh.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lockers_touch_updated_at on public.lockers;
create trigger lockers_touch_updated_at
  before update on public.lockers
  for each row execute function public.touch_updated_at();

drop trigger if exists locker_assignments_touch_updated_at on public.locker_assignments;
create trigger locker_assignments_touch_updated_at
  before update on public.locker_assignments
  for each row execute function public.touch_updated_at();

-- Row level security (no auth flow in app — public read/controlled write).
alter table public.lockers enable row level security;
alter table public.locker_assignments enable row level security;
alter table public.locker_audit_log enable row level security;

drop policy if exists "lockers anon read" on public.lockers;
create policy "lockers anon read" on public.lockers
  for select to anon, authenticated using (true);

drop policy if exists "lockers anon write" on public.lockers;
create policy "lockers anon write" on public.lockers
  for insert to anon, authenticated with check (true);

drop policy if exists "lockers anon update" on public.lockers;
create policy "lockers anon update" on public.lockers
  for update to anon, authenticated using (true) with check (true);

drop policy if exists "locker_assignments anon read" on public.locker_assignments;
create policy "locker_assignments anon read" on public.locker_assignments
  for select to anon, authenticated using (true);

drop policy if exists "locker_assignments anon write" on public.locker_assignments;
create policy "locker_assignments anon write" on public.locker_assignments
  for insert to anon, authenticated with check (true);

drop policy if exists "locker_assignments anon update" on public.locker_assignments;
create policy "locker_assignments anon update" on public.locker_assignments
  for update to anon, authenticated using (true) with check (true);

drop policy if exists "locker_audit_log anon read" on public.locker_audit_log;
create policy "locker_audit_log anon read" on public.locker_audit_log
  for select to anon, authenticated using (true);

drop policy if exists "locker_audit_log anon write" on public.locker_audit_log;
create policy "locker_audit_log anon write" on public.locker_audit_log
  for insert to anon, authenticated with check (true);

-- Seed initial locker inventory (Men / Women / VIP / General).
insert into public.lockers (number, section, key_tag, status, notes)
values
  ('M-01', 'Men', 'K-101', 'IN_USE', ''),
  ('M-02', 'Men', 'K-102', 'AVAILABLE', ''),
  ('M-03', 'Men', 'K-103', 'AVAILABLE', ''),
  ('M-04', 'Men', 'K-104', 'OUT_OF_SERVICE', 'Serrures en réparation'),
  ('W-01', 'Women', 'K-201', 'AVAILABLE', ''),
  ('W-02', 'Women', 'K-202', 'IN_USE', ''),
  ('W-03', 'Women', 'K-203', 'AVAILABLE', ''),
  ('V-01', 'VIP', 'K-301', 'AVAILABLE', ''),
  ('V-02', 'VIP', 'K-302', 'IN_USE', ''),
  ('G-01', 'General', 'K-401', 'AVAILABLE', '')
on conflict do nothing;