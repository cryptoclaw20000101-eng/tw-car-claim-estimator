// =====================================================================
// 失能案例統計 + 霍夫曼係數整合（v0.2.16 新增）
//
// 功能：
//   1. 從 disability-merging.json 8 件有金額的真實案例算出中位數/平均/區間
//   2. lookupByDisabilityLevel(level) — 給估算器用,輸入失能等級(1-15)回對應案例統計
//   3. disabilityByHoffmann(input) — 用霍夫曼算「年收入 × 減損 × 年數」對比真實案例
//   4. compareEstimateWithCases() — 給律師看「霍夫曼試算 vs 真實案件中位數」差異
//
// 來源: 14 件真實失能案例(8 件有金額 + 5 件規則 + 1 件死亡/12 大類)
//   data/precedents/disability-merging.json
//
// 注意: 失能案例的 amount 字段意義不一,有些是 totalAward、有些是勞減、有些是精神慰撫金
//       本模組只取 amount > 0 的 8 件作統計,排除 5 件「保險實務」規則 (amount=0)
// =====================================================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { hoffmannCoefficient, laborLossPct } from './hoffmann'

// --- 案例 schema（從 disability-merging.json 抽出） ---------------------------

export interface DisabilityCase {
  id: string
  caseNo: string
  court: string
  year: number
  category: string
  chain: string
  amount: number // 判決金額（元）
  totalAward: number // 總額（含慰撫金等）
  ratio: { plaintiff: number; defendant: number }
  facts?: string
  source?: string
  scrapedAt?: string
}

// --- 統計結果型別 -----------------------------------------------------------

export interface DisabilityCaseStats {
  count: number
  median: number
  mean: number
  min: number
  max: number
  stdev: number
  q1: number // 25% 分位
  q3: number // 75% 分位
  range: number // max - min
}

// --- 霍夫曼計算結果 ---------------------------------------------------------

export interface HoffmannDisabilityInput {
  annualIncome: number // 年收入（元）
  years: number // 霍夫曼年數
  disabilityLevel: number // 失能等級 (1-15)
  regionalMultiplier?: number // 地區係數（預設 1.0）
}

export interface HoffmannDisabilityResult {
  coefficient: number
  lossPercent: number // 0-1
  baseTotal: number // 年金額 × 係數
  adjustedTotal: number // × 減損比例
  finalTotal: number // × 地區係數
  annualIncome: number
  years: number
  disabilityLevel: number
  regionalMultiplier: number
}

// --- 載入並快取失能案例（module-level cache,避免重複 I/O） ------------------

let _casesCache: DisabilityCase[] | null = null

function loadCases(): DisabilityCase[] {
  if (_casesCache) return _casesCache
  // 從 cwd 找 data/precedents/disability-merging.json（給 scrape script 跟 vitest 都通用）
  const candidates = [
    join(process.cwd(), 'data', 'precedents', 'disability-merging.json'),
    join(process.cwd(), 'tw-car-claim-estimator', 'data', 'precedents', 'disability-merging.json'),
  ]
  for (const p of candidates) {
    try {
      const raw = readFileSync(p, 'utf-8')
      const arr = JSON.parse(raw) as Array<Record<string, unknown>>
      _casesCache = arr
        .filter((it) => (it.amount as number) > 0) // 排除 5 件「保險實務」規則 (amount=0)
        .map((it) => ({
          id: it.id as string,
          caseNo: it.caseNo as string,
          court: it.court as string,
          year: it.year as number,
          category: it.category as string,
          chain: it.chain as string,
          amount: it.amount as number,
          totalAward: (it.totalAward as number) ?? 0,
          ratio: (it.ratio as { plaintiff: number; defendant: number }) ?? {
            plaintiff: 0,
            defendant: 100,
          },
          facts: it.facts as string | undefined,
          source: it.source as string | undefined,
          scrapedAt: it.scrapedAt as string | undefined,
        }))
      return _casesCache
    } catch {
      // try next path
      continue
    }
  }
  // 都找不到 → 回空陣列
  _casesCache = []
  return _casesCache
}

// --- 統計計算工具 -----------------------------------------------------------

/** 四分位數（q=0.25 or 0.75）— 用線性插值（不依賴第三方庫） */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  if (base + 1 < sorted.length) {
    const a = sorted[base] ?? 0
    const b = sorted[base + 1] ?? 0
    return a + (b - a) * rest
  }
  return sorted[base] ?? 0
}

/** 計算 stdev（樣本標準差） */
function stdevSample(values: number[], mean: number): number {
  if (values.length < 2) return 0
  const sumSq = values.reduce((acc, v) => acc + (v - mean) ** 2, 0)
  return Math.sqrt(sumSq / (values.length - 1))
}

