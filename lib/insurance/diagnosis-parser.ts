// =====================================================================
// 診斷書自動推論失能等級（v0.19.0 rule-based parser）
//
// 設計目標：業務員貼上「診斷證明書」全文 → 自動萃取傷勢 + ROM + 關節
// → 對照強制汽車責任保險失能給付標準 §4 → 給出建議等級 + reasoning。
//
// 設計原則（鏡 pain-advisor.ts mockLLMAdvisor）：
//   - 純函式，SSR-safe，不打 API（AGENTS §2.2 零套件紅線）
//   - 是「建議層」非「取代層」：業務員可手動覆寫（v0.11.0 Ensemble 哲學）
//   - 永遠給 reasoning trace + confidence，UI 必顯示
//   - 不處理 PII（AGENTS §11）：診斷書本身可能有姓名，但 parser 只輸出結構化傷勢
//
// v0.19.0 範圍（rule-based，無 LLM）：
//   1. Keyword extraction（regex）：骨折家族 / 截肢 / 神經損傷 / ROM% / 視力 / 聽力
//   2. Severity classification：用既有 classifyJointDisorder
//   3. Level lookup：用既有 lookupUpperLimbLevel / lookupLowerLimbLevel / lookupDisabilityLevelByDate
//   4. Reasoning trace：每個信號 → mapping → final level
//   5. Confidence：high / medium / low / none
//
// v0.20.0+ 規劃（LLM optional）：
//   - 用 Claude API 處理更複雜中文診斷書（多發性傷害、罕見病名）
//   - 鏡 AGENTS §11 三階段交付：mock → API → UI
// =====================================================================

import type { DisabilityLevel, JointName } from './types'
import {
  classifyJointDisorder,
  lookupDisabilityLevelByDate,
  lookupLowerLimbLevel,
  lookupUpperLimbLevel,
} from './disability-joint-mapping'
import { levelFromRomLoss } from './joint-rom'

// --- 型別 ---------------------------------------------------------------

/** 傷勢類型（rule-based 字典） */
export type InjuryType =
  | 'amputation' // 截肢
  | 'fracture_complete' // 完全骨折
  | 'fracture_comminuted' // 粉碎性骨折
  | 'fracture_open' // 開放性骨折
  | 'fracture_incomplete' // 不完全骨折
  | 'fracture_simple' // 一般骨折（未細分）
  | 'dislocation' // 脫臼
  | 'nerve_damage' // 神經損傷 / 麻痺
  | 'paralysis_hemiplegia' // 半身癱
  | 'paralysis_quadriplegia' // 四肢癱
  | 'paralysis_monoplegia' // 單側癱
  | 'vision_loss' // 視力喪失
  | 'hearing_loss' // 聽力損失
  | 'organ_damage' // 器官缺損
  | 'muscle_weakness' // 肌力下降
  | 'sensory_loss' // 感覺喪失
  | 'permanent_impairment' // 永久障害
  | 'ligament_injury' // 韌帶損傷
  | 'scar' // 疤痕
  | 'unknown'

/** 從診斷書萃取的單一傷勢特徵 */
export interface DiagnosisInjury {
  type: InjuryType
  /** 關節（若提及） */
  joint: JointName | null
  /** ROM 喪失度數（若提及） */
  romLossDegree: number | null
  /** ROM 喪失百分比（0-100） */
  romLossPercent: number | null
  /** 視力（如為 vision_loss） */
  vision: number | null
  /** 聽力分貝（如為 hearing_loss） */
  hearingDb: number | null
  /** 受傷側（左 / 右 / 雙側 / 未指定） */
  side: 'left' | 'right' | 'bilateral' | 'unspecified'
}

/** 整體萃取結果 */
export interface DiagnosisFeatures {
  /** 原始輸入 */
  rawText: string
  /** 萃取到的傷勢列表 */
  injuries: DiagnosisInjury[]
  /** 是否有明確關節 */
  hasJoint: boolean
  /** 是否有 ROM 數字 */
  hasRomNumber: boolean
  /** 是否有 ROM 百分比 */
  hasRomPercent: boolean
  /** 提及的關節（去重） */
  joints: JointName[]
}

/** 信心度 */
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'none'

/** 等級建議輸出 */
export interface LevelRecommendation {
  /** 建議等級（null = 資料不足以推論） */
  level: DisabilityLevel | null
  /** 信心度 */
  confidence: ConfidenceLevel
  /** 信心度分數 0-1 */
  confidenceScore: number
  /** Reasoning trace：每步推理 */
  reasoning: string[]
  /** 是否需要人工複核（low/none confidence 時為 true） */
  requiresHumanReview: boolean
  /** 個資保護：永遠附 disclaimer */
  disclaimer: string
}

