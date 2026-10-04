import { describe, expect, it } from 'vitest'
import { proxy } from '../proxy'

describe('route cache protection', () => {
  it('disables cross-deployment caching for page and RSC responses', () => {
    expect(proxy().headers.get('cache-control')).toBe('no-store, max-age=0, must-revalidate')
  })
})
