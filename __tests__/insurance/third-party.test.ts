// =====================================================================
// v0.8.5 third-party.ts 計算引擎測試
// 守護 AGENTS §1 鐵律 ① 「強制險無過失不乘肇責」+ 鐵律 ② 「車損只算第三人責任險」
// v0.5.2+ — 無保額上限（永遠 1：1 對方肇責比例）
// =====================================================================

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  computeThirdParty,
  computeVehicleDamage,
  computePropertyDamage,
  getVehicleDepreciationHint,
} from '@/lib/insurance/third-party'
import { computePainAndSuffering } from '@/lib/insurance/civil-damages'
import type { AccidentBasics, MedicalRecord } from '@/lib/insurance/types'

// 注意：ThirdPartyInput / CivilDamageInput 是從 '@/lib/insurance/third-party' import
// 不是從 '@/lib/insurance/types'
import type { ThirdPartyInput, CivilDamageInput } from '@/lib/insurance/third-party'

// 共用 fixture
const BASICS: AccidentBasics = {
  accidentDate: '2024-01-01',
  accidentLocation: '臺北市信義區',
  accidentType: 'car_to_car',
  injuredRole: 'driver_car',
  isInjured: true, // v0.26.0e+
  isAutomobileAccident: true,
  hasPolicePreliminaryReport: true,
  hasAccidentAppraisal: false,
  hasCompulsoryInsurance: true,
  accidentCity: '臺北市',
  accidentDistrict: '信義區',
  claimantResidenceCity: '臺北市',
  claimantResidenceDistrict: '信義區',
  defendantResidenceCity: '臺北市',
  defendantResidenceDistrict: '信義區',
  courtJurisdiction: '臺灣臺北地方法院',
  insuranceCompanyBranchRegion: '臺北市',
}

const MINIMAL_MEDICAL: MedicalRecord = {
  diagnosisText: '',
  hospitalName: '',
  emergencyDate: '',
  outpatientVisitCount: 0,
  hospitalizationDays: 0,
  hasSurgery: false,
  hasRehabilitation: false,
  rehabilitationCount: 0,
  requiresNursingCare: false,
  nursingDays: 0,
  isSymptomFixed: false,
  hasDisabilityCertificate: false,
  hasClassADiagnosisCertificate: false,
  hasFracture: false,
  hasDislocation: false,
  hasLigamentInjury: false,
  hasNerveDamage: false,
  hasAmputation: false,
  hasOrganDamage: false,
  hasPermanentImpairment: false,
  jointName: null,
  hasRangeOfMotionLimitation: false,
  romLossDegree: 0,
  romNormalDegree: 0,
  hasMuscleWeakness: false,
  hasSensoryLoss: false,
}

function makeCivil(overrides: Partial<CivilDamageInput> = {}): CivilDamageInput {
  const pas = computePainAndSuffering(MINIMAL_MEDICAL, '臺灣臺北地方法院')
  return {
    civilMedicalExpense: 0,
    civilNursingFeeLow: 0,
    civilNursingFeeMid: 0,
    civilNursingFeeHigh: 0,
    civilTransportationFee: 0,
    workLoss: 0,
    laborCapacityLossEstimate: 0,
    painAndSuffering: pas,
    vehicleDamage: 0,
    propertyDamage: 0,
    ...overrides,
  }
}

function makeThirdPartyInput(
  otherFaultRatio: number,
  civil: CivilDamageInput = makeCivil(),
  compulsoryTotalApproved = 0,
): ThirdPartyInput {
  return {
    basics: BASICS,
    civil,
    compulsoryTotalApproved,
    otherFaultRatio,
  }
}

