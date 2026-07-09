/**
 * Estimate Storage — Railway Postgres 雲端持久化 (v0.17.x+ 重寫)
 *
 * 從 Supabase 切換到 Railway Postgres (user 2026-07-09 選)
 * 介面保持不變, 只換底層實作
 *
 * 設計:
 * - 登入時：用 Railway Postgres 儲存
 * - 未登入時：fallback 到 localStorage
 * - 用 pg.Pool 連線, 用 JWT 認證 (lib/auth.ts)
 * - app-level filter (WHERE user_id = $1) 取代 RLS
 */

import { query } from '@/lib/db'
import {
  getEstimateHistory,
  saveEstimateHistory,
  buildHistoryEntry,
  type HistoryEntry,
} from '@/lib/estimate-history'
import type { ClaimInput, EstimationResult } from '@/lib/insurance/types'

/**
 * 完整雲端記錄
 */
export interface CloudEstimate {
  id: string
  userId: string
  claimInput: ClaimInput
  result?: EstimationResult
  createdAt: string
}

/**
 * 儲存估算
 */
export async function saveEstimate(
  input: ClaimInput,
  result: EstimationResult,
  userId: string | null,
): Promise<{ storage: 'cloud' | 'local'; id?: string }> {
  if (userId) {
    try {
      const { rows } = await query<{ id: string }>(
        `insert into public.estimates
           (user_id, claim_input, result, compulsory_total_estimated,
            disability_level, court_name, self_fault_ratio)
         values ($1, $2, $3, $4, $5, $6, $7)
         returning id`,
        [
          userId,
          input,
          result,
          result.compulsoryTotalEstimated,
          input.medical?.disabilityLevel ?? null,
          result.region.courtName,
          input.fault?.selfFaultRatio ?? 50,
        ],
      )
      if (rows[0]) return { storage: 'cloud', id: rows[0].id }
    } catch (e) {
      console.warn('[estimate-storage] Postgres 儲存失敗, fallback 到 localStorage:', e)
    }
  }

  // Fallback
  const entry = buildHistoryEntry(result, input.fault?.selfFaultRatio ?? 50)
  saveEstimateHistory(entry)
  return { storage: 'local' }
}

/**
 * 載入估算列表
 */
export async function loadEstimates(
  userId: string | null,
): Promise<{ storage: 'cloud' | 'local'; items: HistoryEntry[] | CloudEstimate[] }> {
  if (userId) {
    try {
      const { rows } = await query<{
        id: string
        user_id: string
        claim_input: ClaimInput
        result: EstimationResult | null
        created_at: string
      }>(
        `select id, user_id, claim_input, result, created_at
         from public.estimates
         where user_id = $1
         order by created_at desc
         limit 20`,
        [userId],
      )
      const items: CloudEstimate[] = rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        claimInput: row.claim_input,
        result: row.result ?? undefined,
        createdAt: row.created_at,
      }))
      return { storage: 'cloud', items }
    } catch (e) {
      console.warn('[estimate-storage] Postgres 載入失敗:', e)
    }
  }

  return { storage: 'local', items: getEstimateHistory() }
}

/**
 * 刪除雲端估算
 */
export async function deleteCloudEstimate(id: string, userId: string): Promise<boolean> {
  try {
    const { rowCount } = await query(
      'delete from public.estimates where id = $1 and user_id = $2',
      [id, userId],
    )
    return (rowCount ?? 0) > 0
  } catch {
    return false
  }
}

/**
 * 是否啟用雲端 (有 user + DB 連線成功)
 */
export function hasCloudStorage(): boolean {
  return Boolean(process.env.DATABASE_URL)
}
