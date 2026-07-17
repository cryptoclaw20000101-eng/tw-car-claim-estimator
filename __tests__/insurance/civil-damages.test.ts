// =====================================================================
// v0.8.5 civil-damages.ts 計算引擎測試
// 守護 AGENTS §1 鐵律 ② 「精神慰撫金/工作損失/車損只算第三人責任險」
// =====================================================================

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  computePainAndSuffering,
  computeCivilMedicalExpense,
  computeCivilNursingFee,
  computeWorkLoss,
  computeLaborCapacityLoss,
} from '@/lib/insurance/civil-damages'
import type { MedicalRecord, PersonalIncome, CompulsoryMedicalInputs } from '@/lib/insurance/types'

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

const SAMPLE_PERSON: PersonalIncome = {
  birthDate: '1990-01-01',
  age: 30,
  occupation: 'office_worker',
  employmentType: 'full_time_salary',
  sixMonthAverageSalary: 30000,
  monthlySalary: 30000,
  dailyWage: 1000,
  lastYearTaxableIncome: 360000,
  hasPropertyList: false,
  hasSalaryTransferRecord: false,
  hasLeaveCertificate: false,
  hasSalaryDeductionProof: false,
  actualLeaveDays: 0,
  doctorOrderedRestDays: 0,
}