describe('computeThirdParty — 第三人責任險（AGENTS §1 鐵律①② 守護）', () => {
  describe('基本結構', () => {
    it('第三人估計 low ≤ mid ≤ high（單調遞增）', () => {
      const result = computeThirdParty(makeThirdPartyInput(70))
      expect(result.thirdPartyEstimateLow).toBeLessThanOrEqual(result.thirdPartyEstimateMid)
      expect(result.thirdPartyEstimateMid).toBeLessThanOrEqual(result.thirdPartyEstimateHigh)
    })

    it('civilDamageTotalLow ≤ mid ≤ high', () => {
      const result = computeThirdParty(makeThirdPartyInput(70))
      expect(result.civilDamageTotalLow).toBeLessThanOrEqual(result.civilDamageTotalMid)
      expect(result.civilDamageTotalMid).toBeLessThanOrEqual(result.civilDamageTotalHigh)
    })
  })

  describe('肇責比例（AGENTS §1 鐵律①② 守護）', () => {
    it('肇責 0%（被害人全責）→ 第三人估計 = 0', () => {
      const civil = makeCivil({ workLoss: 100_000, vehicleDamage: 50_000 })
      const result = computeThirdParty(makeThirdPartyInput(0, civil))
      expect(result.thirdPartyEstimateMid).toBe(0)
    })

    it('肇責 100%（對方全責）→ 第三人估計 = 民事總額', () => {
      const civil = makeCivil({ workLoss: 100_000, vehicleDamage: 50_000 })
      const result = computeThirdParty(makeThirdPartyInput(100, civil))
      expect(result.thirdPartyEstimateMid).toBe(result.civilDamageTotalMid)
    })

    it('肇責 50% → 第三人估計 ≈ 民事總額 × 0.5', () => {
      const civil = makeCivil({ workLoss: 100_000, vehicleDamage: 50_000 })
      const result = computeThirdParty(makeThirdPartyInput(50, civil))
      expect(result.thirdPartyEstimateMid).toBeCloseTo(result.civilDamageTotalMid * 0.5, -2)
    })

    it('肇責比例線性遞增（單調性）', () => {
      const civil = makeCivil({ workLoss: 100_000, vehicleDamage: 50_000 })
      const r30 = computeThirdParty(makeThirdPartyInput(30, civil))
      const r60 = computeThirdParty(makeThirdPartyInput(60, civil))
      expect(r60.thirdPartyEstimateMid).toBeGreaterThan(r30.thirdPartyEstimateMid)
    })
  })

  describe('v0.5.2+ 無保額上限（永遠 1：1 肇責比例）', () => {
    it('民事總額極大（10 億）→ 第三人估計 = 民事總額 × 肇責（無上限）', () => {
      const civil = makeCivil({ workLoss: 1_000_000_000 }) // 10 億
      const result = computeThirdParty(makeThirdPartyInput(70, civil))
      // 沒有 bodilyCap / propertyCap — 直接乘肇責
      expect(result.thirdPartyEstimateMid).toBeGreaterThan(700_000_000)
    })
  })

  describe('AGENTS §1 鐵律①：強制險無過失不乘肇責', () => {
    it('compulsoryTotalApproved 不影響第三人估計（守護：簽名隔離）', () => {
      // 同一 civil，不同 compulsoryTotalApproved → thirdPartyEstimate 應該一樣
      const civil = makeCivil({ workLoss: 100_000, vehicleDamage: 50_000 })
      const r0 = computeThirdParty(makeThirdPartyInput(70, civil, 0))
      const r100000 = computeThirdParty(makeThirdPartyInput(70, civil, 100_000))
      // 強制險給付不應影響第三人責任險計算
      expect(r0.thirdPartyEstimateMid).toBe(r100000.thirdPartyEstimateMid)
    })
  })

  describe('AGENTS §1 鐵律②：精神撫金/工作損失/車損只算第三人責任險', () => {
    it('workLoss 100000 → 進第三人估計（不算強制險）', () => {
      const civil = makeCivil({ workLoss: 100_000 })
      const result = computeThirdParty(makeThirdPartyInput(100, civil))
      expect(result.thirdPartyEstimateMid).toBeGreaterThan(100_000)
    })

    it('vehicleDamage 50000 → 進第三人估計', () => {
      const civil = makeCivil({ vehicleDamage: 50_000 })
      const result = computeThirdParty(makeThirdPartyInput(100, civil))
      expect(result.thirdPartyEstimateMid).toBeGreaterThan(50_000)
    })

    it('painAndSuffering.regionalMid → 進第三人估計', () => {
      const pas = computePainAndSuffering(MINIMAL_MEDICAL, '臺灣臺北地方法院')
      const civil = makeCivil({ painAndSuffering: pas })
      const result = computeThirdParty(makeThirdPartyInput(100, civil))
      // 至少有精神撫金進來
      expect(result.thirdPartyEstimateMid).toBeGreaterThanOrEqual(pas.regionalMid)
    })
  })

  describe('不變量', () => {
    it('同樣輸入 → 同樣輸出（純函式）', () => {
      const a = computeThirdParty(makeThirdPartyInput(70))
      const b = computeThirdParty(makeThirdPartyInput(70))
      expect(a).toEqual(b)
    })

    it('notes 必為陣列（可能空）', () => {
      const result = computeThirdParty(makeThirdPartyInput(70))
      expect(Array.isArray(result.notes)).toBe(true)
    })
  })
})

