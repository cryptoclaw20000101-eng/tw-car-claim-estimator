import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClaimInput, EstimationResult } from '@/lib/insurance/types'

const historyMocks = vi.hoisted(() => ({
  getEstimateHistory: vi.fn(),
  saveEstimateHistory: vi.fn(),
  buildHistoryEntry: vi.fn(),
}))

vi.mock('@/lib/estimate-history', () => historyMocks)

import { cancelLoad, consumeForLoad, saveForLoad } from '@/lib/estimate-loader'
import {
  deleteCloudEstimate,
  hasCloudStorage,
  loadEstimates,
  saveEstimate,
} from '@/lib/estimate-storage'
import { downloadCloudToLocal, smartSync, uploadLocalToCloud } from '@/lib/sync'

const input = {
  fault: { selfFaultRatio: 30 },
  medical: { disabilityLevel: 7 },
} as ClaimInput
const result = {
  compulsoryTotalEstimated: 50_000,
  region: { courtName: '臺灣臺中地方法院' },
} as EstimationResult

function storageMock() {
  const values = new Map<string, string>()
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
    clear: vi.fn(() => values.clear()),
    key: vi.fn(() => null),
    get length() {
      return values.size
    },
  } as unknown as Storage
}

describe('estimate loader', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { sessionStorage: storageMock() })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('saves, consumes once, and cancels session data', () => {
    saveForLoad(input)
    expect(consumeForLoad()).toEqual(input)
    expect(consumeForLoad()).toBeNull()
    saveForLoad(input)
    cancelLoad()
    expect(consumeForLoad()).toBeNull()
  })

  it('is SSR safe and tolerates storage failures', () => {
    vi.unstubAllGlobals()
    expect(consumeForLoad()).toBeNull()
    expect(() => saveForLoad(input)).not.toThrow()
    expect(() => cancelLoad()).not.toThrow()

    const broken = storageMock()
    vi.mocked(broken.setItem).mockImplementation(() => {
      throw new Error('quota')
    })
    vi.mocked(broken.getItem).mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.stubGlobal('window', { sessionStorage: broken })
    expect(() => saveForLoad(input)).not.toThrow()
    expect(consumeForLoad()).toBeNull()
  })
})

describe('estimate cloud storage', () => {
  beforeEach(() => {
    historyMocks.getEstimateHistory.mockReset().mockReturnValue([])
    historyMocks.saveEstimateHistory.mockReset()
    historyMocks.buildHistoryEntry.mockReset().mockReturnValue({ timestamp: 'local-entry' })
    vi.stubGlobal('window', {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('saves to cloud when authenticated', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'cloud-1' }) })
    vi.stubGlobal('fetch', fetchMock)
    await expect(saveEstimate(input, result, 'user-1')).resolves.toEqual({
      storage: 'cloud',
      id: 'cloud-1',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/estimates',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('falls back locally for anonymous, rejected, or failed cloud saves', async () => {
    await expect(saveEstimate(input, result, null)).resolves.toEqual({ storage: 'local' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    await expect(saveEstimate(input, result, 'user-1')).resolves.toEqual({ storage: 'local' })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(saveEstimate(input, result, 'user-1')).resolves.toEqual({ storage: 'local' })
    expect(historyMocks.saveEstimateHistory).toHaveBeenCalledTimes(3)
  })

  it('loads cloud estimates and falls back to local history', async () => {
    const items = [{ id: 'cloud-1' }]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items }) }))
    await expect(loadEstimates('user-1')).resolves.toEqual({ storage: 'cloud', items })

    historyMocks.getEstimateHistory.mockReturnValue([{ timestamp: 'local-1' }])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    await expect(loadEstimates('user-1')).resolves.toEqual({
      storage: 'local',
      items: [{ timestamp: 'local-1' }],
    })
    await expect(loadEstimates(null)).resolves.toMatchObject({ storage: 'local' })
  })

  it('deletes cloud estimates and reports network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    await expect(deleteCloudEstimate('estimate-1', 'user-1')).resolves.toBe(true)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(deleteCloudEstimate('estimate-1', 'user-1')).resolves.toBe(false)
    expect(hasCloudStorage()).toBe(true)
    vi.unstubAllGlobals()
    expect(hasCloudStorage()).toBe(false)
  })
})

describe('local/cloud synchronization', () => {
  const cloudItem = {
    id: 'cloud-1',
    userId: 'user-1',
    createdAt: '2026-08-10T00:00:00.000Z',
    claimInput: input,
    result,
  }

  beforeEach(() => {
    historyMocks.getEstimateHistory.mockReset().mockReturnValue([])
    historyMocks.saveEstimateHistory.mockReset()
  })

  afterEach(() => vi.unstubAllGlobals())

  it('counts local-only records as skipped uploads', async () => {
    historyMocks.getEstimateHistory.mockReturnValue([{ timestamp: 'a' }, { timestamp: 'b' }])
    await expect(uploadLocalToCloud()).resolves.toMatchObject({ skipped: 2, uploaded: 0 })
  })

  it('downloads cloud records into local history', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [cloudItem] }) }),
    )
    await expect(downloadCloudToLocal('user-1')).resolves.toMatchObject({ downloaded: 1 })
    expect(historyMocks.saveEstimateHistory).toHaveBeenCalledWith(
      expect.objectContaining({ disabilityLevel: 7, selfFaultRatio: 30 }),
    )
  })

  it('reports malformed cloud responses without throwing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('bad json')
        },
      }),
    )
    await expect(downloadCloudToLocal('user-1')).resolves.toMatchObject({
      downloaded: 0,
      errors: [],
    })
  })

  it('smart-sync skips duplicates and downloads only new records', async () => {
    historyMocks.getEstimateHistory.mockReturnValue([{ timestamp: cloudItem.createdAt }])
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            cloudItem,
            { ...cloudItem, id: 'cloud-2', createdAt: '2026-08-11T00:00:00.000Z' },
          ],
        }),
      }),
    )
    await expect(smartSync('user-1')).resolves.toMatchObject({ downloaded: 1, skipped: 2 })
  })
})
