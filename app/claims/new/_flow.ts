export type ClaimStep = 0 | 2 | 3 | 4

/** UI 步驟合併，既有區段編號保持不變以相容草稿與案件。 */
export function getClaimSteps(isInjured: boolean | undefined): ClaimStep[] {
  return isInjured === false ? [0, 4] : [0, 2, 3, 4]
}
