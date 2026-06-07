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
  treatmentDurationDays: number
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
  { level: 8, label: '重大（失能 / 截肢 / 神經重大損傷）', low: 500_000, mid: 800_000, high: 1_500_000 },
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
  if (b.hasAmputation) score += 15  // 截肢疤痕極重
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
  if (score >= 75) return 7  // 重大
  if (score >= 60) return 6  // 極嚴重
  if (score >= 45) return 5  // 嚴重
  if (score >= 35) return 4  // 重度
  if (score >= 25) return 3  // 中重度
  if (score >= 15) return 2  // 中度
  if (score >= 5) return 1   // 輕傷
  return 0                  // 極輕微
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
    scarLengthCm: medical.scarLengthCm,
    hasPermanentImpairment: medical.hasPermanentImpairment,
    hasDisability: medical.hasDisabilityCertificate,
    hasSurgery: medical.hasSurgery,
    hasFracture: medical.hasFracture,
    hasNerveDamage: medical.hasNerveDamage,
    hasAmputation: medical.hasAmputation,
    treatmentDurationDays: medical.hospitalizationDays * 2 + medical.rehabilitationCount * 3,  // 粗估
  }

  const severityScore = scoreSeverity(breakdown)
  const idx = pickPasTableIndex(severityScore)
  const baseRow = BASE_PAS_TABLE[idx]
  const region = getRegionAdjustment(courtName)

  // 治療期間加成（保守版，最多 +20%）
  const treatmentBoost = Math.min(breakdown.treatmentDurationDays / 180, 0.2)

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
  const doctorOrderedDays = receipts.nursingDays > 0
    ? receipts.nursingDays
    : medical.nursingDays

  const region = getRegionAdjustment(courtName)

  const low = Math.max(region.nursingDailyRateLow * doctorOrderedDays - compulsoryNursingApproved, 0)
  const mid = Math.max(region.nursingDailyRateMid * doctorOrderedDays - compulsoryNursingApproved, 0)
  const high = Math.max(region.nursingDailyRateHigh * doctorOrderedDays - compulsoryNursingApproved, 0)

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

export function computeWorkLoss(
  person: PersonalIncome,
  courtName: string,
): WorkLossResult {
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
    notes.push(`${region.courtName} 對工作損失證據要求較嚴，建議齊備：薪轉、扣薪、報稅所得、醫囑休養期間`)
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

// --- 勞動能力減損（MVP 提示用） -------------------------------------

export function computeLaborCapacityLoss(
  medical: MedicalRecord,
): { estimate: number; hint: string | null } {
  const signals = [
    medical.hasDisabilityCertificate,
    medical.hasPermanentImpairment,
    medical.hasRangeOfMotionLimitation,
    medical.hasNerveDamage,
  ].filter(Boolean).length

  if (signals === 0) {
    return { estimate: 0, hint: null }
  }

  return {
    estimate: 0,  // MVP 不計算金額
    hint: '可能涉及勞動能力減損，建議補醫療鑑定或失能比例資料，未來版本將以霍夫曼/萊布尼茲係數計算',
  }
}
