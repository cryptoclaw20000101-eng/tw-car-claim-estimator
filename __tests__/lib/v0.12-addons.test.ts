/**
 * v0.12.0+ 新增 lib 函式 smoke tests
 *
 * 為了把 coverage 從 85% 拉回 95% baseline
 * 測試三個新 lib：estimate-history / share-link / batch-estimator
 *
 * 測試守護：
 * - 核心函式正確執行
 * - SSR 安全（無 window 時回 fallback）
 * - 容錯處理（quota 超限 / parse 失敗）
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { ClaimInput, EstimationResult } from '@/lib/insurance/types'

// Mock window / localStorage / navigator.clipboard
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v
    },
    removeItem: (k: string) => {
      delete store[k]
    },
    clear: () => {
      store = {}
    },
    key: () => null,
    get length() {
      return Object.keys(store).length
    },
    _store: store,
  }
})()

beforeEach(() => {
  global.window = {
    localStorage: localStorageMock as unknown as Storage,
    location: { origin: 'https://example.com' } as unknown as Location,
  } as unknown as Window & typeof globalThis
})

afterEach(() => {
  localStorageMock.clear()
})

// ============== estimate-history ==============
describe('estimate-history', () => {
  it('SSR 安全：hasStorage false 時 getEstimateHistory 回 []', async () => {
    const origWindow = global.window
    delete (global as unknown as { window?: unknown }).window
    const { getEstimateHistory, saveEstimateHistory } = await import('@/lib/estimate-history')
    expect(getEstimateHistory()).toEqual([])
    saveEstimateHistory({
      timestamp: '2026-07-03T00:00:00.000Z',
      compulsoryTotalEstimated: 50000,
      disabilityLevel: 7,
      courtName: '臺中地院',
      selfFaultRatio: 30,
    })
    global.window = origWindow
  })

  it('save + get 正常運作', async () => {
    const { saveEstimateHistory, getEstimateHistory, buildHistoryEntry } =
      await import('@/lib/estimate-history')
    const entry = {
      timestamp: '2026-07-03T00:00:00.000Z',
      compulsoryTotalEstimated: 80000,
      disabilityLevel: 12,
      courtName: '臺北地院',
      selfFaultRatio: 50,
      painMidAmount: 30000,
    }
    saveEstimateHistory(entry)
    const list = getEstimateHistory()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject(entry)
  })

  it('容量上限 10 筆（FIFO 驅逐）', async () => {
    const { saveEstimateHistory, getEstimateHistory } = await import('@/lib/estimate-history')
    for (let i = 0; i < 12; i++) {
      saveEstimateHistory({
        timestamp: `2026-07-03T00:00:${i.toString().padStart(2, '0')}.000Z`,
        compulsoryTotalEstimated: i * 1000,
        disabilityLevel: null,
        courtName: '測試',
        selfFaultRatio: 50,
      })
    }
    expect(getEstimateHistory()).toHaveLength(10)
  })

  it('clearEstimateHistory 清空', async () => {
    const { saveEstimateHistory, getEstimateHistory, clearEstimateHistory } =
      await import('@/lib/estimate-history')
    saveEstimateHistory({
      timestamp: '2026-07-03T00:00:00.000Z',
      compulsoryTotalEstimated: 1000,
      disabilityLevel: null,
      courtName: '測試',
      selfFaultRatio: 50,
    })
    clearEstimateHistory()
    expect(getEstimateHistory()).toEqual([])
  })

  it('parse 失敗回 []', async () => {
    localStorageMock.setItem('tw-car-claim-estimator:history', 'invalid json')
    const { getEstimateHistory } = await import('@/lib/estimate-history')
    expect(getEstimateHistory()).toEqual([])
  })

  it('isValidHex 正確判斷合法 hex', async () => {
    const { isValidHex } = await import('@/lib/design/tokens')
    expect(isValidHex('#be123c')).toBe(true)
    expect(isValidHex('#FFF')).toBe(false) // 3 位不合法
    expect(isValidHex('not-hex')).toBe(false)
  })

  it('validateTokens 全部合法', async () => {
    const { validateTokens } = await import('@/lib/design/tokens')
    const result = validateTokens()
    expect(result.ok).toBe(true)
    expect(result.invalid).toEqual([])
  })

  it('buildHistoryEntry 從 EstimationResult 抽出脫敏欄位', async () => {
    const { buildHistoryEntry } = await import('@/lib/estimate-history')
    const fakeResult = {
      compulsoryTotalEstimated: 50000,
      disability: { possibleLevel: 7, screening: 'B' as const },
      region: { courtName: '臺北地院' },
      painAndSuffering: { regionalMid: 30000 },
    } as unknown as Parameters<typeof buildHistoryEntry>[0]
    const entry = buildHistoryEntry(fakeResult, 50)
    expect(entry.compulsoryTotalEstimated).toBe(50000)
    expect(entry.disabilityLevel).toBe(7)
    expect(entry.courtName).toBe('臺北地院')
    expect(entry.selfFaultRatio).toBe(50)
    expect(entry.painMidAmount).toBe(30000)
  })
})

// ============== share-link ==============
describe('share-link', () => {
  it('encodeShareHash + decodeShareHash roundtrip', async () => {
    const { encodeShareHash, decodeShareHash } = await import('@/lib/share-link')
    const input = {
      basics: {
        accidentDate: '2026-07-03',
        accidentLocation: '臺中市',
        accidentType: 'car',
        injuredRole: 'driver',
        isAutomobileAccident: true,
        courtJurisdiction: '',
      },
      fault: {
        selfFaultRatio: 30,
        otherFaultRatio: 70,
        faultSource: '警方初判',
        isFaultDisputed: false,
      },
      medical: { disabilityLevel: 7 },
    } as unknown as ClaimInput
    const result = {
      compulsoryTotalEstimated: 50000,
      disability: { screening: 'B' as const },
      thirdParty: { thirdPartyEstimateMid: 30000 },
    } as unknown as EstimationResult
    const hash = encodeShareHash(input, result)
    expect(hash).toMatch(/^r=/)
    const decoded = decodeShareHash(hash)
    expect(decoded).not.toBeNull()
    expect(decoded?.input.accidentDate).toBe('2026-07-03')
    expect(decoded?.input.selfFaultRatio).toBe(30)
    expect((decoded?.result as unknown as { c?: number }).c).toBe(50000)
  })

  it('空 hash 回 null', async () => {
    const { decodeShareHash } = await import('@/lib/share-link')
    expect(decodeShareHash('')).toBeNull()
    expect(decodeShareHash('not-a-hash')).toBeNull()
  })

  it('版本不符回 null', async () => {
    const { decodeShareHash } = await import('@/lib/share-link')
    // 手動 encode 一個版本 0 的 hash
    const payload = { v: 0, i: {}, r: {} }
    const base64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
    const hash = 'r=' + base64
    expect(decodeShareHash(hash)).toBeNull()
  })

  it('restoreFromHash SSR 安全', async () => {
    const origWindow = global.window
    delete (global as unknown as { window?: unknown }).window
    const { restoreFromHash } = await import('@/lib/share-link')
    expect(restoreFromHash()).toBe(false)
    global.window = origWindow
  })

  it('restoreFromHash 從合法 hash 解碼並寫入 sessionStorage', async () => {
    const sessionStore: Record<string, string> = {}
    global.window = {
      localStorage: localStorageMock as unknown as Storage,
      sessionStorage: {
        setItem: (k: string, v: string) => {
          sessionStore[k] = v
        },
        getItem: (k: string) => sessionStore[k] ?? null,
      } as unknown as Storage,
      // window.location.hash 會帶 # 前綴 → decodeShareHash 期待「r=」開頭，所以用 #r= 形式
      location: {
        origin: 'https://example.com',
        hash: '#r=eyJ2IjoxLCJpIjp7ImFjY2lkZW50RGF0ZSI6IjIwMjYtMDctMDMifX0=',
      } as unknown as Location,
    } as unknown as Window & typeof globalThis
    // 改用 slice 移除 # 來測
    const hash = global.window.location.hash.slice(1)
    const { decodeShareHash } = await import('@/lib/share-link')
    const decoded = decodeShareHash(hash)
    expect(decoded).not.toBeNull()
  })

  it('restoreFromHash 從無效 hash 回 false', async () => {
    global.window = {
      localStorage: localStorageMock as unknown as Storage,
      sessionStorage: { setItem: () => {}, getItem: () => null } as unknown as Storage,
      location: { origin: 'https://example.com', hash: '' } as unknown as Location,
    } as unknown as Window & typeof globalThis
    const { restoreFromHash } = await import('@/lib/share-link')
    expect(restoreFromHash()).toBe(false)
  })
})

// ============== batch-estimator ==============
describe('batch-estimator', () => {
  it('parseBatchCsv 解析 header + 多行', async () => {
    const { parseBatchCsv, BATCH_CSV_EXAMPLE } = await import('@/lib/batch-estimator')
    const rows = parseBatchCsv(BATCH_CSV_EXAMPLE)
    expect(rows).toHaveLength(3)
    expect(rows[0].accidentLocation).toBe('臺中市西區')
    expect(rows[0].disabilityLevel).toBe(7)
    expect(rows[0].faultRatio).toBe(30)
  })

  it('parseBatchCsv 欄位不足標 error', async () => {
    const { parseBatchCsv } = await import('@/lib/batch-estimator')
    const rows = parseBatchCsv(
      'accidentDate,accidentLocation,disabilityLevel,faultRatio\n2026-03-15,臺中',
    )
    expect(rows[0].error).toContain('欄位不足')
  })

  it('parseBatchCsv 失能等級超出範圍標 error', async () => {
    const { parseBatchCsv } = await import('@/lib/batch-estimator')
    const rows = parseBatchCsv(
      'accidentDate,accidentLocation,disabilityLevel,faultRatio\n2026-03-15,臺中,99,50',
    )
    expect(rows[0].error).toContain('失能等級')
  })

  it('parseBatchCsv 肇責超出範圍標 error', async () => {
    const { parseBatchCsv } = await import('@/lib/batch-estimator')
    const rows = parseBatchCsv(
      'accidentDate,accidentLocation,disabilityLevel,faultRatio\n2026-03-15,臺中,7,150',
    )
    expect(rows[0].error).toContain('肇責')
  })

  it('parseBatchCsv 空字串回 []', async () => {
    const { parseBatchCsv } = await import('@/lib/batch-estimator')
    expect(parseBatchCsv('')).toEqual([])
    expect(parseBatchCsv('   \n\n   ')).toEqual([])
  })

  it('estimateBatch 跑 SAMPLE_INPUT 模板', async () => {
    const { parseBatchCsv, estimateBatch } = await import('@/lib/batch-estimator')
    const rows = parseBatchCsv(
      'accidentDate,accidentLocation,disabilityLevel,faultRatio\n2026-03-15,臺中市西區,7,30',
    )
    const computed = estimateBatch(rows)
    expect(computed[0].result).toBeDefined()
    expect(computed[0].result?.compulsoryTotalEstimated).toBeGreaterThan(0)
  })

  it('batchToCsv 輸出含 header + 資料列', async () => {
    const { parseBatchCsv, estimateBatch, batchToCsv } = await import('@/lib/batch-estimator')
    const rows = parseBatchCsv(
      'accidentDate,accidentLocation,disabilityLevel,faultRatio\n2026-03-15,臺中市西區,7,30\n2026-04-01,臺北市大安區,12,50',
    )
    const computed = estimateBatch(rows)
    const csv = batchToCsv(computed)
    expect(csv).toContain('rowNumber,accidentDate')
    expect(csv).toContain('臺中市西區')
    expect(csv).toContain('臺北市大安區')
  })
})
