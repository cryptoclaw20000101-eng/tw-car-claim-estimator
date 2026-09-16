// =====================================================================
// 失能初篩 — legal-audit 邊界測試
// =====================================================================

import { describe, it, expect } from 'vitest'
import { runDisabilityRuleEngine } from '@/lib/insurance/disability'
import type { MedicalRecord } from '@/lib/insurance/types'

function emptyMedical(overrides: Partial<MedicalRecord> = {}): MedicalRecord {
  return {
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
    ...overrides,
  }
}

describe('沒有明確條目時不硬算失能等級', () => {
  it('肌力下降：有線索但 finalLevel=null', () => {
    const result = runDisabilityRuleEngine({
      medical: emptyMedical({ hasMuscleWeakness: true }),
      accidentDate: '2026-06-01',
    })
    expect(result.finalLevel).toBeNull()
    expect(result.screening).toBe('B')
  })

  it('感覺喪失：有線索但 finalLevel=null', () => {
    const result = runDisabilityRuleEngine({
      medical: emptyMedical({ hasSensoryLoss: true }),
      accidentDate: '2026-06-01',
    })
    expect(result.finalLevel).toBeNull()
    expect(result.screening).toBe('B')
  })

  it('神經損傷：進 C，但不得自行推定等級', () => {
    const result = runDisabilityRuleEngine({
      medical: emptyMedical({ hasNerveDamage: true }),
      accidentDate: '2026-06-01',
    })
    expect(result.screening).toBe('C')
    expect(result.finalLevel).toBeNull()
  })

  it('截肢：進 C，但不得直接 level 1', () => {
    const result = runDisabilityRuleEngine({
      medical: emptyMedical({ hasAmputation: true }),
      accidentDate: '2026-06-01',
    })
    expect(result.screening).toBe('C')
    expect(result.finalLevel).toBeNull()
  })

  it('永久障害：進 C；有明確失能診斷等級才進 D', () => {
    const c = runDisabilityRuleEngine({
      medical: emptyMedical({ hasPermanentImpairment: true }),
      accidentDate: '2026-06-01',
    })
    expect(c.screening).toBe('C')

    const d = runDisabilityRuleEngine({
      medical: emptyMedical({
        hasPermanentImpairment: true,
        hasDisabilityCertificate: true,
        disabilityLevel: 8,
      }),
      accidentDate: '2026-06-01',
    })
    expect(d.screening).toBe('D')
    expect(d.finalLevel).toBe(8)
  })
})

describe('ROM 初篩', () => {
  it('ROM < 5% 不作等級推定', () => {
    const result = runDisabilityRuleEngine({
      medical: emptyMedical({
        jointName: 'knee',
        hasRangeOfMotionLimitation: true,
        romLossDegree: 3,
      }),
      accidentDate: '2026-06-01',
    })
    expect(result.finalLevel).toBeNull()
    expect(result.notes.some((n) => n.includes('不作失能等級推定'))).toBe(true)
  })

  it('單一膝關節 ROM 約 37%：可作第 13 級條目初篩，但未持診斷書仍是 C', () => {
    const result = runDisabilityRuleEngine({
      medical: emptyMedical({
        jointName: 'knee',
        hasRangeOfMotionLimitation: true,
        romLossDegree: 50,
        isSymptomFixed: true,
      }),
      accidentDate: '2026-06-01',
    })
    expect(result.baseLevel).toBe(13)
    expect(result.finalLevel).toBe(13)
    expect(result.screening).toBe('C')
  })
})