// --- Keyword dictionary -------------------------------------------------

/** 中文字 → InjuryType 對照（含 regex pattern） */
const INJURY_PATTERNS: ReadonlyArray<{ pattern: RegExp; type: InjuryType; weight: number }> = [
  // 截肢（最重 → level 1 override）
  { pattern: /(四肢癱|全部截肢)/, type: 'amputation', weight: 1.0 },
  { pattern: /(截肢|截指|截趾)/, type: 'amputation', weight: 0.95 },
  // 癱瘓
  { pattern: /四肢癱瘓/, type: 'paralysis_quadriplegia', weight: 1.0 },
  { pattern: /(半身癱|偏癱|半身不遂)/, type: 'paralysis_hemiplegia', weight: 0.95 },
  { pattern: /單側癱|單癱/, type: 'paralysis_monoplegia', weight: 0.8 },
  // 骨折家族
  { pattern: /粉碎性骨折/, type: 'fracture_comminuted', weight: 0.9 },
  { pattern: /開放性骨折/, type: 'fracture_open', weight: 0.85 },
  { pattern: /不完全骨折|裂縫骨折/, type: 'fracture_incomplete', weight: 0.5 },
  { pattern: /完全骨折/, type: 'fracture_complete', weight: 0.7 },
  { pattern: /骨折(?!後)/, type: 'fracture_simple', weight: 0.6 }, // 排除「骨折後」
  { pattern: /脫臼/, type: 'dislocation', weight: 0.6 },
  // 神經損傷
  { pattern: /(神經損傷|神經麻痺|神經斷裂)/, type: 'nerve_damage', weight: 0.75 },
  { pattern: /腕隧道症候群/, type: 'nerve_damage', weight: 0.6 },
  { pattern: /脊髓損傷/, type: 'nerve_damage', weight: 0.9 },
  // 視力 / 聽力
  { pattern: /(視力|視覺).{0,15}(喪失|受損|障礙|減退)/, type: 'vision_loss', weight: 0.85 },
  { pattern: /(聽力|聽覺).{0,15}(喪失|受損|障礙|減退)/, type: 'hearing_loss', weight: 0.8 },
  // 器官 / 其他
  { pattern: /(器官缺損|器官喪失)/, type: 'organ_damage', weight: 0.9 },
  { pattern: /肌力下降|肌肉萎縮/, type: 'muscle_weakness', weight: 0.5 },
  { pattern: /感覺喪失|感覺異常/, type: 'sensory_loss', weight: 0.5 },
  { pattern: /(永久障害|永久失能|終身障害)/, type: 'permanent_impairment', weight: 0.85 },
  { pattern: /(韌帶|肌腱).{0,5}(斷裂|撕裂|損傷)/, type: 'ligament_injury', weight: 0.6 },
  { pattern: /疤痕/, type: 'scar', weight: 0.3 },
]

/** 關節中文 → JointName */
const JOINT_MAP: ReadonlyArray<{ pattern: RegExp; joint: JointName }> = [
  { pattern: /肩(關節|部)/, joint: 'shoulder' },
  { pattern: /肘(關節|部)/, joint: 'elbow' },
  { pattern: /腕(關節|部)/, joint: 'wrist' },
  { pattern: /髖(關節|部)/, joint: 'hip' },
  { pattern: /膝(關節|部)/, joint: 'knee' },
  { pattern: /踝(關節|部)/, joint: 'ankle' },
  { pattern: /手指/, joint: 'finger' },
  { pattern: /腳趾/, joint: 'toe' },
  { pattern: /(頸椎|頸部)/, joint: 'cervical' },
  { pattern: /(腰椎|腰部)/, joint: 'lumbar' },
]

// --- 萃取 ----------------------------------------------------------------

/**
 * 從中文診斷書全文萃取結構化傷勢特徵
 *
 * @param text 診斷證明書 / 醫療紀錄文字
 * @returns DiagnosisFeatures 結構化萃取結果（包含原始傷勢列表）
 */
