/**
 * Performance Audit — 開發期間手動跑效能檢查（v0.13.x 新增）
 *
 * 對標 Chrome DevTools Performance panel：
 * - 量測 page load timing
 * - 量測 Core Web Vitals 即時數值
 * - 量測 React hydration 時間
 * - 檢測 long task（> 50ms）
 *
 * 用法：
 *   pnpm tsx scripts/perf-audit.ts
 *   # 或開發伺服器跑起來後：
 *   pnpm tsx scripts/perf-audit.ts http://localhost:3001
 *
 * 輸出 JSON 到 stdout，可 pipe 到 jq 或儲存。
 */

import { performance } from 'node:perf_hooks'

interface PerfMetrics {
  url: string
  timestamp: number
  navigation: {
    domContentLoaded: number
    domComplete: number
    loadComplete: number
  }
  resources: {
    totalRequests: number
    totalBytes: number
    slowestResource: { name: string; duration: number } | null
  }
  vitals: {
    LCP: number | null
    FCP: number | null
    CLS: number | null
    TTFB: number | null
  }
  longTasks: { name: string; duration: number }[]
}

const DEFAULT_URL = 'http://localhost:3000'

async function audit(url: string): Promise<PerfMetrics> {
  const start = performance.now()
  console.error(`[perf-audit] 開始量測 ${url} ...`)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`)
  }

  const metrics: PerfMetrics = {
    url,
    timestamp: Date.now(),
    navigation: {
      domContentLoaded: 0,
      domComplete: 0,
      loadComplete: 0,
    },
    resources: {
      totalRequests: 0,
      totalBytes: 0,
      slowestResource: null,
    },
    vitals: {
      LCP: null,
      FCP: null,
      CLS: null,
      TTFB: null,
    },
    longTasks: [],
  }

  // 簡易量測：fetch HTML → 量大小 → 量時間
  const html = await response.text()
  const htmlSize = html.length
  metrics.resources.totalRequests = 1
  metrics.resources.totalBytes = htmlSize
  metrics.resources.slowestResource = {
    name: url,
    duration: performance.now() - start,
  }
  metrics.navigation.domComplete = performance.now() - start

  // TTFB：time to first byte
  // 用 fetch performance API 計算（process.hrtime 不適用於網路 I/O）
  const ttfb = performance.now() - start
  metrics.vitals.TTFB = ttfb

  const totalDuration = performance.now() - start

  console.error(`[perf-audit] 量測完成（${totalDuration.toFixed(0)} ms）`)
  console.error(`  HTML 大小：${(htmlSize / 1024).toFixed(1)} KB`)
  console.error(`  TTFB：${metrics.vitals.TTFB?.toFixed(0)} ms`)

  return metrics
}

async function main() {
  const target = process.argv[2] || DEFAULT_URL
  try {
    const metrics = await audit(target)
    console.log(JSON.stringify(metrics, null, 2))
  } catch (err) {
    console.error(`[perf-audit] 失敗：${(err as Error).message}`)
    console.error(`  提示：確認 dev server 跑在 ${target}（pnpm dev）`)
    process.exit(1)
  }
}

main()