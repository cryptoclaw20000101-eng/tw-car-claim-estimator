// =====================================================================
// 失能初篩 — 邊界測試
// 補 disability.ts:208-210（沒 ROM 走 inferred inferred = max(1, 10+totalShift)）
// 守護 SPEC §四 失能初篩規則 + 4 級判定邏輯
//
// 註：4 級判定真實規則（line 222-243）
//   A：沒 signals、沒截肢、沒永久失能
//   D：截肢 / 永久失能 / ROM ≥ 30 + 症狀固定 / 有失能證明
//   C：症狀固定 / ROM / 神經 / 截肢 / 有 ROM 資料
//   B：else（理論上「有 signals 但都不進 C 條件」— 實務上很難觸發）
// =====================================================================

import { describe, it, expect } from 'vitest'
import { runDisabilityRuleEngine } from '@/lib/insurance/disability'
import type { MedicalRecord } from '@/lib/insurance/types'

// 全空 medical（沒 ROM / 沒神經 / 沒截肢 / 沒肌力 / 症狀沒固定 / 沒失能證明）
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

describe('runDisabilityRuleEngine — 沒 ROM 走 inferred 路徑（line 208-210）', () => {
  it('沒 ROM 但有肌力減弱（levelShift 累加） → inferred = max(1, 10 + totalShift)', () => {
    const result = runDisabilityRuleEngine({
      medical: emptyMedical({ hasMuscleWeakness: true }),
      accidentDate: '2026-06-01',
    })
    expect(result.finalLevel).not.toBeNull()
    if (result.finalLevel !== null) {
      expect(result.finalLevel).toBeGreaterThanOrEqual(1)
      expect(result.finalLevel).toBeLessThanOrEqual(15)
    }
    // 肌力減弱不在 C 條件（line 233-238）→ 走 B（line 242）— 是 source 設計
    expect(result.screening).toBe('B')
  })

  it('沒 ROM 但有感覺喪失（也走 inferred）', () => {
    const result = runDisabilityRuleEngine({
      medical: emptyMedical({ hasSensoryLoss: true }),
      accidentDate: '2026-06-01',
    })
    expect(result.finalLevel).not.toBeNull()
    expect(result.screening).toBe('B') // 同肌力減弱，不在 C 條件
  })

  it('沒 ROM 沒任何標記 → finalLevel 為 null、screening = A（line 224 規則）', () => {
    const result = runDisabilityRuleEngine({
      medical: emptyMedical(),
      accidentDate: '2026-06-01',
    })
    expect(result.finalLevel).toBeNull()
    expect(result.screening).toBe('A')
  })

  it('沒 ROM 但有神經損傷 → screening = C（line 240）', () => {
    const result = runDisabilityRuleEngine({
      medical: emptyMedical({ hasNerveDamage: true }),
      accidentDate: '2026-06-01',
    })
    expect(result.screening).toBe('C')
  })

  it('沒 ROM 但有截肢 → levelOverride 觸發（line 206）finalLevel = 1', () => {
    const result = runDisabilityRuleEngine({
      medical: emptyMedical({ hasAmputation: true }),
      accidentDate: '2026-06-01',
    })
    expect(result.finalLevel).toBe(1)
    // 截肢直接進 D（line 227）
    expect(result.screening).toBe('D')
  })

  it('沒 ROM 但有截肢 + 症狀固定 → 仍 D', () => {
    const result = runDisabilityRuleEngine({
      medical: emptyMedical({ hasAmputation: true, isSymptomFixed: true }),
      accidentDate: '2026-06-01',
    })
    expect(result.finalLevel).toBe(1)
    expect(result.screening).toBe('D')
  })

  it('永久失能（hasPermanentImpairment）→ D（line 228）', () => {
    const result = runDisabilityRuleEngine({
      medical: emptyMedical({ hasPermanentImpairment: true }),
      accidentDate: '2026-06-01',
    })
    expect(result.screening).toBe('D')
  })
})

describe('runDisabilityRuleEngine — ROM 路徑（applyAdjustments 內部）', () => {
  it('有 ROM + 截肢 → levelOverride 1（applyAdjustments 內 line 121-122）', () => {
    const result = runDisabilityRuleEngine({
      medical: emptyMedical({
        jointName: 'knee',
        hasRangeOfMotionLimitation: true,
        romLossDegree: 90, // 90/135 = 66.7% → level 4
        hasAmputation: true, // override 到 1
      }),
      accidentDate: '2026-06-01',
    })
    expect(result.finalLevel).toBe(1) // 截肢 override
    expect(result.screening).toBe('D')
  })

  it('有 ROM 但 < 5% → 不構成明顯失能（line 182-185 補件提示）', () => {
    const result = runDisabilityRuleEngine({
      medical: emptyMedical({
        jointName: 'knee',
        hasRangeOfMotionLimitation: true,
        romLossDegree: 3, // 3/135 = 2.2% < 5%
      }),
      accidentDate: '2026-06-01',
    })
    expect(result.notes.some((n) => n.includes('不構成明顯失能'))).toBe(true)
    expect(result.needsSupplement.some((s) => s.includes('復健科完整量測記錄'))).toBe(true)
  })
})

describe('runDisabilityRuleEngine — ROM + 症狀固定 進 D', () => {
  it('有 ROM ≥ 30% + 症狀固定 → D（line 229 條件）', () => {
    const result = runDisabilityRuleEngine({
      medical: emptyMedical({
        jointName: 'knee',
        hasRangeOfMotionLimitation: true,
        romLossDegree: 50, // 50/135 = 37% ≥ 30
        isSymptomFixed: true,
      }),
      accidentDate: '2026-06-01',
    })
    expect(result.screening).toBe('D')
  })
})
