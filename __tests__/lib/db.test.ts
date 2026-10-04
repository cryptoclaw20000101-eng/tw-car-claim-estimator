import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const pgMocks = vi.hoisted(() => {
  const query = vi.fn()
  const connect = vi.fn()
  const end = vi.fn()
  const on = vi.fn()
  const pool = { query, connect, end, on }
  return {
    query,
    connect,
    end,
    on,
    pool,
    Pool: vi.fn(function MockPool() {
      return pool
    }),
  }
})

vi.mock('pg', () => ({ Pool: pgMocks.Pool }))

describe('database pool', () => {
  beforeEach(() => {
    vi.resetModules()
    pgMocks.Pool.mockClear()
    pgMocks.query.mockReset()
    pgMocks.connect.mockReset()
    pgMocks.end.mockReset()
    pgMocks.on.mockReset()
    delete process.env.DATABASE_URL
  })

  afterEach(() => {
    delete process.env.DATABASE_URL
  })

  it('fails fast without DATABASE_URL', async () => {
    const { query } = await import('@/lib/db')
    await expect(query('select 1')).rejects.toThrow('DATABASE_URL')
  })

  it('uses non-SSL pooling for Railway internal and reuses the singleton', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@postgres.railway.internal:5432/app'
    pgMocks.query.mockResolvedValue({ rows: [{ value: 1 }] })
    const db = await import('@/lib/db')
    await expect(db.query('select $1', [1])).resolves.toEqual({ rows: [{ value: 1 }] })
    await db.query('select 2')
    expect(pgMocks.Pool).toHaveBeenCalledTimes(1)
    expect(pgMocks.Pool).toHaveBeenCalledWith(expect.objectContaining({ ssl: false, max: 10 }))
    expect(pgMocks.on).toHaveBeenCalledWith('error', expect.any(Function))
  })

  it('enables relaxed SSL for public database URLs', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@example.com:5432/app'
    pgMocks.connect.mockResolvedValue({ release: vi.fn() })
    const { getClient } = await import('@/lib/db')
    await expect(getClient()).resolves.toEqual(
      expect.objectContaining({ release: expect.any(Function) }),
    )
    expect(pgMocks.Pool).toHaveBeenCalledWith(
      expect.objectContaining({ ssl: { rejectUnauthorized: false } }),
    )
  })

  it('closes and clears the pool safely', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/app'
    pgMocks.query.mockResolvedValue({ rows: [] })
    const db = await import('@/lib/db')
    await db.query('select 1')
    await db.closePool()
    await db.closePool()
    expect(pgMocks.end).toHaveBeenCalledTimes(1)
    await db.query('select 2')
    expect(pgMocks.Pool).toHaveBeenCalledTimes(2)
  })
})
