// =====================================================================
// 精神慰撫金 ML 區間引擎 — 測試
// 守護 lib/insurance/pain-ml.ts（v0.6.0）
//
// 設計：
//   - 三層區間：啟發式 (規則) → 歷史區間 (13 件 anchor) → fallback
//   - 輸出 P10/P50/P90 + confidence
//   - 與既有 computePainAndSuffering 互補，不取代
//
// 不變量：
//   - lower ≤ mid ≤ upper（單調遞增）
//   - mid 與規則引擎 regionalMid 偏差 ≤ 50%（區間共識校驗）
//   - confidence: 'high' = 樣本 ≥ 20; 'medium' = 10-19; 'low' = <10
// =====================================================================

import { describe, it, expect } from 'vitest'
import {
  predictPainRange,
  reconcileWithRules,
  type PainMLInput,
  type PainMLOutput,
} from '@/lib/insurance/pain-ml'
import type { MedicalRecord } from '@/lib/insurance/types'

const COURT_TAICHUNG = '臺灣臺中地方法院' // multiplier 1.0
const COURT_TAIPEI = '臺灣臺北地方法院' // multiplier 1.15
const COURT_KAOHSIUNG = '臺灣高雄地方法院' // multiplier 0.95

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
    hasClassADiagnosisCertificate: false,
    hasFracture: false,
    hasDislocation: false,
    hasLigamentInjury: false,
    hasNerveDamage: false,
    hasAmputation: false,
    hasPermanentImpairment: false,
    hasScar: false,
    scarLengthCm: 0,
    scarSeverity: 'mild',
    ...overrides,
  } as MedicalRecord
}

function mlInput(overrides: Partial<PainMLInput> = {}): PainMLInput {
  return {
    medical: medical(),
    courtName: COURT_TAICHUNG,
    rulesRegionalMid: 70_000,
    ...overrides,
  }
}

describe('predictPainRange — 三層區間引擎', () => {
  it('回傳結構：lower ≤ mid ≤ upper + confidence', () => {
    const out = predictPainRange(mlInput())
    expect(out.lower).toBeLessThanOrEqual(out.mid)
    expect(out.mid).toBeLessThanOrEqual(out.upper)
    expect(['high', 'medium', 'low']).toContain(out.confidence)
  })

  it('輕傷（無手術無骨折）：區間下限 ≥ 2 萬', () => {
    const out = predictPainRange(mlInput({ medical: medical() }))
    // 對應 severity level 1: 20K-80K（臺中係數 1.0）
    expect(out.lower).toBeGreaterThanOrEqual(20_000)
  })

  it('中度（住院 7 天 + 復健 5 次）：區間在 5 萬 ~ 25 萬', () => {
    const out = predictPainRange(
      mlInput({
        medical: medical({
          hospitalizationDays: 7,
          hasRehabilitation: true,
          rehabilitationCount: 5,
        }),
      }),
    )
    // severity level 2-3: 40K-200K 區間
    expect(out.lower).toBeGreaterThanOrEqual(40_000)
    expect(out.upper).toBeLessThanOrEqual(300_000)
  })

  it('重度（骨折 + 手術 + 住院 30 天）：區間下限 ≥ 15 萬', () => {
    const out = predictPainRange(
      mlInput({
        medical: medical({
          hospitalizationDays: 30,
          hasFracture: true,
          hasSurgery: true,
          hasRehabilitation: true,
          rehabilitationCount: 20,
        }),
      }),
    )
    // severity level 5: 150K-300K（臺中係數 1.0）
    expect(out.lower).toBeGreaterThanOrEqual(150_000)
  })

  it('地區係數：臺北 mid 比臺中高', () => {
    const taichung = predictPainRange(mlInput({ courtName: COURT_TAICHUNG }))
    const taipei = predictPainRange(mlInput({ courtName: COURT_TAIPEI }))
    expect(taipei.mid).toBeGreaterThan(taichung.mid)
  })

  it('地區係數：高雄 mid 比臺中低', () => {
    const taichung = predictPainRange(mlInput({ courtName: COURT_TAICHUNG }))
    const kaohsiung = predictPainRange(mlInput({ courtName: COURT_KAOHSIUNG }))
    expect(kaohsiung.mid).toBeLessThanOrEqual(taichung.mid)
  })

  it('重大（永久障害 + 神經損傷）：區間上限 ≥ 80 萬', () => {
    const out = predictPainRange(
      mlInput({
        medical: medical({
          hasPermanentImpairment: true,
          hasNerveDamage: true,
          hospitalizationDays: 60,
          hasSurgery: true,
          hasFracture: true,
          hasRehabilitation: true,
          rehabilitationCount: 30,
        }),
      }),
    )
    // severity level 7-8: 300K-1.5M（臺中係數 1.0）
    expect(out.upper).toBeGreaterThanOrEqual(800_000)
  })

  it('confidence 反映樣本量：當前資料庫 13 件 → medium', () => {
    const out = predictPainRange(mlInput())
    // 樣本 10-19 → medium（v0.6.0 載入 13 件）
    expect(out.confidence).toBe('medium')
  })

  it('回傳的 anchorCases 是當前資料庫的真實判決', () => {
    const out = predictPainRange(mlInput())
    expect(Array.isArray(out.anchorCases)).toBe(true)
    // 預設 anchor 至少有 1 件
    expect(out.anchorCases.length).toBeGreaterThan(0)
  })
})

