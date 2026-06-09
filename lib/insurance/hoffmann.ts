// =====================================================================
// 霍夫曼係數表（Hoffmann's Compensation Table）
// 來源：司法院 GDGT03 試算頁公告之週年利率 5% 一次給付係數
//   霍夫曼係數 = (1 - (1 + r)^-n) / r、r = 0.05
//   用途：計算未來定期給付之一次性清償金額（勞動能力減損、撫養費、
//         長期工作損失、除疤後續療程費等）
//
// 法源：
//   - 民法 §193 條（不法侵害他人之身體或健康者…被害人雖非財產上之損害，
//     亦得請求賠償相當之金額）
//   - 民法 §194 條（不法侵害他人致死者，…其生前依法負扶養義務之人，
//     得請求賠償）
//   - 司法院 73.05.25 (73)廳民一字第 365 號函釋（勞動能力減損計算）
//
// 注意：
//   1. 霍夫曼係數僅為一次性清償之計算工具，實際給付仍以法院判決為準
//   2. r=5% 為目前司法院 GDGT 試算頁採用之利率
//   3. n 不可為 0；1 年以內請用 `hoffmannFraction`（按月比例）
// =====================================================================

/** 司法院 GDGT03 採用的週年利率（5%） */
export const HOFFMANN_ANNUAL_RATE = 0.05

/**
 * 霍夫曼係數預算表（n = 1..40 年，r = 0.05）
 * 公式：係數 = (1 - (1 + r)^-n) / r
 * 此表為固定值，可離線使用；如需擴充年數請用 `hoffmannCoefficient(n)`
 */
export const HOFFMANN_COEFFICIENTS: Readonly<Record<number, number>> = Object.freeze(
  Object.fromEntries(
    Array.from({ length: 40 }, (_, i) => {
      const n = i + 1
      const r = HOFFMANN_ANNUAL_RATE
      return [n, (1 - Math.pow(1 + r, -n)) / r]
    }),
  ),
)

/**
 * 依年數取霍夫曼係數（n 為正整數）
 *
 * @example
 *   hoffmannCoefficient(10) // → 7.7217（10 年的霍夫曼係數）
 *   hoffmannCoefficient(30) // → 15.3725（30 年）
 */
export function hoffmannCoefficient(n: number): number {
  if (n <= 0) {
    throw new Error(`hoffmannCoefficient: n 必須為正整數，收到 ${n}`)
  }
  if (n > 40) {
    // 40 年以上罕見（通常為死亡撫養到 70 歲為止），但仍計算
    const r = HOFFMANN_ANNUAL_RATE
    return (1 - Math.pow(1 + r, -n)) / r
  }
  return HOFFMANN_COEFFICIENTS[n]
}

/**
 * 不足 1 年的霍夫曼比例（按月比例）
 * 用法：6 個月 = hoffmannFraction(6/12)
 *
 * 注意：霍夫曼係數在 n < 1 時使用「按月比例」近似（司法院實務常見作法）
 */
export function hoffmannFraction(years: number): number {
  if (years < 0) {
    throw new Error(`hoffmannFraction: years 必須 >= 0，收到 ${years}`)
  }
  if (years === 0) return 0
  if (years >= 1) return hoffmannCoefficient(Math.floor(years)) +
    (years - Math.floor(years)) * (1 / HOFFMANN_ANNUAL_RATE)
  // years < 1：以月為單位近似
  // 6 個月 → 0.5 年 → 0.5 / 0.05 = 10（含首年 1 + 0.5/0.05 = 11？）
  // 保守版：直接用 (1 - (1+r)^-years) / r
  const r = HOFFMANN_ANNUAL_RATE
  return (1 - Math.pow(1 + r, -years)) / r
}

// --- 勞動能力減損百分比表（強制險失能等級 1-15 等 → 減損比例） -------
// 來源：強制汽車責任保險給付標準 §4 附表「失能等級」
// 等級 1 = 最重 (100%)，等級 15 = 最輕 (5%)
// 注意：此為「完全勞動能力減損」比例，實務上會再依職業、性質調整

