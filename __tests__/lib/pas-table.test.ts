// pas-table 測試 — 15 級精神慰撫金表 + Personal Factors
import { describe, it, expect } from 'vitest'
import { PAS_TABLE, personalFactorMultiplier, pasLevelIndex } from '@/lib/insurance/pas-table'

describe('PAS_TABLE', () => {
  it('has 15 levels', () => {
    expect(PAS_TABLE.length).toBe(15)
  })

  it('levels are 1-15 in order', () => {
    for (let i = 0; i < 15; i++) {
      expect(PAS_TABLE[i]!.level).toBe(i + 1)
    }
  })

  it('low < mid < high for each level', () => {
    for (const row of PAS_TABLE) {
      expect(row.low).toBeLessThanOrEqual(row.mid)
      expect(row.mid).toBeLessThanOrEqual(row.high)
    }
  })

  it('level 1 (極輕微) is the lowest', () => {
    expect(PAS_TABLE[0]!.label).toContain('極輕微')
    expect(PAS_TABLE[0]!.mid).toBe(20_000)
  })

  it('level 15 (失能重度) is the highest', () => {
    const last = PAS_TABLE[14]!
    expect(last.mid).toBe(5_000_000)
    expect(last.high).toBe(8_000_000)
  })
})

describe('pasLevelIndex', () => {
  it('returns 0 for level 1', () => {
    expect(pasLevelIndex(1)).toBe(0)
  })
  it('returns 14 for level 15', () => {
    expect(pasLevelIndex(15)).toBe(14)
  })
  it('clamps to 0 for level < 1', () => {
    expect(pasLevelIndex(0)).toBe(0)
    expect(pasLevelIndex(-5)).toBe(0)
  })
  it('clamps to 14 for level > 15', () => {
    expect(pasLevelIndex(99)).toBe(14)
  })
})

describe('personalFactorMultiplier', () => {
  it('default mid-age employed no dependents = 1.0x', () => {
    const r = personalFactorMultiplier({
      age: 35,
      occupation: 'employed',
      dependentCount: 0,
      hasLaborLoss: false,
    })
    expect(r.multiplier).toBe(1.0)
    expect(r.ageNote).toBeNull()
    expect(r.occupationNote).toBeNull()
  })

  it('child < 13 → 1.3x age bonus', () => {
    const r = personalFactorMultiplier({
      age: 10,
      occupation: 'employed',
      dependentCount: 0,
      hasLaborLoss: false,
    })
    expect(r.ageFactor).toBe(1.3)
    expect(r.multiplier).toBe(1.3)
  })

  it('senior 65+ → 0.9x', () => {
    const r = personalFactorMultiplier({
      age: 70,
      occupation: 'employed',
      dependentCount: 0,
      hasLaborLoss: false,
    })
    expect(r.ageFactor).toBe(0.9)
  })

  it('professional (lawyer/doctor) → 1.3x occupation', () => {
    const r = personalFactorMultiplier({
      age: 35,
      occupation: 'professional',
      dependentCount: 0,
      hasLaborLoss: false,
    })
    expect(r.occupationFactor).toBe(1.3)
    expect(r.multiplier).toBe(1.3)
  })

  it('4+ dependents → 1.25x', () => {
    const r = personalFactorMultiplier({
      age: 35,
      occupation: 'employed',
      dependentCount: 4,
      hasLaborLoss: false,
    })
    expect(r.dependentFactor).toBe(1.25)
  })

  it('labor loss → 1.3x', () => {
    const r = personalFactorMultiplier({
      age: 35,
      occupation: 'employed',
      dependentCount: 0,
      hasLaborLoss: true,
    })
    expect(r.laborLossFactor).toBe(1.3)
  })

  it('compounds all 4 dimensions (child + pro + 2 deps + labor loss)', () => {
    // 1.3 (age) * 1.3 (pro) * 1.15 (2-3 deps) * 1.3 (labor loss) = 2.5266
    const r = personalFactorMultiplier({
      age: 10,
      occupation: 'professional',
      dependentCount: 2,
      hasLaborLoss: true,
    })
    expect(r.multiplier).toBeCloseTo(2.5266, 3)
  })

  it('clamps multiplier to reasonable range (0.7-3.0)', () => {
    // 極端情況測試
    const r = personalFactorMultiplier({
      age: 10,
      occupation: 'professional',
      dependentCount: 4,
      hasLaborLoss: true,
    })
    // 1.3 * 1.3 * 1.25 * 1.3 = 2.7025
    expect(r.multiplier).toBeGreaterThan(1.5)
    expect(r.multiplier).toBeLessThan(3.0)
  })
})
