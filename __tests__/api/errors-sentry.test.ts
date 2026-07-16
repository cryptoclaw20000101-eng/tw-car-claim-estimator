// =====================================================================
// v0.26.0b+：/api/errors route Sentry 整合守護
// 對應：app/api/errors/route.ts
// 用 vi.mock 替換 @sentry/nextjs，驗證 captureMessage / captureException 被正確呼叫
// 參考：AGENTS.md §32 ErrorTracker → Sentry 整合
// =====================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Sentry SDK
vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}))

import { POST } from '@/app/api/errors/route'
import * as Sentry from '@sentry/nextjs'
import { NextRequest } from 'next/server'

const fakeReq = (body: unknown) =>
  ({
    json: async () => body,
  }) as unknown as NextRequest

describe('POST /api/errors — v0.26.0b sentry 整合', () => {
  beforeEach(() => {
    vi.mocked(Sentry.captureMessage).mockReset()
    vi.mocked(Sentry.captureException).mockReset()
  })

  it('valid ErrorPayload → 204 + Sentry.captureMessage called', async () => {
    const res = await POST(
      fakeReq({
        type: 'TypeError',
        message: 'cannot read property of undefined',
        url: '/claims/new',
        userAgent: 'Mozilla/5.0',
        timestamp: 1752670800000,
      }),
    )
    expect(res.status).toBe(204)
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'TypeError: cannot read property of undefined',
      {
        level: 'error',
        tags: { errorType: 'TypeError', url: '/claims/new' },
        extra: { userAgent: 'Mozilla/5.0', timestamp: 1752670800000 },
      },
    )
  })

  it('缺欄位 → 用 unknown / (no message) / (no url) fallback', async () => {
    const res = await POST(fakeReq({}))
    expect(res.status).toBe(204)
    expect(Sentry.captureMessage).toHaveBeenCalledWith('unknown: (no message)', {
      level: 'error',
      tags: { errorType: 'unknown', url: '(no url)' },
      extra: { userAgent: undefined, timestamp: undefined },
    })
  })

  it('JSON parse failed → 400 + Sentry.captureException called', async () => {
    const req = {
      json: async () => {
        throw new SyntaxError('Unexpected token in JSON')
      },
    } as unknown as NextRequest
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(SyntaxError))
  })

  it('不傳 stack 到 Sentry（個資保護，AGENTS §32 紅線）', async () => {
    await POST(
      fakeReq({
        type: 'X',
        message: 'Y',
        url: '/',
        stack: '/Users/secret/path/file.ts:42\nsecret data',
      }),
    )
    const callArgs = vi.mocked(Sentry.captureMessage).mock.calls[0]
    // captureMessage 第一個參數是字串，第二個是 options
    // stack 不應出現在 message 內，也不應在 options.extra
    expect(callArgs[0]).not.toContain('secret')
    expect(callArgs[0]).not.toContain('/Users/')
    const options = callArgs[1] as { extra?: Record<string, unknown> }
    expect(JSON.stringify(options.extra ?? {})).not.toContain('secret')
    expect(JSON.stringify(options.extra ?? {})).not.toContain('/Users/')
  })
})
