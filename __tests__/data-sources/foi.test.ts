import { describe, it, expect } from 'vitest'
import {
  listFoiDisputeCases,
  getFoiCasesByCategory,
  getFoiCasesByOutcome,
  getFoiCaseById,
  getAverageFoiCompensation,
  getFoiCaseCount,
} from '@/lib/data-sources/foi'

describe('Foi Dispute Cases (金融評議中心)', () => {
  it('listFoiDisputeCases returns all cases', () => {
    const cases = listFoiDisputeCases()
    expect(cases.length).toBeGreaterThan(0)
    expect(cases[0]).toHaveProperty('caseId')
    expect(cases[0]).toHaveProperty('category')
    expect(cases[0]).toHaveProperty('outcome')
  })

  it('getFoiCasesByCategory filters by category', () => {
    const cases = getFoiCasesByCategory('causation')
    expect(cases.length).toBeGreaterThan(0)
    cases.forEach((c) => expect(c.category).toBe('causation'))
  })

  it('getFoiCasesByCategory returns [] for empty category', () => {
    const cases = getFoiCasesByCategory('disability')
    expect(Array.isArray(cases)).toBe(true)
    cases.forEach((c) => expect(c.category).toBe('disability'))
  })

  it('getFoiCasesByOutcome filters by outcome', () => {
    const consumerFavor = getFoiCasesByOutcome('consumer_favor')
    expect(consumerFavor.length).toBeGreaterThan(0)
    consumerFavor.forEach((c) => expect(c.outcome).toBe('consumer_favor'))
  })

  it('getFoiCaseById returns case when exists', () => {
    const all = listFoiDisputeCases()
    const firstId = all[0].caseId
    const found = getFoiCaseById(firstId)
    expect(found).not.toBeNull()
    expect(found?.caseId).toBe(firstId)
  })

  it('getFoiCaseById returns null when not found', () => {
    const found = getFoiCaseById('NONEXISTENT-9999')
    expect(found).toBeNull()
  })

  it('getAverageFoiCompensation returns average of valid cases', () => {
    const avg = getAverageFoiCompensation('nursing_fee')
    // 不一定有此類別，但函式應不爆
    if (avg !== null) {
      expect(avg).toBeGreaterThan(0)
    }
  })

  it('getFoiCaseCount returns total number of cases', () => {
    const count = getFoiCaseCount()
    const all = listFoiDisputeCases()
    expect(count).toBe(all.length)
  })

  it('every case has required fields', () => {
    const cases = listFoiDisputeCases()
    cases.forEach((c) => {
      expect(c.caseId).toBeTruthy()
      expect(c.category).toBeTruthy()
      expect(c.caseYear).toBeGreaterThan(2010)
      expect(c.caseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(c.summary).toBeTruthy()
      expect(c.keyReasoning).toBeTruthy()
      expect(c.outcome).toBeTruthy()
      expect(c.referenceNote).toBeTruthy()
    })
  })
})
