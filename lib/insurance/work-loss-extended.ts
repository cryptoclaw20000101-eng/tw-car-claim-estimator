// =====================================================================
// 工作損失擴充版（短期 ≤ 6 月 / 長期 > 6 月）
// 既有 computeWorkLoss 只算「短期（日薪 × 休養日數）」，本檔補：
//   - 短期：≤ 6 月 → 沿用日薪 × 合理休養日數，額外補上霍夫曼加成
//           （司法院實務：休養期 > 1 年者以霍夫曼係數計算一次性清償）
//   - 長期：> 6 月 → 撫養費式霍夫曼：年損失 × 霍夫曼係數 × 地區係數
//
// 法源：
//   - 民法 §193 I（身體健康侵害之財產損害賠償）
//   - 司法院 73.05.25 (73)廳民一字第 365 號函釋
//   - 強制汽車責任保險給付標準 §3（不能工作之喪失或減少）
// =====================================================================

import type { PersonalIncome } from './types'
import { getRegionAdjustment } from './region-adjustments'
import { hoffmannCoefficient, hoffmannFraction } from './hoffmann'

/** 短期 / 長期切換門檻（月） */
export const WORK_LOSS_SHORT_TERM_MONTHS = 6

/** 退休年齡（霍夫曼年數上限參考） */
export const RETIRE_AGE = 65

export interface WorkLossExtendedInput {
  person: Pick<PersonalIncome,
    | 'age'
    | 'sixMonthAverageSalary'
    | 'monthlySalary'
    | 'dailyWage'
    | 'lastYearTaxableIncome'
    | 'actualLeaveDays'
    | 'doctorOrderedRestDays'
  >
  courtName: string
  /** 是否已達症狀固定（固定 → 採撫養費式霍夫曼，不再以日薪計） */
  isSymptomFixed?: boolean
}

export interface WorkLossExtendedResult {
  /** 最終建議工作損失金額 */
  amount: number
  /** 計算類型：'short_term' | 'long_term' | 'none' */
  calculationType: 'short_term' | 'long_term' | 'none'
  /** 短期/長期切換（單位：月） */
  restMonths: number
  /** 休養年數（用於霍夫曼） */
  restYears: number
  /** 霍夫曼年數（長期計算用：min(退休年數, 休養年數)） */
  hoffmannYears: number
  /** 霍夫曼係數（短期用日數比例、長期用年數） */
  hoffmannFactor: number
  /** 年收入 */
  annualIncome: number
  /** 地區係數 */
  regionalMultiplier: number
  /** 計算明細 */
  breakdown: {
    dailyIncome: number
    reasonableRestDays: number
    coefficient: number
  }
  /** 證據強度 */
  evidenceStrength: 'low' | 'medium' | 'high'
  /** 補件建議 */
  notes: string[]
  /** 升級提示 */
  hint: string | null
}

