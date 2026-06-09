/**
 * 估算範例 — 給「看估算範例」CTA 用
 *
 * taste-skill v1 紀律：
 * - 純資料檔（pure data，零邏輯）
 * - 30 歲女工程師在台中市西屯區遭汽車擦撞，
 *   右膝骨折、住院 7 天、請假 30 天
 * - 對方肇責 70%（有警方初步研判表）
 * - 第三人責任險體傷 200 萬、財損 50 萬
 * - 計算引擎（estimateClaim）直接吃這份資料 → 給使用者看完整 demo 結果
 *
 * 為何獨立檔：
 * 1. 不污染 types.ts（types 留給型別定義）
 * 2. 不污染測試 fixture（測試要在 vitest 環境跑，本檔是 client runtime 用）
 * 3. 未來要新增示範情境（高失能、低肇責等）直接加 const 即可
 */

import type { ClaimInput } from './types'

export const SAMPLE_INPUT: ClaimInput = {
  basics: {
    accidentDate: '2026-05-12',
    accidentLocation: '台中市西屯區台灣大道三段與河南路口',
    accidentType: 'car_to_motorcycle',
    injuredRole: 'driver_motorcycle',
    isAutomobileAccident: true,
    hasPolicePreliminaryReport: true,
    hasAccidentAppraisal: false,
    isSettled: false,
    hasCompulsoryInsurance: true,
    hasThirdPartyInsurance: true,
    thirdPartyBodilyLimit: 2_000_000,
    thirdPartyPropertyLimit: 500_000,
    excessLiabilityLimit: 0,
    accidentCity: '台中市',
    accidentDistrict: '西屯區',
    claimantResidenceCity: '台中市',
    claimantResidenceDistrict: '西屯區',
    defendantResidenceCity: '台中市',
    defendantResidenceDistrict: '西屯區',
    courtJurisdiction: '',
    insuranceCompanyBranchRegion: '中區',
  },
  fault: {
    selfFaultRatio: 30,
    otherFaultRatio: 70,
    faultSource: 'police_preliminary',
    isFaultDisputed: false,
  },
  person: {
    birthDate: '1995-08-22',
    age: 30,
    occupation: '軟體工程師',
    employmentType: 'full_time_salary',
    sixMonthAverageSalary: 62_000,
    monthlySalary: 62_000,
    dailyWage: 0,
    lastYearTaxableIncome: 744_000,
    hasPropertyList: false,
    hasSalaryTransferRecord: true,
    hasLeaveCertificate: true,
    hasSalaryDeductionProof: true,
    actualLeaveDays: 30,
    doctorOrderedRestDays: 45,
  },
  medical: {
    diagnosisText: '右側脛骨平台骨折，伴隨膝關節積血',
    hospitalName: '中山醫學大學附設醫院',
    emergencyDate: '2026-05-12',
    outpatientVisitCount: 8,
    hospitalizationDays: 7,
    hasSurgery: true,
    hasRehabilitation: true,
    rehabilitationCount: 24,
    requiresNursingCare: true,
    nursingDays: 14,
    isSymptomFixed: true,
    hasDisabilityCertificate: false,
    hasClassADiagnosisCertificate: true,
    hasFracture: true,
    hasDislocation: false,
    hasLigamentInjury: true,
    hasNerveDamage: false,
    hasAmputation: false,
    hasOrganDamage: false,
    hasScar: true,
    scarLengthCm: 8,
    scarLocation: '右膝外側手術傷口',
    jointName: 'knee',
    hasRangeOfMotionLimitation: true,
    romLossDegree: 35,
    romNormalDegree: 130,
    hasMuscleWeakness: true,
    hasSensoryLoss: false,
    hasPermanentImpairment: true,
  },
  medicalReceipts: {
    emergencyFee: 2_800,
    ambulanceFee: 1_200,
    nhiCopayment: 12_400,
    registrationFee: 1_600,
    diagnosisCertificateFee: 4_500,
    nonNhiNecessaryMedicalFee: 8_200,
    wardFeeDifference: 3_500,
    wardFeeDays: 7,
    mealFee: 2_100,
    mealDays: 7,
    prosthesisFee: 0,
    dentureFee: 0,
    missingTeethCount: 0,
    artificialEyeFee: 0,
    specialMaterialFee: 30_000,  // v0.2.5+ demo：骨材/鋼板/特材 30,000（與輔具共套 2 萬上限）
    medicalMaterialFee: 8_000,    // v0.2.5+ demo：一般醫材（紗布/縫線）8,000（不再套 2 萬上限）
    assistiveDeviceFee: 8_500,    // 拐杖/輪椅/支架（與特殊材料共套 2 萬上限）
    // 強制險算式：special 30,000 + assistive 8,500 = 38,500 超出 2 萬 → pro-rata 0.519
    //   特殊材料 approved ≈ 15,584, 輔具 approved ≈ 4,416, 合計 20,000
    transportationFee: 4_200,
    nursingFee: 24_000,
    nursingDays: 14,
    otherNecessaryMedicalFee: 1_800,
  },
  property: {
    vehicleRepairEstimate: 86_000,
    vehicleRepairInvoice: 0,
    vehicleMarketValueBeforeAccident: 120_000,
    salvageValue: 0,
    towingFee: 3_000,
    rentalCarFee: 18_000,
    phoneDamage: 12_900,
    helmetDamage: 4_500,
    clothingDamage: 3_200,
    glassesDamage: 0,
    otherPropertyDamage: 0,
  },
}
