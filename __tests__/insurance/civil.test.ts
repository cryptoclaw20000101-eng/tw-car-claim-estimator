// =====================================================================
// 民事損害 + 第三人險 + 補件產生器測試
// 涵蓋 spec §十八 案例 2、3、6
// =====================================================================

import { describe, it, expect } from 'vitest'
import {
  computePainAndSuffering,
  computeCivilMedicalExpense,
  computeCivilNursingFee,
  computeWorkLoss,
  computeLaborCapacityLoss,
  scoreSeverity,
} from '@/lib/insurance/civil-damages'
import { computeThirdParty, computeVehicleDamage, computePropertyDamage } from '@/lib/insurance/third-party'
import { estimateClaim } from '@/lib/insurance'
import type { ClaimInput, MedicalRecord, PersonalIncome, CompulsoryMedicalInputs, PropertyDamageInputs, AccidentBasics, FaultInfo } from '@/lib/insurance/types'

// --- 測試案例 2：有請假損失（強制險不賠工作損失） ---

const case2Basics: AccidentBasics = {
  accidentDate: '2026-08-01',
  accidentLocation: '台中市西屯區',
  accidentType: 'car_to_motorcycle',
  injuredRole: 'driver_motorcycle',
  isAutomobileAccident: true,
  hasPolicePreliminaryReport: true,
  hasAccidentAppraisal: false,
  isSettled: false,
  hasCompulsoryInsurance: true,
  hasThirdPartyInsurance: true,
  thirdPartyBodilyLimit: 1_000_000,
  thirdPartyPropertyLimit: 200_000,
  excessLiabilityLimit: 0,
  accidentCity: '台中市',
  accidentDistrict: '西屯區',
  claimantResidenceCity: '台中市',
  claimantResidenceDistrict: '西屯區',
  defendantResidenceCity: '台北市',
  defendantResidenceDistrict: '信義區',
  courtJurisdiction: '',
  insuranceCompanyBranchRegion: '中區',
}

const case2Fault: FaultInfo = {
  selfFaultRatio: 30,
  otherFaultRatio: 70,
  faultSource: 'police_preliminary',
  isFaultDisputed: false,
}

const case2Person: PersonalIncome = {
  birthDate: '1995-05-15',
  age: 31,
  occupation: '工程師',
  employmentType: 'full_time_salary',
  sixMonthAverageSalary: 60_000,
  monthlySalary: 60_000,
  dailyWage: 0,
  lastYearTaxableIncome: 720_000,
  hasPropertyList: false,
  hasSalaryTransferRecord: true,
  hasLeaveCertificate: true,
  hasSalaryDeductionProof: true,
  actualLeaveDays: 15,
  doctorOrderedRestDays: 20,
}

describe('測試案例 2：有請假損失', () => {
  it('工作損失 = 60,000/30 × min(15, 20) = 30,000', () => {
    const w = computeWorkLoss(case2Person, '臺灣臺中地方法院')
    expect(w.dailyIncome).toBe(2_000)
    expect(w.reasonableRestDays).toBe(15)
    expect(w.amount).toBe(30_000)
  })

  it('第三人險乘 70%', () => {
    const input: ClaimInput = {
      basics: case2Basics,
      fault: case2Fault,
      person: case2Person,
      medical: {
        diagnosisText: '左手挫傷',
        hospitalName: '台中榮總',
        emergencyDate: '2026-08-01',
        outpatientVisitCount: 3,
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
        hasScar: false,
        scarLengthCm: 0,
        scarLocation: '',
        jointName: null,
        hasRangeOfMotionLimitation: false,
        romLossDegree: 0,
        romNormalDegree: 0,
        hasMuscleWeakness: false,
        hasSensoryLoss: false,
        hasPermanentImpairment: false,
      },
      medicalReceipts: {
        emergencyFee: 0,
        ambulanceFee: 1_500,
        nhiCopayment: 13_500,
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
        medicalMaterialFee: 0,
        assistiveDeviceFee: 0,
        transportationFee: 0,
        nursingFee: 0,
        nursingDays: 0,
        otherNecessaryMedicalFee: 0,
      },
      property: {
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
      },
    }
    const r = estimateClaim(input)
    // 強制險不包含工作損失
    expect(r.compulsoryMedicalApproved).toBe(15_000)
    expect(r.workLoss).toBe(30_000)
    // 第三人險: 30,000 工作損失 × 70% = 21,000 + 精神慰撫金（輕傷 5 萬左右 × 0.7）
    expect(r.thirdParty.thirdPartyEstimateMid).toBeGreaterThan(20_000)
    // 對方肇責 70% 須反映
    expect(r.thirdParty.liableAmountMid).toBe(Math.round(r.thirdParty.civilDamageTotalMid * 0.7))
  })
})

