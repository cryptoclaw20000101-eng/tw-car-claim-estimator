'use client'

/**
 * WebVitalsReporter — 上報 Core Web Vitals（v0.13.x 新增）
 *
 * 上報 LCP / CLS / INP / FCP / TTFB 五個指標到 console
 * （生產環境可改為送到 analytics endpoint，例如 Plausible / 自家 endpoint）
 *
 * SSR 安全：useEffect mount 後才跑 onReport
 * Reduced motion 不影響效能指標
 *
 * 為什麼要這個：
 * - Lighthouse CI 只在 PR 跑（合成數據）
 * - 真實使用者數據（RUM）才能知道實際效能
 * - LCP / CLS / INP 是 Google 排名因素（2024 起 INP 取代 FID）
 */

import { useEffect } from 'react'
import { onLCP, onCLS, onINP, onFCP, onTTFB, type Metric } from 'web-vitals'

type Reporter = (metric: Metric) => void

/**
 * 預設 reporter：console.log + window.dispatchEvent
 * 生產環境可改為送到 analytics endpoint
 */
const defaultReporter: Reporter = (metric) => {
  console.info(`[Web Vitals] ${metric.name}:`, {
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
  })
  // 也發 custom event 方便外部監聽
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('web-vitals', { detail: metric }))
  }
}

export function WebVitalsReporter({ reporter = defaultReporter }: { reporter?: Reporter }) {
  useEffect(() => {
    onLCP(reporter)
    onCLS(reporter)
    onINP(reporter)
    onFCP(reporter)
    onTTFB(reporter)
  }, [reporter])

  return null
}

/**
 * 把 web-vitals 數據送到自架 endpoint 的範例 reporter
 * （生產環境用 — 替換 console.info 為 fetch）
 */
export function createEndpointReporter(endpoint: string): Reporter {
  return (metric) => {
    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
      url: typeof window !== 'undefined' ? window.location.href : '',
      timestamp: Date.now(),
    })
    // 用 navigator.sendBeacon 不阻塞 unload
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, body)
    } else if (typeof fetch !== 'undefined') {
      fetch(endpoint, { method: 'POST', body, keepalive: true }).catch(() => {
        // silent fail
      })
    }
  }
}