export function extractDiagnosisFeatures(text: string): DiagnosisFeatures {
  const rawText = (text ?? '').trim()
  const injuries: DiagnosisInjury[] = []
  const jointSet = new Set<JointName>()

  if (!rawText) {
    return {
      rawText: '',
      injuries: [],
      hasJoint: false,
      hasRomNumber: false,
      hasRomPercent: false,
      joints: [],
    }
  }

  // 1. 傷勢類型萃取
  for (const { pattern, type } of INJURY_PATTERNS) {
    if (pattern.test(rawText)) {
      // 對應 joint（從同段文字找）
      const joint = findJointInContext(rawText, pattern) ?? null
      if (joint) jointSet.add(joint)

      // ROM 度數 / 百分比
      const romLossDegree = extractRomDegree(rawText)
      const romLossPercent = extractRomPercent(rawText)

      // 視力 / 聽力
      const vision = type === 'vision_loss' ? extractVision(rawText) : null
      const hearingDb = type === 'hearing_loss' ? extractHearingDb(rawText) : null

      // 受傷側
      const side = extractSide(rawText)

      injuries.push({
        type,
        joint,
        romLossDegree,
        romLossPercent,
        vision,
        hearingDb,
        side,
      })
    }
  }

  // 2. 即使沒傷勢關鍵字，也嘗試找關節 + ROM（純 ROM loss case）
  if (injuries.length === 0) {
    const joint = findJointInContext(rawText, null)
    const romLossDegree = extractRomDegree(rawText)
    const romLossPercent = extractRomPercent(rawText)
    if (joint || romLossDegree !== null || romLossPercent !== null) {
      if (joint) jointSet.add(joint)
      injuries.push({
        type: 'unknown',
        joint,
        romLossDegree,
        romLossPercent,
        vision: null,
        hearingDb: null,
        side: extractSide(rawText),
      })
    }
  }

  const joints = Array.from(jointSet)

  return {
    rawText,
    injuries,
    hasJoint: joints.length > 0,
    hasRomNumber: injuries.some((i) => i.romLossDegree !== null),
    hasRomPercent: injuries.some((i) => i.romLossPercent !== null),
    joints,
  }
}

// --- Helper: 從 regex match 附近找 joint -------------------------------

function findJointInContext(text: string, _pattern: RegExp | null): JointName | null {
  for (const { pattern, joint } of JOINT_MAP) {
    if (pattern.test(text)) return joint
  }
  return null
}

function extractRomDegree(text: string): number | null {
  // 支援「ROM 30 度」「關節活動度 30 度」「屈曲 30 度」
  const m = text.match(/(?:ROM|關節活動度|屈曲|伸展).{0,15}?(\d{1,3})\s*度/)
  if (m) {
    const deg = parseInt(m[1], 10)
    return Number.isFinite(deg) ? deg : null
  }
  return null
}

function extractRomPercent(text: string): number | null {
  // 支援「喪失 30%」「ROM 喪失 30 ％」
  const m = text.match(/喪失.{0,10}?(\d{1,3})\s*[%％]/)
  if (m) {
    const pct = parseInt(m[1], 10)
    return Number.isFinite(pct) ? pct : null
  }
  return null
}

function extractVision(text: string): number | null {
  // 「視力 0.1」「視力 0.5」「視力 0.05」
  const m = text.match(/視力.{0,5}?(0?\.\d{1,2})/)
  if (m) return parseFloat(m[1])
  return null
}

function extractHearingDb(text: string): number | null {
  // 「聽力損失 90 分貝」「聽力 60 dB」
  const m = text.match(/聽力.{0,10}?(\d{2,3})\s*(?:分貝|dB|db)/)
  if (m) return parseInt(m[1], 10)
  return null
}

function extractSide(text: string): 'left' | 'right' | 'bilateral' | 'unspecified' {
  if (/雙側|兩側|雙/.test(text)) return 'bilateral'
  if (/左側|左手|左腳|左/.test(text)) return 'left'
  if (/右側|右手|右腳|右/.test(text)) return 'right'
  return 'unspecified'
}

// --- Level recommendation ------------------------------------------------

/**
 * 從 DiagnosisFeatures 推論建議失能等級
 *
 * Algorithm（鏡 disability.ts runDisabilityRuleEngine 邏輯但更輕量）：
 *   1. 截肢 → level 1（最高）
 *   2. 半身癱 / 四肢癱 → level 1-2
 *   3. ROM% + 明確關節 → lookupUpperLimbLevel / lookupLowerLimbLevel（新法三分類）
 *   4. ROM% only → levelFromRomLoss（舊法 5/15/30/50/70% 對照）
 *   5. 只有關鍵字沒數字 → getDefaultLevel(category) = 13
 *   6. 沒資料 → null
 *
 * @param features DiagnosisFeatures
 * @param accidentDate 事故日（新/舊法切換依此）
 * @returns LevelRecommendation
 */
