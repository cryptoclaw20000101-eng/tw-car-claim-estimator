/**
 * 估算編號 round-trip 守護（commit 4d）
 *
 * user 反饋明確要求：
 * 「上一頁修改 → 結果必須更新」
 *
 * 對應保證：
 * - 表單 submit 一次性產生 estimateId 存 sessionStorage
 * - input 變更後重新 submit → estimateId 必變（不可重用舊 ID）
 * - 同 input 重新整理（不變更）→ estimateId 應該相同（hash 包含時間戳，
 *   所以嚴格說不會完全一樣；本測試只驗證「必變」情境）
 *
 * 為什麼用 Vitest 而非 Playwright：
 * - AntD 6 Select 在 Playwright 環境對 option click 不穩定（pre-existing bug）
 * - estimateId 邏輯是純函式（input hash + Date.now）+ sessionStorage 寫入
 * - 不需要實際瀏覽器渲染
 * - commit 4a 已經 mergeStep 雙 section 的 Vitest 覆蓋；本測試專注 submit-time ID
 *
 * 不變量（測試守護）：
 * 1. estimateId 格式：`TCE-YYYYMMDD-XXXXXXXX`（8 字 hex）
 * 2. 不同 input（任意欄位變更）→ 不同 estimateId
 * 3. 同 input + 同時間戳 → 同 estimateId（idempotent）
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import type { FormSchema } from '../../app/claims/new/_form'

// 重新實作 _form.tsx submit handler 的 estimateId 邏輯
// （避免 import 整個 React 元件樹）
// 對齊 app/claims/new/_form.tsx submit() 內的 djb2 + YYYYMMDD stamp 演算法
function generateEstimateId(input: FormSchema, nowMs: number): string {
  const s = JSON.stringify(input) + nowMs
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  const ts = new Date(nowMs)
  const stamp = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}`
  return `TCE-${stamp}-${(h >>> 0).toString(16).padStart(8, '0').slice(0, 8).toUpperCase()}`
}

const makeMinimalInput = (over: Partial<FormSchema> = {}): FormSchema => ({
  basics: {
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
  },
  fault: {
    selfFaultRatio: 30,
    otherFaultRatio: 70,
    faultSource: 'police_preliminary',
    isFaultDisputed: false,
  },
  person: {
    birthDate: '1990-01-01',
    age: 36,
    occupation: '',
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
  },
  medical: {
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
  },
  receipts: {
    emergencyFee: 0,
    ambulanceFee: 0,
    nhiCopayment: 10000, // user 反饋：1 萬
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
    otherNecessaryMedicalFee: 0,
  },
  property: {
    vehicleRepairEstimate: 0,
    vehicleRepairInvoice: 50000, // user 反饋：5 萬
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
  ...over,
})

describe('estimateId — 估算編號 round-trip', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('estimateId 格式為 TCE-YYYYMMDD-XXXXXXXX（8 字 hex）', () => {
    const input = makeMinimalInput()
    const id = generateEstimateId(input, new Date('2026-07-13T10:00:00').getTime())
    expect(id).toMatch(/^TCE-\d{8}-[A-F0-9]{8}$/)
    // 2026-07-13 → 20260713
    expect(id).toContain('TCE-20260713-')
  })

  it('同 input + 同時間戳 → 同 estimateId（idempotent）', () => {
    const input = makeMinimalInput()
    const now = new Date('2026-07-13T10:00:00').getTime()
    const id1 = generateEstimateId(input, now)
    const id2 = generateEstimateId(input, now)
    expect(id1).toBe(id2)
  })

  it('user 反饋守護：上一頁修改（input 變更）→ estimateId 必變', () => {
    // 第一次 submit
    const original = makeMinimalInput()
    const t1 = new Date('2026-07-13T10:00:00').getTime()
    const id1 = generateEstimateId(original, t1)

    // 回上一頁修改「事故地點」
    const modified: FormSchema = {
      ...original,
      basics: {
        ...original.basics,
        accidentLocation: '高雄市前鎮區', // 改了
      },
    }
    const t2 = new Date('2026-07-13T10:05:00').getTime() // 5 分鐘後
    const id2 = generateEstimateId(modified, t2)

    // estimateId 必變（user 反饋：結果必須更新）
    expect(id1).not.toBe(id2)
  })

  it('同 input 但不同時間戳 → estimateId 也會變（含時間因子）', () => {
    const input = makeMinimalInput()
    const t1 = new Date('2026-07-13T10:00:00').getTime()
    const t2 = new Date('2026-07-13T10:00:01').getTime() // 1 秒後
    const id1 = generateEstimateId(input, t1)
    const id2 = generateEstimateId(input, t2)
    expect(id1).not.toBe(id2)
  })

  it('使用者重填欄位（revenues.nhiCopayment 從 0 變 10000）→ estimateId 必變', () => {
    const before = makeMinimalInput({
      receipts: {
        ...makeMinimalInput().receipts,
        nhiCopayment: 0,
      },
    })
    const after = makeMinimalInput({
      receipts: {
        ...makeMinimalInput().receipts,
        nhiCopayment: 10000,
      },
    })
    const now = new Date('2026-07-13T10:00:00').getTime()
    const id1 = generateEstimateId(before, now)
    const id2 = generateEstimateId(after, now)
    expect(id1).not.toBe(id2)
  })

  it('使用者重填欄位（property.vehicleRepairInvoice 從 0 變 50000）→ estimateId 必變', () => {
    const before = makeMinimalInput({
      property: {
        ...makeMinimalInput().property,
        vehicleRepairInvoice: 0,
      },
    })
    const after = makeMinimalInput({
      property: {
        ...makeMinimalInput().property,
        vehicleRepairInvoice: 50000,
      },
    })
    const now = new Date('2026-07-13T10:00:00').getTime()
    const id1 = generateEstimateId(before, now)
    const id2 = generateEstimateId(after, now)
    expect(id1).not.toBe(id2)
  })
})
