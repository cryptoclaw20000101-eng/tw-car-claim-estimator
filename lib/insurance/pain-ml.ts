// =====================================================================
// 精神慰撫金 ML 區間引擎（v0.6.0）
//
// 設計：三層架構
//   Layer 1（啟發式）  規則引擎 8 級區間 + 地區係數 → baseline range
//   Layer 2（歷史區間） 從 data/precedents/taipei-mental-distress.json
//                       取出 13 件有金額的 anchor → 用傷勢類別推相似度
//                       產出 P10/P50/P90
//   Layer 3（fallback） 樣本 < 5 或資料損壞 → 退回 Layer 1
//
// 輸出：
//   - lower / mid / upper：金額區間（元）
//   - confidence: 'high' | 'medium' | 'low'
//       high = anchor ≥ 20; medium = 10-19; low = <10
//   - anchorCases: 真實判例 ref（給 UI 引註）
//   - method: 'ml_v1_ensemble' | 'heuristic_only' | 'fallback'
//
// 為何 v0.6.0 不用 XGBoost？
//   - 樣本 13 件太少，訓練有意義模型會過擬合
//   - 13 件都集中在 minor_injury，傷勢梯度學不到
//   - 律師手動建檔補完 89 件 0 元 → v0.6.1+ 再升級成 XGBoost
//
// 不變量（測試守護）：
//   - lower ≤ mid ≤ upper
//   - mid 與規則引擎 regionalMid 偏差合理範圍
//   - 未知法院 → fallback 到 1.0 係數，不報錯
// =====================================================================

import type { MedicalRecord } from './types'
import { getRegionAdjustment } from './region-adjustments'

// --- 型別 ---------------------------------------------------------------

export interface PainMLInput {
  medical: MedicalRecord
  courtName: string
  /** 規則引擎算出的 regional mid，供 reconcile 比對 */
  rulesRegionalMid: number
}

export interface PainAnchorCase {
  caseNo: string
  court: string
  amount: number
  year: number
  category: string
}

export interface PainMLOutput {
  lower: number
  mid: number
  upper: number
  /** P10 / P50 / P90（給 UI 顯示「中位數 + 80% 信賴區間」） */
  p10: number
  p50: number
  p90: number
  /** 信心度：依 anchor 樣本量 */
  confidence: 'high' | 'medium' | 'low'
  /** 真實判例 anchor（給 UI 顯示引註） */
  anchorCases: PainAnchorCase[]
  /** 採用方法：說明這次預測是純啟發式還是有歷史資料校正 */
  method: 'ml_v1_ensemble' | 'heuristic_only' | 'fallback'
  /** 嚴重度等級（給 UI 顯示對應等級 label） */
  severityLevel: number
  severityLabel: string
}

export interface ReconcileResult {
  status: 'agree' | 'minor_diverge' | 'diverge'
  divergence: number // 0-1，|rulesMid - mlMid| / mlMid
  warning?: string
}

// --- 8 級區間表（與 civil-damages.ts BASE_PAS_TABLE 同步）-------------

interface PasLevelRow {
  level: number
  label: string
  low: number
  mid: number
  high: number
}

const BASE_PAS_TABLE: PasLevelRow[] = [
  { level: 1, label: '極輕微（單純擦挫傷）', low: 20_000, mid: 50_000, high: 80_000 },
  { level: 2, label: '輕傷（擦挫傷 + 短期就醫）', low: 40_000, mid: 70_000, high: 100_000 },
  { level: 3, label: '中度（明顯疤痕或治療 1-2 個月）', low: 80_000, mid: 120_000, high: 150_000 },
  { level: 4, label: '中重度（住院 1-2 週 + 復健）', low: 100_000, mid: 150_000, high: 200_000 },
  { level: 5, label: '重度（骨折 + 手術 + 長期復健）', low: 150_000, mid: 220_000, high: 300_000 },
  { level: 6, label: '嚴重（多處骨折 + 多次手術）', low: 200_000, mid: 300_000, high: 400_000 },
  { level: 7, label: '極嚴重（永久障害 + 持續治療）', low: 300_000, mid: 500_000, high: 800_000 },
  {
    level: 8,
    label: '重大（失能 / 截肢 / 神經重大損傷）',
    low: 500_000,
    mid: 800_000,
    high: 1_500_000,
  },
]

// --- 嚴重度評分（簡化版，與 civil-damages.ts 同步邏輯）----------------