// --- 測試案例 3：有關節角度喪失（進失能初篩） ---

describe('測試案例 3：右踝 20 度 + 疤痕 10cm + 看護 10 日', () => {
  const med: MedicalRecord = {
    diagnosisText: '右踝擦傷併血腫，疤痕 10 公分，右踝關節活動角度喪失 20 度',
    hospitalName: '中國附醫',
    emergencyDate: '2026-08-15',
    outpatientVisitCount: 5,
    hospitalizationDays: 2,
    hasSurgery: false,
    hasRehabilitation: true,
    rehabilitationCount: 8,
    requiresNursingCare: true,
    nursingDays: 10,
    isSymptomFixed: false,
    hasDisabilityCertificate: false,
    hasClassADiagnosisCertificate: false,
    hasFracture: false,
    hasDislocation: false,
    hasLigamentInjury: false,
    hasNerveDamage: false,
    hasAmputation: false,
    hasOrganDamage: false,
    hasScar: true,
    scarLengthCm: 10,
    scarLocation: '右踝外側',
    jointName: 'ankle',
    hasRangeOfMotionLimitation: true,
    romLossDegree: 20,
    romNormalDegree: 50,
    hasMuscleWeakness: false,
    hasSensoryLoss: false,
    hasPermanentImpairment: false,
  }

  it('進失能初篩，B 或 C 級（資料不足 → B）', () => {
    const r = estimateClaim({
      basics: { ...case2Basics, accidentDate: '2026-08-15' },
      fault: { ...case2Fault, otherFaultRatio: 80 },
      person: case2Person,
      medical: med,
      medicalReceipts: {
        emergencyFee: 3_000,
        ambulanceFee: 1_500,
        nhiCopayment: 22_500,
        registrationFee: 500,
        diagnosisCertificateFee: 1_000,
        nonNhiNecessaryMedicalFee: 1_500,
        wardFeeDifference: 2_000,
        wardFeeDays: 2,
        mealFee: 360,
        mealDays: 2,
        prosthesisFee: 0,
        dentureFee: 0,
        missingTeethCount: 0,
        artificialEyeFee: 0,
        medicalMaterialFee: 0,
        assistiveDeviceFee: 0,
        transportationFee: 3_000,
        nursingFee: 12_000,
        nursingDays: 10,
        otherNecessaryMedicalFee: 0,
      },
      property: {
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
      },
    })
    // 失能初篩必須被觸發
    expect(['B', 'C', 'D']).toContain(r.disability.screening)
    expect(r.disability.romLossPercent).toBeCloseTo(40, 0)
    // 精神慰撫金放第三人險，不放強制險
    expect(r.compulsoryItems.find(i => i.key.includes('pas'))).toBeUndefined()
    // 第三人險有體傷金額
    expect(r.thirdParty.civilDamageTotalMid).toBeGreaterThan(0)
  })

  it('精神慰撫金 8 級評分（住院 2 + 復健 8 + 疤痕 10 + ROM 20°=B/C 級）', () => {
    const pas = computePainAndSuffering(med, '臺灣臺中地方法院')
    expect(pas.severityScore).toBeGreaterThan(15)  // 至少中度
    expect(pas.regionalMid).toBeGreaterThanOrEqual(pas.baseMid)
  })
})

// --- 測試案例 4：車損與財損 ---

describe('測試案例 4：車損', () => {
  it('修復 80,000 + 車價 100,000 - 殘值 30,000 = 取 70,000', () => {
    const v = computeVehicleDamage({
      vehicleRepairEstimate: 80_000,
      vehicleRepairInvoice: 0,
      vehicleMarketValueBeforeAccident: 100_000,
      salvageValue: 30_000,
      towingFee: 0,
      rentalCarFee: 0,
      phoneDamage: 0,
      helmetDamage: 0,
      clothingDamage: 0,
      glassesDamage: 0,
      otherPropertyDamage: 0,
    })
    expect(v).toBe(70_000)
  })

  it('修復 90,000 > 車價-殘值 70,000 → 取 70,000', () => {
    const v = computeVehicleDamage({
      vehicleRepairEstimate: 90_000,
      vehicleRepairInvoice: 0,
      vehicleMarketValueBeforeAccident: 100_000,
      salvageValue: 30_000,
      towingFee: 0,
      rentalCarFee: 0,
      phoneDamage: 0,
      helmetDamage: 0,
      clothingDamage: 0,
      glassesDamage: 0,
      otherPropertyDamage: 0,
    })
    expect(v).toBe(70_000)
  })

  it('財損加總', () => {
    const p = computePropertyDamage({
      vehicleRepairEstimate: 0,
      vehicleRepairInvoice: 0,
      vehicleMarketValueBeforeAccident: 0,
      salvageValue: 0,
      towingFee: 1_000,
      rentalCarFee: 5_000,
      phoneDamage: 20_000,
      helmetDamage: 3_000,
      clothingDamage: 0,
      glassesDamage: 0,
      otherPropertyDamage: 0,
    })
    expect(p).toBe(29_000)
  })
})