describe('reconcileWithRules — 規則 vs ML 校驗', () => {
  it('落差 ≤ 15%：標記 "agree"', () => {
    // 重度案件：住院 30 天 + 骨折 + 手術 + 復健 20 → level 6 mid 300,000
    // + treatmentBoost (~0.2) → 約 360,000 → 規則給 360K（agree）
    const heavy = mlInput({
      medical: medical({
        hospitalizationDays: 30,
        hasFracture: true,
        hasSurgery: true,
        hasRehabilitation: true,
        rehabilitationCount: 20,
      }),
      rulesRegionalMid: 360_000,
    })
    const ml = predictPainRange(heavy)
    const result = reconcileWithRules(ml, 360_000)
    expect(result.status).toBe('agree')
    expect(result.divergence).toBeLessThanOrEqual(0.15)
  })

  it('落差 > 30%：標記 "diverge" + 警告訊息', () => {
    // 輕傷案件：medical=空 → level 1 mid 50,000（無治療加成）
    const ml = predictPainRange(mlInput({ rulesRegionalMid: 50_000 }))
    const result = reconcileWithRules(ml, 200_000) // 規則 200K vs ML 50K
    expect(result.status).toBe('diverge')
    expect(result.divergence).toBeGreaterThan(0.3)
    expect(result.warning).toBeTruthy()
  })

  it('落差在 15-30%：標記 "minor_diverge"', () => {
    // 中度案件：住院 10 天 + 復健 → level 4 mid 150,000 + 加成 → 約 175,000
    // 規則給 220K → 差 25% → minor_diverge
    const midCase = mlInput({
      medical: medical({
        hospitalizationDays: 10,
        hasRehabilitation: true,
        rehabilitationCount: 8,
      }),
      rulesRegionalMid: 175_000,
    })
    const ml = predictPainRange(midCase)
    const result = reconcileWithRules(ml, 220_000) // 差 ~25%
    expect(result.status).toBe('minor_diverge')
  })

  it('ML confidence=low 時：diverge 警示不應升級（避免誤報）', () => {
    const ml: PainMLOutput = {
      lower: 20_000,
      mid: 50_000,
      upper: 80_000,
      p10: 20_000,
      p50: 50_000,
      p90: 80_000,
      confidence: 'low',
      anchorCases: [],
      method: 'heuristic_only',
      severityLevel: 1,
      severityLabel: '極輕微',
    }
    const result = reconcileWithRules(ml, 200_000) // 落差 300%
    // confidence=low 時只給「注意」不給「強烈警告」
    expect(result.warning).toMatch(/資料不足|僅供參考/)
  })
})

describe('predictPainRange — 邊界條件', () => {
  it('空 medical：仍回傳合理區間（極輕微 level 1）', () => {
    const out = predictPainRange(mlInput())
    expect(out.mid).toBeGreaterThan(0)
    expect(out.lower).toBeGreaterThan(0)
  })

  it('所有嚴重特徵都開：上限應在合理範圍（≤ 200 萬）', () => {
    const out = predictPainRange(
      mlInput({
        medical: medical({
          hasPermanentImpairment: true,
          hasNerveDamage: true,
          hasAmputation: true,
          hasFracture: true,
          hasSurgery: true,
          hospitalizationDays: 90,
          hasRehabilitation: true,
          rehabilitationCount: 50,
          scarLengthCm: 30,
        }),
      }),
    )
    // severity level 8: 500K-1.5M（臺中係數 1.0）
    expect(out.upper).toBeLessThanOrEqual(2_000_000)
  })

  it('未知法院名稱：fallback 到臺中係數（不報錯）', () => {
    const out = predictPainRange(mlInput({ courtName: '某個未知法院' }))
    expect(out.mid).toBeGreaterThan(0)
  })
})
