/**
 * mergeStep 5 步對映測試（commit 4a RED → 4c GREEN）
 *
 * 對應 use case：
 * - 表單 7 → 5 步重構（commit 4b）
 * - Step 4（傷勢與診斷）→ medical
 * - Step 5（費用與財損）→ receipts + property 同時合併
 *
 * 為什麼是 mergeStep 自己的測試，不是 E2E：
 * - mergeStep 是純函式，邏輯可在 unit test 完全鎖死
 * - E2E form-flow 只驗證 round-trip，不驗證 merge 細節
 * - 若 mergeStep 在 React 19 更新時序下漏合併某 section，unit test 立刻紅
 *
 * 不變量（測試守護）：
 * 1. step 0/1/2/3 各合併對應 section
 * 2. step 4 同時合併 receipts + property 兩個 section
 * 3. 淺合併冪等：prev.receipts 既有欄位不會被 values.receipts undefined 蓋掉
 */

import { describe, expect, it } from 'vitest'
import { mergeStep } from '../../app/claims/new/_form'
import type { FormSchema } from '../../app/claims/new/_form'
import type {
  AccidentBasics,
  FaultInfo,
  MedicalRecord,
  PersonalIncome,
  PropertyDamageInputs,
  CompulsoryMedicalInputs,
} from '../../lib/insurance/types'

const makeBasics = (): AccidentBasics => ({
  accidentDate: '2026-03-15',
  accidentLocation: '臺中市西區',
  accidentType: 'car_to_car',
  injuredRole: 'driver_car',
  isInjured: true, // v0.26.0e+
  isAutomobileAccident: true,
  hasPolicePreliminaryReport: true,
  hasAccidentAppraisal: false,
  hasCompulsoryInsurance: true,
  accidentCity: '臺中市',
  accidentDistrict: '西區',
  claimantResidenceCity: '臺中市',
  claimantResidenceDistrict: '西區',
  defendantResidenceCity: '臺北市',
  defendantResidenceDistrict: '大安區',
  courtJurisdiction: '臺灣臺中地方法院',
  insuranceCompanyBranchRegion: '中部',
})

const makeFault = (): FaultInfo => ({
  selfFaultRatio: 30,
  otherFaultRatio: 70,
  faultSource: 'police_preliminary',
  isFaultDisputed: false,
})

const makePerson = (): PersonalIncome => ({
  birthDate: '1990-01-01',
  age: 36,
  occupation: '工程師',
  employmentType: 'full_time_salary',
  sixMonthAverageSalary: 60000,
  monthlySalary: 60000,
  dailyWage: 2000,
  lastYearTaxableIncome: 720000,
  hasPropertyList: false,
  hasSalaryTransferRecord: true,
  hasLeaveCertificate: true,
  hasSalaryDeductionProof: false,
  actualLeaveDays: 7,
  doctorOrderedRestDays: 14,
})

const makeMedical = (over: Partial<MedicalRecord> = {}): MedicalRecord => ({
  diagnosisText: '右肩旋轉肌腱破裂',
  hospitalName: '臺中榮總',
  emergencyDate: '2026-03-15',
  outpatientVisitCount: 5,
  hospitalizationDays: 3,
  hasSurgery: true,
  hasRehabilitation: true,
  rehabilitationCount: 12,
  requiresNursingCare: false,
  nursingDays: 0,
  isSymptomFixed: true,
  hasDisabilityCertificate: false,
  hasFracture: false,
  hasDislocation: false,
  hasLigamentInjury: true,
  hasNerveDamage: false,
  hasAmputation: false,
  hasOrganDamage: false,
  hasScar: true,
  scarLengthCm: 5,
  scarLocation: '右肩',
  jointName: null,
  hasRangeOfMotionLimitation: true,
  romLossDegree: 30,
  romNormalDegree: 180,
  hasMuscleWeakness: false,
  hasSensoryLoss: false,
  hasPermanentImpairment: false,
  ...over,
})

const makeReceipts = (over: Partial<CompulsoryMedicalInputs> = {}): CompulsoryMedicalInputs => ({
  emergencyFee: 1500,
  ambulanceFee: 800,
  nhiCopayment: 10000, // user 反饋：醫療費 1 萬必進入估算
  registrationFee: 500,
  diagnosisCertificateFee: 200,
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
  ...over,
})

