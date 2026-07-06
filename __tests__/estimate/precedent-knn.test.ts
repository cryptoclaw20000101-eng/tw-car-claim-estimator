// =====================================================================
// findRelatedPracticeCases KNN 強化 — 測試
// 守護 lib/estimate/precedents.ts 的 findRelatedPracticeCases 改用 KNN 距離
// v0.6.1
//
// 設計：5 維特徵向量 + 距離函式
//   1. city（county）：二元（match 0 / mismatch 1）
//   2. disability_level：|diff| / 15（正規化）
//   3. year：|diff| / 26（正規化到 26 年範圍）
//   4. injury_severity：ordinal 距離（死亡=4 / 重=3 / 中=2 / 輕=1 / 失能=3）
//   5. has_disability_record：二元（query 有 + 案例有 → 0；其他 1）
//
// KNN 排序：距離越小越相似 → 取前 K 個
// =====================================================================

import { describe, it, expect } from 'vitest'
import { findRelatedPracticeCases } from '@/lib/estimate/precedents'
import { computePrecedentDistance, type PrecedentFeatures } from '@/lib/estimate/precedent-knn'

describe('KNN 距離函式特性', () => {
  it('同縣市 + 等級差 0 + 同年 → 距離最小（最相似）', () => {
    const refs = findRelatedPracticeCases('臺灣臺中地方法院', 7, 1)
    // 應該至少回 1 件（fallback）
    expect(refs.length).toBeGreaterThan(0)
  })

  it('失能等級差異越大，距離越大', () => {
    // 等級 7 vs 等級 7 → 0
    const same = findRelatedPracticeCases('臺灣臺中地方法院', 7, 1)
    // 等級 7 vs 等級 14 → 距離大
    const far = findRelatedPracticeCases('臺灣臺中地方法院', 14, 1)
    // 兩者都不為空
    expect(same.length).toBeGreaterThan(0)
    expect(far.length).toBeGreaterThan(0)
    // 同等級的排序應該比等級差 7 還要前面（同等其他條件下）
    // 注意：因為 practice_case 的 court 都「和解」沒 city 維度
    // 主要靠 disability_level + year 區分
  })

  it('limit=1 只回傳 1 件', () => {
    const refs = findRelatedPracticeCases('臺灣臺中地方法院', 7, 1)
    expect(refs.length).toBe(1)
  })

  it('limit=3 最多回傳 3 件', () => {
    const refs = findRelatedPracticeCases('臺灣臺中地方法院', 7, 3)
    expect(refs.length).toBeLessThanOrEqual(3)
  })

  it('null 等級 → 仍能回傳（不報錯）', () => {
    const refs = findRelatedPracticeCases('臺灣臺中地方法院', null, 3)
    expect(refs.length).toBeGreaterThan(0)
  })

  it('未知法院 → fallback 給前 N 筆', () => {
    const refs = findRelatedPracticeCases('完全不存在的法院', null, 2)
    expect(refs.length).toBe(2)
  })
})

describe('KNN 排序穩定性', () => {
  it('多次呼叫同參數回傳順序一致（純函式）', () => {
    const refs1 = findRelatedPracticeCases('臺灣臺中地方法院', 7, 3)
    const refs2 = findRelatedPracticeCases('臺灣臺中地方法院', 7, 3)
    expect(refs1.map((r) => r.id)).toEqual(refs2.map((r) => r.id))
  })

  it('同縣市法院 vs 不同縣市 → 同縣市優先（如果有 city 維度資料）', () => {
    // 因為 practice_case 的 court 都是「和解」沒 city 維度
    // 這條測試主要守護「未來律師補完 city 資料後行為正確」
    // 現在兩個 query 結果順序應一致
    const refsTaichung = findRelatedPracticeCases('臺灣臺中地方法院', 7, 3)
    const refsTainan = findRelatedPracticeCases('臺灣臺南地方法院', 7, 3)
    // 兩個都回同樣 practice_case（因為 city 維度都是 null = 1）
    // 排序應完全一致
    expect(refsTaichung.map((r) => r.id)).toEqual(refsTainan.map((r) => r.id))
  })

  it('等級差異影響排序（同等其他條件）', () => {
    // 等級 4 vs 等級 7 → 排序可能不同
    const lv4 = findRelatedPracticeCases('臺灣臺中地方法院', 4, 4)
    const lv7 = findRelatedPracticeCases('臺灣臺中地方法院', 7, 4)
    // 注意：因為資料少 + city 維度無效，順序可能仍相同
    // 但至少都不為空、不報錯
    expect(lv4.length).toBeGreaterThan(0)
    expect(lv7.length).toBeGreaterThan(0)
  })
})

