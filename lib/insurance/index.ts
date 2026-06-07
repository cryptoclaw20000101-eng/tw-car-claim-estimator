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

  // 8) 勞動能力減損
  const labor = computeLaborCapacityLoss(medical)

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
    laborCapacityLossEstimate: labor.estimate,
    laborCapacityLossHint: labor.hint,

    painAndSuffering: pas,

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
export * from './third-party'
export * from './evidence'
