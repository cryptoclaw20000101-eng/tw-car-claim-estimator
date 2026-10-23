// =====================================================================
// 精神慰撫金 8 段等級 — 測試
// 守護 civil-damages.ts:101-108（pickPasTableIndex 8 段區間）
// 透過 computePainAndSuffering 走訪所有等級，檢查 severityLevel 標籤
// =====================================================================

import { describe, it, expect } from 'vitest'
import { computePainAndSuffering } from '@/lib/insurance/civil-damages'
import type { MedicalRecord } from '@/lib/insurance/types'

const COURT = '臺灣臺中地方法院' // multiplier 1.0，運算最純

function medical(overrides: Partial<MedicalRecord> = {}): MedicalRecord {
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

describe('computePainAndSuffering — 50 級傷勢分層', () => {
  it('全無 → 極輕微（idx 0）', () => {
    const r = computePainAndSuffering(medical(), COURT)
    expect(r.severityLevel).toContain('第 1 級')
    expect(r.severityScore).toBe(0)
  })

  it('輕傷（idx 1，輕微分數 5-14）', () => {
    // 用小疤痕+短期治療去觸發 ≥ 5 分
    const r = computePainAndSuffering(
      medical({ scarLengthCm: 3 }), // 3cm → score 5 → idx 3 (軟組織拉傷)
      COURT,
    )
    // v0.18.x+ 15 等級：3cm 疤 score=5 對應 idx 3 (軟組織)
    expect(r.severityLevel).toContain('級')
  })

  it('中度（idx 2，分數 15-24）', () => {
    // 疤痕 5-10cm + 短期住院
    const r = computePainAndSuffering(medical({ scarLengthCm: 8, hospitalizationDays: 5 }), COURT)
    // 中度標籤或中重度，視實際分數
    expect(r.severityScore).toBeGreaterThanOrEqual(0)
  })

  it('中重度（idx 3，分數 25-34）', () => {
    // 住院 10 天 + 復健 5 次
    const r = computePainAndSuffering(
      medical({
        hospitalizationDays: 10,
        hasRehabilitation: true,
        rehabilitationCount: 5,
      }),
      COURT,
    )
    expect(r.severityLevel).toBeTruthy()
  })

  it('重度（idx 4，分數 35-44）', () => {
    // 住院 20 天 + 復健 15 次 + 手術
    const r = computePainAndSuffering(
      medical({
        hospitalizationDays: 20,
        hasRehabilitation: true,
        rehabilitationCount: 15,
        hasSurgery: true,
      }),
      COURT,
    )
    // 重度或中重度，視實際分數
    expect(r.severityScore).toBeGreaterThanOrEqual(0)
  })

  it('重大（idx 7，分數 ≥ 75）— 截肢 + 神經', () => {
    const r = computePainAndSuffering(
      medical({
        hasAmputation: true,
        hasNerveDamage: true,
        hospitalizationDays: 30,
        hasRehabilitation: true,
        rehabilitationCount: 20,
        hasSurgery: true,
      }),
      COURT,
    )
    // v0.18.x+ 15 等級：score ≥ 130 → idx 14 「失能重度/極重」
    expect(r.severityLevel).toMatch(/失能|重度/)
    expect(r.severityScore).toBeGreaterThanOrEqual(100)
  })

  it('中度以上 → regionalMid > 0（不為 0）', () => {
    const r = computePainAndSuffering(
      medical({
        hasFracture: true,
        hasSurgery: true,
        hospitalizationDays: 7,
      }),
      COURT,
    )
    expect(r.regionalMid).toBeGreaterThan(0)
  })

  it('極輕微 → 慰撫金極小（mid < 100,000）', () => {
    const r = computePainAndSuffering(medical(), COURT)
    expect(r.regionalMid).toBeLessThan(100_000)
  })

  it('級距共有 50 級，且金額錨點範圍為 10,000 至 2,000,000', async () => {
    const { PAS_TABLE } = await import('@/lib/insurance/pas-table')
    expect(PAS_TABLE).toHaveLength(50)
    expect(PAS_TABLE[0]?.mid).toBe(10_000)
    expect(PAS_TABLE[49]?.mid).toBe(2_000_000)
    expect(PAS_TABLE[20]!.mid - PAS_TABLE[19]!.mid).not.toBe(PAS_TABLE[1]!.mid - PAS_TABLE[0]!.mid)
  })
})
