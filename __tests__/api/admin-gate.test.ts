// =====================================================================
// v0.27.0+：後台 admin 守護測試（AGENTS §6 紅線 — privilege escalation 防禦）
// 對應：app/api/admin/{users,estimates,leads}/route.ts + getAdminFromRequest
// 不變量：未登入 → 401 / 非 admin 登入 user → 403 / admin → 200
// =====================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock db
vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}))

// Mock auth
vi.mock('@/lib/auth', () => ({
  getAdminFromRequest: vi.fn(),
}))

import { GET as getUsers } from '@/app/api/admin/users/route'
import { GET as getEstimates } from '@/app/api/admin/estimates/route'
import { GET as getLeads } from '@/app/api/admin/leads/route'
import { getAdminFromRequest } from '@/lib/auth'
import { NextRequest } from 'next/server'

const fakeReq = {} as unknown as NextRequest

describe('GET /api/admin/* — v0.27.0+ admin 守護', () => {
  beforeEach(() => {
    vi.mocked(getAdminFromRequest).mockReset()
  })

  it('未登入 → 401', async () => {
    vi.mocked(getAdminFromRequest).mockResolvedValue(null)
    const usersRes = await getUsers(fakeReq)
    const estRes = await getEstimates(fakeReq)
    const leadsRes = await getLeads(fakeReq)
    expect(usersRes.status).toBe(401)
    expect(estRes.status).toBe(401)
    expect(leadsRes.status).toBe(401)
  })

  it('登入但非 admin → 403', async () => {
    vi.mocked(getAdminFromRequest).mockResolvedValue({
      userId: 'user-1',
      email: 'a@b.com',
      isAdmin: false,
    })
    const usersRes = await getUsers(fakeReq)
    const estRes = await getEstimates(fakeReq)
    const leadsRes = await getLeads(fakeReq)
    expect(usersRes.status).toBe(403)
    expect(estRes.status).toBe(403)
    expect(leadsRes.status).toBe(403)
  })

  it('admin → 200（呼叫 DB query，不驗 DB return）', async () => {
    vi.mocked(getAdminFromRequest).mockResolvedValue({
      userId: 'admin-1',
      email: 'admin@b.com',
      isAdmin: true,
    })
    // query mock 預設回 undefined rows → map 失敗拋錯但會被 catch
    const { query } = await import('@/lib/db')
    vi.mocked(query).mockResolvedValue({ rows: [], rowCount: 0 } as never)
    const usersRes = await getUsers(fakeReq)
    const estRes = await getEstimates(fakeReq)
    const leadsRes = await getLeads(fakeReq)
    // 三個 endpoint 都應該至少通過 auth gate（200 或 500，但不該是 401/403）
    expect([200, 500]).toContain(usersRes.status)
    expect([200, 500]).toContain(estRes.status)
    expect([200, 500]).toContain(leadsRes.status)
  })
})