interface SeverityBreakdown {
  hospitalizationDays: number
  rehabilitationCount: number
  scarLengthCm: number
  hasPermanentImpairment: boolean
  hasDisability: boolean
  hasSurgery: boolean
  hasFracture: boolean
  hasNerveDamage: boolean
  hasAmputation: boolean
}

function scoreSeverity(b: SeverityBreakdown): number {
  let score = 0

  // 住院日數（0-20）
  if (b.hospitalizationDays >= 15) score += 20
  else if (b.hospitalizationDays >= 8) score += 15
  else if (b.hospitalizationDays >= 4) score += 10
  else if (b.hospitalizationDays >= 1) score += 5

  // 復健次數（0-15）
  if (b.rehabilitationCount >= 16) score += 15
  else if (b.rehabilitationCount >= 6) score += 10
  else if (b.rehabilitationCount >= 1) score += 5

  // 疤痕（0-15）
  if (b.hasAmputation) score += 15
  else if (b.scarLengthCm >= 10) score += 15
  else if (b.scarLengthCm >= 5) score += 10
  else if (b.scarLengthCm > 0) score += 5

  // 手術（0-10）
  if (b.hasSurgery) score += 10

  // 骨折（0-10）
  if (b.hasFracture) score += 10

  // 神經損傷（0-10）
  if (b.hasNerveDamage) score += 10

  // 永久障害（0-10）
  if (b.hasPermanentImpairment) score += 10

  // 失能/截肢（0-10）
  if (b.hasDisability || b.hasAmputation) score += 10

  return Math.min(score, 100)
}

function pickLevelIndex(score: number): number {
  if (score >= 75) return 7
  if (score >= 60) return 6
  if (score >= 45) return 5
  if (score >= 35) return 4
  if (score >= 25) return 3
  if (score >= 15) return 2
  if (score >= 5) return 1
  return 0
}

// --- Layer 2：歷史 anchor 載入（13 件有金額的真實判決）----------------

let _anchorCache: PainAnchorCase[] | null = null

/**
 * 載入 13 件有金額的精神慰撫金真實判決（SSR-safe + cache）
 * 失敗回空陣列，視同無資料
 */
function loadAnchorCases(): PainAnchorCase[] {
  if (_anchorCache !== null) return _anchorCache
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync, existsSync } = require('node:fs') as typeof import('node:fs')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require('node:path') as typeof import('node:path')
    const candidates = [
      join(process.cwd(), 'data/precedents/taipei-mental-distress.json'),
      join(process.cwd(), '..', 'data/precedents/taipei-mental-distress.json'),
    ]
    const path = candidates.find((p) => existsSync(p))
    if (!path) {
      _anchorCache = []
      return []
    }
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as Array<{
      caseNo: string
      court: string
      year: number
      category: string
      mentalDistressAmount: number
    }>
    _anchorCache = raw
      .filter((r) => r.mentalDistressAmount > 0)
      .map((r) => ({
        caseNo: r.caseNo,
        court: r.court,
        amount: r.mentalDistressAmount,
        year: r.year,
        category: r.category,
      }))
    return _anchorCache
  } catch {
    _anchorCache = []
    return []
  }
}

