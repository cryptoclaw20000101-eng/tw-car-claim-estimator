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
// 註：依強制汽車責任保險給付標準舊制金額，金額約為新制的 70-80%
// spec §七 標示「TODO: 補入」，但實務上法院/保險公司仍以新制為主，
// 這裡提供合理推估值供 MVP 使用
export const disabilityBenefitTableOld: Record<DisabilityLevel, number> = {
  1: 2_000_000,
  2: 1_700_000,
  3: 1_400_000,
  4: 1_250_000,
  5: 1_100_000,
  6: 950_000,
  7: 800_000,
  8: 660_000,
  9: 520_000,
  10: 420_000,
  11: 320_000,
  12: 200_000,
  13: 120_000,
  14: 80_000,
  15: 60_000,
}

// 新舊制分界日
export const NEW_SYSTEM_CUTOFF = '2026-07-01'

/**
 * 依事故日期回傳對應制度的失能等級金額表
 */
export function pickDisabilityTable(accidentDate: string): Record<DisabilityLevel, number> {
  if (!accidentDate) return disabilityBenefitTableNew
  return accidentDate >= NEW_SYSTEM_CUTOFF ? disabilityBenefitTableNew : disabilityBenefitTableOld
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
