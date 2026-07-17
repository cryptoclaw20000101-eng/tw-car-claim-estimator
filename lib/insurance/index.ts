// =====================================================================
// 統一對外 API：estimateClaim(input)
// 把表單輸入一次餵進所有計算引擎，回傳完整 EstimationResult
// =====================================================================

import type { ClaimInput, EstimationResult } from './types'
import { computeCompulsoryMedicalByDate } from './compulsory'
import { computeDisability } from './disability'
import {
  computePainAndSuffering,
  computeCivilMedicalExpense,
  computeCivilNursingFee,
  computeWorkLoss,
  computeLaborCapacityLoss,
} from './civil-damages'
import { computeWorkLossExtended } from './work-loss-extended'
import { computeScarRevisionCost, type ScarProcedure } from './scar-revision'
import { computeThirdParty, computeVehicleDamage, computePropertyDamage } from './third-party'
import { generateEvidence } from './evidence'
import { lookupCourt } from './region-court-map'
import { getRegionAdjustment } from './region-adjustments'
import { findRelatedPracticeCases } from '@/lib/estimate/precedents'
import { predictPainRange, reconcileWithRules } from './pain-ml'
import { ensembleEstimate } from './pain-ensemble'
import { mockLLMAdvisor, type AdvisorInput } from './pain-advisor'

/**
 * 車禍理賠估算主函式（v0.12.0+ 加 JSDoc）
 *
 * 整合 6 大引擎的總入口：
 * 1) 強制險醫療（v0.8.2+ 依事故日切換新/舊法）
 * 2) 失能初篩
 * 3) 法院判定（自動帶入 + 可手改）
 * 4) 民事醫療差額
 * 5) 第三人責任險
 * 6) 補件與風險
 * + 精神慰撫金 Ensemble（規則 + ML + KNN 三票共識）
 * + LLM 理賠顧問 mock
 *
 * @param input - 完整案件輸入（事故基本 / 肇責 / 人事 / 醫療 / 收據 / 車損）
 * @returns 完整估算結果（含各區金額 + 風險標示 + 法源 + LLM 建議）
 *
 * @throws 不會 throw（資料不足回 null，不會硬算）
 *
 * @see AGENTS.md §0 法律邊界（試算 vs 判決）
 * @see AGENTS.md §1 三條鐵律（強制險無過失 / 不併精神慰撫金 / 資料不足不硬算）
 */
