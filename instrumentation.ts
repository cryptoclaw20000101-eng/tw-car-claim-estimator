/**
 * Next.js startup hook (v0.24.4+)
 *
 * Next.js 15 支援 `instrumentation.ts` 在 server 啟動時跑一次。
 * 我們在這裡自動跑 DB migrations（取代之前手動跑 apply-migrations.ts）
 *
 * 安全：每個 migration 用 `IF NOT EXISTS` 守護，重跑冇副作用
 */

export async function register() {
  // 只在 Node.js runtime 跑（Edge / browser 不適用）
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // dynamic import 避免 build time 嘗試連線
    const { applyMigrations } = await import('./db/apply-migrations')
    try {
      const applied = await applyMigrations()
      if (applied.length > 0) {
        console.log(`[instrumentation] ✓ 跑了 ${applied.length} 個 migrations:`, applied.join(', '))
      }
    } catch (e) {
      console.error('[instrumentation] migration 失敗:', (e as Error).message)
      // 不 throw — 讓 app 啟動，但 logs 顯示錯誤（方便 debug）
    }
  }
}
