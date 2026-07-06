/**
 * Estimate Loader — 載入舊案件（v0.14.x 新增）
 *
 * 業務員工作流：
 * 1. 首頁「最近估算過的案件」看到雲端資料
 * 2. 點「載入」按鈕
 * 3. 系統把 ClaimInput 寫到 sessionStorage（key: 'claim-load-from-history'）
 * 4. 跳轉到 /claims/new?load=true
 * 5. /claims/new mount 時讀 sessionStorage → 自動填表單
 *
 * 為什麼用 sessionStorage 而非 URL：
 * - ClaimInput 可能 5-10KB（失能 12 大類細節、醫療 15 細項）
 * - URL 實用上限 8KB
 * - sessionStorage 上限 5-10MB
 * - sessionStorage 跨頁就好，URL hash 容易把個資洩漏到 analytics
 *
 * 隱私：
 * - sessionStorage 只存在當前分頁
 * - 關 tab 自動清掉
 * - 不寫進 URL（社群分享安全）
 */

import type { ClaimInput } from '@/lib/insurance/types'

const STORAGE_KEY = 'claim-load-from-history'

/**
 * 儲存舊案件到 sessionStorage
 */
export function saveForLoad(claimInput: ClaimInput): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(claimInput))
  } catch {
    // quota 超限等
  }
}

/**
 * 從 sessionStorage 讀舊案件（讀完自動清掉）
 */
export function consumeForLoad(): ClaimInput | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    window.sessionStorage.removeItem(STORAGE_KEY) // 一次性消費
    return JSON.parse(raw) as ClaimInput
  } catch {
    return null
  }
}

/**
 * 取消載入（不清資料，只是不消費）
 */
export function cancelLoad(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}