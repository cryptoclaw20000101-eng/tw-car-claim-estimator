// Sentry server 端設定（v0.26.0b+）
// 對應 AGENTS §13 ErrorTracker 整合 + /api/errors route 整合

import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.1,
  })
}
