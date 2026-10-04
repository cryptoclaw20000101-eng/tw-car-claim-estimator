import { describe, expect, it } from 'vitest'
import {
  combineDisabilityBenefits,
  disabilityBenefitTableNew,
} from '@/lib/insurance/disability-tables'

describe('強制險失能給付標準第 4 條', () => {
  it('兩項第 11 等失能，最高等級升 1 等為第 10 等', () => {
    const result = combineDisabilityBenefits([11, 11], disabilityBenefitTableNew)
    expect(result.level).toBe(10)
    expect(result.amount).toBe(550_000)
  })

  it('兩項第 8 等失能，最高等級升 2 等為第 6 等', () => {
    const result = combineDisabilityBenefits([8, 8], disabilityBenefitTableNew)
    expect(result.level).toBe(6)
    expect(result.amount).toBe(1_350_000)
  })

  it('兩項第 5 等失能，最高等級升 3 等為第 2 等', () => {
    const result = combineDisabilityBenefits([5, 5], disabilityBenefitTableNew)
    expect(result.level).toBe(2)
    expect(result.amount).toBe(2_500_000)
  })
})
