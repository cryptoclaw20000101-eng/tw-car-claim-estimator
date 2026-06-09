import { describe, it, expect } from 'vitest'
import { estimateClaim } from '@/lib/insurance'
import { SAMPLE_INPUT } from '@/lib/insurance/sample'

describe('SAMPLE_INPUT 估算', () => {
  it('能跑出合理結果', () => {
    const r = estimateClaim(SAMPLE_INPUT)
    console.log('compulsory.approved:', r.compulsoryMedicalApproved)
    console.log('workLoss:', r.workLoss)
    console.log('pas:', r.painAndSuffering)
    console.log('vehicleDamage:', r.vehicleDamage)
    expect(r.compulsoryMedicalApproved).toBeGreaterThan(0)
    expect(r.workLoss).toBeGreaterThan(0)
    expect(r.painAndSuffering.regionalMid).toBeGreaterThan(0)
    expect(r.region.courtName).toContain('臺中')
  })
})
