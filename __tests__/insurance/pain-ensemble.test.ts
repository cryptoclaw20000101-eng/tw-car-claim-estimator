// =====================================================================
// 精神慰撫金 Ensemble — legal-audit regression tests
// =====================================================================

import { describe, it, expect } from 'vitest'
import { ensembleEstimate, computeConsensus } from '@/lib/insurance/pain-ensemble'
import type { EnsembleInput } from '@/lib/insurance/pain-ensemble'

function painCase(caseNo: string, amount: number) {
  return { caseNo, amount, targetKind: 'pain_and_suffering' as const }
}

function input(overrides: Partial<EnsembleInput> = {}): EnsembleInput {
  return {
    rulesMid: 100_000,
    mlP50: 100_000,
    knnCases: [painCase('A', 100_000), painCase('B', 100_000), painCase('C', 100_000)],
    mlConfidence: 'medium',
    knnAvailable: true,
    ...overrides,
  }
}

describe('computeConsensus — 共識度判定', () => {
  it('三票差距 ≤ 20%：strong', () => {
    expect(computeConsensus(100_000, 100_000, [100_000]).consensus).toBe('strong')
  })

  it('兩票接近 + KNN outlier：partial', () => {
    const r = computeConsensus(100_000, 100_000, [200_000])
    expect(r.consensus).toBe('partial')
    expect(r.outlier).toBe('knn')
  })

  it('三票分散：weak', () => {
    expect(computeConsensus(100_000, 200_000, [50_000]).consensus).toBe('weak')
  })
})

describe('ensembleEstimate — verified KNN target only', () => {
  it('已驗證的慰撫金案例可進 KNN', () => {
    const r = ensembleEstimate(input())
    expect(r.consensus).toBe('strong')
    expect(r.consensusAmount).toBe(100_000)
    expect(r.knnAmount).toBe(100_000)
  })

  it('民事總和解金沒有 targetKind 時不得當成精神慰撫金', () => {
    const r = ensembleEstimate(
      input({
        knnCases: [{ caseNo: 'TOTAL-SETTLEMENT', amount: 1_800_000 }],
      }),
    )
    expect(r.knnAmount).toBeNull()
    expect(r.knnWeight).toBe(0)
    expect(r.warning).toMatch(/標籤污染|未提供可驗證/)
    // 規則 + ML 仍可形成兩票共識，不會被 180 萬總和解金拉高。
    expect(r.consensusAmount).toBe(100_000)
  })

  it('KNN 不可用：規則 + ML 仍可計算', () => {
    const r = ensembleEstimate(input({ knnAvailable: false, knnCases: [] }))
    expect(r.consensus).toBe('strong')
    expect(r.consensusAmount).toBe(100_000)
    expect(r.knnAmount).toBeNull()
  })

  it('partial 共識會排除 outlier', () => {
    const r = ensembleEstimate(input({ knnCases: [painCase('A', 200_000)] }))
    expect(r.consensus).toBe('partial')
    expect(r.outlier).toBe('knn')
    expect(r.consensusAmount).toBe(100_000)
  })

  it('ML confidence=low 時降低 ML 權重', () => {
    const r = ensembleEstimate(input({ mlConfidence: 'low' }))
    expect(r.mlWeight).toBeLessThan(1)
  })

  it('無可用票數時 insufficient', () => {
    const r = ensembleEstimate(
      input({ rulesMid: 0, mlP50: 0, knnAvailable: false, knnCases: [] }),
    )
    expect(r.consensus).toBe('insufficient')
    expect(r.consensusAmount).toBeNull()
  })
})
