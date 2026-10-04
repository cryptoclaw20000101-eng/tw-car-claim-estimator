import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const queryMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ query: queryMock }))

import {
  RATE_LIMIT_CONFIG,
  calculateLockUntil,
  extractBearerToken,
  extractToken,
  generateVerifyToken,
  getAdminFromRequest,
  getTokenFromRequest,
  getUserFromRequest,
  hashPassword,
  isAccountLocked,
  shouldLockAccount,
  signToken,
  validatePasswordStrength,
  verifyPassword,
  verifyToken,
} from '@/lib/auth'
import { insertLead, listLeads } from '@/lib/leads'

describe('auth runtime services', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'unit-test-secret-with-enough-entropy'
    queryMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.JWT_SECRET
  })

  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('StrongPassword123')
    expect(hash).not.toBe('StrongPassword123')
    await expect(verifyPassword('StrongPassword123', hash)).resolves.toBe(true)
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false)
  })

  it('signs and verifies an HS256 token', () => {
    const token = signToken('user-1', 'user@example.com')
    expect(verifyToken(token)).toEqual({ userId: 'user-1', email: 'user@example.com' })
    expect(verifyToken(`${token}broken`)).toBeNull()
  })

  it('fails closed when JWT secret is absent', () => {
    delete process.env.JWT_SECRET
    expect(() => signToken('user-1', 'user@example.com')).toThrow('JWT_SECRET')
    expect(verifyToken('anything')).toBeNull()
  })

  it.each([
    ['short1A', '密碼至少 12 個字符'],
    ['LongPasswordWithoutNumber', '密碼需包含至少 1 個數字'],
    ['longpassword1234', '密碼需包含至少 1 個大寫字母'],
    ['LongPassword1234', null],
  ])('validates password strength', (password, expected) => {
    expect(validatePasswordStrength(password)).toBe(expected)
  })

  it('creates a unique email verification token expiring after 24 hours', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T00:00:00.000Z'))
    const first = generateVerifyToken()
    const second = generateVerifyToken()
    expect(first.token).not.toBe(second.token)
    expect(first.token.length).toBeGreaterThan(32)
    expect(first.expires.toISOString()).toBe('2026-08-11T00:00:00.000Z')
  })

  it('handles account lock thresholds and expiry', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T00:00:00.000Z'))
    expect(isAccountLocked(null)).toBe(false)
    expect(isAccountLocked(new Date('2026-08-09T23:59:59.000Z'))).toBe(false)
    expect(isAccountLocked(new Date('2026-08-10T00:00:01.000Z'))).toBe(true)
    expect(shouldLockAccount(4)).toBe(false)
    expect(shouldLockAccount(5)).toBe(true)
    expect(calculateLockUntil().toISOString()).toBe('2026-08-10T00:15:00.000Z')
    expect(RATE_LIMIT_CONFIG).toEqual({ threshold: 5, windowMinutes: 15 })
  })

  it('extracts cookie and bearer tokens safely', () => {
    expect(extractToken(null)).toBeNull()
    expect(extractToken('theme=dark; auth_token=hello%20world; x=1')).toBe('hello world')
    expect(extractToken('theme=dark')).toBeNull()
    expect(extractBearerToken(null)).toBeNull()
    expect(extractBearerToken('Basic abc')).toBeNull()
    expect(extractBearerToken('Bearer abc')).toBe('abc')
  })

  it('prefers bearer auth and resolves request users', () => {
    const bearer = signToken('bearer-user', 'bearer@example.com')
    const cookie = signToken('cookie-user', 'cookie@example.com')
    const req = new Request('https://example.com', {
      headers: { authorization: `Bearer ${bearer}`, cookie: `auth_token=${cookie}` },
    })
    expect(getTokenFromRequest(req)).toBe(bearer)
    expect(getUserFromRequest(req)?.userId).toBe('bearer-user')
    expect(getUserFromRequest(new Request('https://example.com'))).toBeNull()
  })

  it('loads fresh admin status from the database', async () => {
    const token = signToken('admin-1', 'admin@example.com')
    const req = new Request('https://example.com', {
      headers: { authorization: `Bearer ${token}` },
    })
    queryMock.mockResolvedValueOnce({ rows: [{ is_admin: true }] })
    await expect(getAdminFromRequest(req)).resolves.toMatchObject({
      userId: 'admin-1',
      isAdmin: true,
    })
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('select is_admin'), ['admin-1'])

    queryMock.mockResolvedValueOnce({ rows: [] })
    await expect(getAdminFromRequest(req)).resolves.toMatchObject({ isAdmin: false })
    await expect(getAdminFromRequest(new Request('https://example.com'))).resolves.toBeNull()
  })
})

describe('lead persistence', () => {
  beforeEach(() => queryMock.mockReset())

  it('creates the table and inserts a normalized lead', async () => {
    const row = {
      id: 'lead-1',
      estimate_id: null,
      user_id: null,
      contact_type: 'line' as const,
      contact_handle: 'agent-id',
      message: null,
      consent: true,
      created_at: new Date('2026-08-10T00:00:00.000Z'),
    }
    queryMock.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [row] })
    await expect(
      insertLead({ contactType: 'line', contactHandle: 'agent-id', consent: true }),
    ).resolves.toEqual(row)
    expect(queryMock).toHaveBeenLastCalledWith(
      expect.stringContaining('INSERT INTO public.leads'),
      [null, null, 'line', 'agent-id', null, true],
    )
  })

  it('rejects an insert that returns no row', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] })
    await expect(
      insertLead({ contactType: 'threads', contactHandle: 'agent-id', consent: true }),
    ).rejects.toThrow('no row returned')
  })

  it('lists leads with a configurable limit', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: 'lead-1' }] })
    await expect(listLeads(25)).resolves.toEqual([{ id: 'lead-1' }])
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY created_at DESC'),
      [25],
    )
  })
})
