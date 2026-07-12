/**
 * api-security.ts — 簡單的 rate limit + CSRF (Origin) 守護 (v0.18.x+)
 *
 * 設計：
 * - 零套件（AGENTS §2.2）
 * - 記憶體 in-memory Map rate limit（單機適用，多機需 Redis）
 * - Origin 標頭比對白名單（生產環境同源）
 * - 失敗回 NextResponse.json 401/429
 *
 * 觸發時機：
 * - rateLimit: 任何 /api/* POST/PUT/DELETE/PATCH
 * - requireSameOrigin: 任何 /api/* mutation
 *
 * 不適用：
 * - GET 請求（CSRF 標準是 safe method）
 * - /api/auth/signin 內部（已通過 cookie SameSite=lax 保護）
 * - /api/auth/verify 用一次性 token
 */

import { NextRequest, NextResponse } from 'next/server'

// ============ Rate Limit ============
// 簡單 token bucket: 每 IP 60 req / 60s, 超過 → 429
const RATE_LIMIT_MAX = 60
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const buckets = new Map<string, { count: number; resetAt: number }>()

/** 取 IP（支援反向代理的 x-forwarded-for） */
function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

/** 檢查並遞增 rate limit 計數；true = 通過，false = 超限 */
export function checkRateLimit(req: NextRequest, bucket: string = 'default'): boolean {
  const ip = getClientIp(req)
  const key = `${bucket}:${ip}`
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  b.count++
  return b.count <= RATE_LIMIT_MAX
}

/** 取目前 bucket 狀態（debug / 給前端顯示） */
export function rateLimitStatus(req: NextRequest, bucket: string = 'default') {
  const ip = getClientIp(req)
  const b = buckets.get(`${bucket}:${ip}`)
  if (!b) return { count: 0, remaining: RATE_LIMIT_MAX }
  return { count: b.count, remaining: Math.max(0, RATE_LIMIT_MAX - b.count) }
}

// ============ CSRF (Origin) ============

/** 取得允許的 Origin 白名單 */
function getAllowedOrigins(): string[] {
  return [
    process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    'http://localhost:3000',
    'https://tw-car-claim-estimator.vercel.app',
    'https://tw-car-claim-estimator-production.up.railway.app',
  ]
}

/** 檢查 mutation 請求的 Origin 是否在白名單；true = 通過 */
export function checkSameOrigin(req: NextRequest): boolean {
  // GET/HEAD 不擋（safe method）
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return true
  }
  const origin = req.headers.get('origin')
  // 同源請求（same-origin）不一定帶 Origin header
  // 但瀏覽器 fetch / form submit 跨站會帶 Origin
  // 同源 POST 不帶 Origin header (有些瀏覽器行為)
  // → 寬鬆策略：無 Origin header 視為同源
  if (!origin) {
    return true
  }
  const allowed = getAllowedOrigins()
  return allowed.some((allowedOrigin) => {
    try {
      const allowedUrl = new URL(allowedOrigin)
      return origin === allowedUrl.origin
    } catch {
      return false
    }
  })
}

// ============ 整合 helper ============

/** 完整守護：rate limit + same origin；不通過回 NextResponse 直接 return */
export function apiGuard(req: NextRequest, options?: { bucket?: string }): NextResponse | null {
  if (!checkRateLimit(req, options?.bucket)) {
    return NextResponse.json(
      { error: '請求過於頻繁，請稍後再試' },
      { status: 429, headers: { 'Retry-After': '60' } },
    )
  }
  if (!checkSameOrigin(req)) {
    return NextResponse.json({ error: '不允許的來源（CSRF 保護）' }, { status: 403 })
  }
  return null // 通過守護
}
