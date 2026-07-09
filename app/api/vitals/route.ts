/**
 * /api/vitals route — 接 WebVitalsReporter 上報（v0.16.x+）
 *
 * scaffold 階段只 log 到 server console，未來接 Vercel Analytics / PostHog
 * 只需改這個 route。
 *
 * 設計：
 * - POST 收 Web Vitals metric (name / value / id / rating)
 * - 在 server console 印 [Vitals] name + value + rating
 * - 永遠回 204 No Content
 *
 * 部署注意：同 /api/errors，需 serverful 模式（Railway 部署可跑）
 */

import { NextRequest } from 'next/server'

interface VitalsPayload {
  name?: string // LCP / FID / CLS / INP / FCP / TTFB
  value?: number
  id?: string
  rating?: 'good' | 'needs-improvement' | 'poor'
  delta?: number
  navigationType?: string
}

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as VitalsPayload
    console.log(
      '[api/vitals]',
      payload.name ?? '?',
      '=',
      payload.value?.toFixed(1) ?? '?',
      `(${payload.rating ?? '?'})`,
    )
    return new Response(null, { status: 204 })
  } catch (e) {
    console.error('[api/vitals] parse failed:', e)
    return new Response(null, { status: 400 })
  }
}
