/**
 * Share Link — URL hash 編碼估算結果（v0.12.0+ Phase B5）
 *
 * 為什麼：
 * - sessionStorage 不能跨裝置 / 跨瀏覽器分享
 * - 業務員可能要把估算結果傳給同事或律師複核
 * - URL hash 編碼後附在網址後面，收件人打開即可看到完整結果
 *
 * 設計：
 * - 用 base64 + JSON.stringify 編碼
 * - 只放 URL hash（不污染 query string）
 * - 容量限制：URL hash 普遍支援 2KB 以內（modern browser） → 夠放精簡後的 input + result
 * - 不放 PII（依 AGENTS §6 紅線）
 * - 開啟時檢查 URL hash 有沒有資料，有就解碼寫入 sessionStorage → 自動導向 /claims/result
 */

import type { ClaimInput } from '@/lib/insurance/types'
import type { EstimationResult } from '@/lib/insurance/types'

/**
 * 精簡版 Input（只留可分享的欄位，不含 PII）
 */
export interface ShareableInput {
  accidentDate: string
  accidentLocation: string
  accidentType: string
  injuredRole: string
  isAutomobileAccident: boolean
  courtJurisdiction: string
  selfFaultRatio: number
  otherFaultRatio: number
  faultSource: string
  isFaultDisputed: boolean
  disabilityLevel: number | null
  // ... 其他必要欄位可加
}

/**
 * URL hash 前綴（方便識別）
 */
const HASH_PREFIX = 'r='

/**
 * 編碼估算結果到 URL hash
 */
export function encodeShareHash(input: ClaimInput, result: EstimationResult): string {
  // 只取 shareable 欄位（去掉姓名 / 身分證 / 車牌）
  const minimalInput: Partial<ShareableInput> = {
    accidentDate: input.basics?.accidentDate,
    accidentLocation: input.basics?.accidentLocation,
    accidentType: input.basics?.accidentType,
    injuredRole: input.basics?.injuredRole,
    isAutomobileAccident: input.basics?.isAutomobileAccident,
    courtJurisdiction: input.basics?.courtJurisdiction,
    selfFaultRatio: input.fault?.selfFaultRatio ?? 50,
    otherFaultRatio: input.fault?.otherFaultRatio ?? 50,
    faultSource: input.fault?.faultSource ?? '尚未確定',
    isFaultDisputed: input.fault?.isFaultDisputed ?? false,
    disabilityLevel: input.medical?.disabilityLevel ?? null,
  }
  const payload = {
    i: minimalInput,
    r: {
      c: result.compulsoryTotalEstimated,
      d: result.disability?.screening ?? null,
      p: result.thirdParty?.thirdPartyEstimateMid ?? 0,
    },
    v: 1, // version
  }
  try {
    const json = JSON.stringify(payload)
    const base64 = btoa(unescape(encodeURIComponent(json)))
    return HASH_PREFIX + base64
  } catch {
    return ''
  }
}

/**
 * 解碼 URL hash 回 input + result（部分欄位）
 */
export function decodeShareHash(
  hash: string,
): { input: Partial<ShareableInput>; result: Partial<EstimationResult> } | null {
  if (!hash || !hash.startsWith(HASH_PREFIX)) return null
  try {
    const base64 = hash.slice(HASH_PREFIX.length)
    const json = decodeURIComponent(escape(atob(base64)))
    const payload = JSON.parse(json)
    if (payload.v !== 1) return null
    return {
      input: payload.i ?? {},
      result: payload.r ?? {},
    }
  } catch {
    return null
  }
}

/**
 * 從當前 URL hash 解碼並寫入 sessionStorage
 * （給 /claims/new 頁 mount 時檢查用）
 */
export function restoreFromHash(): boolean {
  if (typeof window === 'undefined') return false
  const hash = window.location.hash
  const decoded = decodeShareHash(hash)
  if (!decoded) return false

  // 還原 sessionStorage（部分欄位）
  try {
    const reconstructedInput = {
      basics: {
        accidentDate: decoded.input.accidentDate ?? '',
        accidentLocation: decoded.input.accidentLocation ?? '',
        accidentType: decoded.input.accidentType ?? '',
        injuredRole: decoded.input.injuredRole ?? '',
        isAutomobileAccident: decoded.input.isAutomobileAccident ?? true,
        courtJurisdiction: decoded.input.courtJurisdiction ?? '',
      },
      fault: {
        selfFaultRatio: decoded.input.selfFaultRatio ?? 50,
        otherFaultRatio: decoded.input.otherFaultRatio ?? 50,
        faultSource: decoded.input.faultSource ?? '尚未確定',
        isFaultDisputed: decoded.input.isFaultDisputed ?? false,
      },
      medical: {
        disabilityLevel: decoded.input.disabilityLevel ?? null,
      },
    } as unknown as ClaimInput

    // 寫入 sessionStorage（完整 result 從 result/ 計算，這裡只放 input）
    window.sessionStorage.setItem('claim-input', JSON.stringify(reconstructedInput))
    return true
  } catch {
    return false
  }
}
