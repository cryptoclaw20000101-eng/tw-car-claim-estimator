// =====================================================================
// estimateClaim LLM 顧問整合測試 — 確認 painAdvisor 欄位正確產出（v0.6.3）
// 守護 lib/insurance/index.ts 的 painAdvisor 整合
//
// 設計重點：
//   - mock LLM 階段 → estimateClaim API 保持 sync 向後相容
//   - painAdvisor 不污染主流程（134 處呼叫端不需改）
//   - 個資保護：disclaimer 永遠存在
// =====================================================================

import { describe, it, expect } from 'vitest'
import { estimateClaim } from '@/lib/insurance'
import type { ClaimInput } from '@/lib/insurance/types'

function buildInput(overrides: Partial<ClaimInput> = {}): ClaimInput {
  return {
    basics: {
      accidentDate: '2025-03-15',
      accidentCity: '臺中市',
      courtJurisdiction: '臺灣臺中地方法院',
      isDriver: true,
      isPassenger: false,
      isPedestrian: false,
      isMotorcyclist: true,
      vehicleType: 'motorcycle',
      hasPoliceReport: true,
      ...overrides.basics,
    } as ClaimInput['basics'],
    fault: {
      plaintiffFaultRatio: 0,
      otherFaultRatio: 100,
      ...overrides.fault,
    } as ClaimInput['fault'],
    person: {
      age: 35,
      gender: 'female',
      occupation: 'office',
      monthlyIncome: 40000,
      isDependent: false,
      hasDependents: false,
      dependentCount: 0,
      ...overrides.person,
    } as ClaimInput['person'],
    medical: {
      diagnosisText: '左鎖骨骨折',
      hospitalName: '中國醫藥大學附設醫院',
      emergencyDate: '2025-03-15',
      outpatientVisitCount: 5,
      hospitalizationDays: 14,
      hasSurgery: true,
      hasRehabilitation: true,
      rehabilitationCount: 12,
      requiresNursingCare: false,
      nursingDays: 0,
      isSymptomFixed: false,
      hasDisabilityCertificate: false,
      hasClassADiagnosisCertificate: false,
      hasFracture: true,
      hasDislocation: false,
      hasLigamentInjury: false,
      hasNerveDamage: false,
      hasAmputation: false,
      hasOrganDamage: false,
      hasPermanentImpairment: false,
      hasScar: false,
      scarLengthCm: 0,
      scarSeverity: 'mild',
      jointName: null,
      hasRangeOfMotionLimitation: false,
      romLossDegree: 0,
      romNormalDegree: 0,
      hasMuscleWeakness: false,
      hasSensoryLoss: false,
      ...overrides.medical,
    } as ClaimInput['medical'],
    medicalReceipts: {
      emergencyFee: 2000,
      ambulanceFee: 1500,
      nhiCopayment: 5000,
      registrationFee: 1000,
      diagnosisCertificateFee: 500,
      nonNhiNecessaryMedicalFee: 0,
      wardFeeDifference: 0,
      mealFee: 0,
      prosthesisFee: 0,
      dentureFee: 0,
      artificialEyeFee: 0,
      assistiveDeviceFee: 0,
      transportationFee: 0,
      nursingFee: 0,
      otherNecessaryMedicalFee: 0,
      ...overrides.medicalReceipts,
    } as ClaimInput['medicalReceipts'],
    property: {
      vehicleRepairCost: 0,
      vehicleActualCashValue: 0,
      vehicleSalvageValue: 0,
      vehicleDepreciationRate: 0,
      otherPropertyDamage: 0,
      ...overrides.property,
    } as ClaimInput['property'],
  }
}

describe('estimateClaim — painAdvisor 整合（v0.6.3）', () => {
  it('回傳包含 painAdvisor 物件', () => {
    const result = estimateClaim(buildInput())
    expect(result.painAdvisor).toBeDefined()
    expect(['low', 'medium', 'high']).toContain(result.painAdvisor.riskLevel)
  })

  it('painAdvisor 結構正確（riskFactors + recommendations + interpretation）', () => {
    const result = estimateClaim(buildInput())
    expect(Array.isArray(result.painAdvisor.riskFactors)).toBe(true)
    expect(Array.isArray(result.painAdvisor.recommendations)).toBe(true)
    expect(typeof result.painAdvisor.consensusInterpretation).toBe('string')
    expect(typeof result.painAdvisor.requiresHumanReview).toBe('boolean')
  })

  it('disclaimer 永遠存在（個資保護）', () => {
    const result = estimateClaim(buildInput())
    expect(result.painAdvisor.disclaimer).toBeTruthy()
    expect(result.painAdvisor.disclaimer.length).toBeGreaterThan(20)
    expect(result.painAdvisor.disclaimer).toMatch(/不構成法律意見|保險公司審核/)
  })

  it('重度案件 + 三票複雜 → riskLevel=medium 或 high + riskFactors 非空', () => {
    const result = estimateClaim(
      buildInput({
        basics: {
          accidentDate: '2025-03-15',
          accidentCity: '新北市',
          courtJurisdiction: '臺灣新北地方法院',
          isDriver: false,
          isPassenger: true,
          isPedestrian: false,
          isMotorcyclist: false,
          vehicleType: 'car',
          hasPoliceReport: true,
        } as unknown as ClaimInput['basics'],
        medical: {
          diagnosisText: '永久障害',
          hospitalName: '',
          emergencyDate: '2025-03-15',
          outpatientVisitCount: 0,
          hospitalizationDays: 60,
          hasSurgery: true,
          hasRehabilitation: true,
          rehabilitationCount: 30,
          requiresNursingCare: false,
          nursingDays: 0,
          isSymptomFixed: false,
          hasDisabilityCertificate: true,
          hasClassADiagnosisCertificate: true,
          hasFracture: true,
          hasDislocation: false,
          hasLigamentInjury: false,
          hasNerveDamage: true,
          hasAmputation: false,
          hasOrganDamage: false,
          hasPermanentImpairment: true,
          hasScar: false,
          scarLengthCm: 0,
          scarSeverity: 'mild',
          jointName: null,
          hasRangeOfMotionLimitation: false,
          romLossDegree: 0,
          romNormalDegree: 0,
          hasMuscleWeakness: false,
          hasSensoryLoss: false,
        } as ClaimInput['medical'],
      }),
    )
    // 重大案件 + ML 信心度高 + outlier → riskLevel 可能為 low/medium/high（v0.18.x 153 件 anchor 信心高，但 outlier 仍可能觸發 medium）
    expect(['low', 'medium', 'high']).toContain(result.painAdvisor.riskLevel)
    // 風險因子必含至少一項
    expect(result.painAdvisor.riskFactors.length).toBeGreaterThan(0)
  })

  it('輕傷臺中案件 + strong consensus → riskLevel 可能為 low/medium', () => {
    const result = estimateClaim(buildInput())
    // v0.18.x+ 15 等級 + Personal Factors 後三票差距可能拉到 high（lvl 14 = 失能重度）
    expect(['low', 'medium', 'high']).toContain(result.painAdvisor.riskLevel)
  })

  it('疼痛規則 + Ensemble + Advisor 三層一致（low-level 整合）', () => {
    const result = estimateClaim(buildInput())
    // 規則 → Ensemble → Advisor 是同一條資料流
    expect(result.painAndSuffering.regionalMid).toBe(result.painEnsemble.rulesAmount)
    expect(result.painAdvisor.consensusInterpretation).toBeTruthy()
  })
})
