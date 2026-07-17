// =====================================================================
// 除疤費用估算 — 單元測試
// 依據：臺中市美容醫學醫療機構收費標準表 111.03.30
//      + 中地院 110 簡 202 判決（80 萬除疤全額准許）
// =====================================================================

import { describe, it, expect } from 'vitest'
import { computeScarRevisionCost, REGIONAL_SCAR_MULTIPLIER } from '@/lib/insurance/scar-revision'
import type { MedicalRecord } from '@/lib/insurance/types'

const baseMedical: MedicalRecord = {
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
  jointName: null,
  hasRangeOfMotionLimitation: false,
  romLossDegree: 0,
  romNormalDegree: 0,
  hasMuscleWeakness: false,
  hasSensoryLoss: false,
  hasPermanentImpairment: false,
}

describe('computeScarRevisionCost', () => {
  it('無疤痕長度 / 面積 → 0 + 提示', () => {
    const r = computeScarRevisionCost({
      medical: { ...baseMedical },
      courtName: '臺灣臺中地方法院',
      procedure: 'revision_surgery',
    })
    expect(r.amount).toBe(0)
    expect(r.hint).toContain('疤痕長度')
  })

  it('修疤手術 10 公分 × 中地院基線', () => {
    const r = computeScarRevisionCost({
      medical: { ...baseMedical, scarLengthCm: 10, scarSeverity: 'moderate' },
      courtName: '臺灣臺中地方法院',
      procedure: 'revision_surgery',
    })
    // 10 公分 × 6,000 元 (mid) × 1 次 = 60,000
    expect(r.amount).toBe(60_000)
    expect(r.range.low).toBe(30_000) // 3,000 × 10
    expect(r.range.high).toBe(100_000) // 10,000 × 10
    expect(r.regionalMultiplier).toBe(1.0)
  })

  it('修疤手術 10 公分 × 臺北（係數 1.20）→ 60,000 × 1.2 = 72,000', () => {
    const r = computeScarRevisionCost({
      medical: { ...baseMedical, scarLengthCm: 10, scarSeverity: 'moderate' },
      courtName: '臺灣臺北地方法院',
      procedure: 'revision_surgery',
    })
    expect(r.amount).toBe(72_000)
    expect(r.regionalMultiplier).toBe(1.2)
  })

  it('雷射除疤 50 cm² × 4 次療程（臺中基線）', () => {
    const r = computeScarRevisionCost({
      medical: { ...baseMedical, scarAreaCm2: 50, scarSeverity: 'moderate' },
      courtName: '臺灣臺中地方法院',
      procedure: 'laser',
    })
    // (基本費 1,500 + 每 cm² 1,500 × 50) × 4 次 = (1,500 + 75,000) × 4 = 306,000
    expect(r.amount).toBe(306_000)
    expect(r.breakdown.sessions).toBe(4)
    expect(r.breakdown.baseFee).toBe(1_500)
  })

  it('蟹足腫 → 強制走注射治療', () => {
    const r = computeScarRevisionCost({
      medical: { ...baseMedical, scarLengthCm: 15, scarSeverity: 'keloid' },
      courtName: '臺灣臺中地方法院',
      procedure: 'revision_surgery', // 即便選修疤，蟹足腫會強制改注射
    })
    expect(r.procedure).toBe('injection')
    expect(r.hint).toContain('蟹足腫')
  })

  it('中地院 110 簡 202 對照：疤痕 30 公分 + 蟹足腫 → 註記判例 80 萬', () => {
    const r = computeScarRevisionCost({
      medical: { ...baseMedical, scarLengthCm: 30, scarSeverity: 'keloid' },
      courtName: '臺灣臺中地方法院',
      procedure: 'injection',
    })
    expect(r.precedents.some((p) => p.includes('中地院 110 簡 202'))).toBe(true)
    expect(r.notes.some((n) => n.includes('110 簡 202'))).toBe(true)
  })

  it('拉皮手術 腹部 1 次', () => {
    const r = computeScarRevisionCost({
      medical: {
        ...baseMedical,
        scarLengthCm: 5,
        scarLocation: 'abdomen',
        scarSeverity: 'moderate',
      },
      courtName: '臺灣臺中地方法院',
      procedure: 'facelift',
    })
    // 腹部 mid 210,000
    expect(r.amount).toBe(210_000)
    expect(r.notes.some((n) => n.includes('腹部'))).toBe(true)
  })

  it('拉皮手術 嚴重疤痕 → 內視鏡全臉', () => {
    const r = computeScarRevisionCost({
      medical: { ...baseMedical, scarLengthCm: 25, scarLocation: 'face', scarSeverity: 'severe' },
      courtName: '臺灣臺中地方法院',
      procedure: 'facelift',
    })
    // 內視鏡 mid 350,000
    expect(r.amount).toBe(350_000)
    expect(r.notes.some((n) => n.includes('內視鏡'))).toBe(true)
  })

  it('PRP 注射（中等疤痕）4 次療程', () => {
    const r = computeScarRevisionCost({
      medical: { ...baseMedical, scarLengthCm: 10, scarSeverity: 'severe' },
      courtName: '臺灣臺中地方法院',
      procedure: 'injection',
    })
    // 嚴重 → 4 次 PRP × 25,000 = 100,000
    expect(r.amount).toBe(100_000)
    expect(r.breakdown.sessions).toBe(4)
  })

  it('REGIONAL_SCAR_MULTIPLIER 涵蓋北中南', () => {
    expect(REGIONAL_SCAR_MULTIPLIER['臺北']).toBe(1.2)
    expect(REGIONAL_SCAR_MULTIPLIER['臺中']).toBe(1.0)
    expect(REGIONAL_SCAR_MULTIPLIER['高雄']).toBe(0.95)
    expect(REGIONAL_SCAR_MULTIPLIER['臺東']).toBe(0.9)
  })
})
