// api-security 測試 — CSRF (Origin) + rate limit
import { describe, it, expect, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import { checkRateLimit, checkSameOrigin, rateLimitStatus } from '@/lib/api-security'

/** Minimal NextRequest-like mock：只覆蓋測試用得到的欄位（method 可寫） */
function makeReq(headers: Record<string, string> = {}, method = 'POST'): NextRequest {
  const mock: { method: string; headers: { get: (n: string) => string | null } } = {
    method,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  }
  return mock as unknown as NextRequest
}

describe('checkRateLimit', () => {
  beforeEach(() => {
    // 測試隔離：重置所有 bucket（無公開 API）
    // 用不同 IP 規避 cross-test pollution
  })

  it('allows first request', () => {
    const req = makeReq({ 'x-forwarded-for': '1.2.3.4' })
    expect(checkRateLimit(req, 'test1')).toBe(true)
  })

  it('allows up to 60 requests in window', () => {
    const req = makeReq({ 'x-forwarded-for': '5.6.7.8' })
    for (let i = 0; i < 60; i++) {
      expect(checkRateLimit(req, 'test2')).toBe(true)
    }
  })

  it('blocks 61st request', () => {
    const req = makeReq({ 'x-forwarded-for': '9.10.11.12' })
    for (let i = 0; i < 60; i++) checkRateLimit(req, 'test3')
    expect(checkRateLimit(req, 'test3')).toBe(false)
  })

  it('different IPs have separate buckets', () => {
    const reqA = makeReq({ 'x-forwarded-for': '100.1.1.1' })
    const reqB = makeReq({ 'x-forwarded-for': '200.2.2.2' })
    for (let i = 0; i < 60; i++) checkRateLimit(reqA, 'test4')
    expect(checkRateLimit(reqA, 'test4')).toBe(false) // A 超限
    expect(checkRateLimit(reqB, 'test4')).toBe(true) // B 仍可
  })
})

describe('rateLimitStatus', () => {
  it('returns count + remaining for fresh IP', () => {
    const req = makeReq({ 'x-forwarded-for': '50.50.50.50' })
    const status = rateLimitStatus(req, 'test-status')
    expect(status.count).toBe(0)
    expect(status.remaining).toBe(60)
  })

  it('decreases remaining after request', () => {
    const req = makeReq({ 'x-forwarded-for': '60.60.60.60' })
    checkRateLimit(req, 'test-status-2')
    const status = rateLimitStatus(req, 'test-status-2')
    expect(status.count).toBe(1)
    expect(status.remaining).toBe(59)
  })
})

describe('checkSameOrigin', () => {
  // 測試用 process.env.NEXT_PUBLIC_SITE_URL
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
  })

  it('allows GET requests (safe method)', () => {
    const req = makeReq({ origin: 'http://evil.com' }, 'GET')
    expect(checkSameOrigin(req)).toBe(true)
  })

  it('allows POST without origin (same-origin browser request)', () => {
    const req = makeReq({}, 'POST') // 無 origin
    expect(checkSameOrigin(req)).toBe(true)
  })

  it('blocks POST with different origin (CSRF attack)', () => {
    const req = makeReq({ origin: 'http://evil.com' }, 'POST')
    expect(checkSameOrigin(req)).toBe(false)
  })

  it('allows POST with matching origin', () => {
    const req = makeReq({ origin: 'http://localhost:3000' }, 'POST')
    expect(checkSameOrigin(req)).toBe(true)
  })

  it('allows OPTIONS (CORS preflight)', () => {
    const req = makeReq({ origin: 'http://evil.com' }, 'OPTIONS')
    expect(checkSameOrigin(req)).toBe(true)
  })
})
