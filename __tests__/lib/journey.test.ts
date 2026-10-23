import { describe, expect, it, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { parseJourneyPayload } from '@/lib/journey'
const { queryMock, adminMock } = vi.hoisted(() => ({ queryMock: vi.fn(), adminMock: vi.fn() }))
vi.mock('@/lib/db', () => ({ query: queryMock }))
vi.mock('@/lib/auth', () => ({ getAdminFromRequest: adminMock }))
import { POST } from '@/app/api/journey/route'
import { GET } from '@/app/api/admin/journey/route'
const payload = {
  sessionId: '11be898a-808a-4568-947b-459b047c6021',
  event: 'step_completed',
  step: 'basics',
}
function req(body: string, origin = 'http://localhost:3000') {
  return new NextRequest('http://localhost:3000/api/journey', {
    method: 'POST',
    headers: { origin },
    body,
  })
}
beforeEach(() => {
  vi.clearAllMocks()
  queryMock.mockResolvedValue({ rows: [] })
})
describe('匿名填表事件', () => {
  it('只接受已知事件與隨機代碼，拒絕夾帶表單值', () => {
    expect(parseJourneyPayload(payload)).toEqual(payload)
    for (const value of [
      { ...payload, salary: 50000 },
      { ...payload, event: '姓名' },
      { ...payload, sessionId: 'email@example.com' },
      { ...payload, step: '' },
      null,
    ])
      expect(parseJourneyPayload(value)).toBeNull()
    expect(parseJourneyPayload({ ...payload, event: 'repair_completed', step: '' })).not.toBeNull()
  })
  it('去重寫入事件，不寫帳號、IP 或請求內容', async () => {
    expect((await POST(req(JSON.stringify(payload)))).status).toBe(204)
    expect(queryMock.mock.calls[1][0]).toContain('ON CONFLICT DO NOTHING')
    expect(queryMock.mock.calls[1][1]).toEqual([payload.sessionId, payload.event, payload.step])
  })
  it('拒絕跨站、無效 JSON、超大內容；不寫資料庫', async () => {
    expect((await POST(req(JSON.stringify(payload), 'https://example.com'))).status).toBe(403)
    expect((await POST(req('not json'))).status).toBe(400)
    expect((await POST(req('x'.repeat(1025)))).status).toBe(413)
    expect(queryMock).not.toHaveBeenCalled()
  })
  it('資料庫未設定時回報統計不可用，不聲稱事件成功', async () => {
    queryMock.mockRejectedValue(new Error('unavailable'))
    expect((await POST(req(JSON.stringify(payload)))).status).toBe(503)
  })
  it('統計只開放管理員，且不快取', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/journey')
    adminMock.mockResolvedValue(null)
    expect((await GET(request)).status).toBe(401)
    adminMock.mockResolvedValue({ isAdmin: false })
    expect((await GET(request)).status).toBe(403)
    adminMock.mockResolvedValue({ isAdmin: true })
    const result = await GET(request)
    expect(result.headers.get('cache-control')).toBe('no-store')
    expect(await result.json()).toEqual({ days: 7, items: [] })
  })
})