/** 從失能案例清單算出統計 */
export function computeStats(cases: DisabilityCase[]): DisabilityCaseStats {
  if (cases.length === 0) {
    return { count: 0, median: 0, mean: 0, min: 0, max: 0, stdev: 0, q1: 0, q3: 0, range: 0 }
  }
  const amounts = cases.map((c) => c.amount).sort((a, b) => a - b)
  const mean = amounts.reduce((acc, v) => acc + v, 0) / amounts.length
  return {
    count: cases.length,
    median: quantile(amounts, 0.5),
    mean: Math.round(mean),
    min: amounts[0] ?? 0,
    max: amounts[amounts.length - 1] ?? 0,
    stdev: Math.round(stdevSample(amounts, mean)),
    q1: Math.round(quantile(amounts, 0.25) ?? 0),
    q3: Math.round(quantile(amounts, 0.75) ?? 0),
    range: (amounts[amounts.length - 1] ?? 0) - (amounts[0] ?? 0),
  }
}

/** 取得 8 件有金額失能案例的整體統計（給 UI 顯示「真實案件參考」） */
export function getAllDisabilityCaseStats(): DisabilityCaseStats {
  return computeStats(loadCases())
}

/**
 * lookupByDisabilityLevel — 依失能等級 (1-15) 過濾案例
 * 注意: 現有 8 件案例的 category 只有 minor_injury / death,**沒有失能等級標籤**
 *       所以此函式目前會回全部 8 件 + 在 cases 旁標 disabilityLevel: null
 *       未來理賠顧問補失能等級資料後,即可依等級過濾
 */
export function lookupByDisabilityLevel(level: number): DisabilityCaseStats {
  if (level < 1 || level > 15) {
    throw new Error(`lookupByDisabilityLevel: 等級必須 1-15,收到 ${level}`)
  }
  // 目前所有案例都沒標失能等級 → 回全部
  // 未來理賠顧問補資料時,在 case 上加 disabilityLevel 欄位即可分組
  const cases = loadCases()
  return computeStats(cases)
}

// --- 霍夫曼係數整合 ---------------------------------------------------------

/**
 * disabilityByHoffmann — 用霍夫曼算失能勞動能力減損金額
 *
 * 公式（司法院 73.05.25 廳民一字第 365 號函釋）：
 *   最終金額 = 年收入 × 霍夫曼係數(年數) × 失能等級減損比例 × 地區係數
 *
 * @example
 *   disabilityByHoffmann({
 *     annualIncome: 480_000,  // 年薪 48 萬
 *     years: 30,             // 30 年工作年資
 *     disabilityLevel: 7,    // 7 級失能
 *     regionalMultiplier: 1.0,
 *   })
 *   // → 480000 × 15.37 × 0.70 × 1.0 ≈ 5,165,760
 */
export function disabilityByHoffmann(input: HoffmannDisabilityInput): HoffmannDisabilityResult {
  const coefficient = hoffmannCoefficient(input.years)
  const lossPercent = laborLossPct(input.disabilityLevel)
  const regionalMultiplier = input.regionalMultiplier ?? 1.0

  const baseTotal = Math.round(input.annualIncome * coefficient)
  const adjustedTotal = Math.round(baseTotal * lossPercent)
  const finalTotal = Math.round(adjustedTotal * regionalMultiplier)

  return {
    coefficient: Math.round(coefficient * 10_000) / 10_000,
    lossPercent,
    baseTotal,
    adjustedTotal,
    finalTotal,
    annualIncome: input.annualIncome,
    years: input.years,
    disabilityLevel: input.disabilityLevel,
    regionalMultiplier,
  }
}

/**
 * compareEstimateWithCases — 霍夫曼試算 vs 真實案件中位數的差異
 * 用於律師複核 — 看「估算器算的金額」跟「真實案件中位數」差多少
 *
 * @returns 估算金額、中位數、差異百分比、案件參考（中位數 ± stdev 範圍）
 */
export function compareEstimateWithCases(input: HoffmannDisabilityInput): {
  estimate: HoffmannDisabilityResult
  caseStats: DisabilityCaseStats
  diff: {
    delta: number // 估算 - 中位數
    diffPercent: number // (估算 - 中位數) / 中位數 × 100
    withinRange: boolean // 估算是否落在 [q1, q3] 內
  }
} {
  const estimate = disabilityByHoffmann(input)
  const caseStats = getAllDisabilityCaseStats()
  const delta = estimate.finalTotal - caseStats.median
  const diffPercent =
    caseStats.median > 0
      ? Math.round((delta / caseStats.median) * 10_000) / 100 // 2 位小數
      : 0
  const withinRange = estimate.finalTotal >= caseStats.q1 && estimate.finalTotal <= caseStats.q3
  return { estimate, caseStats, diff: { delta, diffPercent, withinRange } }
}
