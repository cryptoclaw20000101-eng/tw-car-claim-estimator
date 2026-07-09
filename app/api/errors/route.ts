/**
 * /api/errors route — 接 ErrorTracker 上報（v0.16.x+）
 *
 * scaffold 階段只 log 到 server console，未來接 Sentry / Logflare / Datadog
 * 只需改這個 route（不動 ErrorTracker component）。
 *
 * 設計：
 * - POST 收 ErrorPayload JSON
 * - 在 server console 印 [Error] type + message + url（不印 stack 避免個資）
 * - 永遠回 204 No Content（client 端 sendBeacon 不需要 body）
 *
 * 部署注意：
 * - 此 route 在 `output: "export"` 靜態站點不會被打包（AGENTS §13 警告）
 * - 目前 Railway Dockerfile 部署是 serverful，route 會跑
 * - production 真接 Sentry：在 route.ts 內 import * as Sentry from '@sentry/nextjs'
 */

import { NextRequest } from 'next/server'

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
    // 簡單 server log（Cloud Run / Railway / Vercel 都會收）
    console.error(
      '[api/errors]',
      payload.type ?? 'unknown',
      payload.message ?? '(no message)',
      '@',
      payload.url ?? '(no url)',
    )
    return new Response(null, { status: 204 })
  } catch (e) {
    console.error('[api/errors] parse failed:', e)
    return new Response(null, { status: 400 })
  }
}
