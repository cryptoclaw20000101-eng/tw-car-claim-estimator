// =====================================================================
// estimateClaim 整合測試 — 確認 painML 欄位正確產出（v0.6.0）
// 守護 lib/insurance/index.ts 的 painML + painReconcile 整合
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

describe('estimateClaim — painML 整合（v0.6.0）', () => {
  it('回傳包含 painML 物件', () => {
    const result = estimateClaim(buildInput())
    expect(result.painML).toBeDefined()
    expect(result.painML.lower).toBeGreaterThan(0)
    expect(result.painML.mid).toBeGreaterThan(0)
    expect(result.painML.upper).toBeGreaterThan(0)
  })

  it('painML 區間單調遞增', () => {
    const result = estimateClaim(buildInput())
    expect(result.painML.lower).toBeLessThanOrEqual(result.painML.mid)
    expect(result.painML.mid).toBeLessThanOrEqual(result.painML.upper)
  })

  it('painML 信心度 + method 標籤正確', () => {
    const result = estimateClaim(buildInput())
    expect(['high', 'medium', 'low']).toContain(result.painML.confidence)
    expect(['ml_v1_ensemble', 'heuristic_only', 'fallback']).toContain(result.painML.method)
    // 13 件 anchor → medium
    expect(result.painML.confidence).toBe('medium')
    expect(result.painML.method).toBe('ml_v1_ensemble')
  })

  it('painML 與規則 painAndSuffering 落差合理（agree）', () => {
    const result = estimateClaim(buildInput())
    expect(result.painML.reconcile.status).toBe('agree')
  })

  it('重度案件 painML severity level 對應', () => {
    const result = estimateClaim(
      buildInput({
        medical: {
          diagnosisText: '多處骨折',
          hospitalName: '',
          emergencyDate: '2025-03-15',
          outpatientVisitCount: 0,
          hospitalizationDays: 30,
          hasSurgery: true,
          hasRehabilitation: true,
          rehabilitationCount: 20,
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
        },
      })
    )
    // 30 天住院 + 骨折 + 手術 + 復健 → severity 6 (嚴重)
    expect(result.painML.severityLevel).toBeGreaterThanOrEqual(5)
    expect(result.painML.upper).toBeGreaterThanOrEqual(300_000)
  })
})
