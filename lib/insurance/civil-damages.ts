// =====================================================================
// 民事損害賠償計算
// 涵蓋：民事醫療差額、看護費（地區行情）、工作損失、勞動能力減損、
//       精神慰撫金（50 級傷勢區間 + Personal Factors）
//
// 公式原則：
//   1. 民事醫療 = 總收據 - 強制險已認列
//   2. 民事看護 = 地區日額 × 醫囑日數 - 強制險已認列
//   3. 工作損失 = 每日收入 × min(實際請假, 醫囑休養)
//   4. 精神慰撫金 = 嚴重度分數 (0-200) → 50 級傷勢區間 → 地區參考 × Personal Factors
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
  hasOrganDamage?: boolean
  hasAmputation: boolean
  treatmentDurationDays: number // 保留供 scoreSeverity 內部使用（測試可注入）
}

// 50 級傷勢區間表（從 pas-table.ts 共用）
import {
  PAS_TABLE,
  PAIN_AMOUNT_MAX,
  PAIN_AMOUNT_MIN,
  type PasLevelRow,
  pasLevelIndexFromScore,
  personalFactorMultiplier,
  DEFAULT_PERSONAL_FACTORS,
  type PersonalFactors,
} from './pas-table'
const BASE_PAS_TABLE: PasLevelRow[] = PAS_TABLE

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

  // 住院日數（0-30）
  if (b.hospitalizationDays >= 60) score += 30
  else if (b.hospitalizationDays >= 30) score += 22
  else if (b.hospitalizationDays >= 15) score += 15
  else if (b.hospitalizationDays >= 7) score += 10
  else if (b.hospitalizationDays >= 1) score += 5

  // 復健次數（0-15）
  if (b.rehabilitationCount >= 50) score += 15
  else if (b.rehabilitationCount >= 30) score += 12
  else if (b.rehabilitationCount >= 15) score += 8
  else if (b.rehabilitationCount >= 5) score += 4

  // 疤痕 / 截肢（截肢屬重度生活功能影響，不與一般疤痕同權重）
  if (b.hasAmputation) score += 80
  else if (b.scarLengthCm >= 20) score += 20
  else if (b.scarLengthCm >= 10) score += 15
  else if (b.scarLengthCm >= 5) score += 10
  else if (b.scarLengthCm > 0) score += 5

  // 開刀 (0-15)
  if (b.hasSurgery) score += 15

  // 骨折 (0-18)
  if (b.hasFracture) score += 18

  // 神經 / 臟器傷害（均須專科診斷，僅供慰撫金傷勢分層）
  if (b.hasNerveDamage) score += 30
  if (b.hasOrganDamage) score += 35

  // 永久障害 (0-25)
  if (b.hasPermanentImpairment) score += 25

  // 已具失能診斷 / 截肢 (0-30)
  if (b.hasDisability || b.hasAmputation) score += 30

  return Math.min(score, 200)
}

function pickPasTableIndex(score: number): number {
  return pasLevelIndexFromScore(score)
}

function clampPainAmount(amount: number): number {
  return Math.max(PAIN_AMOUNT_MIN, Math.min(PAIN_AMOUNT_MAX, Math.round(amount)))
}

/**
 * 計算精神慰撫金（含地區係數）
 */
