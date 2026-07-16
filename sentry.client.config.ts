// Sentry 客戶端設定（v0.26.0b+）
// 對應 AGENTS §13 ErrorTracker 整合
// 從環境變數 SENTRY_DSN 讀 DSN（沒設則關閉 Sentry）

import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    // v0.18.x+ 性能追蹤 sample rate（10% 避免生產環境過載）
    tracesSampleRate: 0.1,
    // v0.18.x+ Web Vitals（先前 WebVitalsReporter 替代）
    integrations: [Sentry.browserTracingIntegration()],
  })
}