export function estimateClaim(input: ClaimInput): EstimationResult {
  const { basics, fault, person, property } = input
  // medical / medicalReceipts 在 isInjured 短路時需 reassign 為 0，故用 let
  let { medical, medicalReceipts } = input

  // v0.26.0e+：AGENTS §1 鐵律 ④「未受傷 → 精神慰撫金 = 0」
  // 在入口把 medical / medicalReceipts 傷相關欄位歸 0，讓所有引擎 cascade 自然得到 0
  // （不需在每個引擎顯式覆寫；包含 painAndSuffering 因為依賴 medical severity）
  // 不動：basics.accidentLocation / fault / person（跟受傷與否無關，但 person 仍需傳遞給 work-loss 引擎）
  //       property（車損跟受傷無關）
  // 註：用 === false 嚴格判定（undefined 視為 true）以維持 `as unknown as ClaimInput` cast 測試向後相容
  if (basics.isInjured === false) {
    medical = {
      ...medical,
      hospitalizationDays: 0,
      hasSurgery: false,
      hasRehabilitation: false,
      requiresNursingCare: false,
      nursingDays: 0,
      hasFracture: false,
      hasDislocation: false,
      hasLigamentInjury: false,
      hasNerveDamage: false,
      hasAmputation: false,
      hasOrganDamage: false,
      hasRangeOfMotionLimitation: false,
      romLossDegree: 0,
      hasMuscleWeakness: false,
      hasSensoryLoss: false,
      hasPermanentImpairment: false,
      hasScar: false,
      scarLengthCm: 0,
      scarAreaCm2: 0,
      disabilityLevel: undefined,
    }
    medicalReceipts = {
      ...medicalReceipts,
      emergencyFee: 0,
      ambulanceFee: 0,
      nhiCopayment: 0,
      registrationFee: 0,
      diagnosisCertificateFee: 0,
      nonNhiNecessaryMedicalFee: 0,
      wardFeeDifference: 0,
      wardFeeDays: 0,
      mealFee: 0,
      mealDays: 0,
      prosthesisFee: 0,
      dentureFee: 0,
      missingTeethCount: 0,
      artificialEyeFee: 0,
      medicalMaterialFee: 0,
      specialMaterialFee: 0,
      assistiveDeviceFee: 0,
      transportationFee: 0,
      nursingFee: 0,
      nursingDays: 0,
    }
  }

  // 1) 強制險醫療（v0.8.2+：依事故日切換新/舊法）
  const compulsory = computeCompulsoryMedicalByDate(medicalReceipts, basics.accidentDate)

  // 2) 失能初篩
  const disability = computeDisability(medical, basics.accidentDate)

  // 3) 法院判定（自動 + 可手改）
  const courtName = basics.courtJurisdiction || lookupCourt(basics.accidentCity)
  const region = getRegionAdjustment(courtName)

  // 4) 民事醫療差額
  const totalMedicalReceipts =
    medicalReceipts.emergencyFee +
    medicalReceipts.ambulanceFee +
    medicalReceipts.nhiCopayment +
    medicalReceipts.registrationFee +
    medicalReceipts.diagnosisCertificateFee +
    medicalReceipts.nonNhiNecessaryMedicalFee +
    medicalReceipts.wardFeeDifference +
    medicalReceipts.mealFee +
    medicalReceipts.prosthesisFee +
    medicalReceipts.dentureFee +
    medicalReceipts.artificialEyeFee +
    (medicalReceipts.medicalMaterialFee ?? 0) +
    (medicalReceipts.specialMaterialFee ?? 0) + // v0.2.5+：特殊材料費也算醫療單據總額
    medicalReceipts.assistiveDeviceFee +
    medicalReceipts.transportationFee +
    medicalReceipts.nursingFee

  const civilMedicalExpense = computeCivilMedicalExpense(totalMedicalReceipts, compulsory.approved)

  // 5) 看護費
  const nursing = computeCivilNursingFee(medicalReceipts, medical, courtName)

  // 6) 精神慰撫金（規則引擎）
  const pas = computePainAndSuffering(medical, courtName)

  // 6b) 精神慰撫金 ML 校驗層（v0.6.0+）
  // 提供歷史 P10/P50/P90 + 信心度 + 規則 vs ML 落差警告
  const painML = predictPainRange({
    medical,
    courtName,
    rulesRegionalMid: pas.regionalMid,
  })
  const painReconcile = reconcileWithRules(painML, pas.regionalMid)

  // 7) 工作損失
  const workLoss = computeWorkLoss(person, courtName)

  // 7b) 工作損失（擴充版：短期 / 長期 / 退休分流）
  // 與 7) 並行：使用者看完整版明細，短期版作主估算
  const workLossExtended = computeWorkLossExtended({
    person,
    courtName,
  })

  // 8) 勞動能力減損
  // v0.6.6 重大改動：失能等級優先順序改為 ROM 細算 > 手填 > null
  // 原因：v0.6.5 之前 `medical.disabilityLevel`（手填或 12 大類 defaultLevel）
  // 蓋掉 `disability.possibleLevel`（ROM 細算結果），導致
  // 「踝關節 ROM 20°」被 12 大類 defaultLevel=9 蓋掉，誤判為第 9 級。
  // 真實附表（v0.6.6）：踝關節 20° = 40% motion → 12-35 第 13 級。
  //
  // 新優先序：
  //   1. ROM 細算（disability.possibleLevel）— 真實附表對照，最精確
  //   2. user 手填 disabilityLevel（且 ROM 細算沒跑時的 fallback）
  //   3. null（都沒資料）
  //
  // 型別收斂：number → 1-15 literal union（執行期已在 form 驗證）
  const rawLevel: number | null = disability.possibleLevel ?? medical.disabilityLevel ?? null
  const finalDisabilityLevel:
    1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | null =
    rawLevel !== null && rawLevel >= 1 && rawLevel <= 15
      ? (rawLevel as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15)
      : null

  // 6c) 精神慰撫金 Ensemble 三票共識（v0.6.2+）
  // 規則 + ML + KNN 三票共識，呼應 iPAS 第 2 課 Ensemble 概念
  // 放在 finalDisabilityLevel 之後才能用 KNN
  const practiceCases = findRelatedPracticeCases(courtName, finalDisabilityLevel, 3)
  const knnCases: Array<{ caseNo: string; amount: number }> = []
  for (const c of practiceCases) {
    const settlement = c.settlement as
      { totalInsurerPayout?: number; civilSettlement?: number } | undefined
    if (!settlement) continue
    const amount = settlement.civilSettlement ?? settlement.totalInsurerPayout ?? 0
    if (amount > 0) knnCases.push({ caseNo: c.caseNo, amount })
  }
  const painEnsemble = ensembleEstimate({
    rulesMid: pas.regionalMid,
    mlP50: painML.p50,
    knnCases,
    knnAvailable: knnCases.length > 0,
    mlConfidence: painML.confidence,
  })

  // 6d) LLM 理賠顧問複核（v0.6.3+，mock 階段，**同步純函式**）
  // ⚠️ 純函式骨架，v0.6.4 接 Claude API 時會改為 async
  // 個資保護：絕不傳姓名/ID/車號/精確日期
  // 免責聲明：永遠在 advisor.disclaimer
  // 設計：mockLLMAdvisor 為 sync 純函式 → estimateClaim 保持 sync 向後相容
  const advisorInput: AdvisorInput = {
    courtName,
    rulesMid: pas.regionalMid,
    rulesLevel: painML.severityLabel,
    mlP50: painML.p50,
    mlConfidence: painML.confidence,
    knnAmount: painEnsemble.knnAmount,
    knnCases,
    ensembleConsensus: painEnsemble.consensus,
    ensembleAmount: painEnsemble.consensusAmount,
    outlier: painEnsemble.outlier ?? null,
    isDivergent: painReconcile.status === 'diverge',
    hasWarnings: painReconcile.warning !== undefined,
  }
  const painAdvisor = mockLLMAdvisor(advisorInput)
  const labor = computeLaborCapacityLoss({
    medical,
    person,
    courtName,
    disabilityLevel: finalDisabilityLevel,
  })

  // 8b) 除疤 / 修疤費用（4 術式 × 北中南 × 疤痕長度）
  // 僅當 medical.hasScar 為真才計算，否則回 0
  // procedure 從表單 scarProcedure 帶入（預設 laser 最常見）
  // 蟹足腫/嚴重疤痕自動由 severity 觸發走注射治療（引擎內處理）
  const scarRevision = computeScarRevisionCost({
    medical,
    courtName,
    procedure: (medical.scarProcedure as ScarProcedure) ?? 'laser',
    prescribedSessions: medical.prescribedSessions,
    isKeloid: medical.isKeloid ?? medical.scarSeverity === 'keloid',
  })

  // 9) 車損財損
  const vehicleDamage = computeVehicleDamage(property)
  const propertyDamage = computePropertyDamage(property)

  // 10) 第三人責任險
  const thirdParty = computeThirdParty({
    basics,
    civil: {
      civilMedicalExpense,
      civilNursingFeeLow: nursing.low,
      civilNursingFeeMid: nursing.mid,
      civilNursingFeeHigh: nursing.high,
      civilTransportationFee: medicalReceipts.transportationFee,
      workLoss: workLoss.amount,
      laborCapacityLossEstimate: labor.estimate,
      painAndSuffering: pas,
      vehicleDamage,
      propertyDamage,
    },
    compulsoryTotalApproved: compulsory.approved,
    otherFaultRatio: fault.otherFaultRatio,
  })

  // 11) 補件與風險
  const evidence = generateEvidence(input, disability, workLoss, pas)

  // 12) 強制險總額（醫療 + 失能 + 死亡）
  const compulsoryTotalEstimated = compulsory.approved + disability.possibleAmount

  const result: EstimationResult = {
    compulsoryItems: compulsory.items,
    compulsoryMedicalSubtotal: compulsory.subtotal,
    compulsoryMedicalApproved: compulsory.approved,
    compulsoryDisabilityAmount: disability.possibleAmount,
    compulsoryDeathAmount: 0, // MVP 不處理死亡
    compulsoryTotalEstimated,

    disability,

    civilMedicalExpense,
    civilNursingFeeLow: nursing.low,
    civilNursingFeeMid: nursing.mid,
    civilNursingFeeHigh: nursing.high,
    civilTransportationFee: medicalReceipts.transportationFee,
    workLoss: workLoss.amount,
    workLossEvidenceStrength: workLoss.evidenceStrength,
    workLossExtended: {
      amount: workLossExtended.amount,
      calculationType: workLossExtended.calculationType,
      isRetired:
        workLossExtended.calculationType === 'long_term' && workLossExtended.hoffmannYears === 0,
      hoffmannYears: workLossExtended.hoffmannYears,
      hoffmannFactor: workLossExtended.hoffmannFactor,
      restMonths: workLossExtended.restMonths,
      restYears: workLossExtended.restYears,
      annualIncome: workLossExtended.annualIncome,
      regionalMultiplier: workLossExtended.regionalMultiplier,
      breakdown: workLossExtended.breakdown,
      evidenceStrength: workLossExtended.evidenceStrength,
      notes: workLossExtended.notes,
      hint: workLossExtended.hint,
    },
    laborCapacityLossEstimate: labor.estimate,
    laborCapacityLossHint: labor.hint,
    laborCapacityRetirementAge: labor.retirementAge,
    laborCapacityLossNotes: labor.notes,

    painAndSuffering: pas,

    painML: {
      lower: painML.lower,
      mid: painML.mid,
      upper: painML.upper,
      p10: painML.p10,
      p50: painML.p50,
      p90: painML.p90,
      confidence: painML.confidence,
      method: painML.method,
      severityLevel: painML.severityLevel,
      severityLabel: painML.severityLabel,
      anchorCases: painML.anchorCases,
      reconcile: {
        status: painReconcile.status,
        divergence: painReconcile.divergence,
        warning: painReconcile.warning,
      },
    },

    painEnsemble: {
      consensus: painEnsemble.consensus,
      consensusAmount: painEnsemble.consensusAmount,
      suggestedRange: painEnsemble.suggestedRange,
      outlier: painEnsemble.outlier,
      rulesAmount: painEnsemble.rulesAmount,
      mlAmount: painEnsemble.mlAmount,
      knnAmount: painEnsemble.knnAmount,
      rulesWeight: painEnsemble.rulesWeight,
      mlWeight: painEnsemble.mlWeight,
      knnWeight: painEnsemble.knnWeight,
      warning: painEnsemble.warning,
    },

    painAdvisor: {
      riskLevel: painAdvisor.riskLevel,
      riskFactors: painAdvisor.riskFactors,
      recommendations: painAdvisor.recommendations,
      consensusInterpretation: painAdvisor.consensusInterpretation,
      requiresHumanReview: painAdvisor.requiresHumanReview,
      promptTokens: painAdvisor.promptTokens,
      completionTokens: painAdvisor.completionTokens,
      disclaimer: painAdvisor.disclaimer,
    },

    scarRevision: {
      amount: scarRevision.amount,
      estimateLow: scarRevision.range.low,
      estimate: scarRevision.amount,
      estimateHigh: scarRevision.range.high,
      range: scarRevision.range,
      procedure: scarRevision.procedure,
      totalSessions: scarRevision.breakdown.sessions,
      primaryProcedure: scarRevision.procedure,
      regionalMultiplier: scarRevision.regionalMultiplier,
      breakdown: scarRevision.breakdown,
      precedents: scarRevision.precedents,
      notes: scarRevision.notes,
      hint: scarRevision.hint,
    },

    vehicleDamage,
    propertyDamage,

    thirdParty,

    missingDocuments: evidence.missingDocuments,
    riskNotes: evidence.riskNotes,

    region: {
      courtName,
      accidentCity: basics.accidentCity,
      courtJurisdiction: courtName,
      painAndSufferingMultiplier: region.painAndSufferingMultiplier,
      nursingDailyRateLow: region.nursingDailyRateLow,
      nursingDailyRateMid: region.nursingDailyRateMid,
      nursingDailyRateHigh: region.nursingDailyRateHigh,
      workLossEvidenceStrictness: region.workLossEvidenceStrictness,
      vehicleDepreciationStrictness: region.vehicleDepreciationStrictness,
      regionNotes: region.notes,
      confidenceLevel: region.confidenceLevel,
    },
  }

  // v0.26.0e+：AGENTS §1 鐵律 ④「未受傷 → 精神慰撫金 = 0」，靠 cascade 自然處理
  // 醫療 / 看護 / 失能相關欄位強制歸 0；精神慰撫金因為依賴 medical severity，
  // 上面 cascaded 成 0 後這裡也 = 0；不需顯式覆寫 painAndSuffering
  // 車損 / 第三人責任險 / region 不變（跟「受傷與否」無關）
  // 註：同上 === false 嚴格判定
  if (basics.isInjured === false) {
    return {
      ...result,
      compulsoryItems: result.compulsoryItems.map((item) => ({
        ...item,
        applied: 0,
        approved: 0,
        reductionReason: '未受傷',
        supplementHint: null,
      })),
      compulsoryMedicalSubtotal: 0,
      compulsoryMedicalApproved: 0,
      compulsoryDisabilityAmount: 0,
      compulsoryTotalEstimated: 0,
      // 失能初篩：未受傷 → null
      disability: {
        ...result.disability,
        possibleLevel: null,
        possibleAmount: 0,
        signals: [],
      },
      // 民事醫療 / 看護 / 接送：全 0
      civilMedicalExpense: 0,
      civilNursingFeeLow: 0,
      civilNursingFeeMid: 0,
      civilNursingFeeHigh: 0,
      civilTransportationFee: 0,
      // 工作損失：歸 0
      workLoss: 0,
      workLossExtended: {
        ...result.workLossExtended,
        amount: 0,
        calculationType: 'none',
      },
      laborCapacityLossEstimate: 0,
      laborCapacityLossHint: '未受傷，無勞動能力減損',
      // 精神慰撫金：基於 AGENTS §1 鐵律 ④ 顯式歸 0（base floor 不會因 medical=0 而歸 0）
      // painML / painEnsemble / painAdvisor 跟著歸 0
      painAndSuffering: {
        ...result.painAndSuffering,
        baseLow: 0,
        baseMid: 0,
        baseHigh: 0,
        regionalLow: 0,
        regionalMid: 0,
        regionalHigh: 0,
        adjustedLow: 0,
        adjustedMid: 0,
        adjustedHigh: 0,
      },
      painML: {
        ...result.painML,
        lower: 0,
        mid: 0,
        upper: 0,
        p10: 0,
        p50: 0,
        p90: 0,
      },
      painEnsemble: {
        ...result.painEnsemble,
        consensusAmount: 0,
        rulesAmount: 0,
        mlAmount: 0,
        knnAmount: 0,
        suggestedRange: { low: 0, high: 0 },
      },
      // scarRevision 跟除疤相關，未受傷時也是 0
      scarRevision: {
        ...result.scarRevision,
        amount: 0,
        estimate: 0,
        estimateLow: 0,
        estimateHigh: 0,
        range: { low: 0, mid: 0, high: 0 },
      },
    }
  }

  return result
}

export * from './types'
export * from './compulsory'
export * from './disability'
export * from './civil-damages'
export * from './work-loss-extended'
export * from './scar-revision'
export * from './third-party'
export * from './evidence'
export * from './pain-ml'
export * from './pain-ensemble'
export * from './pain-advisor'
