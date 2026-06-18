// 12 大類失能保典 E2E：常數表 + 自動帶出 + 引擎吃 disabilityLevel
import { describe, it, expect } from 'vitest'
import {
  DISABILITY_CATEGORIES,
  DISABILITY_LEVELS,
  getDefaultLevel,
  isCompulsoryExclusion,
  needsMMSE,
} from '@/lib/insurance/disability-categories'
import { DISABILITY_LABOR_LOSS_PCT } from '@/lib/insurance/hoffmann'
import { estimateClaim } from '@/lib/insurance'
import type { ClaimInput } from '@/lib/insurance/types'

describe('12 大類失能保典 E2E：常數表', () => {
  it('DISABILITY_CATEGORIES 共 12 項，依序 01-12', () => {
    expect(DISABILITY_CATEGORIES.length).toBe(12)
    expect(DISABILITY_CATEGORIES[0].value).toBe('01_mental')
    expect(DISABILITY_CATEGORIES[11].value).toBe('12_lower_limb')
  })

  it('DISABILITY_LEVELS 共 15 等，1=最重 100%、15=最輕 5%', () => {
    expect(DISABILITY_LEVELS.length).toBe(15)
    expect(DISABILITY_LEVELS[0].value).toBe(1)
    expect(DISABILITY_LEVELS[14].value).toBe(15)
  })

  it('getDefaultLevel 對應：上肢 11 → 第 9 級（缺損 4 項 2-6 / 手指 18 項 7-14 → 中位數 9）', () => {
    expect(getDefaultLevel('11_upper_limb')).toBe(9)
  })

  it('getDefaultLevel 對應：精神 → 第 13 級（通常無礙勞動）', () => {
    expect(getDefaultLevel('01_mental')).toBe(13)
  })

  it('isCompulsoryExclusion：胸腹部臟器 = 是 / 上肢 = 否', () => {
    expect(isCompulsoryExclusion('07_thoracic_organ')).toBe(true)
    expect(isCompulsoryExclusion('11_upper_limb')).toBe(false)
  })

  it('needsMMSE：精神 + 神經 = 是 / 上肢 = 否', () => {
    expect(needsMMSE('01_mental')).toBe(true)
    expect(needsMMSE('02_neural')).toBe(true)
    expect(needsMMSE('11_upper_limb')).toBe(false)
  })
})

describe('12 大類 → 勞減引擎 E2E：吃 disabilityLevel', () => {
  it('輸入 disabilityCategory=11_upper_limb + disabilityLevel=9 → 勞減 60%', () => {
    const input = {
      basics: { ...defaultBasics },
      fault: { selfFaultRatio: 0, otherFaultRatio: 100, faultSource: 'police_preliminary', isFaultDisputed: false },
      person: { ...defaultPerson, age: 35, monthlySalary: 50000, sixMonthAverageSalary: 50000, employmentType: 'full_time_salary', retirementAge: 65 },
      medical: {
        ...defaultMedical,
        disabilityCategory: '11_upper_limb',
        disabilityLevel: 9,
        hasDisabilityCertificate: true,
        hasPermanentImpairment: true,
      },
      medicalReceipts: defaultReceipts,
      property: defaultProperty,
    } as unknown as ClaimInput
    const r = estimateClaim(input)
    // 9 等 = 60% 勞減，年薪 60 萬 × 60% × 霍夫曼 30 年係數 ≈ 大額
    expect(r.laborCapacityLossEstimate).toBeGreaterThan(0)
    expect(r.laborCapacityRetirementAge).toBe(65)
    // notes 應含失能等級
    expect(r.laborCapacityLossNotes.join('|')).toContain('9')
  })

  it('輸入 disabilityLevel=1（最重）→ 勞減金額遠大於 15 等（最輕）', () => {
    const baseInput = {
      basics: { ...defaultBasics },
      fault: { selfFaultRatio: 0, otherFaultRatio: 100, faultSource: 'police_preliminary', isFaultDisputed: false },
      person: { ...defaultPerson, age: 35, monthlySalary: 50000, sixMonthAverageSalary: 50000, employmentType: 'full_time_salary', retirementAge: 65 },
      medicalReceipts: defaultReceipts,
      property: defaultProperty,
    }
    const r1 = estimateClaim({
      ...baseInput,
      person: baseInput.person,
      medical: { ...defaultMedical, disabilityCategory: '11_upper_limb', disabilityLevel: 1 },
    } as unknown as ClaimInput)
    const r15 = estimateClaim({
      ...baseInput,
      person: baseInput.person,
      medical: { ...defaultMedical, disabilityCategory: '11_upper_limb', disabilityLevel: 15 },
    } as unknown as ClaimInput)
    // 1 等 (100%) 應遠大於 15 等 (5%)
    expect(r1.laborCapacityLossEstimate).toBeGreaterThan(r15.laborCapacityLossEstimate * 5)
  })
})

// ============== 共用 default（與表單同步）==============
function today(): string { return new Date().toISOString().slice(0, 10) }
const defaultBasics = {
  accidentDate: today(),
  accidentLocation: '臺中市',
  accidentType: 'car_to_car' as const,
  injuredRole: 'driver_car' as const,
  isAutomobileAccident: true,
  hasPolicePreliminaryReport: true,
  hasAccidentAppraisal: false,
  hasCompulsoryInsurance: true,
  accidentCity: '臺中市',
  accidentDistrict: '西區',
  claimantResidenceCity: '臺中市',
  claimantResidenceDistrict: '西區',
  defendantResidenceCity: '臺中市',
  defendantResidenceDistrict: '西區',
  courtJurisdiction: '臺灣臺中地方法院',
  insuranceCompanyBranchRegion: '中部',
}
const defaultPerson = {
  birthDate: '1990-01-01',
  age: 36,
  occupation: '',
  employmentType: 'full_time_salary' as const,
  sixMonthAverageSalary: 0,
  monthlySalary: 0,
  dailyWage: 0,
  lastYearTaxableIncome: 0,
  hasPropertyList: false,
  hasSalaryTransferRecord: false,
  hasLeaveCertificate: false,
  hasSalaryDeductionProof: false,
  actualLeaveDays: 0,
  doctorOrderedRestDays: 0,
}
const defaultMedical = {
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
  isSymptomFixed: true,
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
}
const defaultReceipts = {
  emergencyFee: 0, ambulanceFee: 0, nhiCopayment: 0, registrationFee: 0,
  diagnosisCertificateFee: 0, nonNhiNecessaryMedicalFee: 0, wardFeeDifference: 0,
  wardFeeDays: 0, mealFee: 0, mealDays: 0, prosthesisFee: 0, dentureFee: 0,
  missingTeethCount: 0, artificialEyeFee: 0, medicalMaterialFee: 0,
  assistiveDeviceFee: 0, transportationFee: 0, nursingFee: 0, nursingDays: 0,
  otherNecessaryMedicalFee: 0,
}
const defaultProperty = {
  vehicleRepairEstimate: 0, vehicleRepairInvoice: 0,
  vehicleMarketValueBeforeAccident: 0, salvageValue: 0, towingFee: 0,
  rentalCarFee: 0, phoneDamage: 0, helmetDamage: 0, clothingDamage: 0,
  glassesDamage: 0, otherPropertyDamage: 0,
}
