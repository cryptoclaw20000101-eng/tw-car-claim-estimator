// pas-table 測試 — 50 級精神慰撫金傷勢表 + Personal Factors
import { describe, it, expect } from 'vitest'
import { PAS_TABLE, personalFactorMultiplier, pasLevelIndex } from '@/lib/insurance/pas-table'

describe('PAS_TABLE', () => {
  it('has 50 levels', () => {
    expect(PAS_TABLE.length).toBe(50)
  })

  it('levels are 1-50 in order', () => {
    for (let i = 0; i < 50; i++) {
      expect(PAS_TABLE[i]!.level).toBe(i + 1)
    }
  })

  it('low < mid < high for each level', () => {
    for (const row of PAS_TABLE) {
      expect(row.low).toBeLessThanOrEqual(row.mid)
      expect(row.mid).toBeLessThanOrEqual(row.high)
    }
  })

  it('level 1 is the lowest injury anchor', () => {
    expect(PAS_TABLE[0]!.label).toContain('第 1 級')
    expect(PAS_TABLE[0]!.mid).toBe(10_000)
  })

  it('level 50 is the highest injury anchor', () => {
    const last = PAS_TABLE[49]!
    expect(last.mid).toBe(2_000_000)
    expect(last.high).toBe(2_000_000)
  })
})

describe('pasLevelIndex', () => {
  it('returns 0 for level 1', () => {
    expect(pasLevelIndex(1)).toBe(0)
  })
  it('returns 49 for level 50', () => {
    expect(pasLevelIndex(50)).toBe(49)
  })
  it('clamps to 0 for level < 1', () => {
    expect(pasLevelIndex(0)).toBe(0)
    expect(pasLevelIndex(-5)).toBe(0)
  })
  it('clamps to 49 for level > 50', () => {
    expect(pasLevelIndex(99)).toBe(49)
  })
})

describe('personalFactorMultiplier', () => {
  it('個人條件不會自動改變慰撫金', () => {
    const r = personalFactorMultiplier({
      age: 10,
      occupation: 'professional',
      dependentCount: 4,
      hasLaborLoss: true,
    })
    expect(r.multiplier).toBe(1)
    expect(r.ageFactor).toBe(1)
    expect(r.occupationFactor).toBe(1)
    expect(r.dependentFactor).toBe(1)
    expect(r.laborLossFactor).toBe(1)
  })
})