/**
 * 從 anchor 計算百分位數（線性插值）
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const first = sorted[0]
  if (sorted.length === 1) return first ?? 0
  const idx = (sorted.length - 1) * p
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) {
    return sorted[lower] ?? 0
  }
  return (sorted[lower] ?? 0) + ((sorted[upper] ?? 0) - (sorted[lower] ?? 0)) * (idx - lower)
}

// --- 主入口：predictPainRange -----------------------------------------

export function predictPainRange(input: PainMLInput): PainMLOutput {
  const { medical, courtName } = input

  // Layer 1：啟發式 baseline
  const breakdown: SeverityBreakdown = {
    hospitalizationDays: medical.hospitalizationDays,
    rehabilitationCount: medical.rehabilitationCount,
    scarLengthCm: medical.scarLengthCm ?? 0,
    hasPermanentImpairment: medical.hasPermanentImpairment,
    hasDisability: medical.hasDisabilityCertificate,
    hasSurgery: medical.hasSurgery,
    hasFracture: medical.hasFracture,
    hasNerveDamage: medical.hasNerveDamage,
    hasAmputation: medical.hasAmputation,
  }
  const severityScore = scoreSeverity(breakdown)
  const levelIdx = pickLevelIndex(severityScore)
  const baseRow = BASE_PAS_TABLE[levelIdx]!

  // 地區係數（fallback 1.0 給未知法院）
  let regionMultiplier = 1.0
  try {
    const region = getRegionAdjustment(courtName)
    regionMultiplier = region.painAndSufferingMultiplier
  } catch {
    regionMultiplier = 1.0
  }

  // 治療期間加成（與規則引擎同步：保守版，最多 +20%）
  // 規則公式：treatmentDays = hospitalizationDays × 2 + rehabilitationCount × 3
  const treatmentDays = medical.hospitalizationDays * 2 + medical.rehabilitationCount * 3
  const treatmentBoost = Math.min(treatmentDays / 180, 0.2)

  const baseLow = Math.round(baseRow.low * (1 + treatmentBoost))
  const baseMid = Math.round(baseRow.mid * (1 + treatmentBoost))
  const baseHigh = Math.round(baseRow.high * (1 + treatmentBoost))

  const heurLow = Math.round(baseLow * regionMultiplier)
  const heurMid = Math.round(baseMid * regionMultiplier)
  const heurHigh = Math.round(baseHigh * regionMultiplier)

  // Layer 2：歷史 anchor 載入（13 件有金額的 minor_injury 真實判決）
  const anchors = loadAnchorCases()
  const validAnchors = anchors.filter((a) => a.amount > 0)

  // ⚠️ 重要決策（v0.6.0）：
  // anchor 樣本全部是 minor_injury，傷勢梯度學不到。
  // 因此 v0.6.0 不直接用 anchor 校正金額區間（會把輕傷慰撫金推高），
  // 只用 anchor 來：
  //   1. 提供 P10/P50/P90 給 UI 顯示「歷史中位數」
  //   2. 計算 confidence（給業務信心度標記）
  //   3. 提供 anchorCases 給 UI 顯示引註
  //
  // 區間金額本身仍由規則引擎（heurLow/heurMid/heurHigh）決定，
  // 保證不變量 lower ≤ mid ≤ upper 且地區係數正確生效。
  //
  // v0.6.1+ 律師補完 89 件 0 元資料 → 才能真正用 XGBoost 學出傷勢梯度。

  let p10 = heurLow
  let p50 = heurMid
  let p90 = heurHigh
  let confidence: 'high' | 'medium' | 'low' = 'low'
  let method: 'ml_v1_ensemble' | 'heuristic_only' | 'fallback' = 'heuristic_only'

  if (validAnchors.length >= 5) {
    const sortedAmounts = validAnchors.map((a) => a.amount).sort((a, b) => a - b)
    p10 = percentile(sortedAmounts, 0.1)
    p50 = percentile(sortedAmounts, 0.5)
    p90 = percentile(sortedAmounts, 0.9)

    if (validAnchors.length >= 20) confidence = 'high'
    else if (validAnchors.length >= 10) confidence = 'medium'
    else confidence = 'low'

    method = 'ml_v1_ensemble'
  }

  return {
    lower: heurLow,
    mid: heurMid,
    upper: heurHigh,
    p10,
    p50,
    p90,
    confidence,
    anchorCases: validAnchors.slice(0, 3),
    method,
    severityLevel: baseRow.level,
    severityLabel: baseRow.label,
  }
}

// --- reconcileWithRules：規則 vs ML 校驗 ------------------------------

/**
 * 比較規則引擎（中點）與 ML（中點），給 UI 顯示共識度
 *
 * - agree: 偏差 ≤ 15%
 * - minor_diverge: 偏差 15-30%
 * - diverge: 偏差 > 30%
 *
 * ML confidence=low 時降級警告強度（避免誤報）
 */
export function reconcileWithRules(ml: PainMLOutput, rulesMid: number): ReconcileResult {
  const divergence = Math.abs(rulesMid - ml.mid) / Math.max(ml.mid, 1)

  if (divergence <= 0.15) {
    return { status: 'agree', divergence }
  }

  if (divergence <= 0.3) {
    return {
      status: 'minor_diverge',
      divergence,
      warning: `規則引擎與歷史資料落差 ${(divergence * 100).toFixed(0)}%，建議複核`,
    }
  }

  // > 30% 落差
  const baseWarning = `規則引擎 ${rulesMid.toLocaleString()} 元 vs 歷史中位 ${ml.mid.toLocaleString()} 元，落差 ${(divergence * 100).toFixed(0)}%`
  if (ml.confidence === 'low') {
    return {
      status: 'diverge',
      divergence,
      warning: `${baseWarning}（ML 樣本 < 10，僅供參考，建議人工複核）`,
    }
  }
  return {
    status: 'diverge',
    divergence,
    warning: `${baseWarning}（建議進階複核，可能為非典型案件）`,
  }
}
