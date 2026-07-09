/**
 * Estimate Storage — Client-side fetch wrapper (v0.17.x+)
 *
 * 從 Supabase + 直接 pg 改為 fetch /api/estimates
 * 原因: pg 是 Node.js only, 不能 bundle 到 client (Next.js build 會 fail)
 *
 * 流程:
 * - client 呼叫 saveEstimate() → fetch POST /api/estimates
 * - /api/estimates (serverful route) 透過 lib/db.ts 用 pg 寫入 Postgres
 * - cookie (auth_token) 自動跟著 fetch 走
 *
 * 介面不變, 只換底層實作.
 */

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
 * - 已登入: POST /api/estimates (serverful 寫 Postgres)
 * - 未登入: localStorage fallback
 */
export async function saveEstimate(
  input: ClaimInput,
  result: EstimationResult,
  userId: string | null,
): Promise<{ storage: 'cloud' | 'local'; id?: string }> {
  if (userId) {
    try {
      const res = await fetch('/api/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ claimInput: input, result }),
      })
      if (res.ok) {
        const body = (await res.json()) as { id: string }
        return { storage: 'cloud', id: body.id }
      }
    } catch (e) {
      console.warn('[estimate-storage] /api/estimates POST 失敗:', e)
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
      const res = await fetch('/api/estimates', {
        method: 'GET',
        credentials: 'include',
      })
      if (res.ok) {
        const body = (await res.json()) as { items: CloudEstimate[] }
        return { storage: 'cloud', items: body.items }
      }
    } catch (e) {
      console.warn('[estimate-storage] /api/estimates GET 失敗:', e)
    }
  }
  return { storage: 'local', items: getEstimateHistory() }
}

/**
 * 刪除雲端估算
 */
export async function deleteCloudEstimate(id: string, _userId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/estimates/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * 是否啟用雲端 (Railway 部署時 API route 可用)
 */
export function hasCloudStorage(): boolean {
  return typeof window !== 'undefined'
}
