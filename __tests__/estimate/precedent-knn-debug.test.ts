// =====================================================================
// KNN 5 維距離拆解（v0.7.3+ debug panel 用）— 測試
// 守護 lib/estimate/precedent-knn.ts 的 computeDimensionDistances
//
// 不變量：
//   - sum(breakdown) === computePrecedentDistance(a, b)
//   - 每維值 ∈ [0, 1]
//   - city null vs null → 0
//   - city null vs value → 0.5
//   - 對稱：breakdown(a, b) === breakdown(b, a)
// =====================================================================

import { describe, it, expect } from 'vitest'
import {
  computeDimensionDistances,
  computePrecedentDistance,
  type PrecedentFeatures,
} from '@/lib/estimate/precedent-knn'

const F_A: PrecedentFeatures = {
  city: '臺中市',
  disabilityLevel: 7,
  year: 2024,
  injurySeverity: 'moderate',
  hasDisabilityRecord: true,
}

describe('computeDimensionDistances 不變量', () => {
  it('完全相同 → 全部 0', () => {
    const b = computeDimensionDistances(F_A, F_A)
    expect(b.city).toBe(0)
    expect(b.disabilityLevel).toBe(0)
    expect(b.year).toBe(0)
    expect(b.injurySeverity).toBe(0)
    expect(b.hasDisabilityRecord).toBe(0)
  })

  it('5 維加總 = computePrecedentDistance 加總', () => {
    const F_B: PrecedentFeatures = {
      city: '臺北市',
      disabilityLevel: 10,
      year: 2020,
      injurySeverity: 'severe',
      hasDisabilityRecord: false,
    }
    const breakdown = computeDimensionDistances(F_A, F_B)
    const sum =
      breakdown.city +
      breakdown.disabilityLevel +
      breakdown.year +
      breakdown.injurySeverity +
      breakdown.hasDisabilityRecord
    const total = computePrecedentDistance(F_A, F_B)
    // 浮點容忍 1e-9
    expect(Math.abs(sum - total)).toBeLessThan(1e-9)
  })

  it('5 維全極端 → 距離 5', () => {
    const F_EXTREME: PrecedentFeatures = {
      city: '高雄市',
      disabilityLevel: 15,
      year: 2000,
      injurySeverity: 'death',
      hasDisabilityRecord: false,
    }
    const b = computeDimensionDistances(F_A, F_EXTREME)
    // city 不同 = 1, level = |7-15|/15 = 0.533, year = |2024-2000|/26 = 0.923,
    // injury = |2-4|/4 = 0.5, disability = 1
    // total = 1 + 0.533 + 0.923 + 0.5 + 1 = 3.956
    expect(b.city).toBe(1)
    expect(b.disabilityLevel).toBeCloseTo(8 / 15, 3)
    expect(b.year).toBeCloseTo(24 / 26, 3)
    expect(b.injurySeverity).toBe(0.5)
    expect(b.hasDisabilityRecord).toBe(1)
  })

  it('city null vs null → 0（不懲罰未知）', () => {
    const f1: PrecedentFeatures = { ...F_A, city: null }
    const f2: PrecedentFeatures = { ...F_A, city: null }
    const b = computeDimensionDistances(f1, f2)
    expect(b.city).toBe(0)
  })

  it('city null vs value → 0.5（中性）', () => {
    const f1: PrecedentFeatures = { ...F_A, city: null }
    const f2: PrecedentFeatures = { ...F_A, city: '臺北市' }
    const b = computeDimensionDistances(f1, f2)
    expect(b.city).toBe(0.5)
  })

  it('city value vs null → 0.5（對稱）', () => {
    const f1: PrecedentFeatures = { ...F_A, city: '臺北市' }
    const f2: PrecedentFeatures = { ...F_A, city: null }
    const b = computeDimensionDistances(f1, f2)
    expect(b.city).toBe(0.5)
  })

  it('disability_level 兩邊 null → 0', () => {
    const f1: PrecedentFeatures = { ...F_A, disabilityLevel: null }
    const f2: PrecedentFeatures = { ...F_A, disabilityLevel: null }
    const b = computeDimensionDistances(f1, f2)
    expect(b.disabilityLevel).toBe(0)
  })

  it('disability_level 一邊 null → 0.5（中性）', () => {
    const f1: PrecedentFeatures = { ...F_A, disabilityLevel: 7 }
    const f2: PrecedentFeatures = { ...F_A, disabilityLevel: null }
    const b = computeDimensionDistances(f1, f2)
    expect(b.disabilityLevel).toBe(0.5)
  })

  it('injury_severity 兩邊 null → 0', () => {
    const f1: PrecedentFeatures = { ...F_A, injurySeverity: null }
    const f2: PrecedentFeatures = { ...F_A, injurySeverity: null }
    const b = computeDimensionDistances(f1, f2)
    expect(b.injurySeverity).toBe(0)
  })

  it('injury_severity ordinal 差正確', () => {
    // moderate=2 vs severe=3 → |2-3|/4 = 0.25
    const f1: PrecedentFeatures = { ...F_A, injurySeverity: 'moderate' }
    const f2: PrecedentFeatures = { ...F_A, injurySeverity: 'severe' }
    const b = computeDimensionDistances(f1, f2)
    expect(b.injurySeverity).toBeCloseTo(0.25, 3)
  })

  it('hasDisabilityRecord 一致 → 0', () => {
    const b = computeDimensionDistances(F_A, { ...F_A, hasDisabilityRecord: true })
    expect(b.hasDisabilityRecord).toBe(0)
  })

  it('hasDisabilityRecord 不一致 → 1', () => {
    const b = computeDimensionDistances(F_A, { ...F_A, hasDisabilityRecord: false })
    expect(b.hasDisabilityRecord).toBe(1)
  })

  it('對稱：breakdown(a, b) === breakdown(b, a)', () => {
    const F_B: PrecedentFeatures = {
      city: '臺北市',
      disabilityLevel: 10,
      year: 2020,
      injurySeverity: 'severe',
      hasDisabilityRecord: false,
    }
    const ab = computeDimensionDistances(F_A, F_B)
    const ba = computeDimensionDistances(F_B, F_A)
    expect(ab.city).toBe(ba.city)
    expect(ab.disabilityLevel).toBe(ba.disabilityLevel)
    expect(ab.year).toBe(ba.year)
    expect(ab.injurySeverity).toBe(ba.injurySeverity)
    expect(ab.hasDisabilityRecord).toBe(ba.hasDisabilityRecord)
  })

  it('year 差 26 年 → 1（正規化上限）', () => {
    const f: PrecedentFeatures = { ...F_A, year: 2000 }
    const b = computeDimensionDistances(F_A, f)
    expect(b.year).toBeCloseTo(24 / 26, 3)
  })

  it('disability_level 差 15 → 1（正規化上限）', () => {
    const f: PrecedentFeatures = { ...F_A, disabilityLevel: 15 }
    const b = computeDimensionDistances(F_A, f)
    expect(b.disabilityLevel).toBeCloseTo(8 / 15, 3)
  })
})
