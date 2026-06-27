/**
 * 共用 Ensemble 健康度純函式測試（v0.6.9+）
 *
 * lib/insurance/pain-ensemble-health.ts 從 scripts/report-precedents.ts 抽出來
 * 給首頁 hero + 報表 + 未來 API route 共用。本檔驗證純函式邏輯正確。
 */
import { describe, it, expect } from 'vitest'
import {
  computeEnsembleHealth,
  CONFIDENCE_META,
  type PrecedentRow,
} from '@/lib/insurance/pain-ensemble-health'

describe('computeEnsembleHealth 純函式', () => {
  it('空陣列 → anchorN=0 + confidence=none', () => {
    const r = computeEnsembleHealth([])
    expect(r.anchorN).toBe(0)
    expect(r.anchorMedian).toBe(0)
    expect(r.anchorP10).toBe(0)
    expect(r.anchorP90).toBe(0)
    expect(r.confidenceLevel).toBe('none')
    expect(r.injuryGradientWarning).toBeNull()
  })

  it('20 件 → confidence=high', () => {
    const rows: PrecedentRow[] = Array.from({ length: 20 }, (_, i) => ({
      amount: (i + 1) * 10000,
      court: 'court-A',
      category: 'minor_injury',
    }))
    const r = computeEnsembleHealth(rows)
    expect(r.anchorN).toBe(20)
    expect(r.confidenceLevel).toBe('high')
    expect(r.confidenceTip).toContain('可啟動 XGBoost')
  })

  it('10~19 件 → confidence=medium', () => {
    const rows: PrecedentRow[] = Array.from({ length: 15 }, (_, i) => ({
      amount: (i + 1) * 10000,
    }))
    const r = computeEnsembleHealth(rows)
    expect(r.anchorN).toBe(15)
    expect(r.confidenceLevel).toBe('medium')
  })

  it('5~9 件 → confidence=low', () => {
    const rows: PrecedentRow[] = Array.from({ length: 7 }, (_, i) => ({
      amount: (i + 1) * 10000,
    }))
    const r = computeEnsembleHealth(rows)
    expect(r.anchorN).toBe(7)
    expect(r.confidenceLevel).toBe('low')
  })

  it('0 元（amount=0）不計入 anchorN', () => {
    const rows: PrecedentRow[] = [
      { amount: 0 },
      { amount: 50000 },
      { amount: 0 },
      { amount: 100000 },
    ]
    const r = computeEnsembleHealth(rows)
    expect(r.anchorN).toBe(2)
  })

  it('mentalDistressAmount fallback 到 amount 為 0 時', () => {
    const rows: PrecedentRow[] = [
      { mentalDistressAmount: 80000 },
      { mentalDistressAmount: 0 },
      { amount: 120000 },
    ]
    const r = computeEnsembleHealth(rows)
    expect(r.anchorN).toBe(2) // 80000 + 120000
  })

  it('單一傷勢類別 → injuryGradientWarning 觸發「梯度為 0」', () => {
    const rows: PrecedentRow[] = Array.from({ length: 50 }, () => ({
      amount: 100000,
      category: 'minor_injury',
    }))
    const r = computeEnsembleHealth(rows)
    expect(r.injuryGradientWarning).toContain('傷勢梯度為 0')
    expect(r.injuryGradientWarning).toContain('minor_injury')
  })

  it('兩類別且一類 ≥90% → injuryGradientWarning 觸發「偏置風險高」', () => {
    const rows: PrecedentRow[] = [
      ...Array.from({ length: 95 }, () => ({ amount: 100000, category: 'minor_injury' })),
      ...Array.from({ length: 5 }, () => ({ amount: 200000, category: 'death' })),
    ]
    const r = computeEnsembleHealth(rows)
    expect(r.injuryGradientWarning).toContain('XGBoost 偏置風險高')
  })

  it('兩類別 60/40 → 無 injuryGradientWarning', () => {
    const rows: PrecedentRow[] = [
      ...Array.from({ length: 6 }, () => ({ amount: 100000, category: 'minor_injury' })),
      ...Array.from({ length: 4 }, () => ({ amount: 200000, category: 'death' })),
    ]
    const r = computeEnsembleHealth(rows)
    expect(r.injuryGradientWarning).toBeNull()
  })

  it('法院中位數 Top 8 + 件數排序', () => {
    const rows: PrecedentRow[] = [
      // court-A: 10 件，median=100K
      ...Array.from({ length: 10 }, () => ({ amount: 100000, court: 'A' })),
      // court-B: 5 件
      ...Array.from({ length: 5 }, () => ({ amount: 200000, court: 'B' })),
      // court-C: 1 件
      { amount: 500000, court: 'C' },
    ]
    const r = computeEnsembleHealth(rows)
    expect(r.courtMedians[0].court).toBe('A')
    expect(r.courtMedians[0].n).toBe(10)
    expect(r.courtMedians[0].median).toBe(100000)
    expect(r.courtMedians.length).toBe(3) // 只有 3 個法院
  })
})

describe('CONFIDENCE_META 顯示標籤', () => {
  it('4 等級標籤齊全（high/medium/low/none）', () => {
    expect(CONFIDENCE_META.high.label).toBe('high')
    expect(CONFIDENCE_META.medium.label).toBe('medium')
    expect(CONFIDENCE_META.low.label).toBe('low')
    expect(CONFIDENCE_META.none.label).toBe('none')
  })

  it('4 等級顏色用 Tailwind text-* class（hero 卡對齊 taste-skill）', () => {
    expect(CONFIDENCE_META.high.color).toMatch(/emerald/)
    expect(CONFIDENCE_META.medium.color).toMatch(/amber/)
    expect(CONFIDENCE_META.low.color).toMatch(/red/)
    expect(CONFIDENCE_META.none.color).toMatch(/gray/)
  })
})

describe('EnsembleHealth 型別契約', () => {
  it('結果必含 4 組指標（anchor / court / confidence / injury）', () => {
    const r = computeEnsembleHealth([])
    expect(r.anchorFile).toBe('taipei-mental-distress.json')
    expect(Array.isArray(r.courtMedians)).toBe(true)
    expect(Array.isArray(r.injuryCoverage)).toBe(true)
    expect(['high', 'medium', 'low', 'none']).toContain(r.confidenceLevel)
  })
})
