/**
 * /api/errors route — 接 ErrorTracker 上報（v0.16.x+）
 *
 * v0.26.0b+：串接 Sentry（init 由 sentry.server.config.ts 自動載入）
 * - 沒設 SENTRY_DSN → Sentry 為 no-op，只 server console
 * - 有設 SENTRY_DSN → Sentry.captureMessage 上報到 Sentry project
 * 參考：AGENTS.md §32 ErrorTracker → Sentry 整合
 *
 * 設計：
 * - POST 收 ErrorPayload JSON
 * - 在 server console 印 [Error] type + message + url（不印 stack 避免個資）
 * - 永遠回 204 No Content（client 端 sendBeacon 不需要 body）
 */

import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'

interface ErrorPayload {
  type?: string
  message?: string
  url?: string
  userAgent?: string
  timestamp?: number
  // stack 故意不在 server log 印（避免個資 / 路徑外洩）
}

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as ErrorPayload
    const type = payload.type ?? 'unknown'
    const message = payload.message ?? '(no message)'
    const url = payload.url ?? '(no url)'
    // 簡單 server log（Cloud Run / Railway / Vercel 都會收）
    console.error('[api/errors]', type, message, '@', url)
    // v0.26.0b+：送到 Sentry（已 init via sentry.server.config.ts）
    // 注意：不傳 stack 避免個資 / 路徑外洩（與 console 策略一致）
    Sentry.captureMessage(`${type}: ${message}`, {
      level: 'error',
      tags: { errorType: type, url },
      extra: { userAgent: payload.userAgent, timestamp: payload.timestamp },
    })
    return new Response(null, { status: 204 })
  } catch (e) {
    console.error('[api/errors] parse failed:', e)
    Sentry.captureException(e)
    return new Response(null, { status: 400 })
  }
}
