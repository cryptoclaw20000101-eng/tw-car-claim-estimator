// =====================================================================
// 統一對外 API：estimateClaim(input)
// 把表單輸入一次餵進所有計算引擎，回傳完整 EstimationResult
// =====================================================================

import type { ClaimInput, EstimationResult } from './types'
import { computeCompulsoryMedical } from './compulsory'
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
import {
  computeThirdParty,
  computeVehicleDamage,
  computePropertyDamage,
} from './third-party'
import { generateEvidence } from './evidence'
import { lookupCourt } from './region-court-map'
import { getRegionAdjustment } from './region-adjustments'

export function estimateClaim(input: ClaimInput): EstimationResult {
  const { basics, fault, person, medical, medicalReceipts, property } = input

  // 1) 強制險醫療
  const compulsory = computeCompulsoryMedical(medicalReceipts)

  // 2) 失能初篩
  const disability = computeDisability(medical, basics.accidentDate)

  // 3) 法院判定（自動 + 可手改）
  const courtName = basics.courtJurisdiction || lookupCourt(basics.accidentCity)
  const region = getRegionAdjustment(courtName)

  // 4) 民事醫療差額
  const totalMedicalReceipts =
    medicalReceipts.emergencyFee
    + medicalReceipts.ambulanceFee
    + medicalReceipts.nhiCopayment
    + medicalReceipts.registrationFee
    + medicalReceipts.diagnosisCertificateFee
    + medicalReceipts.nonNhiNecessaryMedicalFee
    + medicalReceipts.wardFeeDifference
    + medicalReceipts.mealFee
    + medicalReceipts.prosthesisFee
    + medicalReceipts.dentureFee
    + medicalReceipts.artificialEyeFee
    + medicalReceipts.medicalMaterialFee
    + medicalReceipts.assistiveDeviceFee
    + medicalReceipts.transportationFee
    + medicalReceipts.nursingFee
    + medicalReceipts.otherNecessaryMedicalFee

  const civilMedicalExpense = computeCivilMedicalExpense(totalMedicalReceipts, compulsory.approved)

  // 5) 看護費
  const nursing = computeCivilNursingFee(medicalReceipts, medical, courtName)

  // 6) 精神慰撫金
  const pas = computePainAndSuffering(medical, courtName)

  // 7) 工作損失
  const workLoss = computeWorkLoss(person, courtName)

  // 7b) 工作損失（擴充版：短期 / 長期 / 退休分流）
  // 與 7) 並行：使用者看完整版明細，短期版作主估算
  const workLossExtended = computeWorkLossExtended({
    person,
    courtName,
  })

  // 8) 勞動能力減損
  // 失能等級優先順序：手填 disabilityLevel > 自動推算 possibleLevel > null
  // （失能保典 12 大類下拉選單會自動帶出常見等級 → 表單可直接覆蓋）
  // 型別收斂：number → 1-15 literal union（執行期已在 form 驗證）
  const rawLevel: number | null =
    medical.disabilityLevel ?? disability.possibleLevel ?? null
  const finalDisabilityLevel: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | null =
    rawLevel !== null && rawLevel >= 1 && rawLevel <= 15
      ? (rawLevel as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15)
      : null
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

  return {
    compulsoryItems: compulsory.items,
    compulsoryMedicalSubtotal: compulsory.subtotal,
    compulsoryMedicalApproved: compulsory.approved,
    compulsoryDisabilityAmount: disability.possibleAmount,
    compulsoryDeathAmount: 0,  // MVP 不處理死亡
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
      isRetired: workLossExtended.calculationType === 'long_term' && workLossExtended.hoffmannYears === 0,
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
}

export * from './types'
export * from './compulsory'
export * from './disability'
export * from './civil-damages'
export * from './work-loss-extended'
export * from './scar-revision'
export * from './third-party'
export * from './evidence'
