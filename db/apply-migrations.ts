/**
 * Migration runner (v0.24.4+)
 *
 * 自動跑 db/migrations/*.sql 套用尚未執行的 migration。
 * 用 pg.Client 連 DATABASE_URL，依檔名排序跑。
 *
 * 使用：
 *   npx tsx db/apply-migrations.ts
 * 或在 API route 用：
 *   import { applyMigrations } from '@/db/apply-migrations'
 *   await applyMigrations()
 *
 * 安全：每個 migration 用 IF NOT EXISTS 守護，重跑冇副作用。
 */
import { Client } from 'pg'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS_DIR = join(process.cwd(), 'db', 'migrations')

export async function applyMigrations(): Promise<string[]> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('[migrations] DATABASE_URL not set')

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const client = new Client({ connectionString: url })
  await client.connect()

  const applied: string[] = []
  try {
    for (const file of files) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
      try {
        await client.query(sql)
        applied.push(file)
        console.log(`[migrations] ✓ ${file}`)
      } catch (e) {
        console.error(`[migrations] ✗ ${file}:`, (e as Error).message)
        throw e
      }
    }
  } finally {
    await client.end()
  }

  return applied
}

// 允許 CLI 直接執行：npx tsx db/apply-migrations.ts
if (process.argv[1]?.endsWith('apply-migrations.ts')) {
  applyMigrations()
    .then((files) => {
      console.log(`[migrations] 完成 ${files.length} 個 migration`)
    })
    .catch((e) => {
      console.error('[migrations] 失敗:', e)
      process.exit(1)
    })
}
