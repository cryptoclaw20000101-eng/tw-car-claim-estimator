import { describe, expect, it } from 'vitest'
import { computeThirdParty, computeVehicleDamage } from '@/lib/insurance/third-party'
import type {
  AccidentBasics,
  PainAndSufferingResult,
  PropertyDamageInputs,
} from '@/lib/insurance/types'

const pas: PainAndSufferingResult = {
  baseLow: 0,
  baseMid: 0,
  baseHigh: 0,
  regionalMultiplier: 1,
  regionalLow: 0,
  regionalMid: 0,
  regionalHigh: 0,
  severityLevel: '',
  severityScore: 0,
  breakdown: {
    hospitalizationDays: 0,
    rehabilitationCount: 0,
    scarLengthCm: 0,
    hasPermanentImpairment: false,
    hasDisability: false,
  },
}

const baseBasics: AccidentBasics = {
  accidentDate: '2024-01-01',
  accidentLocation: '臺中市',
  accidentType: 'car_to_car',
  injuredRole: 'driver_car',
  isInjured: true,
  isAutomobileAccident: true,
  hasPolicePreliminaryReport: true,
  hasAccidentAppraisal: false,
  hasCompulsoryInsurance: true,
  accidentCity: '臺中市',
  accidentDistrict: '',
  claimantResidenceCity: '臺中市',
  claimantResidenceDistrict: '',
  defendantResidenceCity: '臺中市',
  defendantResidenceDistrict: '',
  courtJurisdiction: '臺灣臺中地方法院',
  insuranceCompanyBranchRegion: '中部',
}

function civil() {
  return {
    civilMedicalExpense: 80_000,
    civilNursingFeeLow: 0,
    civilNursingFeeMid: 0,
    civilNursingFeeHigh: 0,
    civilTransportationFee: 0,
    workLoss: 0,
    laborCapacityLossEstimate: 0,
    painAndSuffering: pas,
    vehicleDamage: 0,
    propertyDamage: 0,
  }
}

describe('legal-audit：調解／法院雙模式', () => {
  it('調解模式：責任基準先做過失相抵；淨額先扣強制險再乘肇責', () => {
    const result = computeThirdParty({
      basics: { ...baseBasics, calculationMode: 'mediation' } as AccidentBasics,
      civil: civil(),
      compulsoryTotalApproved: 20_000,
      otherFaultRatio: 50,
    })
    // gross bodily 100,000；責任基準 = 100,000 × 50% = 50,000
    expect(result.liableAmountMid).toBe(50_000)
    // 調解淨額：(100,000 - 20,000) × 50% = 40,000
    expect(result.thirdPartyEstimateMid).toBe(40_000)
  })

  it('法院模式：責任基準先做過失相抵；淨額再扣實際已領強制險', () => {
    const result = computeThirdParty({
      basics: {
        ...baseBasics,
        calculationMode: 'litigation',
        compulsoryActuallyPaid: 20_000,
      } as AccidentBasics,
      civil: civil(),
      compulsoryTotalApproved: 20_000,
      otherFaultRatio: 50,
    })
    // gross bodily 100,000；責任基準 = 100,000 × 50% = 50,000
    expect(result.liableAmountMid).toBe(50_000)
    // 法院淨額：100,000 × 50% - 20,000 = 30,000
    expect(result.thirdPartyEstimateMid).toBe(30_000)
  })

  it('法院模式未實際領取時，不扣預估強制險', () => {
    const result = computeThirdParty({
      basics: {
        ...baseBasics,
        calculationMode: 'litigation',
        compulsoryActuallyPaid: 0,
      } as AccidentBasics,
      civil: civil(),
      compulsoryTotalApproved: 20_000,
      otherFaultRatio: 50,
    })
    expect(result.liableAmountMid).toBe(50_000)
    expect(result.thirdPartyEstimateMid).toBe(50_000)
  })
})

describe('legal-audit：車損使用事故年份', () => {
  const property: PropertyDamageInputs = {
    vehicleRepairEstimate: 80_000,
    vehicleRepairInvoice: 80_000,
    vehicleMarketValueBeforeAccident: 500_000,
    salvageValue: 0,
    vehicleManufactureYear: 2022,
    vehicleDepreciationYears: 5,
    towingFee: 0,
    rentalCarFee: 0,
    phoneDamage: 0,
    helmetDamage: 0,
    clothingDamage: 0,
    glassesDamage: 0,
    otherPropertyDamage: 0,
  }

  it('同一事故日期重算時，不依目前年度改變車齡', () => {
    const value = computeVehicleDamage(property, '2024-01-10')
    // 2024 - 2022 = 2 年，事故時折舊後價值 300,000，修復費 80,000 可全認列。
    expect(value).toBe(80_000)
  })
})
