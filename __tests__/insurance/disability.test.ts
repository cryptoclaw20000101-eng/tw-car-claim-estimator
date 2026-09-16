// =====================================================================
// 失能規則引擎 — legal-audit regression tests
// =====================================================================

import { describe, it, expect } from 'vitest'
import { runDisabilityRuleEngine, computeDisability } from '@/lib/insurance/disability'
import type { MedicalRecord } from '@/lib/insurance/types'

const blankMedical: MedicalRecord = {
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

describe('零輸入', () => {
  it('A 級、無等級、confidence 0', () => {
    const r = runDisabilityRuleEngine({ medical: blankMedical, accidentDate: '2026-08-01' })
    expect(r.screening).toBe('A')
    expect(r.finalLevel).toBeNull()
    expect(r.confidenceScore).toBe(0)
  })
})

describe('ROM 關節障害初篩', () => {
  it('右踝 ROM 喪失 20 度可初篩對應第 13 級條目', () => {
    const m: MedicalRecord = {
      ...blankMedical,
      diagnosisText: '右踝關節活動角度喪失 20 度',
      jointName: 'ankle',
      hasRangeOfMotionLimitation: true,
      romLossDegree: 20,
    }
    const r = runDisabilityRuleEngine({ medical: m, accidentDate: '2026-08-01' })
    expect(r.romLossPercent).toBeCloseTo(40, 0)
    expect(r.baseLevel).toBe(13)
    expect(r.finalLevel).toBe(13)
    expect(['B', 'C']).toContain(r.screening)
  })

  it('明確失能診斷書等級優先於 ROM 初篩', () => {
    const m: MedicalRecord = {
      ...blankMedical,
      diagnosisText: '右踝活動受限',
      jointName: 'ankle',
      hasRangeOfMotionLimitation: true,
      romLossDegree: 20,
      hasDisabilityCertificate: true,
      disabilityLevel: 11,
    }
    const r = runDisabilityRuleEngine({ medical: m, accidentDate: '2026-08-01' })
    expect(r.baseLevel).toBe(13)
    expect(r.finalLevel).toBe(11)
    expect(r.screening).toBe('D')
  })
})

describe('非 ROM 線索不得自動升級', () => {
  it('截肢但沒有明確失能條目／等級，不得直接判第 1 級', () => {
    const m: MedicalRecord = {
      ...blankMedical,
      diagnosisText: '右下肢膝下截肢',
      hasAmputation: true,
    }
    const r = runDisabilityRuleEngine({ medical: m, accidentDate: '2026-08-01' })
    expect(r.finalLevel).toBeNull()
    expect(r.screening).toBe('C')
    expect(r.needsSupplement.some((x) => x.includes('失能給付標準表'))).toBe(true)
  })

  it('神經損傷不得把 ROM 等級自動加重 2 級', () => {
    const m: MedicalRecord = {
      ...blankMedical,
      diagnosisText: '右腕神經損傷，關節活動受限',
      jointName: 'wrist',
      hasRangeOfMotionLimitation: true,
      romLossDegree: 60, // 40% loss → 單一關節 motion → 13 級
      hasNerveDamage: true,
    }
    const r = runDisabilityRuleEngine({ medical: m, accidentDate: '2026-08-01' })
    expect(r.baseLevel).toBe(13)
    expect(r.finalLevel).toBe(13)
    expect(r.notes.some((x) => x.includes('不得以固定'))).toBe(true)
  })
})

describe('computeDisability — 金額', () => {
  it('沒有明確等級時不得因截肢直接算 300 萬', () => {
    const r = computeDisability({ ...blankMedical, hasAmputation: true }, '2026-08-01')
    expect(r.possibleLevel).toBeNull()
    expect(r.possibleAmount).toBe(0)
  })

  it('有失能診斷書且明確第 1 級，新制 300 萬', () => {
    const r = computeDisability(
      {
        ...blankMedical,
        hasAmputation: true,
        hasDisabilityCertificate: true,
        disabilityLevel: 1,
      },
      '2026-08-01',
    )
    expect(r.possibleLevel).toBe(1)
    expect(r.possibleAmount).toBe(3_000_000)
  })

  it('同樣第 1 級在舊制為 200 萬', () => {
    const r = computeDisability(
      {
        ...blankMedical,
        hasDisabilityCertificate: true,
        disabilityLevel: 1,
      },
      '2026-01-01',
    )
    expect(r.possibleAmount).toBe(2_000_000)
  })
})
