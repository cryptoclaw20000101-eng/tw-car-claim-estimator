// =====================================================================
// 失能規則引擎測試
// 涵蓋：關鍵字掃描、ROM 比例、截肢、神經損傷、永久障害、4 級初篩
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

describe('失能引擎 — 零輸入（無任何線索）', () => {
  it('A 級，無等級，confidence 0', () => {
    const r = runDisabilityRuleEngine({ medical: blankMedical, accidentDate: '2026-08-01' })
    expect(r.screening).toBe('A')
    expect(r.finalLevel).toBeNull()
    expect(r.confidenceScore).toBe(0)
    expect(r.signals).toHaveLength(0)
  })
})

describe('失能引擎 — spec §六 案例：右踝關節活動角度喪失 20 度', () => {
  it('A 級 — 有失能線索但資料不足', () => {
    const m: MedicalRecord = {
      ...blankMedical,
      diagnosisText: '右踝關節活動角度喪失 20 度',
      jointName: 'ankle',
      hasRangeOfMotionLimitation: true,
      romLossDegree: 20,
      // 缺：isSymptomFixed, hasDisabilityCertificate
    }
    const r = runDisabilityRuleEngine({ medical: m, accidentDate: '2026-08-01' })
    // v0.6.6 真實附表：踝關節 ROM 20°/50° = 40% → motion（33%-50%）
    // 三大關節中有一大關節遺存運動障害 → 12-35 第 13 級
    expect(r.romLossPercent).toBeCloseTo(40, 0)
    expect(r.baseLevel).toBe(13)
    // 40% ROM 喪失 → 進 C 級（高度可能需申請失能診斷），
    // 因為角度喪失本身是強烈線索，但缺症狀固定/失能診斷書
    expect(['B', 'C']).toContain(r.screening)
    expect(r.needsSupplement.length).toBeGreaterThan(0)
  })

  it('加上症狀固定 + 永久障害 → D 級（已具失能申請基礎）', () => {
    const m: MedicalRecord = {
      ...blankMedical,
      diagnosisText: '右踝關節活動角度喪失 20 度，症狀固定，永久障害',
      jointName: 'ankle',
      hasRangeOfMotionLimitation: true,
      romLossDegree: 20,
      isSymptomFixed: true,
      hasPermanentImpairment: true,
      hasDisabilityCertificate: true,
    }
    const r = runDisabilityRuleEngine({ medical: m, accidentDate: '2026-08-01' })
    expect(r.screening).toBe('D')
    // v0.6.6 真實附表對應第 13 級（不再是舊版第 6 級）
    expect(r.finalLevel).toBe(13)
  })
})

describe('失能引擎 — 截肢需依附表缺損項目認定', () => {
  it('hasAmputation 不會自動推定第 1 級', () => {
    const m: MedicalRecord = {
      ...blankMedical,
      diagnosisText: '右下肢膝下截肢',
      hasAmputation: true,
    }
    const r = runDisabilityRuleEngine({ medical: m, accidentDate: '2026-08-01' })
    expect(r.finalLevel).toBeNull()
    expect(r.confidenceScore).toBeGreaterThanOrEqual(0.3)
    expect(r.signals).toContain('截肢')
  })

  it('非關節失能線索不要求 ROM，應依附表項次補相應資料', () => {
    const r = computeDisability(
      { ...blankMedical, diagnosisText: '右眼視力嚴重減退' },
      '2026-08-01',
    )
    expect(r.needsSupplement.join('|')).not.toContain('活動度')
    expect(r.needsSupplement.join('|')).not.toContain('ROM')
    expect(r.needsSupplement.join('|')).toContain('失能診斷書')
  })
})