// --- 測試案例 5：強制險 + 第三人險混合（看顧 40 日） ---

describe('測試案例 5：看護 40 日 + 體傷 100 萬 / 財損 50 萬', () => {
  it('強制險看護只認 30 日（1,200 × 30 = 36,000）', () => {
    const r = estimateClaim({
      basics: { ...case2Basics, thirdPartyBodilyLimit: 1_000_000, thirdPartyPropertyLimit: 500_000 },
      fault: { ...case2Fault, otherFaultRatio: 50 },
      person: case2Person,
      medical: {
        diagnosisText: '左膝骨折',
        hospitalName: '',
        emergencyDate: '2026-08-01',
        outpatientVisitCount: 10,
        hospitalizationDays: 5,
        hasSurgery: true,
        hasRehabilitation: true,
        rehabilitationCount: 20,
        requiresNursingCare: true,
        nursingDays: 40,
        isSymptomFixed: false,
        hasDisabilityCertificate: false,
        hasClassADiagnosisCertificate: false,
        hasFracture: true,
        hasDislocation: false,
        hasLigamentInjury: false,
        hasNerveDamage: false,
        hasAmputation: false,
        hasOrganDamage: false,
        hasScar: true,
        scarLengthCm: 8,
        scarLocation: '左膝',
        jointName: 'knee',
        hasRangeOfMotionLimitation: true,
        romLossDegree: 30,
        romNormalDegree: 135,
        hasMuscleWeakness: true,
        hasSensoryLoss: false,
        hasPermanentImpairment: false,
      },
      medicalReceipts: {
        emergencyFee: 5_000,
        ambulanceFee: 2_000,
        nhiCopayment: 243_000,  // 250,000 總收據，強制險上限 200,000
        registrationFee: 500,
        diagnosisCertificateFee: 1_500,
        nonNhiNecessaryMedicalFee: 0,
        wardFeeDifference: 7_500,
        wardFeeDays: 5,
        mealFee: 900,
        mealDays: 5,
        prosthesisFee: 0,
        dentureFee: 0,
        missingTeethCount: 0,
        artificialEyeFee: 0,
        medicalMaterialFee: 5_000,
        assistiveDeviceFee: 8_000,
        transportationFee: 5_000,
        nursingFee: 48_000,  // 40 日 × 1,200
        nursingDays: 40,
        otherNecessaryMedicalFee: 0,
      },
      property: {
        vehicleRepairEstimate: 120_000,
        vehicleRepairInvoice: 0,
        vehicleMarketValueBeforeAccident: 0,
        salvageValue: 0,
        towingFee: 2_000,
        rentalCarFee: 0,
        phoneDamage: 0,
        helmetDamage: 0,
        clothingDamage: 0,
        glassesDamage: 0,
        otherPropertyDamage: 0,
      },
    })
    // 強制險總額上限 200,000
    expect(r.compulsoryMedicalApproved).toBe(200_000)
    // 看護 30 日被認可
    const nursingItem = r.compulsoryItems.find(i => i.key === 'nursingFee')!
    expect(nursingItem.approved).toBe(36_000)
  })
})

// --- 測試案例 6：因果關係爭議（事故 1/1、就醫 1/10） ---

