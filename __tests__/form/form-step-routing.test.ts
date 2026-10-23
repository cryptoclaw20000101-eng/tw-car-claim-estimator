import { describe, expect, it } from 'vitest'
import { getClaimSteps } from '@/app/claims/new/_flow'

describe('按受傷狀態導覽，事故與肇責同一步', () => {
  it('受傷案件為四步，保留既有資料區段編號', () => {
    expect(getClaimSteps(true)).toEqual([0, 2, 3, 4])
  })
  it('未受傷案件只需事故肇責及費用核對兩步', () => {
    expect(getClaimSteps(false)).toEqual([0, 4])
  })
  it('未選受傷狀態不會提前略過醫療流程', () => {
    expect(getClaimSteps(undefined)).toEqual([0, 2, 3, 4])
  })
})