const makeProperty = (over: Partial<PropertyDamageInputs> = {}): PropertyDamageInputs => ({
  vehicleRepairEstimate: 0, // 預設全 0（對齊 _form.tsx DEFAULT_PROPERTY）
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
  ...over,
})

const makeSchema = (): FormSchema => ({
  basics: makeBasics(),
  fault: makeFault(),
  person: makePerson(),
  medical: makeMedical(),
  receipts: makeReceipts(),
  property: makeProperty(),
})

describe('mergeStep — 5 步對映', () => {
  it('step 0 合併 basics section', () => {
    const prev = makeSchema()
    const updated: Partial<FormSchema> = {
      basics: { ...prev.basics, accidentLocation: '高雄市前鎮區' },
    }
    const result = mergeStep(prev, 0, updated)
    expect(result.basics.accidentLocation).toBe('高雄市前鎮區')
    // 其他 section 不變
    expect(result.fault).toEqual(prev.fault)
    expect(result.receipts).toEqual(prev.receipts)
  })

  it('step 1 合併 fault section', () => {
    const prev = makeSchema()
    const updated: Partial<FormSchema> = {
      fault: { ...prev.fault, selfFaultRatio: 50, otherFaultRatio: 50 },
    }
    const result = mergeStep(prev, 1, updated)
    expect(result.fault.selfFaultRatio).toBe(50)
    expect(result.fault.otherFaultRatio).toBe(50)
  })

  it('step 2 合併 person section', () => {
    const prev = makeSchema()
    const updated: Partial<FormSchema> = {
      person: { ...prev.person, actualLeaveDays: 30 },
    }
    const result = mergeStep(prev, 2, updated)
    expect(result.person.actualLeaveDays).toBe(30)
  })

  it('step 3 合併 medical section', () => {
    const prev = makeSchema()
    const updated: Partial<FormSchema> = {
      medical: { ...prev.medical, diagnosisText: '左膝半月板破裂' },
    }
    const result = mergeStep(prev, 3, updated)
    expect(result.medical.diagnosisText).toBe('左膝半月板破裂')
  })

  // 這是 user 反饋明確要求的核心守護：
  // 表單 4→5 步後 Step 5 = 費用與財損，需同時合併 receipts + property
  it('step 4 同時合併 receipts + property（user 反饋必進估算）', () => {
    const prev = makeSchema()
    const updated: Partial<FormSchema> = {
      receipts: { ...prev.receipts, nhiCopayment: 10000 }, // 醫療費 1 萬
      property: { ...prev.property, vehicleRepairInvoice: 50000 }, // 車損 5 萬
    }
    const result = mergeStep(prev, 4, updated)

    // 兩個 section 都要被合併
    expect(result.receipts.nhiCopayment).toBe(10000)
    expect(result.property.vehicleRepairInvoice).toBe(50000)
    // 其他 section 不變
    expect(result.basics).toEqual(prev.basics)
    expect(result.medical).toEqual(prev.medical)
  })

  it('step 4 部分合併：只給 receipts 不給 property，property 保持 prev 既有值', () => {
    const prev = makeSchema()
    const updated: Partial<FormSchema> = {
      receipts: { ...prev.receipts, emergencyFee: 9999 },
    }
    const result = mergeStep(prev, 4, updated)
    expect(result.receipts.emergencyFee).toBe(9999)
    // property 沒動，仍是 prev 的 0（mergeStep 不該清空）
    expect(result.property.vehicleRepairInvoice).toBe(0)
  })

  it('step 4 冪等：同 values 連續 merge 兩次結果相同', () => {
    const prev = makeSchema()
    const updated: Partial<FormSchema> = {
      receipts: { ...prev.receipts, nhiCopayment: 10000 },
      property: { ...prev.property, vehicleRepairInvoice: 50000 },
    }
    const r1 = mergeStep(prev, 4, updated)
    const r2 = mergeStep(r1, 4, updated)
    expect(r2.receipts.nhiCopayment).toBe(10000)
    expect(r2.property.vehicleRepairInvoice).toBe(50000)
  })

  it('超出範圍的 step 數字 fallback 到 basics（不爆炸）', () => {
    const prev = makeSchema()
    const updated: Partial<FormSchema> = {
      basics: { ...prev.basics, accidentLocation: '花蓮縣' },
    }
    const result = mergeStep(prev, 999, updated)
    // 既有邏輯 fallback 到 'basics'（不會 throw）
    expect(result.basics.accidentLocation).toBe('花蓮縣')
  })
})