export const DISABILITY_LABOR_LOSS_PCT: Readonly<Record<number, number>> = Object.freeze({
  1: 100, 2: 95, 3: 90, 4: 85, 5: 80,
  6: 75, 7: 70, 8: 65, 9: 60, 10: 55,
  11: 45, 12: 35, 13: 25, 14: 15, 15: 5,
})

/** 失能等級對應的勞動能力減損百分比（0-1 之間） */
export function laborLossPct(level: number): number {
  const pct = DISABILITY_LABOR_LOSS_PCT[level]
  if (pct === undefined) {
    throw new Error(`laborLossPct: 不支援的失能等級 ${level}（僅 1-15）`)
  }
  return pct / 100
}

// --- 霍夫曼計算結果型別 -----------------------------------------------

export interface HoffmannCalculationInput {
  annualAmount: number      // 每年金額（元）
  years: number             // 年數（正整數）
  lossPercent: number       // 勞動能力減損比例（0-1）
  annualIncome: number      // 受傷前年收入（元）
  regionalMultiplier: number // 地區係數（精神慰撫金係數，沿用以反映物價）
}

export interface HoffmannCalculationResult {
  /** 霍夫曼係數 */
  coefficient: number
  /** 未扣減損比例的基礎霍夫曼總額（annualAmount × 係數） */
  baseTotal: number
  /** 扣減損比例後的霍夫曼總額 */
  adjustedTotal: number
  /** 套用地區係數後的最終金額 */
  finalTotal: number
  /** 計算明細 */
  breakdown: {
    annualAmount: number
    years: number
    lossPercent: number
    annualIncome: number
    regionalMultiplier: number
  }
}

/**
 * 計算霍夫曼一次性清償金額
 *
 * 公式：最終金額 = 年金額 × 霍夫曼係數 × 減損比例 × 地區係數
 *
 * @example 勞動能力減損範例：
 *   hoffmannCalculation({
 *     annualAmount: 480_000,  // 年收入 48 萬
 *     years: 30,             // 30 年工作年資
 *     lossPercent: 0.5,      // 50% 減損
 *     annualIncome: 480_000,
 *     regionalMultiplier: 1.0,
 *   })
 *   // → 480000 × 15.37 × 0.5 × 1.0 ≈ 3,689,280
 */
export function hoffmannCalculation(
  input: HoffmannCalculationInput,
): HoffmannCalculationResult {
  const coefficient = hoffmannCoefficient(input.years)
  const baseTotal = Math.round(input.annualAmount * coefficient)
  const adjustedTotal = Math.round(baseTotal * input.lossPercent)
  const finalTotal = Math.round(adjustedTotal * input.regionalMultiplier)

  return {
    coefficient: Math.round(coefficient * 10_000) / 10_000,
    baseTotal,
    adjustedTotal,
    finalTotal,
    breakdown: {
      annualAmount: input.annualAmount,
      years: input.years,
      lossPercent: input.lossPercent,
      annualIncome: input.annualIncome,
      regionalMultiplier: input.regionalMultiplier,
    },
  }
}

// --- 計算器：霍夫曼年數推算 ---------------------------------------------

/**
 * 從「開始工作年齡 + 退休年齡」推算霍夫曼年數
 * 預設退休年齡 = 65 歲
 */
export function hoffmannYearsFromAge(
  startAge: number,
  retireAge: number = 65,
): number {
  if (startAge < 0 || retireAge < 0) {
    throw new Error('hoffmannYearsFromAge: 年齡不可為負')
  }
  return Math.max(retireAge - startAge, 0)
}

// --- 驗證工具 ---------------------------------------------------------

/** 驗證所有預算表值是否符合霍夫曼公式（給測試用） */
export function validateHoffmannTable(): {
  ok: boolean
  mismatches: { n: number; expected: number; actual: number }[]
} {
  const r = HOFFMANN_ANNUAL_RATE
  const mismatches: { n: number; expected: number; actual: number }[] = []
  for (let n = 1; n <= 40; n++) {
    const expected = (1 - Math.pow(1 + r, -n)) / r
    const actual = HOFFMANN_COEFFICIENTS[n]
    if (Math.abs(expected - actual) > 1e-6) {
      mismatches.push({ n, expected, actual })
    }
  }
  return { ok: mismatches.length === 0, mismatches }
}
