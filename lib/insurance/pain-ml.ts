// =====================================================================
// 精神慰撫金 ML 區間引擎（v0.18.x+ v2 — 傷勢 × 地區 brackets）
//
// 設計：四層架構
//   Layer 1（啟發式）  規則引擎 8 級區間 + 地區係數 → baseline range
//   Layer 2（傷勢 × 地區 brackets） 從 153 件 精神慰撫金 真實判決萃取
//                       按 (死亡/重傷/輕傷) × (北/中/南) 給 P10/P50/P90
//                       v0.18.x 取代 v0.6.0 的 13 件全體 anchor
//   Layer 3（傷勢全國 fallback） 該地區樣本 < 5 → 退到全國傷勢中位
//   Layer 4（純啟發式） 樣本 < 5 → 退到 Layer 1
//
// 輸出：
//   - lower / mid / upper：金額區間（元）
//   - p10 / p50 / p90：歷史中位 + 80% 信賴區間
//   - confidence: 'high' ≥ 20 / 'medium' 10-19 / 'low' < 10
//   - anchorCases: 真實判例 ref（給 UI 引註）
//   - method: 'ml_v2_severity_region' | 'ml_v2_severity_national'
//           | 'heuristic_only' | 'fallback'
//
// v0.18.x 變更（相對 v0.6.0）：
//   - 修 loadAnchorCases 欄位名 bug（mentalDistressAmount → amount）
//     13 件 anchor 全部沒讀到的問題修了
//   - 改成 (severity, region) 二維 bracket，從 153 件 records 萃取
//   - sample size 大幅提升：death_north N=12 / minor_north N=48 / minor_central N=24
//
// 不變量（測試守護）：
//   - lower ≤ mid ≤ upper
//   - p10 ≤ p50 ≤ p90
//   - 未知法院 / 未知傷勢 → fallback 到 1.0 係數，不報錯
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
  method: 'ml_v2_severity_region' | 'ml_v2_severity_national' | 'heuristic_only' | 'fallback'
  /** 嚴重度等級（給 UI 顯示對應等級 label） */
  severityLevel: number
  severityLabel: string
  /** 樣本數（給 UI 顯示「歷史 N=48 件」） */
  sampleSize: number
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

  if (b.hospitalizationDays >= 15) score += 20
  else if (b.hospitalizationDays >= 8) score += 15
  else if (b.hospitalizationDays >= 4) score += 10
  else if (b.hospitalizationDays >= 1) score += 5

  if (b.rehabilitationCount >= 16) score += 15
  else if (b.rehabilitationCount >= 6) score += 10
  else if (b.rehabilitationCount >= 1) score += 5

  if (b.hasAmputation) score += 15
  else if (b.scarLengthCm >= 10) score += 15
  else if (b.scarLengthCm >= 5) score += 10
  else if (b.scarLengthCm > 0) score += 5

  if (b.hasSurgery) score += 10
  if (b.hasFracture) score += 10
  if (b.hasNerveDamage) score += 10
  if (b.hasPermanentImpairment) score += 10
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

// --- 傷勢分類 (對應 historical bracket) ---------------------------------

type PainSeverity = 'death' | 'severe_injury' | 'minor_injury'

/** 從 severity level 推對應的 historical bracket 分類 */
function severityFromLevel(level: number): PainSeverity {
  if (level >= 7) return 'death' // 極嚴重/重大 → 對齊「死亡」分組
  if (level >= 5) return 'severe_injury' // 重度/嚴重 → 對齊「重傷」分組
  return 'minor_injury' // 其他 → 對齊「輕傷」分組
}

// --- 地區分類 (與 precedents 一致) ---------------------------------------

type PainRegion = 'north' | 'central' | 'south' | 'island' | 'unknown'

