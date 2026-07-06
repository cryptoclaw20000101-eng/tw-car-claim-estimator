// =====================================================================
// 民事損害賠償計算
// 涵蓋：民事醫療差額、看護費（地區行情）、工作損失、勞動能力減損、
//       精神慰撫金（6-8 級分項加權 + 地區係數）
//
// 公式原則：
//   1. 民事醫療 = 總收據 - 強制險已認列
//   2. 民事看護 = 地區日額 × 醫囑日數 - 強制險已認列
//   3. 工作損失 = 每日收入 × min(實際請假, 醫囑休養)
//   4. 精神慰撫金 = 嚴重度分數 → 對應區間 → × 地區係數
// =====================================================================

import type {
  CompulsoryMedicalInputs,
  MedicalRecord,
  PersonalIncome,
  PainAndSufferingResult,
} from './types'
import { getRegionAdjustment } from './region-adjustments'
import { hoffmannCoefficient, laborLossPct } from './hoffmann'

// --- 精神慰撫金 6-8 級評分系統（spec §八 5 + v2 細分） ---------------
// 6-8 級（採用 8 級）— 依傷勢嚴重度 + 治療強度分項加權

interface SeverityScoreBreakdown {
  hospitalizationDays: number
  rehabilitationCount: number
  scarLengthCm: number
  hasPermanentImpairment: boolean
  hasDisability: boolean
  hasSurgery: boolean
  hasFracture: boolean
  hasNerveDamage: boolean
  hasAmputation: boolean
  treatmentDurationDays: number // 保留供 scoreSeverity 內部使用（測試可注入）
}

