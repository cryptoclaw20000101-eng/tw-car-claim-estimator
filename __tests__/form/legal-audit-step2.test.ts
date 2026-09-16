import { describe, expect, it } from 'vitest'
import { mergeStep, type FormSchema } from '@/app/claims/new/_form'
import { SAMPLE_INPUT } from '@/lib/insurance/sample'

describe('Step 2 legal-audit fields', () => {
  it('跨到下一步時原子保存 fault + calculation/coverage basics', () => {
    const prev: FormSchema = {
      basics: { ...SAMPLE_INPUT.basics },
      fault: { ...SAMPLE_INPUT.fault },
      person: { ...SAMPLE_INPUT.person },
      medical: { ...SAMPLE_INPUT.medical },
      receipts: { ...SAMPLE_INPUT.medicalReceipts },
      property: { ...SAMPLE_INPUT.property },
    }

    const result = mergeStep(prev, 1, {
      fault: {
        ...prev.fault,
        selfFaultRatio: 40,
        otherFaultRatio: 60,
        faultSource: 'court_judgment',
      },
      basics: {
        ...prev.basics,
        calculationMode: 'litigation',
        compulsoryActuallyPaid: 80_000,
        thirdPartyCoverageStatus: 'yes',
        thirdPartyBodilyLimit: 2_000_000,
        thirdPartyPropertyLimit: 500_000,
        excessLiabilityLimit: 10_000_000,
      },
    })

    expect(result.fault.selfFaultRatio).toBe(40)
    expect(result.fault.otherFaultRatio).toBe(60)
    expect(result.fault.faultSource).toBe('court_judgment')

    expect(result.basics.calculationMode).toBe('litigation')
    expect(result.basics.compulsoryActuallyPaid).toBe(80_000)
    expect(result.basics.thirdPartyCoverageStatus).toBe('yes')
    expect(result.basics.thirdPartyBodilyLimit).toBe(2_000_000)
    expect(result.basics.thirdPartyPropertyLimit).toBe(500_000)
    expect(result.basics.excessLiabilityLimit).toBe(10_000_000)
  })

  it('只改 fault 時，不會清掉既有保單資料', () => {
    const prev: FormSchema = {
      basics: {
        ...SAMPLE_INPUT.basics,
        calculationMode: 'mediation',
        compulsoryActuallyPaid: 20_000,
        thirdPartyCoverageStatus: 'yes',
        thirdPartyBodilyLimit: 1_000_000,
        thirdPartyPropertyLimit: 200_000,
        excessLiabilityLimit: 5_000_000,
      },
      fault: { ...SAMPLE_INPUT.fault },
      person: { ...SAMPLE_INPUT.person },
      medical: { ...SAMPLE_INPUT.medical },
      receipts: { ...SAMPLE_INPUT.medicalReceipts },
      property: { ...SAMPLE_INPUT.property },
    }

    const result = mergeStep(prev, 1, {
      fault: { ...prev.fault, selfFaultRatio: 20, otherFaultRatio: 80 },
    })

    expect(result.fault.otherFaultRatio).toBe(80)
    expect(result.basics.thirdPartyCoverageStatus).toBe('yes')
    expect(result.basics.thirdPartyBodilyLimit).toBe(1_000_000)
    expect(result.basics.excessLiabilityLimit).toBe(5_000_000)
  })
})