describe('computeVehicleDamage — 車損計算（回傳 number）', () => {
  it('基本回傳 >= 0', () => {
    const result = computeVehicleDamage({
      vehicleRepairEstimate: 50_000,
      vehicleRepairInvoice: 50_000,
      vehicleMarketValueBeforeAccident: 300_000,
      salvageValue: 50_000,
      towingFee: 0,
      rentalCarFee: 0,
      phoneDamage: 0,
      helmetDamage: 0,
      clothingDamage: 0,
      glassesDamage: 0,
      otherPropertyDamage: 0,
    })
    expect(typeof result).toBe('number')
    expect(result).toBeGreaterThanOrEqual(0)
  })

  it('修復費 0 → 回傳 0', () => {
    const result = computeVehicleDamage({
      vehicleRepairEstimate: 0,
      vehicleRepairInvoice: 0,
      vehicleMarketValueBeforeAccident: 300_000,
      salvageValue: 0,
      towingFee: 0,
      rentalCarFee: 0,
      phoneDamage: 0,
      helmetDamage: 0,
      clothingDamage: 0,
      glassesDamage: 0,
      otherPropertyDamage: 0,
    })
    expect(result).toBe(0)
  })

  it('AGENTS §1 鐵律②：車損不進強制險（守護：computeVehicleDamage 不該被 compulsory.ts 引用）', () => {
    const compulsorySrc = readFileSync(join(process.cwd(), 'lib/insurance/compulsory.ts'), 'utf-8')
    expect(compulsorySrc).not.toContain('computeVehicleDamage')
  })
})

describe('computePropertyDamage — 財產損失（回傳 number）', () => {
  it('基本回傳 >= 0', () => {
    const result = computePropertyDamage({
      vehicleRepairEstimate: 0,
      vehicleRepairInvoice: 0,
      vehicleMarketValueBeforeAccident: 0,
      salvageValue: 0,
      towingFee: 0,
      rentalCarFee: 0,
      phoneDamage: 5_000,
      helmetDamage: 0,
      clothingDamage: 0,
      glassesDamage: 0,
      otherPropertyDamage: 0,
    })
    expect(typeof result).toBe('number')
    expect(result).toBeGreaterThanOrEqual(0)
  })
})

describe('getVehicleDepreciationHint — 折舊提示', () => {
  it('回傳字串（可能空字串）', () => {
    const hint = getVehicleDepreciationHint('臺灣臺北地方法院')
    expect(typeof hint).toBe('string')
  })

  it('未知法院 → 回傳字串（不報錯）', () => {
    const hint = getVehicleDepreciationHint('未知法院XYZ')
    expect(typeof hint).toBe('string')
  })
})
