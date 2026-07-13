// =====================================================================
// 第三人責任險 Bug A 修復回歸測試（從 civil.test.ts 抽出）
//
// 歷史：v0.2.5 之前 computeThirdParty 會 double-count 強制險已賠金額
//       （在 civilMedicalExpense 已扣過的 20 萬又被扣第二次 → 15 萬變 35 萬）
// 修復：強制險已認列的金額不應在第三人體傷再扣（已是 civilMedicalExpense 差額）
// 對齊：CLAUDE.md §1 鐵律 ② 精神慰撫金 / 工作損失 / 車損不進強制險
//       但「強制險已賠的體傷」要在第三人「不重複扣」
// =====================================================================

import { describe, it, expect } from 'vitest'
import { computeThirdParty } from '@/lib/insurance/third-party'
import type { AccidentBasics } from '@/lib/insurance/types'

// 共用 fixture — 簡化版 case2 basics（從 civil.test.ts case2Basics 抄來）
const case2Basics: AccidentBasics = {
  accidentDate: '2026-08-01',
  accidentLocation: '台中市西屯區',
  accidentType: 'car_to_motorcycle',
  injuredRole: 'driver_motorcycle',
  isAutomobileAccident: true,
  hasPolicePreliminaryReport: true,
  hasAccidentAppraisal: false,
  hasCompulsoryInsurance: true,
  accidentCity: '台中市',
  accidentDistrict: '西屯區',
  claimantResidenceCity: '台中市',
  claimantResidenceDistrict: '西屯區',
  defendantResidenceCity: '台北市',
  defendantResidenceDistrict: '信義區',
  courtJurisdiction: '',
  insuranceCompanyBranchRegion: '中區',
}

describe('computeThirdParty Bug A 修復：不重複扣減強制險', () => {
  it('強制險已賠 20 萬 + 民事體傷差額 50 萬 + 肇責 70% → 第三人體傷應為 50 萬 × 70% = 35 萬（非扣 20 萬）', () => {
    // 構造一個 civilMedicalExpense 50 萬、civilNursingFee 0、其他 0 的情境
    // 強制險已賠 20 萬是 compulsory.approved（已在 civilMedicalExpense 內扣過）
    // 第三人險體傷 = 50 萬 × 70% = 35 萬（不該再扣 20 萬）
    const r = computeThirdParty({
      basics: {
        ...case2Basics,
      },
      civil: {
        civilMedicalExpense: 500_000, // 已是差額（已扣 20 萬強制險）
        civilNursingFeeLow: 0,
        civilNursingFeeMid: 0,
        civilNursingFeeHigh: 0,
        civilTransportationFee: 0,
        workLoss: 0,
        laborCapacityLossEstimate: 0,
        painAndSuffering: {
          regionalLow: 0,
          regionalMid: 0,
          regionalHigh: 0,
          baseLow: 0,
          baseMid: 0,
          baseHigh: 0,
          regionalMultiplier: 1,
          severityLevel: '',
          severityScore: 0,
          breakdown: {
            hospitalizationDays: 0,
            rehabilitationCount: 0,
            scarLengthCm: 0,
            hasPermanentImpairment: false,
            hasDisability: false,
          },
        },
        vehicleDamage: 0,
        propertyDamage: 0,
      },
      compulsoryTotalApproved: 200_000, // 已在 civilMedicalExpense 內扣過
      otherFaultRatio: 70,
    })
    // 第三人體傷低 = 50 萬 × 0.7 = 35 萬（修 Bug A 之前會被扣 20 萬 * (50/50) = 20 萬 → 15 萬）
    expect(r.thirdPartyEstimateLow).toBe(350_000)
    expect(r.thirdPartyEstimateMid).toBe(350_000)
    expect(r.thirdPartyEstimateHigh).toBe(350_000)
  })
})
