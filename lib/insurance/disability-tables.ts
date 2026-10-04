// =====================================================================
// 失能等級金額表
// 規範來源：強制汽車責任保險給付標準 §4 + 附表「失能等級」
//
// 新制：事故日期 2026-07-01 起適用（金額已修法提高）
// 舊制：事故日期 2026-07-01 前適用（spec §七 預留金額）
//
// 規則：第 1 級最重（300 萬），第 15 級最輕（8 萬）
// =====================================================================

import type { DisabilityLevel } from './types'
import { isNewLaw } from '../data-sources/regulation-cutoff'

// 新制金額表（事故日期 2026-07-01 起）
export const disabilityBenefitTableNew: Record<DisabilityLevel, number> = {
  1: 3_000_000,
  2: 2_500_000,
  3: 2_100_000,
  4: 1_850_000,
  5: 1_600_000,
  6: 1_350_000,
  7: 1_100_000,
  8: 900_000,
  9: 700_000,
  10: 550_000,
  11: 400_000,
  12: 250_000,
  13: 150_000,
  14: 100_000,
  15: 80_000,
}

// 舊制金額表（事故日期 2026-07-01 前）
// v0.28.6+：改用實際法規金額（之前是 70-80% 估算值，與實際差 1-7 萬）
// 來源：強制汽車責任保險給付標準（101 年 3 月 1 日修正版），2026 修法前適用
// 參考：https://www.6laws.net/6law/law3/強制汽車責任保險給付標準.htm
export const disabilityBenefitTableOld: Record<DisabilityLevel, number> = {
  1: 2_000_000,
  2: 1_670_000,
  3: 1_400_000,
  4: 1_230_000,
  5: 1_070_000,
  6: 900_000,
  7: 730_000,
  8: 600_000,
  9: 470_000,
  10: 370_000,
  11: 270_000,
  12: 170_000,
  13: 100_000,
  14: 70_000,
  15: 50_000,
}

// 新舊制分界日
export const NEW_SYSTEM_CUTOFF = '2026-07-01'

/**
 * 依事故日期回傳對應制度的失能等級金額表
 */
export function pickDisabilityTable(accidentDate: string): Record<DisabilityLevel, number> {
  if (!accidentDate) return disabilityBenefitTableNew
  return isNewLaw(accidentDate) ? disabilityBenefitTableNew : disabilityBenefitTableOld
}

/**
 * 依等級查金額（找不到回 0）
 */
export function lookupDisabilityAmount(
  level: DisabilityLevel,
  table: Record<DisabilityLevel, number>,
): number {
  return table[level] ?? 0
}

/** 強制險給付標準第 4 條：同時符合二項以上時的升等與合計額上限。 */
export function combineDisabilityBenefits(
  levels: DisabilityLevel[],
  table: Record<DisabilityLevel, number>,
): { level: DisabilityLevel; amount: number; appliedUpgrade: number } {
  const highest = Math.min(...levels) as DisabilityLevel
  if (levels.length < 2) {
    return { level: highest, amount: lookupDisabilityAmount(highest, table), appliedUpgrade: 0 }
  }

  // 第 4 條第 3 至 5 款：依最高失能等級決定升 1、2 或 3 等。
  const appliedUpgrade = highest <= 5 ? 3 : highest <= 8 ? 2 : 1
  const level = Math.max(1, highest - appliedUpgrade) as DisabilityLevel
  const upgradedAmount = lookupDisabilityAmount(level, table)
  const separateTotal = levels.reduce((sum, item) => sum + lookupDisabilityAmount(item, table), 0)

  return {
    level,
    // 第 4 條第 6 款：升等後的金額若超過各項分別計算合計額，按合計額給與。
    // 因此同一事故的合併給付取兩者較低者，不能把各項金額再無條件相加。
    amount: Math.min(upgradedAmount, separateTotal),
    appliedUpgrade,
  }
}
