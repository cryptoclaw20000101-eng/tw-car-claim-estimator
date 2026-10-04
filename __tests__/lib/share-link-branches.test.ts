import { afterEach, describe, expect, it, vi } from 'vitest'
import { decodeShareHash, encodeShareHash, restoreFromHash } from '@/lib/share-link'
import type { ClaimInput, EstimationResult } from '@/lib/insurance/types'

function encodePayload(payload: unknown): string {
  return `r=${btoa(unescape(encodeURIComponent(JSON.stringify(payload))))}`
}

describe('share-link fallback branches', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('restores safe defaults when optional fields are absent', () => {
    const writes = new Map<string, string>()
    vi.stubGlobal('window', {
      location: { hash: `#${encodePayload({ v: 1 })}` },
      sessionStorage: {
        setItem: (key: string, value: string) => writes.set(key, value),
      },
    })

    expect(restoreFromHash()).toBe(true)
    const restored = JSON.parse(writes.get('claim-input') ?? '{}')
    expect(restored).toEqual({
      basics: {
        accidentDate: '',
        accidentLocation: '',
        accidentType: '',
        injuredRole: '',
        isAutomobileAccident: true,
        courtJurisdiction: '',
      },
      fault: {
        selfFaultRatio: 50,
        otherFaultRatio: 50,
        faultSource: '尚未確定',
        isFaultDisputed: false,
      },
      medical: { disabilityLevel: null },
    })
  })

  it('returns false when sessionStorage rejects the restored payload', () => {
    vi.stubGlobal('window', {
      location: { hash: `#${encodePayload({ v: 1, i: {}, r: {} })}` },
      sessionStorage: {
        setItem: () => {
          throw new Error('storage blocked')
        },
      },
    })
    expect(restoreFromHash()).toBe(false)
  })

  it('returns null for malformed base64 or JSON', () => {
    expect(decodeShareHash('r=%%%')).toBeNull()
    expect(decodeShareHash(`r=${btoa('not-json')}`)).toBeNull()
  })

  it('returns an empty hash when serialization fails', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(
      encodeShareHash(
        {} as unknown as ClaimInput,
        { compulsoryTotalEstimated: circular } as unknown as EstimationResult,
      ),
    ).toBe('')
  })
})
