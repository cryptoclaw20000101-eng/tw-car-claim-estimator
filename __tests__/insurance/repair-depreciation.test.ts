import { describe, expect, it } from 'vitest'
import { computeRepairDepreciation } from '@/lib/insurance/repair-depreciation'

const base = {
  vehicleType: 'car' as const,
  manufactureDate: '2023-01-01',
  accidentDate: '2026-01-01',
  parts: 100000,
  labor: 10000,
  paint: 5000,
}

describe('維修零件折舊', () => {
  it('只折舊零件，工資及烤漆保留全額', () => {
    const result = computeRepairDepreciation(base)!
    expect(result.partsAfterDepreciation).toBe(Math.round(100000 * 0.631 ** 3))
    expect(result.total).toBe(result.partsAfterDepreciation + 15000)
    expect(result.monthsUsed).toBe(36)
  })
  it('不滿一年按月比例，未滿一月按一月', () => {
    const result = computeRepairDepreciation({ ...base, accidentDate: '2023-02-02' })!
    expect(result.monthsUsed).toBe(2)
    expect(result.partsAfterDepreciation).toBe(Math.round(100000 * (1 - (0.369 * 2) / 12)))
  })
  it('逾耐用年限零件保留十分之一；老車工資不歸零', () => {
    expect(computeRepairDepreciation({ ...base, manufactureDate: '2000-01-01' })?.total).toBe(25000)
    expect(computeRepairDepreciation({ ...base, vehicleType: 'motorcycle' })?.total).toBe(25000)
  })
  it('機車一年按 53.6% 折舊', () => {
    expect(
      computeRepairDepreciation({ ...base, vehicleType: 'motorcycle', accidentDate: '2024-01-01' })
        ?.partsAfterDepreciation,
    ).toBe(46400)
  })
  it('沒有零件替換也可試算純工資、烤漆，不要求車齡', () => {
    expect(computeRepairDepreciation({ ...base, parts: 0, manufactureDate: '' })?.total).toBe(15000)
  })
  it('需要折舊但缺日期、出廠日在事故後或無效日期不硬算', () => {
    for (const manufactureDate of ['', '2027-01-01', '2023-02-30']) {
      expect(computeRepairDepreciation({ ...base, manufactureDate })).toBeNull()
    }
  })
  it('缺少金額不當作零；負值、NaN、Infinity 不硬算', () => {
    for (const parts of [null, -1, NaN, Infinity]) {
      expect(computeRepairDepreciation({ ...base, parts })).toBeNull()
    }
  })
})
