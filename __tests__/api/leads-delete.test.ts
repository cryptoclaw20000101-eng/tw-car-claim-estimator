// =====================================================================
// v0.26.0a+：Lead 刪除 endpoint 守護（AGENTS §6 個資風格守護）
// 對應：app/api/leads/[id]/route.ts DELETE
// 用 vi.mock mock 掉 query + getUserFromRequest，純 unit test
// =====================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock db + auth
vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({
  getUserFromRequest: vi.fn(),
}))

import { DELETE } from '@/app/api/leads/[id]/route'
import { query } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// Next.js 16 dynamic route params 是 Promise
const fakeReq = {} as unknown as Request
const fakeParams = (id: string) => ({ params: Promise.resolve({ id }) })

describe('DELETE /api/leads/[id] — v0.26.0a lead 刪除', () => {
  beforeEach(() => {
    vi.mocked(query).mockReset()
    vi.mocked(getUserFromRequest).mockReset()
  })

  it('no auth cookie → 401', async () => {
    vi.mocked(getUserFromRequest).mockReturnValue(null)
    const res = await DELETE(fakeReq, fakeParams('00000000-0000-0000-0000-000000000000'))
    expect(res.status).toBe(401)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBe('unauthorized')
    expect(query).not.toHaveBeenCalled()
  })

  it('invalid id format → 400 (SQL injection 防禦)', async () => {
    vi.mocked(getUserFromRequest).mockReturnValue({
      userId: 'user-1',
      email: 'a@b.com',
    })
    const attacks = [
      `12345; DROP TABLE users;--`,
      `' OR 1=1; --`,
      `<script>alert(1)</script>`,
      `not-a-uuid`,
    ]
    for (const id of attacks) {
      const res = await DELETE(fakeReq, fakeParams(id))
      expect(res.status).toBe(400)
    }
    // 確保 query 沒被呼叫（防 SQL injection 守護）
    expect(query).not.toHaveBeenCalled()
  })

  it('non-existent id → 404', async () => {
    vi.mocked(getUserFromRequest).mockReturnValue({
      userId: 'user-1',
      email: 'a@b.com',
    })
    vi.mocked(query).mockResolvedValue({ rows: [], rowCount: 0 } as never)
    const res = await DELETE(fakeReq, fakeParams('00000000-0000-0000-0000-000000000000'))
    expect(res.status).toBe(404)
  })

  it('valid id + auth → 200 + 刪除成功', async () => {
    vi.mocked(getUserFromRequest).mockReturnValue({
      userId: 'user-1',
      email: 'a@b.com',
    })
    vi.mocked(query).mockResolvedValue({ rows: [], rowCount: 1 } as never)
    const res = await DELETE(fakeReq, fakeParams('11111111-1111-1111-1111-111111111111'))
    expect(res.status).toBe(200)
    const data = (await res.json()) as { ok: boolean; id: string }
    expect(data.ok).toBe(true)
    expect(data.id).toBe('11111111-1111-1111-1111-111111111111')
  })

  it('db error → 500', async () => {
    vi.mocked(getUserFromRequest).mockReturnValue({
      userId: 'user-1',
      email: 'a@b.com',
    })
    vi.mocked(query).mockRejectedValue(new Error('connection lost'))
    const res = await DELETE(fakeReq, fakeParams('11111111-1111-1111-1111-111111111111'))
    expect(res.status).toBe(500)
  })
})