describe('computePainAndSuffering — 精神慰撫金（AGENTS §1 鐵律②）', () => {
  describe('基本結構', () => {
    it('回傳區間 low ≤ mid ≤ high（單調遞增）', () => {
      const result = computePainAndSuffering(MINIMAL_MEDICAL, '臺灣臺北地方法院')
      expect(result.regionalLow).toBeLessThanOrEqual(result.regionalMid)
      expect(result.regionalMid).toBeLessThanOrEqual(result.regionalHigh)
    })

    it('baseLow ≤ baseMid ≤ baseHigh（治療加成前）', () => {
      const result = computePainAndSuffering(MINIMAL_MEDICAL, '臺灣臺北地方法院')
      expect(result.baseLow).toBeLessThanOrEqual(result.baseMid)
      expect(result.baseMid).toBeLessThanOrEqual(result.baseHigh)
    })

    it('baseMid > 0（任何醫療輸入都該有 baseline）', () => {
      const result = computePainAndSuffering(MINIMAL_MEDICAL, '臺灣臺北地方法院')
      expect(result.baseMid).toBeGreaterThan(0)
    })
  })

  describe('地區係數生效', () => {
    it('臺北 > 臺中 > 高雄（依 AGENTS §2.4 設計）', () => {
      const tpe = computePainAndSuffering(MINIMAL_MEDICAL, '臺灣臺北地方法院')
      const tcg = computePainAndSuffering(MINIMAL_MEDICAL, '臺灣臺中地方法院')
      const khh = computePainAndSuffering(MINIMAL_MEDICAL, '臺灣高雄地方法院')
      expect(tpe.regionalMid).toBeGreaterThanOrEqual(tcg.regionalMid)
      expect(tcg.regionalMid).toBeGreaterThanOrEqual(khh.regionalMid)
    })

    it('未知法院 → 1.0 係數（不報錯）', () => {
      const result = computePainAndSuffering(MINIMAL_MEDICAL, '未知法院XYZ')
      expect(result.regionalMultiplier).toBe(1.0)
    })
  })

  describe('治療加成', () => {
    it('住院 180 天 → baseMid 顯著提升（治療加成 + 等級跳級效應）', () => {
      const r0 = computePainAndSuffering(MINIMAL_MEDICAL, '臺灣臺北地方法院')
      const r180 = computePainAndSuffering(
        { ...MINIMAL_MEDICAL, hospitalizationDays: 180 },
        '臺灣臺北地方法院',
      )
      // 180 天住院觸發 scoreSeverity 跳級（>=15 天 +20 分），baseMid 顯著提升
      expect(r180.baseMid).toBeGreaterThan(r0.baseMid)
      const boost = (r180.baseMid - r0.baseMid) / r0.baseMid
      // boost 至少 > 20%（因為有跳級效應）
      expect(boost).toBeGreaterThanOrEqual(0.2)
    })

    it('住院 365 天 → 等級跳級效應（不只有治療加成）', () => {
      // 注意：scoreSeverity 對 hospitalizationDays 是分段加分，365 天會跳級
      // 所以 baseMid 差異 = 治療加成 +20% + 等級跳級效應（不可拆）
      const r0 = computePainAndSuffering(MINIMAL_MEDICAL, '臺灣臺北地方法院')
      const r365 = computePainAndSuffering(
        { ...MINIMAL_MEDICAL, hospitalizationDays: 365 },
        '臺灣臺北地方法院',
      )
      // 365 天住院的 baseMid 一定 >= 180 天的 baseMid（單調遞增）
      const r180 = computePainAndSuffering(
        { ...MINIMAL_MEDICAL, hospitalizationDays: 180 },
        '臺灣臺北地方法院',
      )
      expect(r365.baseMid).toBeGreaterThanOrEqual(r180.baseMid)
      expect(r365.baseMid).toBeGreaterThan(r0.baseMid)
      // boost 沒有上限（因為有等級跳級效應）
      const boost = (r365.baseMid - r0.baseMid) / r0.baseMid
      expect(boost).toBeGreaterThan(0.2) // 至少 > 20%（因為有跳級）
    })
  })

  describe('傷害嚴重度分級', () => {
    it('有骨折 → severity 應提升', () => {
      const noFracture = computePainAndSuffering(MINIMAL_MEDICAL, '臺灣臺北地方法院')
      const withFracture = computePainAndSuffering(
        { ...MINIMAL_MEDICAL, hasFracture: true },
        '臺灣臺北地方法院',
      )
      expect(withFracture.severityScore).toBeGreaterThan(noFracture.severityScore)
      expect(withFracture.regionalMid).toBeGreaterThanOrEqual(noFracture.regionalMid)
    })

    it('有失能 → severity 應顯著提升', () => {
      const noDisability = computePainAndSuffering(MINIMAL_MEDICAL, '臺灣臺北地方法院')
      const withDisability = computePainAndSuffering(
        { ...MINIMAL_MEDICAL, hasDisabilityCertificate: true },
        '臺灣臺北地方法院',
      )
      expect(withDisability.severityScore).toBeGreaterThan(noDisability.severityScore + 5)
    })
  })

  describe('不變量', () => {
    it('同樣輸入 → 同樣輸出（純函式）', () => {
      const a = computePainAndSuffering(MINIMAL_MEDICAL, '臺灣臺北地方法院')
      const b = computePainAndSuffering(MINIMAL_MEDICAL, '臺灣臺北地方法院')
      expect(a).toEqual(b)
    })

    it('breakdown 包含所有輸入欄位', () => {
      const result = computePainAndSuffering(MINIMAL_MEDICAL, '臺灣臺北地方法院')
      expect(result.breakdown).toHaveProperty('hospitalizationDays')
      expect(result.breakdown).toHaveProperty('rehabilitationCount')
      expect(result.breakdown).toHaveProperty('scarLengthCm')
    })
  })
})

describe('computeCivilMedicalExpense — 民事醫療差額', () => {
  it('差額 = 總醫療 - 強制險給付', () => {
    expect(computeCivilMedicalExpense(50000, 30000)).toBe(20000)
  })

  it('強制險給付 > 總醫療 → 差額 = 0（不為負）', () => {
    expect(computeCivilMedicalExpense(30000, 50000)).toBe(0)
  })

  it('總醫療 0 → 差額 0', () => {
    expect(computeCivilMedicalExpense(0, 0)).toBe(0)
  })

  it('強制險給付 0 → 差額 = 總醫療（全額進民事）', () => {
    expect(computeCivilMedicalExpense(50000, 0)).toBe(50000)
  })
})

