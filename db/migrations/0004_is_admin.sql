-- =====================================================================
-- v0.27.0 修：users table 加 is_admin 欄位
-- 原因：admin / 一般 user 權限分流（/admin 後台限定 admin 才能進）
-- 預設 false（既有 user 全部變非 admin；需手動 SQL 設單一帳號為 admin）
-- =====================================================================

alter table public.users
  add column if not exists is_admin boolean not null default false;

-- 索引：給 /api/admin/* 查詢用（找所有 admin）
create index if not exists users_is_admin_idx on public.users (is_admin) where is_admin = true;