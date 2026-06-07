import { describe, it, expect } from 'vitest'
import {
  getCourtCompensation,
  listAllCompensationTable,
  getCaseReferencesByCategory,
  getCaseReferenceById,
  getMedianCourtCompensation,
  getSupportedCourts,
  getCourtCaseCount,
} from '@/lib/data-sources/judicial'

describe('Court Compensation (司法院)', () => {
  it('getCourtCompensation returns matching record', () => {
    const data = getCourtCompensation('臺灣臺中地方法院', 'pain_and_suffering')
    expect(data).not.toBeNull()
    expect(data?.amountLow).toBeLessThanOrEqual(data?.amountHigh ?? 0)
    expect(data?.amountMid).toBeGreaterThanOrEqual(data?.amountLow ?? 0)
    expect(data?.amountMid).toBeLessThanOrEqual(data?.amountHigh ?? 0)
  })

  it('getCourtCompensation returns null for unsupported combination', () => {
    const data = getCourtCompensation('臺灣臺北地方法院', 'vehicle_damage')
    expect(data).toBeNull()  // 台北地院無 vehicle_damage 區間
  })

  it('listAllCompensationTable returns all records', () => {
    const all = listAllCompensationTable()
    expect(all.length).toBeGreaterThan(0)
    all.forEach((c) => {
      expect(c.courtName).toBeTruthy()
      expect(c.category).toBeTruthy()
      expect(c.sampleSize).toBeGreaterThan(0)
    })
  })

  it('getCaseReferencesByCategory filters by category', () => {
    const refs = getCaseReferencesByCategory('pain_and_suffering')
    expect(refs.length).toBeGreaterThan(0)
    refs.forEach((r) => expect(r.category).toBe('pain_and_suffering'))
  })

  it('every case reference has low <= amount <= high', () => {
    const all = listAllCompensationTable()
    all.forEach((c) => {
      expect(c.amountLow).toBeLessThanOrEqual(c.amountHigh)
      expect(c.amountMid).toBeGreaterThanOrEqual(c.amountLow)
      expect(c.amountMid).toBeLessThanOrEqual(c.amountHigh)
    })
  })

  it('getCaseReferenceById returns case when exists', () => {
    const refs = getCaseReferencesByCategory('pain_and_suffering')
    const found = getCaseReferenceById(refs[0].caseId)
    expect(found).not.toBeNull()
    expect(found?.caseId).toBe(refs[0].caseId)
  })

  it('getCaseReferenceById returns null when not found', () => {
    const found = getCaseReferenceById('NONEXISTENT-9999')
    expect(found).toBeNull()
  })

  it('getMedianCourtCompensation returns mid value', () => {
    const mid = getMedianCourtCompensation('臺灣臺中地方法院', 'pain_and_suffering')
    expect(mid).toBe(150_000)
  })

  it('getMedianCourtCompensation returns null when no data', () => {
    const mid = getMedianCourtCompensation('臺灣臺東地方法院', 'pain_and_suffering')
    expect(mid).toBeNull()
  })

  it('getSupportedCourts returns unique court names', () => {
    const courts = getSupportedCourts()
    expect(courts.length).toBeGreaterThan(0)
    expect(new Set(courts).size).toBe(courts.length)  // no duplicates
    courts.forEach((c) => expect(c).toMatch(/^臺灣/))  // 法院名以「臺灣」開頭
  })

  it('getCourtCaseCount returns total number of case references', () => {
    const count = getCourtCaseCount()
    expect(count).toBeGreaterThan(0)
  })
})
