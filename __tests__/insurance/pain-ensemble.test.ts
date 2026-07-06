// =====================================================================
// 精神慰撫金 Ensemble 三票共識 — 測試
// 守護 lib/insurance/pain-ensemble.ts（v0.6.2）
//
// 設計：三票共識
//   🎯 規則票：computePainAndSuffering.regionalMid（公式推導）
//   📊 ML 票：predictPainRange.p50（歷史中位數）
//   🔍 KNN 票：findRelatedPracticeCases 平均金額（相似案件）
//
// 共識度：
//   - strong：三票接近（差距 ≤ 20%）→ 用平均
//   - partial：兩票接近 + 一票 outlier → 用兩票平均 + 標 outlier
//   - weak：三票分散 → 顯示區間 + 警示人工複核
// =====================================================================

import { describe, it, expect } from 'vitest'
import {
  ensembleEstimate,
  computeConsensus,
  type EnsembleInput,
  type EnsembleOutput,
} from '@/lib/insurance/pain-ensemble'

function input(overrides: Partial<EnsembleInput> = {}): EnsembleInput {
  return {
    rulesMid: 100_000,
    mlP50: 100_000,
    knnCases: [
      { caseNo: 'A', amount: 100_000 },
      { caseNo: 'B', amount: 100_000 },
      { caseNo: 'C', amount: 100_000 },
    ],
    mlConfidence: 'medium',
    knnAvailable: true,
    ...overrides,
  }
}

describe('computeConsensus — 共識度判定', () => {
  it('三票差距 ≤ 20%：strong 共識', () => {
    const r = computeConsensus(100_000, 100_000, [100_000, 100_000, 100_000])
    expect(r.consensus).toBe('strong')
  })

  it('兩票接近 + 一票 outlier >50%：partial 共識', () => {
    // 規則 100K + ML 100K 一致；KNN 200K outlier
    const r = computeConsensus(100_000, 100_000, [200_000])
    expect(r.consensus).toBe('partial')
    expect(r.outlier).toBe('knn')
  })

  it('三票分散（差距都 >30%）：weak 共識', () => {
    // 規則 100K / ML 200K / KNN 50K 三票完全不同方向
    const r = computeConsensus(100_000, 200_000, [50_000])
    expect(r.consensus).toBe('weak')
  })

  it('規則 outlier：partial', () => {
    // 規則 300K outlier；ML 100K + KNN 100K 一致
    const r = computeConsensus(300_000, 100_000, [100_000])
    expect(r.consensus).toBe('partial')
    expect(r.outlier).toBe('rules')
  })

  it('ML outlier：partial', () => {
    const r = computeConsensus(100_000, 300_000, [100_000])
    expect(r.consensus).toBe('partial')
    expect(r.outlier).toBe('ml')
  })
})

describe('ensembleEstimate — 三票共識引擎', () => {
  it('strong 共識：回傳三票平均', () => {
    const r = ensembleEstimate(input())
    expect(r.consensus).toBe('strong')
    expect(r.consensusAmount).toBe(100_000)
    expect(r.warning).toBeUndefined()
  })

  it('partial 共識：回傳兩票平均 + 標 outlier', () => {
    const r = ensembleEstimate(
      input({
        knnCases: [{ caseNo: 'A', amount: 200_000 }],
      }),
    )
    expect(r.consensus).toBe('partial')
    // 規則 100K + ML 100K → 平均 100K
    expect(r.consensusAmount).toBe(100_000)
    expect(r.outlier).toBe('knn')
    expect(r.warning).toBeTruthy()
  })

  it('weak 共識：回傳區間 + 警示人工複核', () => {
    const r = ensembleEstimate(
      input({
        rulesMid: 100_000,
        mlP50: 300_000,
        knnCases: [{ caseNo: 'A', amount: 50_000 }],
      }),
    )
    expect(r.consensus).toBe('weak')
    expect(r.consensusAmount).toBeNull() // 不給單一金額
    expect(r.suggestedRange).toBeDefined()
    expect(r.warning).toMatch(/人工複核|建議複核/)
  })

  it('KNN 不可用：仍能計算（規則 + ML 二票）', () => {
    const r = ensembleEstimate(
      input({
        knnAvailable: false,
        knnCases: [],
      }),
    )
    // 規則 100K + ML 100K → 仍 strong（兩票就夠）
    expect(r.consensus).toBe('strong')
    expect(r.consensusAmount).toBe(100_000)
    expect(r.knnAmount).toBeNull()
  })

  it('ML confidence=low 時：弱化 ML 票的權重', () => {
    const r = ensembleEstimate(
      input({
        rulesMid: 100_000,
        mlP50: 100_000,
        knnCases: [{ caseNo: 'A', amount: 100_000 }],
        mlConfidence: 'low',
      }),
    )
    // 三票一致但 ML 信心低 → consensus 仍 strong 但附說明
    expect(r.consensus).toBe('strong')
    expect(r.mlWeight).toBeLessThan(1) // ML 票權重 < 1
  })

  it('票數為空（rules/ml 都 null）→ 回傳 null + 補件提示', () => {
    const r = ensembleEstimate(
      input({
        rulesMid: 0,
        mlP50: 0,
        knnAvailable: false,
        knnCases: [],
      }),
    )
    expect(r.consensus).toBe('insufficient')
    expect(r.consensusAmount).toBeNull()
    expect(r.warning).toMatch(/資料不足/)
  })
})

describe('ensembleEstimate — 不變量', () => {
  it('consensusAmount 永遠 ≥ 0', () => {
    const r = ensembleEstimate(input())
    if (r.consensusAmount !== null) {
      expect(r.consensusAmount).toBeGreaterThanOrEqual(0)
    }
  })

  it('suggestedRange 下限 ≤ 上限', () => {
    const r = ensembleEstimate(
      input({
        rulesMid: 100_000,
        mlP50: 300_000,
        knnCases: [{ caseNo: 'A', amount: 50_000 }],
      }),
    )
    if (r.suggestedRange) {
      expect(r.suggestedRange.low).toBeLessThanOrEqual(r.suggestedRange.high)
    }
  })

  it('回傳每票金額獨立可讀（給 UI 顯示）', () => {
    const r = ensembleEstimate(input())
    expect(r.rulesAmount).toBe(100_000)
    expect(r.mlAmount).toBe(100_000)
    expect(r.knnAmount).toBe(100_000)
  })
})
