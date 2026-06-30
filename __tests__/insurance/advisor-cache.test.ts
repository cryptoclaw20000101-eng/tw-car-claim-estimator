/**
 * advisor-cache 純函式測試 — v0.7.7+
 *
 * 不變量（測試守護）：
 *   - getCachedAdvisor(set 過的 input) 回相同 result
 *   - getCachedAdvisor(未 set) 回 null
 *   - 過期 → 視同 miss
 *   - LRU 容量上限 → 驅逐最舊
 *   - privacy fallback → 不寫快取
 *   - enabled=false → 不查不寫
 *   - cacheKey() 同 input 不同 key 順序 → 同鍵
 *   - 統計：hits/misses/evictions 正確累計
 *   - getAdvisorCacheHitRate() 沒任何請求 → null
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getCachedAdvisor,
  setCachedAdvisor,
  clearAdvisorCache,
  getAdvisorCacheStats,
  getAdvisorCacheHitRate,
  cacheKey,
  type AdvisorCacheConfig,
} from '@/lib/insurance/advisor-cache'
import type { AdvisorApiResult } from '@/lib/insurance/advisor-api'
import type { AdvisorInput } from '@/lib/insurance/pain-advisor'

const mockInput: AdvisorInput = {
  courtName: '臺灣臺北地方法院',
  rulesMid: 100000,
  rulesLevel: '中度',
  mlP50: 80000,
  mlConfidence: 'medium',
  knnAmount: 90000,
  knnCases: [{ caseNo: '113 北簡字 123', amount: 90000 }],
  ensembleConsensus: 'strong',
  ensembleAmount: 90000,
  outlier: null,
  isDivergent: false,
  hasWarnings: false,
}

const liveResult: AdvisorApiResult = {
  mode: 'live',
  advisor: {
    riskLevel: 'low',
    riskFactors: [],
    recommendations: [],
    consensusInterpretation: 'ok',
    requiresHumanReview: false,
    promptTokens: 100,
    completionTokens: 30,
    disclaimer: '本建議由 AI 產生，僅供參考',
  },
  usage: { inputTokens: 100, outputTokens: 30 },
}

const privacyFallback: AdvisorApiResult = {
  mode: 'fallback',
  advisor: {
    riskLevel: 'low',
    riskFactors: [],
    recommendations: [],
    consensusInterpretation: 'ok',
    requiresHumanReview: false,
    promptTokens: 0,
    completionTokens: 0,
    disclaimer: '偵測到個資，無法送 API',
  },
  fallbackReason: 'privacy',
}

beforeEach(() => {
  clearAdvisorCache()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-01T00:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('advisor-cache 基本', () => {
  it('未 set 的 input → getCachedAdvisor 回 null', () => {
    expect(getCachedAdvisor(mockInput)).toBeNull()
  })

  it('set 後 get → 回相同 result', () => {
    setCachedAdvisor(mockInput, liveResult)
    expect(getCachedAdvisor(mockInput)).toEqual(liveResult)
  })

  it('不同 input → 不同快取條目', () => {
    const other: AdvisorInput = { ...mockInput, courtName: '臺灣臺中地方法院' }
    setCachedAdvisor(mockInput, liveResult)
    setCachedAdvisor(other, { ...liveResult, usage: { inputTokens: 200, outputTokens: 60 } })
    const r1 = getCachedAdvisor(mockInput)
    const r2 = getCachedAdvisor(other)
    expect(r1?.usage?.inputTokens).toBe(100)
    expect(r2?.usage?.inputTokens).toBe(200)
  })
})

describe('advisor-cache TTL', () => {
  it('未過期 → 命中', () => {
    setCachedAdvisor(mockInput, liveResult, { ttlMs: 60_000 })
    vi.advanceTimersByTime(30_000)  // 30 秒後
    expect(getCachedAdvisor(mockInput, { ttlMs: 60_000 })).toEqual(liveResult)
  })

  it('剛好過期 → 視同 miss', () => {
    setCachedAdvisor(mockInput, liveResult, { ttlMs: 60_000 })
    vi.advanceTimersByTime(60_001)  // 60.001 秒後（過期）
    expect(getCachedAdvisor(mockInput, { ttlMs: 60_000 })).toBeNull()
  })
})

describe('advisor-cache LRU 驅逐', () => {
  it('超過 maxEntries → 驅逐最舊', () => {
    const inputs = Array.from({ length: 5 }, (_, i) => ({
      ...mockInput,
      courtName: `法院 ${i}`,
    }))

    // maxEntries=3，set 5 個 → 應只留 3 個
    for (const input of inputs) {
      setCachedAdvisor(input, liveResult, { maxEntries: 3 })
    }

    // 前 2 個（法院 0、法院 1）應被驅逐
    expect(getCachedAdvisor(inputs[0], { maxEntries: 3 })).toBeNull()
    expect(getCachedAdvisor(inputs[1], { maxEntries: 3 })).toBeNull()
    // 後 3 個（法院 2、3、4）仍命中
    expect(getCachedAdvisor(inputs[2], { maxEntries: 3 })).toEqual(liveResult)
    expect(getCachedAdvisor(inputs[3], { maxEntries: 3 })).toEqual(liveResult)
    expect(getCachedAdvisor(inputs[4], { maxEntries: 3 })).toEqual(liveResult)
  })

  it('getCachedAdvisor 後 LRU 順序更新（touch）', () => {
    const inputs = Array.from({ length: 5 }, (_, i) => ({
      ...mockInput,
      courtName: `法院 ${i}`,
    }))
    // 先塞 5 個到 maxEntries=5（不驅逐）
    for (const input of inputs) {
      setCachedAdvisor(input, liveResult, { maxEntries: 5 })
    }
    // touch inputs[0]（重新插入 LRU 尾端 — Map 順序：1,2,3,4,0）
    getCachedAdvisor(inputs[0], { maxEntries: 5 })
    // 再塞 1 個 → 觸發驅逐現在最舊的 inputs[1]
    setCachedAdvisor(
      { ...mockInput, courtName: '新進法院' },
      liveResult,
      { maxEntries: 5 },
    )
    // inputs[1] 應被驅逐
    expect(getCachedAdvisor(inputs[1], { maxEntries: 5 })).toBeNull()
    // inputs[0] 仍命中（被 touch 過）
    expect(getCachedAdvisor(inputs[0], { maxEntries: 5 })).toEqual(liveResult)
  })
})

describe('advisor-cache 隱私與停用', () => {
  it('privacy fallback 不寫快取', () => {
    setCachedAdvisor(mockInput, privacyFallback)
    expect(getCachedAdvisor(mockInput)).toBeNull()
  })

  it('enabled=false → set 不寫入', () => {
    setCachedAdvisor(mockInput, liveResult, { enabled: false })
    expect(getCachedAdvisor(mockInput, { enabled: false })).toBeNull()
  })

  it('enabled=false → get 永遠 miss', () => {
    setCachedAdvisor(mockInput, liveResult)
    expect(getCachedAdvisor(mockInput, { enabled: false })).toBeNull()
  })
})

describe('advisor-cache 統計', () => {
  it('hits/misses 正確累計', () => {
    setCachedAdvisor(mockInput, liveResult)
    getCachedAdvisor(mockInput)  // hit
    getCachedAdvisor(mockInput)  // hit
    getCachedAdvisor({ ...mockInput, courtName: '其他' })  // miss

    const stats = getAdvisorCacheStats()
    expect(stats.hits).toBe(2)
    expect(stats.misses).toBe(1)
    expect(stats.size).toBe(1)
  })

  it('過期 → expirations++', () => {
    setCachedAdvisor(mockInput, liveResult, { ttlMs: 1000 })
    vi.advanceTimersByTime(2000)
    getCachedAdvisor(mockInput, { ttlMs: 1000 })  // 過期 miss
    expect(getAdvisorCacheStats().expirations).toBe(1)
  })

  it('驅逐 → evictions++', () => {
    const inputs = Array.from({ length: 5 }, (_, i) => ({
      ...mockInput,
      courtName: `法院 ${i}`,
    }))
    for (const input of inputs) {
      setCachedAdvisor(input, liveResult, { maxEntries: 3 })
    }
    expect(getAdvisorCacheStats().evictions).toBe(2)  // 5 - 3 = 2 驅逐
  })

  it('getAdvisorCacheHitRate 沒請求 → null', () => {
    expect(getAdvisorCacheHitRate()).toBeNull()
  })

  it('getAdvisorCacheHitRate 有請求 → 比例', () => {
    setCachedAdvisor(mockInput, liveResult)
    getCachedAdvisor(mockInput)  // hit
    getCachedAdvisor(mockInput)  // hit
    getCachedAdvisor({ ...mockInput, courtName: '其他' })  // miss
    expect(getAdvisorCacheHitRate()).toBeCloseTo(0.6667, 3)
  })
})

describe('cacheKey 純函式', () => {
  it('同 input 不同 key 順序 → 同鍵', () => {
    const a: AdvisorInput = { ...mockInput, ensembleAmount: 1, courtName: 'A' }
    const b: AdvisorInput = { ...mockInput, courtName: 'A', ensembleAmount: 1 }
    expect(cacheKey(a)).toBe(cacheKey(b))
  })

  it('不同欄位值 → 不同鍵', () => {
    const a: AdvisorInput = { ...mockInput, courtName: 'A' }
    const b: AdvisorInput = { ...mockInput, courtName: 'B' }
    expect(cacheKey(a)).not.toBe(cacheKey(b))
  })
})

// 避免 TS unused 警告
const _cfg: AdvisorCacheConfig = {}