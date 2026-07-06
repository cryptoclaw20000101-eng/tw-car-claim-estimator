// =====================================================================
// /api/advisor route 測試 — Next 16 App Router POST handler
//
// v0.6.4 新增：
//   - POST /api/advisor 收 AdvisorInput
//   - 內部呼叫 callClaudeAdvisor
//   - 回傳 AdvisorApiResult JSON
// =====================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { clearAdvisorCache } from '@/lib/insurance/advisor-cache'
import { POST } from '@/app/api/advisor/route'
import type { AdvisorInput } from '@/lib/insurance/pain-advisor'

// =====================================================================
// mock fetch + env
// =====================================================================

const mockFetch = vi.fn()

beforeEach(() => {
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
  delete process.env.ANTHROPIC_API_KEY
  // v0.7.7+：清快取避免跨測試污染
  clearAdvisorCache()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// =====================================================================
// 測試 fixture
// =====================================================================

const validInput: AdvisorInput = {
  courtName: '臺灣臺北地方法院',
  rulesMid: 100000,
  rulesLevel: '中度',
  mlP50: 80000,
  mlConfidence: 'medium',
  knnAmount: 90000,
  knnCases: [{ caseNo: '113 北簡字 123', amount: 90000 }],
  ensembleConsensus: 'strong',
  ensembleAmount: 90000,
  outlier: null,
  isDivergent: false,
  hasWarnings: false,
}

// =====================================================================
// POST handler — 基本
// =====================================================================

describe('POST /api/advisor', () => {
  it('正常請求 → 200 + AdvisorApiResult', async () => {
    // 沒設 ANTHROPIC_API_KEY → mock mode
    const req = new Request('http://localhost/api/advisor', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validInput),
    })
    const res = await POST(req as unknown as Request)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.mode).toBe('mock')
    expect(data.advisor).toBeDefined()
    expect(data.advisor.disclaimer).toContain('不構成法律意見')
  })

  it('空 body → 400', async () => {
    const req = new Request('http://localhost/api/advisor', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '',
    })
    const res = await POST(req as unknown as Request)
    expect(res.status).toBe(400)
  })

  it('無效 JSON → 400', async () => {
    const req = new Request('http://localhost/api/advisor', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'this is not JSON',
    })
    const res = await POST(req as unknown as Request)
    expect(res.status).toBe(400)
  })

  it('缺必要欄位（courtName 為空） → 400 + 錯誤訊息', async () => {
    const invalid = { ...validInput, courtName: '' }
    const req = new Request('http://localhost/api/advisor', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(invalid),
    })
    const res = await POST(req as unknown as Request)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/courtName/i)
  })

  it('缺必要欄位（rulesMid 不是數字）→ 400', async () => {
    const invalid = { ...validInput, rulesMid: 'not a number' }
    const req = new Request('http://localhost/api/advisor', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(invalid),
    })
    const res = await POST(req as unknown as Request)
    expect(res.status).toBe(400)
  })

  it('有 ANTHROPIC_API_KEY → live mode + 打到 fetch', async () => {
    process.env.ANTHROPIC_API_KEY = '***'
    const llmResponse = JSON.stringify({
      riskLevel: 'medium',
      riskFactors: ['ML 信心度中等'],
      recommendations: ['建議補件'],
      consensusInterpretation: '可採用',
      requiresHumanReview: true,
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ type: 'text', text: '```json\n' + llmResponse + '\n```' }],
        usage: { input_tokens: 150, output_tokens: 50 },
      }),
    })

    const req = new Request('http://localhost/api/advisor', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validInput),
    })
    const res = await POST(req as unknown as Request)
    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const data = await res.json()
    expect(data.mode).toBe('live')
    expect(data.advisor.riskLevel).toBe('medium')
  })

  it('live mode + fetch 失敗 → 200 + mode=fallback', async () => {
    process.env.ANTHROPIC_API_KEY = '***'
    mockFetch.mockRejectedValue(new TypeError('fetch failed'))

    const req = new Request('http://localhost/api/advisor', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validInput),
    })
    const res = await POST(req as unknown as Request)
    // route 不應該讓 fetch 失敗變 5xx，要走 fallback
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.mode).toBe('fallback')
    expect(data.fallbackReason).toBe('network')
  })

  it('回應 header 有 cache-control: no-store（個資絕不 cache）', async () => {
    const req = new Request('http://localhost/api/advisor', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validInput),
    })
    const res = await POST(req as unknown as Request)
    expect(res.headers.get('cache-control')).toBe('no-store')
  })
})
