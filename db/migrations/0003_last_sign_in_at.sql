-- =====================================================================
-- v0.24.4 修：users table 加 last_sign_in_at 欄位
-- 原因：admin/users query SELECT 包含 last_sign_in_at 但 schema 沒此欄位
--      → 導致 query 失敗 → catch block 沒捕獲 → 回 200 + 空 items
-- 修復：加欄位讓 admin query 成功
-- =====================================================================

alter table public.users
  add column if not exists last_sign_in_at timestamptz;
