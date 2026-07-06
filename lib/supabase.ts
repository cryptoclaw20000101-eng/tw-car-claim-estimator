/**
 * Supabase Client — 雲端 Auth + DB（v0.14.x 規劃落實）
 *
 * 為什麼用 Supabase：
 * - 純前端 SDK，不需要 server → 配 Next.js static export（output: "export"）
 * - Auth 內建（magic link 信箱登入 / OAuth）
 * - Postgres DB + RLS（row-level security）
 * - Free tier：500MB DB + 50k MAU
 *
 * 用法：
 *   import { getSupabase, hasSupabase } from '@/lib/supabase'
 *   const client = getSupabase()
 *   if (client) await client.from('estimates').insert(...)
 *
 * SSR 安全：client init 在瀏覽器才跑
 * 沒設 env vars 時回 null（自動降級到 localStorage）
 *
 * 環境變數（.env.local）：
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

/**
 * 取得 Supabase client（單例）
 * 沒設 env vars 時回 null（呼叫端需 fallback）
 */
export function getSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') return null // SSR safety

  if (_client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) return null

  _client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

  return _client
}

/**
 * 檢查 Supabase 是否設定（env vars 完整）
 */
export function hasSupabase(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}