describe('computeCivilNursingFee — 民事看護費', () => {
  it('看護 0 天 → 看護費 0', () => {
    const result = computeCivilNursingFee(EMPTY_RECEIPTS, MINIMAL_MEDICAL, '臺灣臺北地方法院')
    expect(result.low).toBe(0)
    expect(result.mid).toBe(0)
    expect(result.high).toBe(0)
  })

  it('看護 30 天 → 看護費 > 0', () => {
    const result = computeCivilNursingFee(
      { ...EMPTY_RECEIPTS, nursingDays: 30 },
      { ...MINIMAL_MEDICAL, requiresNursingCare: true, nursingDays: 30 },
      '臺灣臺北地方法院',
    )
    expect(result.mid).toBeGreaterThan(0)
  })

  it('看護費 result 結構守護 low ≤ mid ≤ high', () => {
    const result = computeCivilNursingFee(
      { ...EMPTY_RECEIPTS, nursingDays: 30 },
      { ...MINIMAL_MEDICAL, requiresNursingCare: true, nursingDays: 30 },
      '臺灣臺北地方法院',
    )
    expect(result.low).toBeLessThanOrEqual(result.mid)
    expect(result.mid).toBeLessThanOrEqual(result.high)
  })
})

describe('computeWorkLoss — 工作損失（AGENTS §1 鐵律② 守護）', () => {
  it('基本輸入回傳 result.amount >= 0', () => {
    const result = computeWorkLoss(SAMPLE_PERSON, '臺灣臺北地方法院')
    expect(result.amount).toBeGreaterThanOrEqual(0)
  })

  it('未輸入請假/休養日數 → amount = 0', () => {
    const result = computeWorkLoss(SAMPLE_PERSON, '臺灣臺北地方法院')
    expect(result.amount).toBe(0)
  })

  it('輸入請假 30 天 → amount = dailyIncome * 30', () => {
    const person = { ...SAMPLE_PERSON, actualLeaveDays: 30, doctorOrderedRestDays: 30 }
    const result = computeWorkLoss(person, '臺灣臺北地方法院')
    expect(result.amount).toBe(30_000) // 30000/30 * 30 = 30000
  })

  it('同樣輸入 → 同樣輸出（純函式）', () => {
    const a = computeWorkLoss(SAMPLE_PERSON, '臺灣臺北地方法院')
    const b = computeWorkLoss(SAMPLE_PERSON, '臺灣臺北地方法院')
    expect(a).toEqual(b)
  })
})

describe('computeLaborCapacityLoss — 勞動能力減損', () => {
  it('無失能（disabilityLevel=null）→ estimate = 0', () => {
    const result = computeLaborCapacityLoss({
      medical: MINIMAL_MEDICAL,
      person: SAMPLE_PERSON,
      courtName: '臺灣臺北地方法院',
      disabilityLevel: null,
    })
    expect(result.estimate).toBe(0)
  })

  it('有失能（disabilityLevel=1）→ estimate > 0', () => {
    const result = computeLaborCapacityLoss({
      medical: { ...MINIMAL_MEDICAL, hasDisabilityCertificate: true },
      person: SAMPLE_PERSON,
      courtName: '臺灣臺北地方法院',
      disabilityLevel: 1,
    })
    expect(result.estimate).toBeGreaterThan(0)
  })

  it('失能等級越高 → 勞減金額越高（單調）', () => {
    const lvl7 = computeLaborCapacityLoss({
      medical: { ...MINIMAL_MEDICAL, hasDisabilityCertificate: true },
      person: SAMPLE_PERSON,
      courtName: '臺灣臺北地方法院',
      disabilityLevel: 7,
    })
    const lvl13 = computeLaborCapacityLoss({
      medical: { ...MINIMAL_MEDICAL, hasDisabilityCertificate: true },
      person: SAMPLE_PERSON,
      courtName: '臺灣臺北地方法院',
      disabilityLevel: 13,
    })
    // 等級數字越小表示障害越嚴重 → 勞減越高
    expect(lvl7.estimate).toBeGreaterThan(lvl13.estimate)
  })
})

describe('AGENTS §1 鐵律② 整合守護', () => {
  it('這些函式都不在 compulsory.ts 內被呼叫（只算第三人責任險）', () => {
    const compulsorySrc = readFileSync(join(process.cwd(), 'lib/insurance/compulsory.ts'), 'utf-8')
    expect(compulsorySrc).not.toContain('computePainAndSuffering')
    expect(compulsorySrc).not.toContain('computeWorkLoss')
    expect(compulsorySrc).not.toContain('computeVehicleDamage')
  })
})