export function computePainAndSuffering(
  medical: MedicalRecord,
  courtName: string,
  personal?: PersonalFactors, // v0.18.x+ Personal Factors (不傳時用 DEFAULT)
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
    hasOrganDamage: medical.hasOrganDamage,
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

  const baseLow = clampPainAmount(baseRow.low * (1 + treatmentBoost))
  const baseMid = clampPainAmount(baseRow.mid * (1 + treatmentBoost))
  const baseHigh = clampPainAmount(baseRow.high * (1 + treatmentBoost))

  const regionalLow = clampPainAmount(baseLow * region.painAndSufferingMultiplier)
  const regionalMid = clampPainAmount(baseMid * region.painAndSufferingMultiplier)
  const regionalHigh = clampPainAmount(baseHigh * region.painAndSufferingMultiplier)

  // 個人條件由人工依證據審酌，不以固定倍率自動加減慰撫金。
  const pf = personalFactorMultiplier(personal ?? DEFAULT_PERSONAL_FACTORS)
  const adjustedLow = clampPainAmount(regionalLow * pf.multiplier)
  const adjustedMid = clampPainAmount(regionalMid * pf.multiplier)
  const adjustedHigh = clampPainAmount(regionalHigh * pf.multiplier)

  const notes: string[] = []
  if (pf.ageNote) notes.push(pf.ageNote)
  if (pf.occupationNote) notes.push(pf.occupationNote)
  if (pf.dependentNote) notes.push(pf.dependentNote)
  if (pf.laborLossNote) notes.push(pf.laborLossNote)

  return {
    baseLow,
    baseMid,
    baseHigh,
    regionalMultiplier: region.painAndSufferingMultiplier,
    regionalLow,
    regionalMid,
    regionalHigh,
    adjustedLow,
    adjustedMid,
    adjustedHigh,
    personalFactorMultiplier: pf.multiplier,
    personalFactorNotes: notes,
    severityLevel: baseRow.label,
    severityScore,
    severityLevelIndex: idx,
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
  /** 未確認醫囑必要性時，金額不得列入主估算。 */
  requiresMedicalProof: boolean
  notes: string[]
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
  const region = getRegionAdjustment(courtName)
  // 看護費（尤其居家看護）需有醫師認定必要性；不能只因輸入收據／日數即主張。
  // undefined 保留舊分享資料的向後相容，明確填 false 時才阻擋試算。
  if (medical.requiresNursingCare === false) {
    return {
      low: 0,
      mid: 0,
      high: 0,
      requiresMedicalProof: true,
      notes: ['未確認醫師認定看護必要性，看護費暫不列入民事主估算'],
      region: {
        low: region.nursingDailyRateLow,
        mid: region.nursingDailyRateMid,
        high: region.nursingDailyRateHigh,
      },
    }
  }

  // 強制險已認列的看護費
  const eligibleDays = Math.min(receipts.nursingDays, 30)
  const compulsoryNursingApproved = Math.min(receipts.nursingFee, 1_200 * eligibleDays)

  // 醫囑看護日數優先用 receipts.nursingDays，否則 medical.nursingDays
  const doctorOrderedDays = receipts.nursingDays > 0 ? receipts.nursingDays : medical.nursingDays

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
    requiresMedicalProof: false,
    notes: [],
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

// --- 勞動能力減損（霍夫曼 × 失能等級 1-15 × 年收入） --------------------
// 法源：
//   - 民法 §193 II（勞動能力減損之賠償）
//   - 司法院 73.05.25 (73)廳民一字第 365 號函釋
//   - 強制汽車責任保險給付標準 §4 附表「失能等級」1-15 等
//
// 公式：金額 = 年收入 × 霍夫曼係數（n=到退休年數）× 失能等級百分比
//   - 年收入：以 6 月平均薪資 × 12 推估（保守版）
//   - 霍夫曼年數：min(65 - 事故年齡, 40)；不足 0 年回 0
//   - 失能等級百分比：來自 DISABILITY_LABOR_LOSS_PCT（1 等=100%, 15 等=5%）
//   - 地區差異僅影響證據提示，不以慰撫金係數調整已證明的收入損失。
//
// 重要：未輸入失能等級、年齡、收入任一項時回 estimate = 0 + 提示，不硬算

export interface LaborCapacityLossInput {
  medical: MedicalRecord
  person: Pick<PersonalIncome, 'age' | 'sixMonthAverageSalary' | 'monthlySalary'>
  courtName: string
  /** 失能等級 1-15（來自強制險失能診斷書）；未輸入時為 null */
  disabilityLevel: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | null
  /** 醫療鑑定或職務分析認定的勞減率（0–1）；優先於強制險失能等級參考表。 */
  assessedLossPercent?: number
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
  /** 沒有個案鑑定／職務分析率時，等級映射只能作參考。 */
  isReferenceEstimate?: boolean
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
      regionalMultiplier: 1,
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
      regionalMultiplier: 1,
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
      regionalMultiplier: 1,
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
      regionalMultiplier: 1,
      disabilityLevel,
      retirementAge,
      hint: `受害人年齡已達/超過計算終點年齡（${retirementAge} 歲 = 退休年齡），霍夫曼年數為 0，不適用勞動能力減損（多以慰撫金取代）`,
      notes: [`${retirementAge} 歲以上者多以「慰撫金」取代「勞減」`],
    }
  }

  const coefficient = hoffmannCoefficient(hoffmannYears)
  const assessedLossPercent = input.assessedLossPercent
  const hasAssessedLossPercent =
    assessedLossPercent !== undefined &&
    Number.isFinite(assessedLossPercent) &&
    assessedLossPercent >= 0 &&
    assessedLossPercent <= 1
  const lossPercent = hasAssessedLossPercent ? assessedLossPercent : laborLossPct(disabilityLevel)
  // 收入損失應依實際收入、期間與勞減比例計算，不能套用慰撫金的地區係數。
  const regionalMultiplier = 1

  const estimate = Math.round(annualIncome * coefficient * lossPercent)

  // 區間反映證據與失能比例仍待認定的風險，不以地區係數放大收入。
  const estimateLow = Math.round(estimate * 0.8)
  const estimateHigh = Math.round(estimate * 1.2)

  // 提示
  notes.push(
    `年齡 ${person.age} 歲 → 霍夫曼年數 ${hoffmannYears} 年（係數 ${coefficient.toFixed(4)}）`,
  )
  notes.push(
    hasAssessedLossPercent
      ? `採醫療鑑定／職務分析勞減率 ${(lossPercent * 100).toFixed(0)}%`
      : `失能等級 ${disabilityLevel} 等 → 參考勞減比例 ${(lossPercent * 100).toFixed(0)}%`,
  )
  notes.push(
    `年收入 ${annualIncome.toLocaleString()} 元 → 勞減估算約 ${estimate.toLocaleString()} 元`,
  )

  if (region.workLossEvidenceStrictness === 'high') {
    notes.push(`${region.courtName} 對收入與失能證據要求較嚴，建議補齊薪資、稅務與醫療資料`)
  }
  if (!hasAssessedLossPercent) {
    notes.push('⚠️ 未提供個案鑑定或職務分析勞減率；本額以失能等級映射，僅供參考')
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
    isReferenceEstimate: !hasAssessedLossPercent,
  }
}