describe('失能引擎 — 神經損傷需依附表認定', () => {
  it('神經損傷 + ROM 喪失不以固定級距自動加重', () => {
    const m: MedicalRecord = {
      ...blankMedical,
      diagnosisText: '右腕神經損傷，關節活動受限 30 度',
      jointName: 'wrist',
      hasRangeOfMotionLimitation: true,
      romLossDegree: 30,
      hasNerveDamage: true,
    }
    const r = runDisabilityRuleEngine({ medical: m, accidentDate: '2026-08-01' })
    // v0.6.6 真實附表：腕關節 ROM 30°/150° = 20% < 33% → 無明顯障害（severity=none, level=15）
    // 神經損傷須以受影響部位與客觀檢查依附表認定，ROM 初判不自動加重
    expect(r.baseLevel).toBe(15)
    expect(r.finalLevel).toBe(15)
  })
})

describe('失能引擎 — 角度喪失 < 5% 視為不明顯', () => {
  it('小角度喪失不構成失能線索', () => {
    const m: MedicalRecord = {
      ...blankMedical,
      diagnosisText: '右肩不適 5 度活動受限',
      jointName: 'shoulder',
      hasRangeOfMotionLimitation: true,
      romLossDegree: 5, // 5/180 = 2.78%
    }
    const r = runDisabilityRuleEngine({ medical: m, accidentDate: '2026-08-01' })
    expect(r.romLossPercent).toBeCloseTo(2.78, 1)
    // 仍會被偵測到關節活動受限 signal
    expect(r.signals).toContain('關節活動受限')
  })
})

describe('computeDisability — 金額表對應', () => {
  it('新制第 1 級 300 萬（症狀固定、診斷書與附表等級齊備）', () => {
    const m: MedicalRecord = {
      ...blankMedical,
      hasAmputation: true,
      isSymptomFixed: true,
      hasDisabilityCertificate: true,
      disabilityLevel: 1,
      disabilityTableItemIds: ['1-1'],
    }
    const r = computeDisability(m, '2026-08-01')
    expect(r.possibleAmount).toBe(3_000_000)
  })

  it('舊制（2026-07-01 前）第 1 級 200 萬（症狀固定、診斷書與附表等級齊備）', () => {
    const m: MedicalRecord = {
      ...blankMedical,
      hasAmputation: true,
      isSymptomFixed: true,
      hasDisabilityCertificate: true,
      disabilityLevel: 1,
      disabilityTableItemIds: ['1-1'],
    }
    const r = computeDisability(m, '2026-01-01')
    expect(r.possibleAmount).toBe(2_000_000)
  })

  it('只有初篩線索時不列入強制險失能給付', () => {
    const r = computeDisability({ ...blankMedical, hasAmputation: true }, '2026-08-01')
    expect(r.possibleAmount).toBe(0)
    expect(r.isPayable).toBe(false)
    expect(r.needsSupplement.join('|')).toContain('失能診斷書')
  })

  it('同一障害部位已有第 9 級，僅給付本次加重至第 7 級的差額', () => {
    const r = computeDisability(
      {
        ...blankMedical,
        isSymptomFixed: true,
        hasDisabilityCertificate: true,
        disabilityLevel: 7,
        disabilityTableItemIds: ['12-27'],
        preExistingDisabilityLevel: 9,
      },
      '2026-08-01',
    )
    expect(r.recognizedLevel).toBe(7)
    expect(r.possibleAmount).toBe(400_000)
  })

  it('選正式附表項次時，以附表等級核對並計算', () => {
    const r = computeDisability(
      {
        ...blankMedical,
        isSymptomFixed: true,
        hasDisabilityCertificate: true,
        disabilityTableItemIds: ['12-29'],
      },
      '2026-08-01',
    )
    expect(r.recognizedLevel).toBe(11)
    expect(r.possibleAmount).toBe(400_000)
  })

  it('手填等級與正式附表項次不符時，不列入給付', () => {
    const r = computeDisability(
      {
        ...blankMedical,
        isSymptomFixed: true,
        hasDisabilityCertificate: true,
        disabilityLevel: 9,
        disabilityTableItemIds: ['12-29'],
      },
      '2026-08-01',
    )
    expect(r.isPayable).toBe(false)
    expect(r.possibleAmount).toBe(0)
    expect(r.needsSupplement.join('|')).toContain('不一致')
  })
})
