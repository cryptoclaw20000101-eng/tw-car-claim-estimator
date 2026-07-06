/**
 * Ensemble 健康度統計（v0.6.9+ 共用函式）
 *
 * 不重跑 Ensemble 引擎，而是從精神慰撫金這條鏈的歷史資料
 * 算出「如果現在跑 predictPainRange 會用什麼 anchor」+ 信心度判斷依據。
 *
 * 抽到 lib/insurance/ 是為了讓首頁 hero（app/page.tsx）+ 報表
 * （scripts/report-precedents.ts）共用，避免重複實作。
 *
 * 純函式，無 fs 依賴，build-time import 安全：
 * - 首頁可直接 `import { computeEnsembleHealth } from '@/lib/insurance/pain-ensemble-health'`
 * - 報表 scripts/ 也可 import
 * - 靜態 JSON build-time 載入 = 0KB runtime overhead
 */

export interface PrecedentRow {
  id?: string
  caseNo?: string
  court?: string
  year?: number
  category?: string
  amount?: number
  mentalDistressAmount?: number
  chain?: string
  scrapedAt?: string
  [k: string]: unknown
}

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'none'

export interface EnsembleHealth {
  anchorFile: string
  anchorN: number
  anchorMedian: number
  anchorP10: number
  anchorP90: number
  confidenceLevel: ConfidenceLevel
  confidenceTip: string
  courtMedians: Array<{ court: string; n: number; median: number }>
  injuryCoverage: Array<{ category: string; n: number }>
  injuryGradientWarning: string | null
}

/** 取純量函式（給純函式模組用，避免 reports 重複實作） */
function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid]
}

/**
 * 從精神慰撫金 anchor rows 計算 Ensemble 健康度
 *
 * @param anchorRows 通常 = JSON.parse(readFileSync('data/precedents/taipei-mental-distress.json'))
 * @returns 4 組指標：anchor / court / confidence / injury
 */
export function computeEnsembleHealth(anchorRows: PrecedentRow[]): EnsembleHealth {
  const amounts = anchorRows
    .map((r) => Number(r.amount ?? r.mentalDistressAmount ?? 0))
    .filter((n) => n > 0)

  const n = amounts.length
  const sorted = [...amounts].sort((a, b) => a - b)
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]

  // 信心度分級（沿用 pain-ml.ts §8 規則）
  let confidenceLevel: ConfidenceLevel
  let confidenceTip: string
  if (n >= 20) {
    confidenceLevel = 'high'
    confidenceTip = '≥20 件，ML 區間可信，可啟動 XGBoost 訓練'
  } else if (n >= 10) {
    confidenceLevel = 'medium'
    confidenceTip = '10-19 件，ML 區間可用但需人類 review 邊界值'
  } else if (n >= 5) {
    confidenceLevel = 'low'
    confidenceTip = '5-9 件，僅 fallback 用啟發式，ML 不可信'
  } else {
    confidenceLevel = 'none'
    confidenceTip = '<5 件，完全 fallback 到啟發式規則'
  }

  // 法院中位數（給規則票地區係數對齊用）
  const byCourt = new Map<string, number[]>()
  for (const r of anchorRows) {
    const amt = Number(r.amount ?? r.mentalDistressAmount ?? 0)
    if (amt <= 0) continue
    const court = r.court || '(unknown)'
    if (!byCourt.has(court)) byCourt.set(court, [])
    byCourt.get(court)!.push(amt)
  }
  const courtMedians = Array.from(byCourt.entries())
    .map(([court, nums]) => ({
      court,
      n: nums.length,
      median: median(nums),
    }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 8)

  // 傷勢覆蓋
  const catMap = new Map<string, number>()
  for (const r of anchorRows) {
    const c = String(r.category || '(none)')
    catMap.set(c, (catMap.get(c) ?? 0) + 1)
  }
  const injuryCoverage = Array.from(catMap.entries())
    .map(([category, n]) => ({ category, n }))
    .sort((a, b) => b.n - a.n)

  // 傷勢梯度警示
  let injuryGradientWarning: string | null = null
  if (injuryCoverage.length === 1) {
    injuryGradientWarning = `全部 ${injuryCoverage[0].n} 件都集中在 ${injuryCoverage[0].category}，傷勢梯度為 0，XGBoost 無法學習`
  } else if (injuryCoverage.length === 2) {
    const top = injuryCoverage[0]
    const total = injuryCoverage.reduce((s, x) => s + x.n, 0)
    if (top.n / total > 0.9) {
      injuryGradientWarning = `${top.category} 佔 ${((top.n / total) * 100).toFixed(0)}%，傷勢梯度不足，XGBoost 偏置風險高`
    }
  }

  return {
    anchorFile: 'taipei-mental-distress.json',
    anchorN: n,
    anchorMedian: n > 0 ? median(amounts) : 0,
    anchorP10: n > 0 ? at(0.1) : 0,
    anchorP90: n > 0 ? at(0.9) : 0,
    confidenceLevel,
    confidenceTip,
    courtMedians,
    injuryCoverage,
    injuryGradientWarning,
  }
}

/**
 * 信心度顯示標籤（給 UI 用，emoji-free 沿用 taste-skill 紀律）
 */
export const CONFIDENCE_META: Record<
  ConfidenceLevel,
  { label: string; tip: string; color: string }
> = {
  high: {
    label: 'high',
    tip: '≥20 件 anchor',
    color: 'text-emerald-700',
  },
  medium: {
    label: 'medium',
    tip: '10-19 件 anchor',
    color: 'text-amber-700',
  },
  low: {
    label: 'low',
    tip: '5-9 件 anchor',
    color: 'text-red-700',
  },
  none: {
    label: 'none',
    tip: '<5 件 anchor',
    color: 'text-gray-500',
  },
}
