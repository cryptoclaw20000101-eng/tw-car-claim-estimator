import { describe, it, expect } from 'vitest'
import { estimateClaim } from '@/lib/insurance'
import { SAMPLE_INPUT } from '@/lib/insurance/sample'

describe('SAMPLE_INPUT 估算', () => {
  it('能跑出合理結果', () => {
    const r = estimateClaim(SAMPLE_INPUT)
    expect(r.compulsoryMedicalApproved).toBeGreaterThan(0)
    expect(r.workLoss).toBeGreaterThan(0)
    expect(r.painAndSuffering.regionalMid).toBeGreaterThan(0)
    expect(r.region.courtName).toContain('臺中')
  })

  it('症狀固定時，第三人責任總額採用長期工作損失而非僅展示短期金額', () => {
    const fixed = estimateClaim(SAMPLE_INPUT)
    const notFixed = estimateClaim({
      ...SAMPLE_INPUT,
      medical: { ...SAMPLE_INPUT.medical, isSymptomFixed: false },
    })

    expect(fixed.workLossExtended.calculationType).toBe('long_term')
    expect(notFixed.workLossExtended.calculationType).toBe('short_term')
    expect(fixed.thirdParty.civilDamageTotalMid - notFixed.thirdParty.civilDamageTotalMid).toBe(
      fixed.workLossExtended.amount - notFixed.workLossExtended.amount,
    )
  })
})
