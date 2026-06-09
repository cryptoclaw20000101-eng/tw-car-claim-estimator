// =====================================================================
// 工作損失擴充版 — 單元測試
// =====================================================================

import { describe, it, expect } from 'vitest'
import {
  computeWorkLossExtended,
  WORK_LOSS_SHORT_TERM_MONTHS,
} from '@/lib/insurance/work-loss-extended'
import type { PersonalIncome } from '@/lib/insurance/types'

const basePerson: Pick<
  PersonalIncome,
  'age' | 'sixMonthAverageSalary' | 'monthlySalary' | 'dailyWage' | 'lastYearTaxableIncome' | 'actualLeaveDays' | 'doctorOrderedRestDays'
> = {
  age: 35,
  sixMonthAverageSalary: 40_000,
  monthlySalary: 40_000,
  dailyWage: 0,
  lastYearTaxableIncome: 480_000,
  actualLeaveDays: 60,
  doctorOrderedRestDays: 60,
}

describe('computeWorkLossExtended', () => {
  it('無請假 / 無醫囑 → 0 / none', () => {
    const r = computeWorkLossExtended({
      person: { ...basePerson, actualLeaveDays: 0, doctorOrderedRestDays: 0 },
      courtName: '臺灣臺中地方法院',
    })
    expect(r.amount).toBe(0)
    expect(r.calculationType).toBe('none')
  })

  it('60 日 (2 月) 休養 → 短期 → 日薪制', () => {
    const r = computeWorkLossExtended({
      person: basePerson,
      courtName: '臺灣臺中地方法院',
    })
    expect(r.calculationType).toBe('short_term')
    // 6 月均薪 / 30 = 40000/30 ≈ 1333/日
    // 60 日 × 1333 = 80,000
    expect(r.breakdown.dailyIncome).toBe(1333)
    // 80000 × 1.0 (台中係數) = 80,000
    expect(r.amount).toBe(80_000)
  })

  it('240 日 (8 月) 休養 → 長期 → 撫養費式霍夫曼', () => {
    const r = computeWorkLossExtended({
      person: { ...basePerson, actualLeaveDays: 240, doctorOrderedRestDays: 240 },
      courtName: '臺灣臺中地方法院',
    })
    expect(r.calculationType).toBe('long_term')
    // 休養 8 月、35 歲 → 霍夫曼年數 min(65-35=30, max(0.66, 1)=1) = 1
    // 但休養 < 1 年 → 走 hoffmannFraction(0.66) ≈ 0.66/0.05 × ...（按公式）
    expect(r.hoffmannYears).toBe(1)  // min(30, max(0.66, 1))
    expect(r.hoffmannFactor).toBeGreaterThan(0)
    expect(r.amount).toBeGreaterThan(50_000)  // 至少有年損失 × 比例
  })

  it('症狀固定 → 強制長期計算', () => {
    const r = computeWorkLossExtended({
      person: { ...basePerson, actualLeaveDays: 30, doctorOrderedRestDays: 30 },
      courtName: '臺灣臺中地方法院',
      isSymptomFixed: true,
    })
    expect(r.calculationType).toBe('long_term')
    expect(r.hint).toContain('症狀固定')
  })

  it('日領者 → 用日薪', () => {
    const r = computeWorkLossExtended({
      person: {
        ...basePerson,
        sixMonthAverageSalary: 0,
        monthlySalary: 0,
        dailyWage: 1_500,
      },
      courtName: '臺灣臺中地方法院',
    })
    expect(r.breakdown.dailyIncome).toBe(1_500)
    // 1500 × 60 = 90,000
    expect(r.amount).toBe(90_000)
  })

  it('臺北地院（係數 1.10）→ 短期加成 10%', () => {
    const r = computeWorkLossExtended({
      person: basePerson,
      courtName: '臺灣臺北地方法院',
    })
    expect(r.regionalMultiplier).toBe(1.10)
    // 80000 × 1.10 = 88,000
    expect(r.amount).toBe(88_000)
  })

  it('65 歲 → 霍夫曼年數 0 → 提示退休', () => {
    const r = computeWorkLossExtended({
      person: { ...basePerson, age: 65, actualLeaveDays: 240, doctorOrderedRestDays: 240 },
      courtName: '臺灣臺中地方法院',
    })
    expect(r.amount).toBe(0)
    expect(r.notes.some(n => n.includes('退休') || n.includes('慰撫金'))).toBe(true)
    expect(r.hint).toContain('退休')
  })

  it('WORK_LOSS_SHORT_TERM_MONTHS = 6（API 穩定性）', () => {
    expect(WORK_LOSS_SHORT_TERM_MONTHS).toBe(6)
  })
})
