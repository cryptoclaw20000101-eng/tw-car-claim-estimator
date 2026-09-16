import { describe, expect, it } from 'vitest'
import { estimateClaim } from '@/lib/insurance'
import { SAMPLE_INPUT } from '@/lib/insurance/sample'
import type { ClaimInput, CompulsoryMedicalInputs } from '@/lib/insurance/types'

const EMPTY_RECEIPTS: CompulsoryMedicalInputs = {
  emergencyFee: 0,
  ambulanceFee: 0,
  nhiCopayment: 0,
  registrationFee: 0,
  diagnosisCertificateFee: 0,
  nonNhiNecessaryMedicalFee: 0,
  wardFeeDifference: 0,
  wardFeeDays: 0,
  mealFee: 0,
  mealDays: 0,
  prosthesisFee: 0,
  dentureFee: 0,
  missingTeethCount: 0,
  artificialEyeFee: 0,
  specialMaterialFee: 0,
  medicalMaterialFee: 0,
  assistiveDeviceFee: 0,
  transportationFee: 0,
  nursingFee: 0,
  nursingDays: 0,
}

const EMPTY_PROPERTY = {
  vehicleRepairEstimate: 0,
  vehicleRepairInvoice: 0,
  vehicleMarketValueBeforeAccident: 0,
  salvageValue: 0,
  towingFee: 0,
  rentalCarFee: 0,
  phoneDamage: 0,
  helmetDamage: 0,
  clothingDamage: 0,
  glassesDamage: 0,
  otherPropertyDamage: 0,
}

function makeInput(
  receipts: Partial<CompulsoryMedicalInputs>,
  medicalOverrides: Partial<ClaimInput['medical']> = {},
): ClaimInput {
  return {
    ...SAMPLE_INPUT,
    basics: {
      ...SAMPLE_INPUT.basics,
      accidentDate: '2026-08-01',
      hasCompulsoryInsurance: true,
      courtJurisdiction: '臺灣臺中地方法院',
    },
    fault: {
      ...SAMPLE_INPUT.fault,
      selfFaultRatio: 0,
      otherFaultRatio: 100,
    },
    person: {
      ...SAMPLE_INPUT.person,
      sixMonthAverageSalary: 0,
      monthlySalary: 0,
      actualLeaveDays: 0,
      doctorOrderedRestDays: 0,
    },
    medical: {
      ...SAMPLE_INPUT.medical,
      hospitalizationDays: 0,
      hasSurgery: false,
      hasRehabilitation: false,
      rehabilitationCount: 0,
      requiresNursingCare: false,
      nursingDays: 0,
      hasFracture: false,
      hasDislocation: false,
      hasLigamentInjury: false,
      hasNerveDamage: false,
      hasAmputation: false,
      hasOrganDamage: false,
      hasScar: false,
      scarLengthCm: 0,
      jointName: null,
      hasRangeOfMotionLimitation: false,
      romLossDegree: 0,
      hasMuscleWeakness: false,
      hasSensoryLoss: false,
      hasPermanentImpairment: false,
      hasDisabilityCertificate: false,
      disabilityLevel: undefined,
      ...medicalOverrides,
    },
    medicalReceipts: {
      ...EMPTY_RECEIPTS,
      ...receipts,
    },
    property: { ...EMPTY_PROPERTY },
  }
}

describe('civil deduction flow — 醫療／接送／看護不得重複計入', () => {
  it('接送費 10,000 全由強制險認列時，民事接送差額為 0', () => {
    const result = estimateClaim(makeInput({ transportationFee: 10_000 }))

    expect(result.compulsoryMedicalApproved).toBe(10_000)
    expect(result.civilMedicalExpense).toBe(0)
    expect(result.civilTransportationFee).toBe(0)
  })

  it('接送費 30,000、強制險上限 20,000 時，民事只留 10,000 差額', () => {
    const result = estimateClaim(makeInput({ transportationFee: 30_000 }))

    expect(result.compulsoryMedicalApproved).toBe(20_000)
    expect(result.civilMedicalExpense).toBe(0)
    expect(result.civilTransportationFee).toBe(10_000)
  })

  it('看護 30 日申請 60,000 時，不把超額 24,000 再塞進民事醫療差額', () => {
    const result = estimateClaim(
      makeInput(
        { nursingFee: 60_000, nursingDays: 30 },
        { requiresNursingCare: true, nursingDays: 30 },
      ),
    )

    expect(result.compulsoryMedicalApproved).toBe(36_000)
    expect(result.civilMedicalExpense).toBe(0)
    // 臺中中標 2,400 × 30 = 72,000；扣強制險看護 36,000 → 36,000。
    expect(result.civilNursingFeeMid).toBe(36_000)
  })

  it('強制險醫療總額觸及 20 萬上限時，三桶扣抵合計仍精確等於 20 萬', () => {
    const result = estimateClaim(
      makeInput(
        {
          nhiCopayment: 180_000,
          transportationFee: 20_000,
          nursingFee: 36_000,
          nursingDays: 30,
        },
        { requiresNursingCare: true, nursingDays: 30 },
      ),
    )

    expect(result.compulsoryMedicalSubtotal).toBe(236_000)
    expect(result.compulsoryMedicalApproved).toBe(200_000)

    // 民事 gross：一般醫療 180,000 + 接送 20,000 + 臺中看護中標 72,000 = 272,000。
    // 強制險總扣抵 200,000 後，三個民事差額合計必須恰為 72,000。
    expect(
      result.civilMedicalExpense +
        result.civilTransportationFee +
        result.civilNursingFeeMid,
    ).toBe(72_000)
  })
})
