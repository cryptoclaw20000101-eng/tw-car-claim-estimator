/**
 * Estimate Storage — 估算雲端持久化（v0.14.x 新增）
 *
 * 設計：
 * - 登入時：用 Supabase 雲端儲存
 * - 未登入時：fallback 到 localStorage（v0.12.0+ Phase B3 既有功能）
 * - 自動根據 auth state 切換
 *
 * 為什麼要雲端：
 * - 跨裝置同步（業務員手機 / 桌機切換）
 * - 跨瀏覽器（Chrome / Safari）
 * - 永久保存（localStorage 會被清）
 *
 * 資料表 schema（Supabase）：
 *   create table estimates (
 *     id uuid primary key default uuid_generate_v4(),
 *     user_id uuid references auth.users(id) on delete cascade,
 *     claim_input jsonb not null,          -- 完整 ClaimInput
 *     result jsonb,                         -- EstimationResult
 *     compulsory_total_estimated bigint,    -- 快速查詢用
 *     disability_level int,
 *     court_name text,
 *     self_fault_ratio int,
 *     created_at timestamptz default now()
 *   );
 *
 *   -- RLS（row-level security）
 *   alter table estimates enable row level security;
 *   create policy "Users can only see own estimates"
 *     on estimates for select using (auth.uid() = user_id);
 */

import { getSupabase, hasSupabase } from '@/lib/supabase'
import { getEstimateHistory, saveEstimateHistory, buildHistoryEntry, type HistoryEntry } from '@/lib/estimate-history'
import type { ClaimInput, EstimationResult } from '@/lib/insurance/types'

/**
 * 完整雲端記錄（含 ClaimInput + EstimationResult）
 */
export interface CloudEstimate {
  id: string
  userId: string
  claimInput: ClaimInput
  result?: EstimationResult
  createdAt: string
}

/**
 * 儲存估算（自動選擇 Supabase 或 localStorage）
 */
export async function saveEstimate(
  input: ClaimInput,
  result: EstimationResult,
  userId: string | null,
): Promise<{ storage: 'cloud' | 'local'; id?: string }> {
  // 已登入 + Supabase 設定 → 雲端
  if (userId && hasSupabase()) {
    const client = getSupabase()
    if (client) {
      try {
        const { data, error } = await client
          .from('estimates')
          .insert({
            user_id: userId,
            claim_input: input,
            result,
            compulsory_total_estimated: result.compulsoryTotalEstimated,
            disability_level: input.medical?.disabilityLevel ?? null,
            court_name: result.region.courtName,
            self_fault_ratio: input.fault?.selfFaultRatio ?? 50,
          })
          .select('id')
          .single()
        if (!error && data) {
          return { storage: 'cloud', id: data.id }
        }
        // Supabase 失敗 → fallback
        console.warn('[estimate-storage] Supabase 儲存失敗，fallback 到 localStorage:', error)
      } catch (e) {
        console.warn('[estimate-storage] Supabase 異常，fallback 到 localStorage:', e)
      }
    }
  }

  // Fallback：localStorage
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
  if (userId && hasSupabase()) {
    const client = getSupabase()
    if (client) {
      try {
        const { data, error } = await client
          .from('estimates')
          .select('id, user_id, claim_input, result, created_at')
          .order('created_at', { ascending: false })
          .limit(20)
        if (!error && data) {
          const items: CloudEstimate[] = data.map((row) => ({
            id: row.id,
            userId: row.user_id,
            claimInput: row.claim_input as ClaimInput,
            result: row.result as EstimationResult | undefined,
            createdAt: row.created_at,
          }))
          return { storage: 'cloud', items }
        }
      } catch (e) {
        console.warn('[estimate-storage] Supabase 載入失敗:', e)
      }
    }
  }

  // Fallback：localStorage
  return { storage: 'local', items: getEstimateHistory() }
}

/**
 * 刪除雲端估算
 */
export async function deleteCloudEstimate(id: string, userId: string): Promise<boolean> {
  if (!userId || !hasSupabase()) return false
  const client = getSupabase()
  if (!client) return false
  try {
    const { error } = await client.from('estimates').delete().eq('id', id)
    return !error
  } catch {
    return false
  }
}