export function recommendDisabilityLevel(
  features: DiagnosisFeatures,
  accidentDate?: string,
): LevelRecommendation {
  const reasoning: string[] = []

  // 規則 1：截肢（最重）
  const amputation = features.injuries.find((i) => i.type === 'amputation')
  if (amputation) {
    reasoning.push(
      `偵測到「${amputation.type === 'amputation' ? '截肢' : ''}」→ 失能第 1 級（最高等級）`,
    )
    reasoning.push(
      `金額：依事故日查 disabilityBenefitTable${accidentDate && accidentDate >= '2026-07-01' ? 'New' : 'Old'} 第 1 級`,
    )
    return {
      level: 1,
      confidence: 'high',
      confidenceScore: 0.95,
      reasoning,
      requiresHumanReview: false,
      disclaimer: STANDARD_DISCLAIMER,
    }
  }

  // 規則 2：癱瘓
  const quadriplegia = features.injuries.find((i) => i.type === 'paralysis_quadriplegia')
  if (quadriplegia) {
    reasoning.push('偵測到「四肢癱瘓」→ 失能第 1 級')
    return {
      level: 1,
      confidence: 'high',
      confidenceScore: 0.95,
      reasoning,
      requiresHumanReview: false,
      disclaimer: STANDARD_DISCLAIMER,
    }
  }
  const hemiplegia = features.injuries.find((i) => i.type === 'paralysis_hemiplegia')
  if (hemiplegia) {
    reasoning.push('偵測到「半身癱」→ 失能第 2 級')
    return {
      level: 2,
      confidence: 'high',
      confidenceScore: 0.9,
      reasoning,
      requiresHumanReview: false,
      disclaimer: STANDARD_DISCLAIMER,
    }
  }

  // 規則 3：ROM + 明確關節（新法三分類）
  const injuryWithRomAndJoint = features.injuries.find(
    (i) => i.joint && (i.romLossPercent !== null || i.romLossDegree !== null),
  )
  if (injuryWithRomAndJoint && injuryWithRomAndJoint.joint) {
    const joint = injuryWithRomAndJoint.joint
    const romLossPercent =
      injuryWithRomAndJoint.romLossPercent ??
      deriveRomLossPercent(injuryWithRomAndJoint.romLossDegree, joint)
    if (romLossPercent !== null) {
      reasoning.push(`偵測到「${jointLabelZh(joint)}」+ ROM 喪失 ${romLossPercent.toFixed(1)}%`)

      // 三大關節（上肢：肩/肘/腕；下肢：髖/膝/踝）→ 走 limb lookup
      const limbSide = getLimbSide(joint)
      if (limbSide) {
        const severity = classifyJointDisorder(romLossPercent)
        reasoning.push(`三分類: ${severity}`)
        const result = lookupLimbLevel(joint, severity, limbSide)
        if (result) {
          reasoning.push(`查表 ${result.articleId} → 失能第 ${result.level} 級`)
          return {
            level: result.level,
            confidence: 'high',
            confidenceScore: 0.9,
            reasoning,
            requiresHumanReview: false,
            disclaimer: STANDARD_DISCLAIMER,
          }
        }
      }

      // 其他關節（頸椎/腰椎/手指/腳趾）→ 用 levelFromRomLoss + 舊法百分比對照
      const fallbackLevel = lookupDisabilityLevelByDate(
        getLimbSide(joint) ?? 'upper',
        romLossPercent,
        accidentDate,
      )
      if (fallbackLevel) {
        reasoning.push(`${jointLabelZh(joint)} 用整肢 fallback 對照 → 失能第 ${fallbackLevel} 級`)
        return {
          level: fallbackLevel,
          confidence: 'medium',
          confidenceScore: 0.75,
          reasoning,
          requiresHumanReview: false,
          disclaimer: STANDARD_DISCLAIMER,
        }
      }
    }
  }

  // 規則 4：ROM 數字但無關節
  const injuryWithRomOnly = features.injuries.find(
    (i) => !i.joint && (i.romLossPercent !== null || i.romLossDegree !== null),
  )
  if (injuryWithRomOnly) {
    const pct = injuryWithRomOnly.romLossPercent ?? 0
    const fallbackLevel = lookupDisabilityLevelByDate('upper', pct, accidentDate)
    if (fallbackLevel) {
      reasoning.push(
        `ROM 喪失 ${pct}% 但無明確關節 → 用 upper fallback 對照 → 失能第 ${fallbackLevel} 級`,
      )
      return {
        level: fallbackLevel,
        confidence: 'medium',
        confidenceScore: 0.6,
        reasoning,
        requiresHumanReview: true,
        disclaimer: STANDARD_DISCLAIMER,
      }
    }
  }

  // 規則 5：只有關鍵字沒數字 → 預設 13 級
  if (features.injuries.length > 0) {
    const keywords = features.injuries.map((i) => injuryLabel(i.type)).filter(Boolean)
    reasoning.push(`偵測到關鍵字：${keywords.join('、')}，但缺 ROM/百分比`)
    reasoning.push('無明確失能百分比 → 預設第 13 級（極輕微機能障害）')
    return {
      level: 13,
      confidence: 'low',
      confidenceScore: 0.4,
      reasoning,
      requiresHumanReview: true,
      disclaimer: STANDARD_DISCLAIMER,
    }
  }

  // 規則 6：沒資料
  reasoning.push('診斷書過短或無可辨識的失能信號')
  reasoning.push('資料不足 → 等級 null，請手動輸入或補充資料')
  return {
    level: null,
    confidence: 'none',
    confidenceScore: 0,
    reasoning,
    requiresHumanReview: true,
    disclaimer: STANDARD_DISCLAIMER,
  }
}

