/**
 * Estimate History — localStorage 歷史估算記錄（v0.12.0+ Phase B3）
 *
 * 設計：
 * - localStorage key: 'tw-car-claim-estimator:history'
 * - 容量上限 10 筆（FIFO 驅逐最舊）
 * - 脫敏處理：只存非 PII 欄位（金額、失能等級、地區、肇事比例、時間戳）
 * - 不存姓名 / 身分證 / 車牌 / 精確事故日期（AGENTS §6 紅線）
 *
 * API：
 * - getEstimateHistory(): HistoryEntry[] — 從 localStorage 讀（SSR 安全：return []）
 * - saveEstimateHistory(entry): void — 新增 1 筆（自動 FIFO）
 * - clearEstimateHistory(): void — 清空（測試 / 重置用）
 * - MAX_HISTORY = 10
 *
 * 使用：
 *   const history = getEstimateHistory()
 *   saveEstimateHistory({ disabilityLevel: 7, compulsoryTotalEstimated: 50000, ... })
 */

import type { EstimationResult } from '@/lib/insurance/types'

/**
 * 脫敏後的歷史記錄條目
 * - 不含 PII
 * - 業務員掃一眼就知道「上次估算的等級 + 金額」
 */
export interface HistoryEntry {
  /** 時間戳 (ISO string) */
  timestamp: string
  /** 強制險總估算金額 */
  compulsoryTotalEstimated: number
  /** 失能等級（1-15，null = 未填）*/
  disabilityLevel: number | null
  /** 管轄法院 */
  courtName: string
  /** 己方肇責比例 (0-100) */
  selfFaultRatio: number
  /** 民事中標精神慰撫金（optional）*/
  painMidAmount?: number
}

const STORAGE_KEY = 'tw-car-claim-estimator:history'
const MAX_HISTORY = 10

/**
 * 驗證目前環境是否可用 localStorage（SSR + 隱私模式都會 false）
 */
function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

/**
 * 從 localStorage 讀歷史（SSR 安全：return []）
 */
export function getEstimateHistory(): HistoryEntry[] {
  if (!hasStorage()) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is HistoryEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof e.timestamp === 'string' &&
        typeof e.compulsoryTotalEstimated === 'number' &&
        typeof e.courtName === 'string' &&
        typeof e.selfFaultRatio === 'number',
    )
  } catch {
    // localStorage 損壞 / quota 超限 / JSON parse 失敗
    return []
  }
}

/**
 * 從 EstimationResult 抽出脫敏欄位
 */
export function buildHistoryEntry(
  result: EstimationResult,
  selfFaultRatio: number,
): HistoryEntry {
  return {
    timestamp: new Date().toISOString(),
    compulsoryTotalEstimated: result.compulsoryTotalEstimated,
    disabilityLevel: result.disability.possibleLevel ?? null,
    courtName: result.region.courtName,
    selfFaultRatio,
    painMidAmount: result.painAndSuffering.regionalMid,
  }
}

/**
 * 新增 1 筆（FIFO，超過 MAX_HISTORY 自動驅逐最舊）
 */
export function saveEstimateHistory(entry: HistoryEntry): void {
  if (!hasStorage()) return
  try {
    const list = getEstimateHistory()
    // 去重：同時間戳不重複存
    const deduped = list.filter((e) => e.timestamp !== entry.timestamp)
    deduped.unshift(entry)
    const trimmed = deduped.slice(0, MAX_HISTORY)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // quota 超限或寫入失敗 — silent fail（歷史記錄不是關鍵功能）
  }
}

/**
 * 清空（測試 / 重置用）
 */
export function clearEstimateHistory(): void {
  if (!hasStorage()) return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}