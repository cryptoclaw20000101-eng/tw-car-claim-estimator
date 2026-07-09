-- =====================================================================
-- tw-car-claim-estimator — Supabase 雲端持久化 (v0.14.x+)
-- 對應 lib/estimate-storage.ts 的 estimates table + Auth.users 整合
--
-- 用途:
-- - 業務員跨裝置同步估算歷史
-- - 永久保存 (localStorage 會被清)
-- - Auth 登入狀態
--
-- 跑法: Supabase Dashboard > SQL Editor > New Query > 貼上 > Run
-- =====================================================================

-- 1. 啟用 UUID extension (Supabase 預設啟用, 保險起見)
create extension if not exists "uuid-ossp";

-- 2. estimates table
create table if not exists public.estimates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  claim_input jsonb not null,                    -- 完整 ClaimInput
  result jsonb,                                   -- EstimationResult
  compulsory_total_estimated bigint,              -- 快速查詢用
  disability_level int,
  court_name text,
  self_fault_ratio int,
  created_at timestamptz default now()
);

-- 3. 索引 (加快 user_id + created_at 查詢)
create index if not exists estimates_user_id_idx on public.estimates (user_id, created_at desc);
create index if not exists estimates_court_idx on public.estimates (court_name);

-- 4. RLS (row-level security) — 每個用戶只能看自己的估算
alter table public.estimates enable row level security;

-- 5. RLS policies
-- SELECT: 只能看自己的
drop policy if exists "Users can only see own estimates" on public.estimates;
create policy "Users can only see own estimates"
  on public.estimates for select
  using (auth.uid() = user_id);

-- INSERT: 只能新增自己的 (user_id = 自己)
drop policy if exists "Users can only insert own estimates" on public.estimates;
create policy "Users can only insert own estimates"
  on public.estimates for insert
  with check (auth.uid() = user_id);

-- DELETE: 只能刪自己的
drop policy if exists "Users can only delete own estimates" on public.estimates;
create policy "Users can only delete own estimates"
  on public.estimates for delete
  using (auth.uid() = user_id);

-- UPDATE: 禁止 (估算是一次寫入, 不更新)
drop policy if exists "Estimates are immutable" on public.estimates;
create policy "Estimates are immutable"
  on public.estimates for update
  using (false);

-- 6. 驗證
-- select * from public.estimates limit 5;