// --- Helper: derive romLossPercent from degree -------------------------

import { jointNormalRom } from './joint-rom'

function deriveRomLossPercent(romLossDegree: number | null, joint: JointName): number | null {
  if (romLossDegree === null) return null
  const normal = jointNormalRom[joint]
  if (!normal) return null
  const pct = (romLossDegree / normal) * 100
  return Math.min(100, Math.max(0, pct))
}

function lookupLimbLevel(
  joint: JointName,
  severity: 'none' | 'motion' | 'significant' | 'lost',
  limbSide: 'upper' | 'lower',
): { articleId: string; level: DisabilityLevel } | null {
  const summary: { severity: typeof severity; count: '1' } = { severity, count: '1' }
  const other: { severity: 'none'; count: '0' } = { severity: 'none', count: '0' }
  if (limbSide === 'upper') {
    return lookupUpperLimbLevel(summary, other)
  }
  return lookupLowerLimbLevel(summary, other)
}

/** JointName → 'upper' | 'lower' | null（非肢體關節回傳 null） */
function getLimbSide(joint: JointName): 'upper' | 'lower' | null {
  const upperJoints: JointName[] = ['shoulder', 'elbow', 'wrist']
  const lowerJoints: JointName[] = ['hip', 'knee', 'ankle']
  if (upperJoints.includes(joint)) return 'upper'
  if (lowerJoints.includes(joint)) return 'lower'
  return null
}

function jointLabelZh(joint: JointName): string {
  const map: Record<JointName, string> = {
    shoulder: '肩關節',
    elbow: '肘關節',
    wrist: '腕關節',
    hip: '髖關節',
    knee: '膝關節',
    ankle: '踝關節',
    finger: '手指',
    toe: '腳趾',
    cervical: '頸椎',
    lumbar: '腰椎',
  }
  return map[joint]
}

function injuryLabel(type: InjuryType): string {
  const map: Record<InjuryType, string> = {
    amputation: '截肢',
    fracture_complete: '完全骨折',
    fracture_comminuted: '粉碎性骨折',
    fracture_open: '開放性骨折',
    fracture_incomplete: '不完全骨折',
    fracture_simple: '骨折',
    dislocation: '脫臼',
    nerve_damage: '神經損傷',
    paralysis_hemiplegia: '半身癱',
    paralysis_quadriplegia: '四肢癱',
    paralysis_monoplegia: '單側癱',
    vision_loss: '視力喪失',
    hearing_loss: '聽力喪失',
    organ_damage: '器官缺損',
    muscle_weakness: '肌力下降',
    sensory_loss: '感覺喪失',
    permanent_impairment: '永久障害',
    ligament_injury: '韌帶損傷',
    scar: '疤痕',
    unknown: '未知',
  }
  return map[type]
}

/** 標準免責聲明（永遠附帶） */
const STANDARD_DISCLAIMER =
  '本建議為 rule-based parser 自動推論，僅供業務員參考。' +
  '實際失能等級以保險公司審核、醫師鑑定、強制汽車責任保險給付標準 §4 為準。' +
  '重大理賠決策請諮詢專業律師。'

// --- Re-export for convenience ------------------------------------------

export { levelFromRomLoss }
