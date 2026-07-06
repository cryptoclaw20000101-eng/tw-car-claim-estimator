// =====================================================================
// findRelatedPracticeCases KNN debug 模式（v0.7.3+）— 測試
// 守護 lib/estimate/precedents.ts 的 withKnnDebug 參數
//
// 不變量：
//   - withKnnDebug=false（預設）：回 PracticeCase[]，不附 knnDistance/knnBreakdown
//   - withKnnDebug=true：回 PracticeCaseWithKnn[]，每件附 knnDistance + knnBreakdown + knnQuery
//   - debug 模式下 knnDistance = sum(knnBreakdown)（浮點容忍 1e-9）
//   - 排序仍以 KNN distance 為主（不影響既有排序）
// =====================================================================

import { describe, it, expect } from 'vitest'
import { findRelatedPracticeCases, type PracticeCaseWithKnn } from '@/lib/estimate/precedents'

describe('findRelatedPracticeCases KNN debug 模式', () => {
  it('預設（不傳 withKnnDebug）→ 不附 knnDistance', () => {
    const refs = findRelatedPracticeCases('臺灣臺中地方法院', 7, 3)
    expect(refs.length).toBeGreaterThan(0)
    // 預設型別是 PracticeCase[]，所以 ts 上不會有 knnDistance
    // runtime 也應該沒有
    expect((refs[0] as PracticeCaseWithKnn).knnDistance).toBeUndefined()
    expect((refs[0] as PracticeCaseWithKnn).knnBreakdown).toBeUndefined()
  })

  it('withKnnDebug=true → 每件附 knnDistance + knnBreakdown + knnQuery', () => {
    const refs = findRelatedPracticeCases('臺灣臺中地方法院', 7, 3, true)
    expect(refs.length).toBeGreaterThan(0)
    for (const r of refs) {
      expect(r.knnDistance).toBeDefined()
      expect(r.knnBreakdown).toBeDefined()
      expect(r.knnQuery).toBeDefined()
    }
  })

  it('debug 模式：knnDistance = sum(knnBreakdown)', () => {
    const refs = findRelatedPracticeCases('臺灣臺中地方法院', 7, 3, true)
    for (const r of refs) {
      const breakdown = r.knnBreakdown!
      const sum =
        breakdown.city +
        breakdown.disabilityLevel +
        breakdown.year +
        breakdown.injurySeverity +
        breakdown.hasDisabilityRecord
      expect(Math.abs(sum - r.knnDistance!)).toBeLessThan(1e-9)
    }
  })

  it('debug 模式：knnQuery 反映 query 端特徵', () => {
    const refs = findRelatedPracticeCases('臺灣臺中地方法院', 7, 3, true)
    expect(refs[0].knnQuery).toBeDefined()
    expect(refs[0].knnQuery!.disabilityLevel).toBe(7)
    expect(refs[0].knnQuery!.city).toBe('臺中市') // 法院→縣市
    expect(refs[0].knnQuery!.hasDisabilityRecord).toBe(true) // 有失能等級
  })

  it('debug 模式：排序仍以 KNN distance 為主', () => {
    const refs = findRelatedPracticeCases('臺灣臺中地方法院', 7, 3, true)
    // 取前 2 件，後件 distance 應 >= 前件 distance
    for (let i = 1; i < refs.length; i++) {
      expect(refs[i].knnDistance).toBeGreaterThanOrEqual(refs[i - 1].knnDistance!)
    }
  })

  it('debug 模式：disabilities null-safe（無失能紀錄的案例仍能算 distance）', () => {
    const refs = findRelatedPracticeCases('和解', null, 3, true)
    // 不會爆，且每件都有 breakdown
    expect(refs.length).toBeGreaterThan(0)
    for (const r of refs) {
      expect(r.knnBreakdown).toBeDefined()
    }
  })

  it('debug 模式：limit 限制生效', () => {
    const refs = findRelatedPracticeCases('臺灣臺中地方法院', 7, 2, true)
    expect(refs.length).toBeLessThanOrEqual(2)
  })
})
