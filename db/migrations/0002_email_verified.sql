-- =====================================================================
-- v0.19.x+ 註冊系統安全改進
-- 對應 AGENTS §6 紅線 + user 2026-07-10 註冊系統重新設計
--
-- 1. email_verified 欄位 (註冊後收信確認 → 啟用帳號)
-- 2. verify_token + verify_expires (24 小時過期)
-- 3. failed_login_count + locked_until (rate limit 防暴力破解)
-- =====================================================================

alter table public.users
  add column if not exists email_verified boolean not null default false,
  add column if not exists verify_token text,
  add column if not exists verify_expires timestamptz,
  add column if not exists failed_login_count int not null default 0,
  add column if not exists locked_until timestamptz;

-- 索引: verify_token 唯一 (防止 token 碰撞)
create unique index if not exists users_verify_token_idx on public.users (verify_token) where verify_token is not null;
