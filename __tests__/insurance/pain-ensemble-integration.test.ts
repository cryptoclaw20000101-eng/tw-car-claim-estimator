// =====================================================================
// estimateClaim Ensemble 整合測試 — 確認 painEnsemble 欄位正確產出（v0.6.2）
// 守護 lib/insurance/index.ts 的 painEnsemble 整合
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

describe('estimateClaim — painEnsemble 整合（v0.6.2）', () => {
  it('回傳包含 painEnsemble 物件', () => {
    const result = estimateClaim(buildInput())
    expect(result.painEnsemble).toBeDefined()
    expect(['strong', 'partial', 'weak', 'insufficient']).toContain(result.painEnsemble.consensus)
  })

  it('僅有總賠償資料時，不把 KNN 混入慰撫金', () => {
    const result = estimateClaim(buildInput())
    expect(result.painEnsemble.rulesAmount).toBeGreaterThan(0)
    expect(result.painEnsemble.mlAmount).toBeGreaterThan(0)
    expect(result.painEnsemble.knnAmount).toBeNull()
    expect(result.painEnsemble.knnWeight).toBe(0)
  })

  it('共識度為 strong / partial / weak（給臺中案件）', () => {
    const result = estimateClaim(buildInput())
    // v0.18.x+ 15 等級 + Personal Factors 後規則 vs ML 落差變大
    // 改寬接受 weak（仍需排除 'none' 失敗情況）
    expect(['strong', 'partial', 'weak']).toContain(result.painEnsemble.consensus)
  })

  it('共識金額為正數且落在可比較的規則與歷史資料範圍內', () => {
    const result = estimateClaim(buildInput())
    if (result.painEnsemble.consensusAmount !== null) {
      const maxTicket = Math.max(result.painEnsemble.rulesAmount, result.painEnsemble.mlAmount)
      expect(result.painEnsemble.consensusAmount).toBeLessThanOrEqual(maxTicket)
      expect(result.painEnsemble.consensusAmount).toBeGreaterThan(0)
    }
  })

  it('權重反映 ML 信心度', () => {
    const result = estimateClaim(buildInput())
    // v0.18.x 153 件 anchor → high → mlWeight = 1.0
    expect(result.painEnsemble.mlWeight).toBe(1.0)
  })

  it('重度案件仍不以總賠償 KNN 金額作為慰撫金票', () => {
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
    expect(result.painEnsemble.knnAmount).toBeNull()
    // 不具體斷定 consensus，但必須是合法值
    expect(['strong', 'partial', 'weak']).toContain(result.painEnsemble.consensus)
  })
})
