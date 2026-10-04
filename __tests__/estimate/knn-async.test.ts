import { describe, expect, it } from 'vitest'
import { findRelatedPracticeCasesAsync } from '@/lib/estimate/knn-async'

describe('findRelatedPracticeCasesAsync', () => {
  it('yields and returns the requested number of cases', async () => {
    const cases = await findRelatedPracticeCasesAsync('臺灣臺中地方法院', 7, 2)
    expect(cases).toHaveLength(2)
  })

  it('preserves KNN debug metadata', async () => {
    const cases = await findRelatedPracticeCasesAsync('臺灣臺北地方法院', 10, 1, true)
    expect(cases).toHaveLength(1)
    expect(cases[0]).toEqual(
      expect.objectContaining({
        knnDistance: expect.any(Number),
        knnBreakdown: expect.any(Object),
      }),
    )
  })
})
