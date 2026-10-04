import { describe, expect, it } from 'vitest'
import {
  DISABILITY_LABOR_LOSS_PCT,
  HOFFMANN_ANNUAL_RATE,
  HOFFMANN_COEFFICIENTS,
  hoffmannCalculation,
  hoffmannCoefficient,
  hoffmannFraction,
  hoffmannYearsFromAge,
  laborLossPct,
  validateHoffmannTable,
} from '@/lib/insurance/hoffmann'

const formula = (years: number) =>
  (1 - Math.pow(1 + HOFFMANN_ANNUAL_RATE, -years)) / HOFFMANN_ANNUAL_RATE

describe('霍夫曼係數', () => {
  it('表內首年、常用年數與上限都符合 5% 公式', () => {
    expect(hoffmannCoefficient(1)).toBeCloseTo(formula(1), 12)
    expect(hoffmannCoefficient(10)).toBeCloseTo(formula(10), 12)
    expect(hoffmannCoefficient(40)).toBeCloseTo(formula(40), 12)
  })

  it('超過預算表上限時仍以相同公式計算', () => {
    expect(hoffmannCoefficient(41)).toBeCloseTo(formula(41), 12)
  })

  it('拒絕零年與負年數', () => {
    expect(() => hoffmannCoefficient(0)).toThrow('n 必須為正整數')
    expect(() => hoffmannCoefficient(-1)).toThrow('n 必須為正整數')
  })

  it('固定表完整涵蓋 1 到 40 年且內容可驗證', () => {
    expect(Object.keys(HOFFMANN_COEFFICIENTS)).toHaveLength(40)
    expect(validateHoffmannTable()).toEqual({ ok: true, mismatches: [] })
  })
})

describe('不足整年的霍夫曼比例', () => {
  it('處理零年與一年內比例', () => {
    expect(hoffmannFraction(0)).toBe(0)
    expect(hoffmannFraction(0.5)).toBeCloseTo(formula(0.5), 12)
  })

  it('整年沿用係數，餘年按既有比例規則加入', () => {
    expect(hoffmannFraction(1)).toBeCloseTo(hoffmannCoefficient(1), 12)
    expect(hoffmannFraction(1.5)).toBeCloseTo(
      hoffmannCoefficient(1) + 0.5 / HOFFMANN_ANNUAL_RATE,
      12,
    )
  })

  it('拒絕負年數', () => {
    expect(() => hoffmannFraction(-0.5)).toThrow('years 必須 >= 0')
  })
})

describe('失能勞動能力減損比例', () => {
  it('守護最重與最輕等級邊界', () => {
    expect(laborLossPct(1)).toBe(1)
    expect(laborLossPct(15)).toBe(0.05)
    expect(Object.keys(DISABILITY_LABOR_LOSS_PCT)).toHaveLength(15)
  })

  it('拒絕表外等級', () => {
    expect(() => laborLossPct(0)).toThrow('僅 1-15')
    expect(() => laborLossPct(16)).toThrow('僅 1-15')
  })
})

describe('霍夫曼一次性清償試算', () => {
  it('逐步四捨五入並保留完整輸入明細', () => {
    const input = {
      annualAmount: 480_000,
      years: 30,
      lossPercent: 0.5,
      annualIncome: 480_000,
      regionalMultiplier: 1.1,
    }
    const coefficient = hoffmannCoefficient(input.years)
    const baseTotal = Math.round(input.annualAmount * coefficient)
    const adjustedTotal = Math.round(baseTotal * input.lossPercent)

    expect(hoffmannCalculation(input)).toEqual({
      coefficient: Math.round(coefficient * 10_000) / 10_000,
      baseTotal,
      adjustedTotal,
      finalTotal: Math.round(adjustedTotal * input.regionalMultiplier),
      breakdown: input,
    })
  })
})

describe('工作年數推算', () => {
  it('預設以 65 歲退休計算', () => {
    expect(hoffmannYearsFromAge(35)).toBe(30)
  })

  it('支援自訂退休年齡，已退休者不會得到負年數', () => {
    expect(hoffmannYearsFromAge(30, 60)).toBe(30)
    expect(hoffmannYearsFromAge(70, 65)).toBe(0)
  })

  it('拒絕負年齡', () => {
    expect(() => hoffmannYearsFromAge(-1)).toThrow('年齡不可為負')
    expect(() => hoffmannYearsFromAge(30, -1)).toThrow('年齡不可為負')
  })
})
