/**
 * db.ts — PostgreSQL connection pool (v0.17.x+)
 *
 * 取代 lib/supabase.ts (user 2026-07-09 選 Railway Postgres 改自寫)
 *
 * 設計:
 * - 用 pg.Pool (連線池, 自動管理連線)
 * - lazy 初始化 (避免 build time 連線)
 * - 環境變數 DATABASE_URL 必填 (Railway 自動注入)
 * - 連線失敗 throw (fail fast, 容易 debug)
 *
 * 使用:
 *   import { query, getClient } from '@/lib/db'
 *   const { rows } = await query('SELECT * FROM users WHERE id = $1', [id])
 */

import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg'

let _pool: Pool | null = null

/**
 * 取得 pg.Pool singleton (lazy 初始化)
 */
function getPool(): Pool {
  if (_pool) return _pool

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('[db] DATABASE_URL 環境變數未設定. Railway 部署會自動注入, 本機需設 .env')
  }

  _pool = new Pool({
    connectionString,
    // Railway Postgres 內部網路不需要 SSL
    // 但外部連線 (DATABASE_PUBLIC_URL) 需 ssl={rejectUnauthorized:false}
    ssl:
      connectionString.includes('railway.internal') || connectionString.includes('localhost')
        ? false
        : { rejectUnauthorized: false },
    max: 10, // 連線池上限
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  })

  // 連線錯誤 log (不要 throw, 讓 query 失敗顯式報)
  _pool.on('error', (err) => {
    console.error('[db] pool error:', err)
  })

  return _pool
}

/**
 * 查詢 helper (最常用)
 */
export async function query<R extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<R>> {
  return getPool().query<R>(text, params)
}

/**
 * 取得專用 client (transaction 用)
 *
 * 使用:
 *   const client = await getClient()
 *   try {
 *     await client.query('BEGIN')
 *     await client.query(...)
 *     await client.query('COMMIT')
 *   } catch (e) {
 *     await client.query('ROLLBACK')
 *     throw e
 *   } finally {
 *     client.release()
 *   }
 */
export async function getClient(): Promise<PoolClient> {
  return getPool().connect()
}

/**
 * 關閉 pool (測試 / 優雅關閉用)
 */
export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end()
    _pool = null
  }
}
