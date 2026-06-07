import { describe, it, expect } from 'vitest'
import {
  listLegalReferences,
  getLegalReference,
  getPrimaryLegalReferences,
  getCompulsoryInsuranceReferences,
  getCivilDamagesReferences,
  isLegalReferenceStale,
} from '@/lib/data-sources/legal-reference'

describe('Legal References (法源常數)', () => {
  it('listLegalReferences returns all references', () => {
    const refs = listLegalReferences()
    expect(refs.length).toBeGreaterThan(0)
    refs.forEach((r) => {
      expect(r.key).toBeTruthy()
      expect(r.title).toBeTruthy()
      expect(r.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(r.summary).toBeTruthy()
      expect(r.relevantArticles.length).toBeGreaterThan(0)
    })
  })

  it('getLegalReference returns matching reference', () => {
    const ref = getLegalReference('compulsory_insurance_act')
    expect(ref).not.toBeNull()
    expect(ref?.key).toBe('compulsory_insurance_act')
  })

  it('getLegalReference returns null when not found', () => {
    const ref = getLegalReference('nonexistent_key' as never)
    expect(ref).toBeNull()
  })

  it('getPrimaryLegalReferences returns 3 main laws', () => {
    const refs = getPrimaryLegalReferences()
    expect(refs.length).toBe(3)
    const keys = refs.map((r) => r.key)
    expect(keys).toContain('compulsory_insurance_act')
    expect(keys).toContain('compulsory_payment_standard')
    expect(keys).toContain('civil_code_184_196')
  })

  it('getCompulsoryInsuranceReferences returns insurance-related laws', () => {
    const refs = getCompulsoryInsuranceReferences()
    expect(refs.length).toBe(2)
    refs.forEach((r) => {
      expect(['compulsory_insurance_act', 'compulsory_payment_standard']).toContain(r.key)
    })
  })

  it('getCivilDamagesReferences returns civil code + guideline', () => {
    const refs = getCivilDamagesReferences()
    expect(refs.length).toBe(2)
    refs.forEach((r) => {
      expect(['civil_code_184_196', 'pain_and_suffering_guideline']).toContain(r.key)
    })
  })

  it('every reference has sourceUrl', () => {
    const refs = listLegalReferences()
    refs.forEach((r) => {
      expect(r.sourceUrl).toMatch(/^https?:\/\//)
    })
  })

  it('isLegalReferenceStale returns false for recently reviewed', () => {
    const ref = getLegalReference('compulsory_insurance_act')!
    expect(isLegalReferenceStale(ref)).toBe(false)  // lastReviewed 2026-06-07
  })

  it('isLegalReferenceStale returns true for old review', () => {
    const staleRef = {
      key: 'test' as never,
      title: 'Test',
      effectiveDate: '2020-01-01',
      sourceUrl: 'https://example.com',
      summary: 'Test',
      relevantArticles: ['§1'],
      lastReviewed: '2020-01-01',  // 6+ 年前
    }
    expect(isLegalReferenceStale(staleRef)).toBe(true)
  })
})
