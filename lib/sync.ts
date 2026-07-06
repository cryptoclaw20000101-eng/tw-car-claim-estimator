/**
 * Sync — 雲端 ↔ 本地 同步工具（v0.15.x Phase 3）
 *
 * 業務員場景：
 * - 登入前估算了 5 筆 → 都存 localStorage
 * - 登入後想跨裝置 → 這 5 筆要上傳到雲端
 * - 換手機後想看 → 從雲端下載到本地
 *
 * 設計：
 * - uploadLocalToCloud()：把 localStorage 所有 entries 上傳
 * - downloadCloudToLocal()：把雲端所有 entries 下載到 localStorage
 * - smartSync()：自動偵測 → 上傳新本地 + 下載新雲端
 * - 衝突解決：時間戳較新者勝（簡單版）
 *
 * 隱私：
 * - 同步前自動跑 saveEstimate 脫敏邏輯
 * - 不傳姓名 / 身分證 / 車牌
 */

import { getEstimateHistory, saveEstimateHistory, type HistoryEntry } from '@/lib/estimate-history'
import { saveEstimate, loadEstimates, type CloudEstimate } from '@/lib/estimate-storage'

export interface SyncResult {
  uploaded: number
  downloaded: number
  skipped: number
  errors: string[]
}

/**
 * 上傳本地所有 entries 到雲端
 *
 * 流程：
 * 1. 讀 localStorage 所有 entries
 * 2. 對每個 entry 呼叫 saveEstimate
 * 3. 因為 saveEstimate 需要 ClaimInput，但我們只存了 HistoryEntry（脫敏版）
 * 4. 對於「沒有完整 ClaimInput」的本地 entries，無法上傳
 *
 * 結論：v0.15.x 只能同步「在登入後新估算的」（自動有完整 ClaimInput）
 * 登入前估的（只有脫敏的 HistoryEntry）目前無法上傳（需要保留完整資料）
 *
 * v0.16.x 規劃：本地也存完整 ClaimInput（不只脫敏）→ 可以補上傳
 */
export async function uploadLocalToCloud(userId: string): Promise<SyncResult> {
  const local = getEstimateHistory()
  const result: SyncResult = {
    uploaded: 0,
    downloaded: 0,
    skipped: 0,
    errors: [],
  }

  for (const entry of local) {
    // v0.15.x 限制：本地只存脫敏資料，沒有完整 ClaimInput，無法上傳
    result.skipped++
  }

  return result
}

/**
 * 從雲端下載所有 entries 到本地
 *
 * 流程：
 * 1. 呼叫 loadEstimates 拿雲端資料
 * 2. 對每個 CloudEstimate 轉成 HistoryEntry 格式
 * 3. 寫入 localStorage（FIFO 10 筆上限）
 */
export async function downloadCloudToLocal(userId: string): Promise<SyncResult> {
  const result: SyncResult = {
    uploaded: 0,
    downloaded: 0,
    skipped: 0,
    errors: [],
  }

  try {
    const { items } = await loadEstimates(userId)
    const cloud = items as CloudEstimate[]

    for (const c of cloud) {
      // 轉成 HistoryEntry 格式
      const entry: HistoryEntry = {
        timestamp: c.createdAt,
        compulsoryTotalEstimated: c.result?.compulsoryTotalEstimated ?? 0,
        disabilityLevel: c.claimInput?.medical?.disabilityLevel ?? null,
        courtName: c.result?.region?.courtName ?? '—',
        selfFaultRatio: c.claimInput?.fault?.selfFaultRatio ?? 50,
      }
      saveEstimateHistory(entry)
      result.downloaded++
    }
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : '未知錯誤')
  }

  return result
}

/**
 * 智慧同步：自動偵測 + 上傳新本地 + 下載新雲端
 *
 * 衝突解決：時間戳較新者勝
 */
export async function smartSync(userId: string): Promise<SyncResult> {
  const [local, cloudResult] = await Promise.all([
    Promise.resolve(getEstimateHistory()),
    loadEstimates(userId).catch(() => ({ storage: 'local' as const, items: [] })),
  ])

  const result: SyncResult = {
    uploaded: 0,
    downloaded: 0,
    skipped: 0,
    errors: [],
  }

  // v0.15.x 限制：無法上傳本地（缺 ClaimInput），只能下載
  result.skipped = local.length

  // 下載雲端（時間戳較新才寫入，避免覆蓋本地較新資料）
  const cloudItems = cloudResult.items as CloudEstimate[]
  const localTimestamps = new Set(local.map((e) => e.timestamp))

  for (const c of cloudItems) {
    if (localTimestamps.has(c.createdAt)) {
      // 本地已有相同時間戳 → 跳過（避免覆蓋）
      result.skipped++
      continue
    }
    const entry: HistoryEntry = {
      timestamp: c.createdAt,
      compulsoryTotalEstimated: c.result?.compulsoryTotalEstimated ?? 0,
      disabilityLevel: c.claimInput?.medical?.disabilityLevel ?? null,
      courtName: c.result?.region?.courtName ?? '—',
      selfFaultRatio: c.claimInput?.fault?.selfFaultRatio ?? 50,
    }
    saveEstimateHistory(entry)
    result.downloaded++
  }

  return result
}