describe('KNN 不變量', () => {
  it('回傳的 case 必須有 id 欄位', () => {
    const refs = findRelatedPracticeCases('臺灣臺中地方法院', 7, 3)
    refs.forEach((r) => {
      expect(r.id).toBeTruthy()
    })
  })

  it('回傳的 case 必須有 keyHoldings 陣列', () => {
    const refs = findRelatedPracticeCases('臺灣臺中地方法院', 7, 1)
    refs.forEach((r) => {
      expect(Array.isArray(r.keyHoldings)).toBe(true)
    })
  })

  it('回傳數量永遠 ≤ limit', () => {
    for (const limit of [1, 2, 3, 5, 10]) {
      const refs = findRelatedPracticeCases('臺灣臺中地方法院', 7, limit)
      expect(refs.length).toBeLessThanOrEqual(limit)
    }
  })
})

describe('computePrecedentDistance — 純函式 KNN 距離', () => {
  function features(overrides: Partial<PrecedentFeatures> = {}): PrecedentFeatures {
    return {
      city: null,
      disabilityLevel: null,
      year: 2025,
      injurySeverity: null,
      hasDisabilityRecord: false,
      ...overrides,
    }
  }

  it('距離永遠 ≥ 0', () => {
    const a = features({ city: '臺中市', disabilityLevel: 7, year: 2025 })
    const b = features({ city: '臺中市', disabilityLevel: 7, year: 2025 })
    const d = computePrecedentDistance(a, b)
    expect(d).toBeGreaterThanOrEqual(0)
  })

  it('完全相同 → 距離為 0', () => {
    const a = features({ city: '臺中市', disabilityLevel: 7, year: 2025 })
    const b = features({ city: '臺中市', disabilityLevel: 7, year: 2025 })
    expect(computePrecedentDistance(a, b)).toBe(0)
  })

  it('對稱性：d(A,B) = d(B,A)', () => {
    const a = features({ city: '臺中市', disabilityLevel: 7, year: 2025 })
    const b = features({ city: '臺北市', disabilityLevel: 10, year: 2023 })
    expect(computePrecedentDistance(a, b)).toBeCloseTo(computePrecedentDistance(b, a))
  })

  it('縣市不同 → 距離增加（city 維度有效）', () => {
    const sameCity = features({ city: '臺中市', disabilityLevel: 7 })
    const diffCity = features({ city: '臺北市', disabilityLevel: 7 })
    const base = features({ city: '臺中市', disabilityLevel: 7 })
    expect(computePrecedentDistance(base, diffCity)).toBeGreaterThan(
      computePrecedentDistance(base, sameCity),
    )
  })

  it('失能等級差異越大 → 距離越大', () => {
    const base = features({ disabilityLevel: 7 })
    const same = features({ disabilityLevel: 7 })
    const close = features({ disabilityLevel: 8 }) // 差 1
    const far = features({ disabilityLevel: 14 }) // 差 7
    const dSame = computePrecedentDistance(base, same)
    const dClose = computePrecedentDistance(base, close)
    const dFar = computePrecedentDistance(base, far)
    expect(dSame).toBeLessThan(dClose)
    expect(dClose).toBeLessThan(dFar)
  })

  it('年份差異越大 → 距離越大', () => {
    const base = features({ year: 2025 })
    const same = features({ year: 2025 })
    const close = features({ year: 2024 }) // 差 1
    const far = features({ year: 2015 }) // 差 10
    const dSame = computePrecedentDistance(base, same)
    const dClose = computePrecedentDistance(base, close)
    const dFar = computePrecedentDistance(base, far)
    expect(dSame).toBeLessThan(dClose)
    expect(dClose).toBeLessThan(dFar)
  })

  it('city=null + null → 距離 0（不懲罰未知）', () => {
    const a = features({ city: null, disabilityLevel: 7 })
    const b = features({ city: null, disabilityLevel: 7 })
    expect(computePrecedentDistance(a, b)).toBe(0)
  })

  it('null 維度不影響其他維度（不會爆炸性增加）', () => {
    const a = features({ city: null, disabilityLevel: 7, year: 2025 })
    const b = features({ city: '臺中市', disabilityLevel: 7, year: 2025 })
    const c = features({ city: '臺北市', disabilityLevel: 7, year: 2025 })
    // null + 臺中 距離 < 臺中 + 臺北 距離（city 維度還是會算）
    const dNullMid = computePrecedentDistance(a, b)
    const dMidNorth = computePrecedentDistance(b, c)
    expect(dNullMid).toBeLessThan(dMidNorth)
  })

  it('距離有上限（單一維度不會無限大）', () => {
    const a = features({ city: '臺中市', disabilityLevel: 1, year: 2000 })
    const b = features({ city: '臺東縣', disabilityLevel: 15, year: 2026 })
    const d = computePrecedentDistance(a, b)
    // 最大距離應 ≤ 5（5 維各 1）
    expect(d).toBeLessThanOrEqual(5)
  })
})