function courtToRegion(courtName: string): PainRegion {
  if (!courtName) return 'unknown'
  if (courtName.includes('福建')) return 'island'
  if (
    courtName.includes('臺灣臺北') ||
    courtName.includes('臺灣新北') ||
    courtName.includes('臺灣士林') ||
    courtName.includes('臺灣基隆') ||
    courtName.includes('臺灣宜蘭') ||
    courtName.includes('臺灣桃園') ||
    courtName.includes('臺灣新竹')
  )
    return 'north'
  if (
    courtName.includes('臺灣臺中') ||
    courtName.includes('臺灣彰化') ||
    courtName.includes('臺灣南投') ||
    courtName.includes('臺灣苗栗') ||
    courtName.includes('臺灣雲林') ||
    courtName.includes('臺灣嘉義')
  )
    return 'central'
  if (
    courtName.includes('臺灣臺南') ||
    courtName.includes('臺灣高雄') ||
    courtName.includes('臺灣屏東') ||
    courtName.includes('臺灣花蓮') ||
    courtName.includes('臺灣臺東') ||
    courtName.includes('臺灣澎湖') ||
    courtName.includes('橋頭')
  )
    return 'south'
  return 'unknown'
}

// --- Historical anchor 載入 -----------------------------------------------

interface RawPrecedent {
  caseNo: string
  court: string
  year: number
  category: string
  amount: number
  gist?: string
  facts?: string
}

interface PainBracket {
  n: number
  p10: number
  p50: number
  p90: number
}

interface BracketMap {
  /** (severity, region) → bracket；樣本 < 5 會被省略 */
  byCell: Record<string, PainBracket>
  /** 該 severity 跨所有地區的 fallback */
  bySeverity: Record<string, PainBracket>
  /** 全部 anchor (internal) */
  allAnchors: PainAnchorInternal[]
}

/** Internal anchor with severity/region for bracket 計算（不 export） */
interface PainAnchorInternal extends PainAnchorCase {
  severity: PainSeverity
  region: PainRegion
}

let _bracketCache: BracketMap | null = null

/**
 * 從 taipei-mental-distress.json 153 件 records 計算 (severity × region) brackets
 * 樣本 < 5 的 cell 省略，調用端 fallback 到 bySeverity
 */
function loadBrackets(): BracketMap {
  if (_bracketCache !== null) return _bracketCache
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
    if (!path) return { byCell: {}, bySeverity: {}, allAnchors: [] }

    const raw = JSON.parse(readFileSync(path, 'utf-8')) as RawPrecedent[]
    const anchors: PainAnchorInternal[] = []
    for (const r of raw) {
      if (!r.amount || r.amount <= 0) continue
      const text = (r.gist || '') + (r.facts || '') + (r.category || '')
      let sev: PainSeverity = 'minor_injury'
      if (r.category === 'death' || text.includes('死亡')) sev = 'death'
      else if (r.category === 'severe_injury' || text.includes('重傷')) sev = 'severe_injury'
      const reg = courtToRegion(r.court || '')
      anchors.push({
        caseNo: r.caseNo,
        court: r.court,
        amount: r.amount,
        year: r.year,
        category: r.category,
        severity: sev,
        region: reg,
      })
    }

    // 計算 (severity, region) brackets
    const byCell: Record<string, PainBracket> = {}
    const bySeverity: Record<string, PainBracket> = {}
    const MIN_N = 5
    const cellMap: Record<string, number[]> = {}
    for (const a of anchors) {
      const key = `${a.severity}_${a.region}`
      ;(cellMap[key] ||= []).push(a.amount)
      ;(cellMap[`${a.severity}_*`] ||= []).push(a.amount) // 全國 fallback
    }
    for (const key of Object.keys(cellMap)) {
      const amounts = cellMap[key]!.sort((a, b) => a - b)
      const bracket: PainBracket = {
        n: amounts.length,
        p10: Math.round(percentile(amounts, 0.1)),
        p50: Math.round(percentile(amounts, 0.5)),
        p90: Math.round(percentile(amounts, 0.9)),
      }
      // 樣本 ≥ 5 才列入 cell；severity 全國 fallback 不論 N
      if (key.endsWith('_*') || amounts.length >= MIN_N) {
        if (key.endsWith('_*')) {
          bySeverity[key.replace('_*', '')] = bracket
        } else {
          byCell[key] = bracket
        }
      }
    }
    _bracketCache = { byCell, bySeverity, allAnchors: anchors }
    return _bracketCache
  } catch {
    return { byCell: {}, bySeverity: {}, allAnchors: [] }
  }
}

