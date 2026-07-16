// =====================================================================
// v0.26.0e+：AGENTS §1 鐵律 ④「未受傷 → 精神慰撫金 = 0」守護
// 對應：lib/insurance/index.ts estimateClaim 末尾的 isInjured guard
// 設計：未受傷時所有傷相關欄位歸 0（cascade 自然處理 painAndSuffering）
// 不動：第三人責任險、車損、region（跟受傷與否無關）
// =====================================================================

import { describe, it, expect } from 'vitest'
import { estimateClaim } from '@/lib/insurance'
import { SAMPLE_INPUT } from '@/lib/insurance/sample'

describe('estimateClaim isInjured guard（v0.26.0e+ AGENTS §1 鐵律 ④）', () => {
  const injuredResult = estimateClaim(SAMPLE_INPUT)

  const notInjuredInput = {
    ...SAMPLE_INPUT,
    basics: {
      ...SAMPLE_INPUT.basics,
      isInjured: false as const,
    },
  }
  const notInjuredResult = estimateClaim(notInjuredInput)

  it('受傷預設 → 強制險 > 0（既有行為不變）', () => {
    expect(injuredResult.compulsoryMedicalApproved).toBeGreaterThan(0)
    expect(injuredResult.painAndSuffering.regionalMid).toBeGreaterThan(0)
  })

  it('未受傷 → 強制險醫療全 0', () => {
    expect(notInjuredResult.compulsoryMedicalSubtotal).toBe(0)
    expect(notInjuredResult.compulsoryMedicalApproved).toBe(0)
    expect(notInjuredResult.compulsoryTotalEstimated).toBe(0)
  })

  it('未受傷 → 強制險明細 approved 都 = 0', () => {
    for (const item of notInjuredResult.compulsoryItems) {
      expect(item.approved).toBe(0)
      expect(item.applied).toBe(0)
      expect(item.reductionReason).toBe('未受傷')
    }
  })

  it('未受傷 → 失能初篩 possibleLevel = null + possibleAmount = 0', () => {
    expect(notInjuredResult.disability.possibleLevel).toBeNull()
    expect(notInjuredResult.disability.possibleAmount).toBe(0)
    expect(notInjuredResult.disability.signals).toEqual([])
  })

  it('未受傷 → 民事醫療 / 看護 / 接送 全 0', () => {
    expect(notInjuredResult.civilMedicalExpense).toBe(0)
    expect(notInjuredResult.civilNursingFeeLow).toBe(0)
    expect(notInjuredResult.civilNursingFeeMid).toBe(0)
    expect(notInjuredResult.civilNursingFeeHigh).toBe(0)
    expect(notInjuredResult.civilTransportationFee).toBe(0)
  })

  it('未受傷 → 工作損失歸 0（cascade）', () => {
    expect(notInjuredResult.workLoss).toBe(0)
    expect(notInjuredResult.workLossExtended.amount).toBe(0)
    expect(notInjuredResult.workLossExtended.calculationType).toBe('none')
    expect(notInjuredResult.laborCapacityLossEstimate).toBe(0)
  })

  it('未受傷 → 精神慰撫金 cascade 為 0（無顯式覆寫，靠 medical=0）', () => {
    expect(notInjuredResult.painAndSuffering.regionalMid).toBe(0)
    expect(notInjuredResult.painML.mid).toBe(0)
    expect(notInjuredResult.painEnsemble.consensusAmount).toBe(0)
  })

  it('未受傷 → 第三人責任險會跟著變小（因為包含我方 civil 數字 × 對方肇責）', () => {
    // 對方肇責比例 × (我方 civil 醫療 + 工作損失 + 精神慰撫金) — 未受傷時全 0
    // 但若對方有體傷 / 死亡，第三人責任險仍可能有金額（這是對方受害的賠償）
    // 註：本測試 SAMPLE_INPUT 對方肇責 70% × (civil 數字)
    expect(notInjuredResult.thirdParty.thirdPartyEstimateMid).toBeLessThan(
      injuredResult.thirdParty.thirdPartyEstimateMid,
    )
  })

  it('未受傷 → 車損不變', () => {
    expect(notInjuredResult.vehicleDamage).toBe(injuredResult.vehicleDamage)
    expect(notInjuredResult.propertyDamage).toBe(injuredResult.propertyDamage)
  })

  it('未受傷 → region 不變', () => {
    expect(notInjuredResult.region.courtName).toBe(injuredResult.region.courtName)
    expect(notInjuredResult.region.accidentCity).toBe(injuredResult.region.accidentCity)
  })
})