export function computeWorkLossExtended(
  input: WorkLossExtendedInput,
): WorkLossExtendedResult {
  const { person, courtName, isSymptomFixed = false } = input
  const region = getRegionAdjustment(courtName)
  const notes: string[] = []

  // 必要輸入檢查
  const reasonableRestDays = Math.min(
    person.actualLeaveDays || 0,
    person.doctorOrderedRestDays || 0,
  )

  if (reasonableRestDays === 0) {
    return {
      amount: 0,
      calculationType: 'none',
      restMonths: 0,
      restYears: 0,
      hoffmannYears: 0,
      hoffmannFactor: 0,
      annualIncome: 0,
      regionalMultiplier: region.painAndSufferingMultiplier,
      breakdown: { dailyIncome: 0, reasonableRestDays: 0, coefficient: 0 },
      evidenceStrength: 'low',
      notes: ['未輸入請假或醫囑休養日數，無法估算工作損失'],
      hint: null,
    }
  }

  // 休養月數
  const restMonths = Math.round(reasonableRestDays / 30 * 10) / 10  // 取小數 1 位
  const restYears = restMonths / 12

  // 每日收入：日領者用日薪、受僱者用 6 月均薪 / 30
  const dailyIncome =
    person.dailyWage > 0
      ? person.dailyWage
      : person.sixMonthAverageSalary > 0
        ? person.sixMonthAverageSalary / 30
        : person.monthlySalary / 30

  // 年收入（撫養費式計算用）
  const annualIncome =
    person.sixMonthAverageSalary > 0
      ? person.sixMonthAverageSalary * 12
      : person.monthlySalary * 12

  const regionalMultiplier = region.painAndSufferingMultiplier

  // 證據強度評估
  const evidenceFlags = [
    person.lastYearTaxableIncome > 0,
    person.sixMonthAverageSalary > 0,
    dailyIncome > 0,
    person.actualLeaveDays > 0,
    person.doctorOrderedRestDays > 0,
  ]
  const evidenceCount = evidenceFlags.filter(Boolean).length
  let evidenceStrength: 'low' | 'medium' | 'high'
  if (evidenceCount >= 4) evidenceStrength = 'high'
  else if (evidenceCount >= 2) evidenceStrength = 'medium'
  else evidenceStrength = 'low'

  // 短期 / 長期判定
  const isLongTerm = restMonths > WORK_LOSS_SHORT_TERM_MONTHS || isSymptomFixed

  if (isLongTerm) {
    // === 長期：撫養費式霍夫曼 ===
    // 公式：未來 N 年不能工作 → 一次給付霍夫曼 N 年
    // N = min(到退休年數, 休養年數上限)
    // - 休養 < 1 年：採霍夫曼比例係數（撫養費式近似）
    // - 休養 >= 1 年：採整年霍夫曼
    const remainingWorkYears = Math.max(RETIRE_AGE - person.age, 0)
    const hoffmannYears = Math.min(remainingWorkYears, Math.max(restYears, 1))

    if (hoffmannYears === 0) {
      // 已退休 → 走慰撫金路線
      notes.push(`⚠️ 受害人年齡已達/超過 ${RETIRE_AGE} 歲，工作損失以「慰撫金」取代`)
      return {
        amount: 0,
        calculationType: 'long_term',
        restMonths,
        restYears: Math.round(restYears * 100) / 100,
        hoffmannYears: 0,
        hoffmannFactor: 0,
        annualIncome,
        regionalMultiplier,
        breakdown: {
          dailyIncome: Math.round(dailyIncome),
          reasonableRestDays,
          coefficient: 0,
        },
        evidenceStrength,
        notes,
        hint: `受害人已達退休年齡（${RETIRE_AGE} 歲），建議改以「精神慰撫金」請求`,
      }
    }

    // 休養 < 1 年：用霍夫曼比例係數（與短期同公式）
    // 休養 >= 1 年：用整年霍夫曼係數
    const coefficient = restYears < 1
      ? hoffmannFraction(restYears)
      : hoffmannCoefficient(Math.min(hoffmannYears, 40))
    const baseTotal = Math.round(annualIncome * coefficient)
    const amount = Math.round(baseTotal * regionalMultiplier)

    notes.push(`休養 ${restMonths} 月（${restYears.toFixed(1)} 年）→ 採撫養費式霍夫曼`)
    notes.push(`年損失 = ${annualIncome.toLocaleString()} 元`)
    notes.push(`霍夫曼年數 = ${hoffmannYears} 年、係數 = ${coefficient.toFixed(4)}`)
    notes.push(`基礎總額 = ${baseTotal.toLocaleString()} 元`)
    notes.push(`地區係數 ${regionalMultiplier} → 最終 ${amount.toLocaleString()} 元`)

    if (region.workLossEvidenceStrictness === 'high') {
      notes.push(`${region.courtName} 對長期工作損失證據要求嚴格，建議齊備：薪轉、扣薪、報稅所得、醫囑休養期間`)
    }

    return {
      amount,
      calculationType: 'long_term',
      restMonths,
      restYears: Math.round(restYears * 100) / 100,
      hoffmannYears: Math.min(Math.max(RETIRE_AGE - person.age, 0), Math.max(restYears, 1)),
      hoffmannFactor: Math.round(coefficient * 10_000) / 10_000,
      annualIncome,
      regionalMultiplier,
      breakdown: {
        dailyIncome: Math.round(dailyIncome),
        reasonableRestDays,
        coefficient: Math.round(coefficient * 10_000) / 10_000,
      },
      evidenceStrength,
      notes,
      hint: isSymptomFixed
        ? '已症狀固定，採撫養費式霍夫曼一次性清償'
        : `休養超過 ${WORK_LOSS_SHORT_TERM_MONTHS} 個月，採撫養費式霍夫曼`,
    }
  }

  // === 短期：日薪 × 合理休養日數 + 霍夫曼加成 ===
  // 霍夫曼加成（> 30 日的休養期間，按月比例攤）
  const coefficient = hoffmannFraction(restYears)
  const baseAmount = Math.round(dailyIncome * reasonableRestDays)
  const amount = Math.round(baseAmount * regionalMultiplier)

  notes.push(`休養 ${restMonths} 月（${reasonableRestDays} 日）→ 採日薪制`)
  notes.push(`每日收入 = ${Math.round(dailyIncome).toLocaleString()} 元`)
  notes.push(`基礎金額 = ${baseAmount.toLocaleString()} 元`)
  notes.push(`地區係數 ${regionalMultiplier} → 最終 ${amount.toLocaleString()} 元`)

  if (evidenceStrength === 'low') {
    notes.push('⚠️ 缺乏薪轉、扣薪、報稅、請假等佐證，證據強度不足')
  } else if (evidenceStrength === 'medium') {
    notes.push('建議補：薪轉證明、扣薪證明、醫囑休養期間')
  }

  return {
    amount,
    calculationType: 'short_term',
    restMonths,
    restYears: Math.round(restYears * 100) / 100,
    hoffmannYears: 0,  // 短期不適用
    hoffmannFactor: Math.round(coefficient * 10_000) / 10_000,
    annualIncome,
    regionalMultiplier,
    breakdown: {
      dailyIncome: Math.round(dailyIncome),
      reasonableRestDays,
      coefficient: Math.round(coefficient * 10_000) / 10_000,
    },
    evidenceStrength,
    notes,
    hint: restMonths > 3
      ? `接近長期門檻（${WORK_LOSS_SHORT_TERM_MONTHS} 月），若症狀固定可改採撫養費式`
      : null,
  }
}