/** 線性插值百分位數 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const first = sorted[0]!
  if (sorted.length === 1) return first
  const idx = (sorted.length - 1) * p
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return sorted[lower]!
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (idx - lower)
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

  // 地區係數
  let regionMultiplier = 1.0
  try {
    const region = getRegionAdjustment(courtName)
    regionMultiplier = region.painAndSufferingMultiplier
  } catch {
    regionMultiplier = 1.0
  }

  // 治療期間加成（保守版最多 +20%）
  const treatmentDays = medical.hospitalizationDays * 2 + medical.rehabilitationCount * 3
  const treatmentBoost = Math.min(treatmentDays / 180, 0.2)

  const baseLow = Math.round(baseRow.low * (1 + treatmentBoost))
  const baseMid = Math.round(baseRow.mid * (1 + treatmentBoost))
  const baseHigh = Math.round(baseRow.high * (1 + treatmentBoost))

  const heurLow = Math.round(baseLow * regionMultiplier)
  const heurMid = Math.round(baseMid * regionMultiplier)
  const heurHigh = Math.round(baseHigh * regionMultiplier)

  // Layer 2-4：歷史 anchor brackets
  const { byCell, bySeverity, allAnchors } = loadBrackets()
  const severity = severityFromLevel(levelIdx)
  const region = courtToRegion(courtName)
  const cellKey = `${severity}_${region}`

  let p10 = heurLow
  let p50 = heurMid
  let p90 = heurHigh
  let sampleSize = 0
  let confidence: 'high' | 'medium' | 'low' = 'low'
  let method: PainMLOutput['method'] = 'heuristic_only'

  // 優先用 (severity, region) cell
  const cell = byCell[cellKey]
  const fallback = bySeverity[severity]

  if (cell) {
    p10 = cell.p10
    p50 = cell.p50
    p90 = cell.p90
    sampleSize = cell.n
    method = 'ml_v2_severity_region'
  } else if (fallback) {
    p10 = fallback.p10
    p50 = fallback.p50
    p90 = fallback.p90
    sampleSize = fallback.n
    method = 'ml_v2_severity_national'
  } else if (allAnchors.length > 0) {
    // 全 anchor fallback
    const sorted = allAnchors.map((a) => a.amount).sort((a, b) => a - b)
    p10 = Math.round(percentile(sorted, 0.1))
    p50 = Math.round(percentile(sorted, 0.5))
    p90 = Math.round(percentile(sorted, 0.9))
    sampleSize = allAnchors.length
    method = 'fallback'
  }

  if (sampleSize >= 20) confidence = 'high'
  else if (sampleSize >= 10) confidence = 'medium'
  else if (sampleSize > 0) confidence = 'low'

  // 選 anchorCases 引註 (同 severity + region 優先)
  const sameCellAnchors = allAnchors.filter((a) => a.severity === severity && a.region === region)
  const sameSevAnchors = allAnchors.filter((a) => a.severity === severity)
  const pickAnchors = sameCellAnchors.length > 0 ? sameCellAnchors : sameSevAnchors
  const anchorCases = pickAnchors
    .sort((a, b) => Math.abs(a.amount - p50) - Math.abs(b.amount - p50))
    .slice(0, 3)
    .map((a) => ({
      caseNo: a.caseNo,
      court: a.court,
      amount: a.amount,
      year: a.year,
      category: a.category,
    }))

  return {
    lower: heurLow,
    mid: heurMid,
    upper: heurHigh,
    p10,
    p50,
    p90,
    confidence,
    anchorCases,
    method,
    severityLevel: baseRow.level,
    severityLabel: baseRow.label,
    sampleSize,
  }
}

// --- reconcileWithRules：規則 vs ML 校驗 ------------------------------

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

  const baseWarning = `規則引擎 ${rulesMid.toLocaleString()} 元 vs 歷史中位 ${ml.p50.toLocaleString()} 元，落差 ${(divergence * 100).toFixed(0)}%`
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