describe('測試案例 6：因果關係爭議', () => {
  it('就醫距事故 9 天 → 觸發因果關係風險提示', () => {
    const r = estimateClaim({
      basics: { ...case2Basics, accidentDate: '2026-01-01' },
      fault: { ...case2Fault, otherFaultRatio: 100 },
      person: case2Person,
      medical: {
        diagnosisText: '腰椎疼痛，疑似舊疾惡化',
        hospitalName: '',
        emergencyDate: '2026-01-10',  // 事故後 9 天
        outpatientVisitCount: 3,
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
        hasScar: false,
        scarLengthCm: 0,
        scarLocation: '',
        jointName: null,
        hasRangeOfMotionLimitation: false,
        romLossDegree: 0,
        romNormalDegree: 0,
        hasMuscleWeakness: false,
        hasSensoryLoss: false,
        hasPermanentImpairment: false,
      },
      medicalReceipts: {
        emergencyFee: 0,
        ambulanceFee: 0,
        nhiCopayment: 50_000,
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
        medicalMaterialFee: 0,
        assistiveDeviceFee: 0,
        transportationFee: 0,
        nursingFee: 0,
        nursingDays: 0,
        otherNecessaryMedicalFee: 0,
      },
      property: {
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
      },
    })
    // 強制險先估
    expect(r.compulsoryMedicalApproved).toBe(50_000)
    // 因果關係提示必須出現
    const hasCausalityRisk = r.riskNotes.some(n => n.includes('因果關係'))
    expect(hasCausalityRisk).toBe(true)
    // 補件建議必須有因果關係
    const hasCausalitySupp = r.missingDocuments.some(n => n.includes('因果關係'))
    expect(hasCausalitySupp).toBe(true)
  })
})

// --- 細項測試：精神慰撫金評分函式 ---

describe('scoreSeverity 評分函式', () => {
  it('全無 → 0 分', () => {
    expect(scoreSeverity({
      hospitalizationDays: 0,
      rehabilitationCount: 0,
      scarLengthCm: 0,
      hasPermanentImpairment: false,
      hasDisability: false,
      hasSurgery: false,
      hasFracture: false,
      hasNerveDamage: false,
      hasAmputation: false,
      treatmentDurationDays: 0,
    })).toBe(0)
  })

  it('截肢 + 神經 → 至少 20 分', () => {
    expect(scoreSeverity({
      hospitalizationDays: 0,
      rehabilitationCount: 0,
      scarLengthCm: 0,
      hasPermanentImpairment: false,
      hasDisability: false,
      hasSurgery: false,
      hasFracture: false,
      hasNerveDamage: true,
      hasAmputation: true,
      treatmentDurationDays: 0,
    })).toBeGreaterThanOrEqual(20)
  })

  it('住院 15+ 復健 16+ 疤痕 10cm + 骨折 + 手術 → 重度', () => {
    const s = scoreSeverity({
      hospitalizationDays: 20,
      rehabilitationCount: 20,
      scarLengthCm: 12,
      hasPermanentImpairment: false,
      hasDisability: false,
      hasSurgery: true,
      hasFracture: true,
      hasNerveDamage: false,
      hasAmputation: false,
      treatmentDurationDays: 100,
    })
    expect(s).toBeGreaterThanOrEqual(50)
  })
})

describe('computeCivilMedicalExpense', () => {
  it('總收據 8,000、強制險認 8,000 → 民事 0', () => {
    expect(computeCivilMedicalExpense(8_000, 8_000)).toBe(0)
  })

  it('總收據 250,000、強制險認 200,000 → 民事 50,000', () => {
    expect(computeCivilMedicalExpense(250_000, 200_000)).toBe(50_000)
  })
})

describe('computeCivilNursingFee', () => {
  it('臺中地區 mid = 2,400 × 10 - 強制險看護', () => {
    const r = computeCivilNursingFee(
      { nursingFee: 12_000, nursingDays: 10 } as CompulsoryMedicalInputs,
      { nursingDays: 10 } as MedicalRecord,
      '臺灣臺中地方法院',
    )
    // 2,400 × 10 = 24,000 - 12,000 (強制險已認) = 12,000
    expect(r.mid).toBe(12_000)
  })
})

describe('computeLaborCapacityLoss', () => {
  it('無失能線索 → 0 / null', () => {
    const r = computeLaborCapacityLoss({
      hasDisabilityCertificate: false,
      hasPermanentImpairment: false,
      hasRangeOfMotionLimitation: false,
      hasNerveDamage: false,
    } as MedicalRecord)
    expect(r.estimate).toBe(0)
    expect(r.hint).toBeNull()
  })

  it('有線索 → 提示', () => {
    const r = computeLaborCapacityLoss({
      hasDisabilityCertificate: false,
      hasPermanentImpairment: true,
      hasRangeOfMotionLimitation: true,
      hasNerveDamage: false,
    } as MedicalRecord)
    expect(r.hint).toBeTruthy()
  })
})