// 8 級區間表（元），基本值
const BASE_PAS_TABLE: { level: number; label: string; low: number; mid: number; high: number }[] = [
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

/**
 * 依傷勢細節計算嚴重度分數（0-100），再對應到 8 級區間
 *
 * 評分權重（總和 100）：
 *   - 住院日數：0-20 分（0-3 日=5, 4-7=10, 8-14=15, 15+=20）
 *   - 復健次數：0-15 分（0=0, 1-5=5, 6-15=10, 16+=15）
 *   - 疤痕長度：0-15 分（0=0, <5cm=5, 5-10=10, 10cm+=15）
 *   - 手術：0-10 分（有=10）
 *   - 骨折：0-10 分（有=10）
 *   - 神經損傷：0-10 分（有=10）
 *   - 永久障害：0-10 分（有=10）
 *   - 失能/截肢：0-10 分（有=10）
 */
export function scoreSeverity(b: SeverityScoreBreakdown): number {
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
  if (b.hasAmputation)
    score += 15 // 截肢疤痕極重
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

  // 失能/截肢（0-10）— 與疤痕不重複計
  if (b.hasDisability || b.hasAmputation) score += 10

  return Math.min(score, 100)
}

function pickPasTableIndex(score: number): number {
  if (score >= 75) return 7 // 重大
  if (score >= 60) return 6 // 極嚴重
  if (score >= 45) return 5 // 嚴重
  if (score >= 35) return 4 // 重度
  if (score >= 25) return 3 // 中重度
  if (score >= 15) return 2 // 中度
  if (score >= 5) return 1 // 輕傷
  return 0 // 極輕微
}

/**
 * 計算精神慰撫金（含地區係數）
 */
export function computePainAndSuffering(
  medical: MedicalRecord,
  courtName: string,
): PainAndSufferingResult {
  const breakdown: SeverityScoreBreakdown = {
    hospitalizationDays: medical.hospitalizationDays,
    rehabilitationCount: medical.rehabilitationCount,
    scarLengthCm: medical.scarLengthCm ?? 0,
    hasPermanentImpairment: medical.hasPermanentImpairment,
    hasDisability: medical.hasDisabilityCertificate,
    hasSurgery: medical.hasSurgery,
    hasFracture: medical.hasFracture,
    hasNerveDamage: medical.hasNerveDamage,
    hasAmputation: medical.hasAmputation,
    treatmentDurationDays: medical.hospitalizationDays * 2 + medical.rehabilitationCount * 3,
  }

  const severityScore = scoreSeverity(breakdown)
  const idx = pickPasTableIndex(severityScore)
  const baseRow = BASE_PAS_TABLE[idx]!
  const region = getRegionAdjustment(courtName)

  // 治療期間加成（保守版，最多 +20%）— 用實際天數粗估
  const treatmentDays = medical.hospitalizationDays * 2 + medical.rehabilitationCount * 3
  const treatmentBoost = Math.min(treatmentDays / 180, 0.2)

  const baseLow = Math.round(baseRow.low * (1 + treatmentBoost))
  const baseMid = Math.round(baseRow.mid * (1 + treatmentBoost))
  const baseHigh = Math.round(baseRow.high * (1 + treatmentBoost))

  const regionalLow = Math.round(baseLow * region.painAndSufferingMultiplier)
  const regionalMid = Math.round(baseMid * region.painAndSufferingMultiplier)
  const regionalHigh = Math.round(baseHigh * region.painAndSufferingMultiplier)

  return {
    baseLow,
    baseMid,
    baseHigh,
    regionalMultiplier: region.painAndSufferingMultiplier,
    regionalLow,
    regionalMid,
    regionalHigh,
    severityLevel: baseRow.label,
    severityScore,
    breakdown: {
      hospitalizationDays: breakdown.hospitalizationDays,
      rehabilitationCount: breakdown.rehabilitationCount,
      scarLengthCm: breakdown.scarLengthCm,
      hasPermanentImpairment: breakdown.hasPermanentImpairment,
      hasDisability: breakdown.hasDisability,
    },
  }
}

// --- 民事醫療費差額 --------------------------------------------------

export function computeCivilMedicalExpense(
  totalMedicalReceipts: number,
  compulsoryApproved: number,
): number {
  return Math.max(totalMedicalReceipts - compulsoryApproved, 0)
}

// --- 民事看護費（地區行情） -------------------------------------------

export interface CivilNursingResult {
  low: number
  mid: number
  high: number
  region: {
    low: number
    mid: number
    high: number
  }
}

export function computeCivilNursingFee(
  receipts: CompulsoryMedicalInputs,
  medical: MedicalRecord,
  courtName: string,
): CivilNursingResult {
  // 強制險已認列的看護費
  const eligibleDays = Math.min(receipts.nursingDays, 30)
  const compulsoryNursingApproved = Math.min(receipts.nursingFee, 1_200 * eligibleDays)

  // 醫囑看護日數優先用 receipts.nursingDays，否則 medical.nursingDays
  const doctorOrderedDays = receipts.nursingDays > 0 ? receipts.nursingDays : medical.nursingDays

  const region = getRegionAdjustment(courtName)

  const low = Math.max(
    region.nursingDailyRateLow * doctorOrderedDays - compulsoryNursingApproved,
    0,
  )
  const mid = Math.max(
    region.nursingDailyRateMid * doctorOrderedDays - compulsoryNursingApproved,
    0,
  )
  const high = Math.max(
    region.nursingDailyRateHigh * doctorOrderedDays - compulsoryNursingApproved,
    0,
  )

  return {
    low,
    mid,
    high,
    region: {
      low: region.nursingDailyRateLow,
      mid: region.nursingDailyRateMid,
      high: region.nursingDailyRateHigh,
    },
  }
}

// --- 工作損失 --------------------------------------------------------

export interface WorkLossResult {
  amount: number
  dailyIncome: number
  reasonableRestDays: number
  evidenceStrength: 'low' | 'medium' | 'high'
  notes: string[]
}

export function computeWorkLoss(person: PersonalIncome, courtName: string): WorkLossResult {
  const notes: string[] = []
  const region = getRegionAdjustment(courtName)

  // 每日收入 = 六個月平均薪資 / 30
  const dailyIncome = person.sixMonthAverageSalary / 30

  // 合理休養日數 = min(實際請假, 醫囑休養)
  const reasonableRestDays = Math.min(person.actualLeaveDays, person.doctorOrderedRestDays)

  if (reasonableRestDays === 0) {
    return {
      amount: 0,
      dailyIncome: 0,
      reasonableRestDays: 0,
      evidenceStrength: 'low',
      notes: ['未輸入請假或醫囑休養日數，無法估算工作損失'],
    }
  }

  const amount = Math.round(dailyIncome * reasonableRestDays)

  // 證據強度評估
  let strength: 'low' | 'medium' | 'high' = 'low'
  const evidenceFlags = [
    person.hasPropertyList,
    person.hasSalaryTransferRecord,
    person.hasLeaveCertificate,
    person.hasSalaryDeductionProof,
    person.sixMonthAverageSalary > 0,
    person.lastYearTaxableIncome > 0,
  ]
  const evidenceCount = evidenceFlags.filter(Boolean).length
  if (evidenceCount >= 5) strength = 'high'
  else if (evidenceCount >= 3) strength = 'medium'
  else strength = 'low'

  if (strength === 'low') {
    notes.push('⚠️ 缺乏薪轉、扣薪、報稅、請假等佐證，工作損失證據強度不足')
  } else if (strength === 'medium') {
    notes.push('建議補齊：薪轉證明、扣薪證明、醫囑休養期間')
  }

  // 地區嚴格度提示
  if (region.workLossEvidenceStrictness === 'high') {
    notes.push(
      `${region.courtName} 對工作損失證據要求較嚴，建議齊備：薪轉、扣薪、報稅所得、醫囑休養期間`,
    )
  } else if (region.workLossEvidenceStrictness === 'medium') {
    notes.push('建議補：薪資證明、請假單、扣薪證明、醫囑休養期間')
  }

  return {
    amount,
    dailyIncome,
    reasonableRestDays,
    evidenceStrength: strength,
    notes,
  }
}

// --- 勞動能力減損（霍夫曼 × 失能等級 1-15 × 年收入 × 地區係數） --------
// 法源：
//   - 民法 §193 II（勞動能力減損之賠償）
//   - 司法院 73.05.25 (73)廳民一字第 365 號函釋
//   - 強制汽車責任保險給付標準 §4 附表「失能等級」1-15 等
//
// 公式：金額 = 年收入 × 霍夫曼係數（n=到退休年數）× 失能等級百分比 × 地區係數
//   - 年收入：以 6 月平均薪資 × 12 推估（保守版）
//   - 霍夫曼年數：min(65 - 事故年齡, 40)；不足 0 年回 0
//   - 失能等級百分比：來自 DISABILITY_LABOR_LOSS_PCT（1 等=100%, 15 等=5%）
//   - 地區係數：沿用 painAndSufferingMultiplier（反映物價 + 物資）
//
// 重要：未輸入失能等級、年齡、收入任一項時回 estimate = 0 + 提示，不硬算

export interface LaborCapacityLossInput {
  medical: MedicalRecord
  person: Pick<PersonalIncome, 'age' | 'sixMonthAverageSalary' | 'monthlySalary'>
  courtName: string
  /** 失能等級 1-15（來自強制險失能診斷書）；未輸入時為 null */
  disabilityLevel: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | null
  /**
   * 霍夫曼計算終點年齡（勞減算到幾歲）。
   * 預設 65（勞基法 §54 強制退休年齡）。
   * 農業 / 自營 / 高齡就業者可調到 70（雲林地院 110 簡 23 號判例）。
   * 專業人士（律師 / 醫師 / 會計師）可調到 70-75。
   */
  retirementAge?: number
  /**
   * 職業類型：用於自動建議 retirementAge 與 notes 提示。
   * 選填，不影響計算。
   */
  occupation?:
    | 'labor'
    | 'farmer'
    | 'self_employed'
    | 'professional'
    | 'service'
    | 'student'
    | 'unemployed'
    | 'retired'
}

export interface LaborCapacityLossResult {
  estimate: number
  estimateLow: number
  estimateHigh: number
  annualIncome: number
  hoffmannYears: number
  hoffmannCoefficient: number
  lossPercent: number
  regionalMultiplier: number
  disabilityLevel: number | null
  retirementAge: number
  hint: string | null
  notes: string[]
}

export function computeLaborCapacityLoss(input: LaborCapacityLossInput): LaborCapacityLossResult {
  const { medical, person, courtName, disabilityLevel } = input
  const region = getRegionAdjustment(courtName)
  const notes: string[] = []

  // 訊號檢查：完全無失能/神經/關節受限線索 → 不計算
  const signals = [
    medical.hasDisabilityCertificate,
    medical.hasPermanentImpairment,
    medical.hasRangeOfMotionLimitation,
    medical.hasNerveDamage,
    medical.hasAmputation,
  ].filter(Boolean).length

  if (signals === 0 && disabilityLevel === null) {
    return {
      estimate: 0,
      estimateLow: 0,
      estimateHigh: 0,
      annualIncome: 0,
      hoffmannYears: 0,
      hoffmannCoefficient: 0,
      lossPercent: 0,
      regionalMultiplier: region.painAndSufferingMultiplier,
      disabilityLevel: null,
      retirementAge: input.retirementAge ?? 65,
      hint: null,
      notes: ['未偵測到失能線索，無需計算勞動能力減損'],
    }
  }

  // 必要參數檢查
  if (disabilityLevel === null) {
    return {
      estimate: 0,
      estimateLow: 0,
      estimateHigh: 0,
      annualIncome: 0,
      hoffmannYears: 0,
      hoffmannCoefficient: 0,
      lossPercent: 0,
      regionalMultiplier: region.painAndSufferingMultiplier,
      disabilityLevel: null,
      retirementAge: input.retirementAge ?? 65,
      hint: '有失能/神經/關節/截肢線索，但缺「失能等級」。請補：強制險失能診斷書 1-15 等，或勞工失能 1-15 等',
      notes: ['建議補：失能等級（強制險 §4 附表 或 勞工失能 §2 附表）'],
    }
  }

  // 年收入：以 6 月平均薪資 × 12 推估；六個月未填則用月薪 × 12
  const annualIncome =
    person.sixMonthAverageSalary > 0 ? person.sixMonthAverageSalary * 12 : person.monthlySalary * 12

  if (annualIncome === 0) {
    return {
      estimate: 0,
      estimateLow: 0,
      estimateHigh: 0,
      annualIncome: 0,
      hoffmannYears: 0,
      hoffmannCoefficient: 0,
      lossPercent: 0,
      regionalMultiplier: region.painAndSufferingMultiplier,
      disabilityLevel,
      retirementAge: input.retirementAge ?? 65,
      hint: '缺年收入（六個月平均薪資或月薪），無法計算勞動能力減損',
      notes: ['請補：事故前 6 月平均薪資 或 現職月薪'],
    }
  }

  // 霍夫曼年數：min(退休年齡 - 事故年齡, 40)，不足 0 年回 0
  // 預設 65 歲（勞基法 §54），農業/自營/專業人士可調到 70-75（雲林地院 110 簡 23 號判例）
  const retirementAge = input.retirementAge ?? 65
  const rawYears = retirementAge - person.age
  const hoffmannYears = Math.max(Math.min(rawYears, 40), 0)

  if (hoffmannYears === 0) {
    return {
      estimate: 0,
      estimateLow: 0,
      estimateHigh: 0,
      annualIncome,
      hoffmannYears: 0,
      hoffmannCoefficient: 0,
      lossPercent: 0,
      regionalMultiplier: region.painAndSufferingMultiplier,
      disabilityLevel,
      retirementAge,
      hint: `受害人年齡已達/超過計算終點年齡（${retirementAge} 歲 = 退休年齡），霍夫曼年數為 0，不適用勞動能力減損（多以慰撫金取代）`,
      notes: [`${retirementAge} 歲以上者多以「慰撫金」取代「勞減」`],
    }
  }

  const coefficient = hoffmannCoefficient(hoffmannYears)
  const lossPercent = laborLossPct(disabilityLevel)
  const regionalMultiplier = region.painAndSufferingMultiplier

  // 主估算（地區係數已含）
  const estimate = Math.round(annualIncome * coefficient * lossPercent * regionalMultiplier)

  // 低/高估算：低 = 不含地區加成、高 = 1.2 倍地區加成（容許 ±20% 區間）
  const estimateLow = Math.round(annualIncome * coefficient * lossPercent * 1.0)
  const estimateHigh = Math.round(
    annualIncome * coefficient * lossPercent * regionalMultiplier * 1.2,
  )

  // 提示
  notes.push(
    `年齡 ${person.age} 歲 → 霍夫曼年數 ${hoffmannYears} 年（係數 ${coefficient.toFixed(4)}）`,
  )
  notes.push(`失能等級 ${disabilityLevel} 等 → 勞減比例 ${(lossPercent * 100).toFixed(0)}%`)
  notes.push(
    `年收入 ${annualIncome.toLocaleString()} 元 → 勞減估算約 ${estimate.toLocaleString()} 元`,
  )

  if (region.confidenceLevel === 'low') {
    notes.push(`⚠️ ${region.courtName} 地區資料信心度低，實際判賠可能與估算有 ±20% 落差`)
  }

  return {
    estimate,
    estimateLow,
    estimateHigh,
    annualIncome,
    hoffmannYears,
    hoffmannCoefficient: Math.round(coefficient * 10_000) / 10_000,
    lossPercent,
    regionalMultiplier,
    disabilityLevel,
    retirementAge,
    hint: null,
    notes,
  }
}
