-- =====================================================================
-- tw-car-claim-estimator — Railway Postgres schema (v0.17.x+)
-- 對應 lib/db.ts + lib/auth.ts
--
-- 從 Supabase 切換到 Railway Postgres (user 2026-07-09 選)
-- 不再用 Supabase Auth + RLS, 改自寫 JWT + bcrypt + app-level filter
--
-- 跑法: node -e "套用 SQL 連線 DATABASE_URL"  (見 db/apply-migrations.ts)
-- 或 psql $DATABASE_URL < db/migrations/0001_init.sql
-- =====================================================================

-- 1. pgcrypto extension (gen_random_uuid 取代 uuid-ossp)
create extension if not exists "pgcrypto";

-- 2. users table (自寫 Auth, 取代 Supabase Auth)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,                    -- bcrypt hash
  display_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists users_email_idx on public.users (email);

-- 3. estimates table (估算歷史持久化, 跨裝置同步)
create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  claim_input jsonb not null,                    -- 完整 ClaimInput
  result jsonb,                                   -- EstimationResult
  compulsory_total_estimated bigint,              -- 快速查詢
  disability_level int,
  court_name text,
  self_fault_ratio int,
  created_at timestamptz default now()
);
create index if not exists estimates_user_id_idx on public.estimates (user_id, created_at desc);
create index if not exists estimates_court_idx on public.estimates (court_name);

-- 4. updated_at trigger for users
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();
