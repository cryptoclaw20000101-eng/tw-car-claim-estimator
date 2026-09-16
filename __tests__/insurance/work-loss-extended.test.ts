// =====================================================================
// 工作損失擴充情境 — 單元測試
// =====================================================================

import { describe, it, expect } from 'vitest'
import {
  computeWorkLossExtended,
  WORK_LOSS_SHORT_TERM_MONTHS,
} from '@/lib/insurance/work-loss-extended'
import type { PersonalIncome } from '@/lib/insurance/types'

const basePerson: Pick<
  PersonalIncome,
  | 'age'
  | 'sixMonthAverageSalary'
  | 'monthlySalary'
  | 'dailyWage'
  | 'lastYearTaxableIncome'
  | 'actualLeaveDays'
  | 'doctorOrderedRestDays'
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
    expect(r.breakdown.dailyIncome).toBe(1333)
    expect(r.amount).toBe(80_000)
    expect(r.regionalMultiplier).toBe(1)
  })

  it('240 日 (8 月) 休養 → 長期 → 霍夫曼情境', () => {
    const r = computeWorkLossExtended({
      person: { ...basePerson, actualLeaveDays: 240, doctorOrderedRestDays: 240 },
      courtName: '臺灣臺中地方法院',
    })
    expect(r.calculationType).toBe('long_term')
    expect(r.hoffmannYears).toBe(1)
    expect(r.hoffmannFactor).toBeGreaterThan(0)
    expect(r.amount).toBeGreaterThan(50_000)
  })

  it('症狀固定本身不強制切換長期；永久減損另走勞減模組', () => {
    const r = computeWorkLossExtended({
      person: { ...basePerson, actualLeaveDays: 30, doctorOrderedRestDays: 30 },
      courtName: '臺灣臺中地方法院',
      isSymptomFixed: true,
    })
    expect(r.calculationType).toBe('short_term')
    expect(r.notes.join('|')).toContain('不因此自動延長')
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
    expect(r.amount).toBe(90_000)
  })

  it('不同法院不應用精神慰撫金地區倍率改變同一薪資損失', () => {
    const taichung = computeWorkLossExtended({
      person: basePerson,
      courtName: '臺灣臺中地方法院',
    })
    const taipei = computeWorkLossExtended({
      person: basePerson,
      courtName: '臺灣臺北地方法院',
    })

    expect(taichung.regionalMultiplier).toBe(1)
    expect(taipei.regionalMultiplier).toBe(1)
    expect(taipei.amount).toBe(taichung.amount)
    expect(taipei.amount).toBe(80_000)
  })

  it('65 歲且進入長期情境 → 不自動改稱慰撫金，改提示人工確認工作狀態', () => {
    const r = computeWorkLossExtended({
      person: { ...basePerson, age: 65, actualLeaveDays: 240, doctorOrderedRestDays: 240 },
      courtName: '臺灣臺中地方法院',
    })
    expect(r.amount).toBe(0)
    expect(r.notes.join('|')).toContain('人工確認')
    expect(r.hint).toContain('實際就業')
  })

  it('WORK_LOSS_SHORT_TERM_MONTHS = 6（API 穩定性）', () => {
    expect(WORK_LOSS_SHORT_TERM_MONTHS).toBe(6)
  })
})
