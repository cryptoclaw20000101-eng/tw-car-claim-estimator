// =====================================================================
// 工作損失擴充情境（短期 ≤ 6 月 / 長期 > 6 月）
//
// 本模組是「情境參考」，不是核心第三人責任總額的唯一來源：
// - 核心責任總額目前仍採 computeWorkLoss（收入 × 實際請假/醫囑日數）。
// - 本模組用來提示短期/長期不同計算路徑與霍夫曼情境。
// - 實際收入損失不套用精神慰撫金的地區倍率；地區資料只用於證據嚴格度提示。
// - 症狀固定不等於長期不能工作；永久勞動能力減損由獨立模組處理。
// =====================================================================

import type { PersonalIncome } from './types'
import { getRegionAdjustment } from './region-adjustments'
import { hoffmannCoefficient, hoffmannFraction } from './hoffmann'

/** 短期 / 長期切換門檻（月） */
export const WORK_LOSS_SHORT_TERM_MONTHS = 6

/** 模型預設工作年齡終點；到達此年齡需人工確認實際就業狀態，不代表法律上當然無工作損失。 */
export const RETIRE_AGE = 65

export interface WorkLossExtendedInput {
  person: Pick<
    PersonalIncome,
    | 'age'
    | 'sixMonthAverageSalary'
    | 'monthlySalary'
    | 'dailyWage'
    | 'lastYearTaxableIncome'
    | 'actualLeaveDays'
    | 'doctorOrderedRestDays'
  >
  courtName: string
  /** 僅作風險提示；症狀固定本身不會強制切換長期工作損失。 */
  isSymptomFixed?: boolean
}

export interface WorkLossExtendedResult {
  /** 情境估算金額 */
  amount: number
  calculationType: 'short_term' | 'long_term' | 'none'
  restMonths: number
  restYears: number
  hoffmannYears: number
  hoffmannFactor: number
  annualIncome: number
  /** 保留相容欄位；工作損失不再使用精神慰撫金地區倍率，因此固定為 1。 */
  regionalMultiplier: number
  breakdown: {
    dailyIncome: number
    reasonableRestDays: number
    coefficient: number
  }
  evidenceStrength: 'low' | 'medium' | 'high'
  notes: string[]
  hint: string | null
}

export function computeWorkLossExtended(input: WorkLossExtendedInput): WorkLossExtendedResult {
  const { person, courtName, isSymptomFixed = false } = input
  const region = getRegionAdjustment(courtName)
  const notes: string[] = []
  const regionalMultiplier = 1

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
      regionalMultiplier,
      breakdown: { dailyIncome: 0, reasonableRestDays: 0, coefficient: 0 },
      evidenceStrength: 'low',
      notes: ['未輸入請假或醫囑休養日數，無法估算工作損失'],
      hint: null,
    }
  }

  const restMonths = Math.round((reasonableRestDays / 30) * 10) / 10
  const restYears = restMonths / 12

  const dailyIncome =
    person.dailyWage > 0
      ? person.dailyWage
      : person.sixMonthAverageSalary > 0
        ? person.sixMonthAverageSalary / 30
        : person.monthlySalary / 30

  const annualIncome =
    person.sixMonthAverageSalary > 0 ? person.sixMonthAverageSalary * 12 : person.monthlySalary * 12

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

  if (isSymptomFixed) {
    notes.push('已標示症狀固定；不因此自動延長工作損失期間，永久減損請另看勞動能力減損模組。')
  }

  const isLongTerm = restMonths > WORK_LOSS_SHORT_TERM_MONTHS

  if (isLongTerm) {
    const remainingWorkYears = Math.max(RETIRE_AGE - person.age, 0)
    const hoffmannYears = Math.min(remainingWorkYears, Math.max(restYears, 1))

    if (hoffmannYears === 0) {
      notes.push(
        `受害人已達本模型預設工作年齡終點 ${RETIRE_AGE} 歲；無法用固定退休年齡模型估算，應人工確認實際工作狀態、收入與可工作期間。`,
      )
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
        hint: '已達模型預設工作年齡終點，請人工確認實際就業、收入與工作年限後再估算。',
      }
    }

    const coefficient =
      restYears < 1 ? hoffmannFraction(restYears) : hoffmannCoefficient(Math.min(hoffmannYears, 40))
    const amount = Math.round(annualIncome * coefficient)

    notes.push(`休養 ${restMonths} 月（${restYears.toFixed(1)} 年）→ 長期工作損失情境`)
    notes.push(`年收入 = ${annualIncome.toLocaleString()} 元`)
    notes.push(`霍夫曼年數 = ${hoffmannYears} 年、係數 = ${coefficient.toFixed(4)}`)
    notes.push(`情境估算 = ${amount.toLocaleString()} 元（不套精神慰撫金地區倍率）`)

    if (region.workLossEvidenceStrictness === 'high') {
      notes.push(
        `${region.courtName} 的工作損失證據設定為高嚴格度，建議齊備：薪轉、扣薪、報稅所得、請假紀錄與醫囑休養期間。`,
      )
    } else if (region.workLossEvidenceStrictness === 'medium') {
      notes.push('建議齊備薪資、請假、扣薪與醫囑休養證明。')
    }

    return {
      amount,
      calculationType: 'long_term',
      restMonths,
      restYears: Math.round(restYears * 100) / 100,
      hoffmannYears,
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
      hint: `休養超過 ${WORK_LOSS_SHORT_TERM_MONTHS} 個月，列為長期情境參考；核心責任金額仍應依證據確認。`,
    }
  }

  const coefficient = hoffmannFraction(restYears)
  const amount = Math.round(dailyIncome * reasonableRestDays)

  notes.push(`休養 ${restMonths} 月（${reasonableRestDays} 日）→ 採日薪制情境`)
  notes.push(`每日收入 = ${Math.round(dailyIncome).toLocaleString()} 元`)
  notes.push(`情境估算 = ${amount.toLocaleString()} 元（不套精神慰撫金地區倍率）`)

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
    hoffmannYears: 0,
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
    hint:
      restMonths > 3
        ? `接近長期門檻（${WORK_LOSS_SHORT_TERM_MONTHS} 月）；是否可延長請求期間仍應以醫囑與實際工作影響證據判斷。`
        : null,
  }
}
