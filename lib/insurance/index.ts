// =====================================================================
// 統一對外 API：estimateClaim(input)
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

type PainDamages = {
  painAndSuffering?: number
}

type PracticeCaseWithPainTarget = ReturnType<typeof findRelatedPracticeCases>[number] & {
  damages?: PainDamages
}

type CompulsoryAllocation = {
  medical: number
  transportation: number
  nursing: number
}

/**
 * 將強制險傷害醫療總認列額拆回「一般醫療／接送／看護」三個民事損害桶。
 *
 * 目的不是宣稱保險公司有法定分配順位，而是避免本工具在民事端把同一筆
 * 看護／接送費同時計入「醫療差額」與獨立項目造成重複計算。
 *
 * 若細項認列 subtotal 超過傷害醫療總額上限，按細項認列額比例縮放；
 * 最後把 rounding remainder 留在一般醫療桶，確保三桶加總精確等於 approved。
 */
function allocateCompulsoryMedicalDeduction(
  compulsory: ReturnType<typeof computeCompulsoryMedicalByDate>,
  hasCompulsoryInsurance: boolean,
): CompulsoryAllocation {
  if (!hasCompulsoryInsurance || compulsory.approved <= 0 || compulsory.subtotal <= 0) {
    return { medical: 0, transportation: 0, nursing: 0 }
  }

  const scale = compulsory.approved / compulsory.subtotal
  const transportationItem = compulsory.items.find((item) => item.key === 'transportationFee')
  const nursingItem = compulsory.items.find((item) => item.key === 'nursingFee')

  const transportation = Math.min(
    Math.round((transportationItem?.approved ?? 0) * scale),
    compulsory.approved,
  )
  const nursing = Math.min(
    Math.round((nursingItem?.approved ?? 0) * scale),
    Math.max(compulsory.approved - transportation, 0),
  )
  const medical = Math.max(compulsory.approved - transportation - nursing, 0)

  return { medical, transportation, nursing }
}

export function estimateClaim(input: ClaimInput): EstimationResult {
  const { basics, fault, person, property } = input
  let { medical, medicalReceipts } = input

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

  // 1) 強制險醫療（依事故日切換新舊法）
  const compulsory = computeCompulsoryMedicalByDate(medicalReceipts, basics.accidentDate)

  // 2) 失能初篩
  const disability = computeDisability(medical, basics.accidentDate)

  // 3) 法院判定
  const courtName = basics.courtJurisdiction || lookupCourt(basics.accidentCity)
  const region = getRegionAdjustment(courtName)

  // 4) 民事醫療差額
  // 看護費與接送費在民事端有獨立項目，因此不能再次塞進「醫療差額」。
  const baseMedicalReceipts =
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
    (medicalReceipts.specialMaterialFee ?? 0) +
    medicalReceipts.assistiveDeviceFee

  const compulsoryAllocation = allocateCompulsoryMedicalDeduction(
    compulsory,
    basics.hasCompulsoryInsurance,
  )

  const compulsoryMedicalDeduction = basics.hasCompulsoryInsurance ? compulsory.approved : 0
  const civilMedicalExpense = computeCivilMedicalExpense(
    baseMedicalReceipts,
    compulsoryAllocation.medical,
  )

  // 5) 看護費
  // 先算民事合理行情 gross，再扣本次強制險總上限分配到看護的部分。
  // 將 nursingFee 暫設 0，可沿用 computeCivilNursingFee 的地區日額與醫囑日數邏輯，
  // 同時避免該 helper 再自行扣一次強制險看護費。
  const nursingGross = computeCivilNursingFee(
    { ...medicalReceipts, nursingFee: 0 },
    medical,
    courtName,
  )
  const nursing = {
    low: Math.max(nursingGross.low - compulsoryAllocation.nursing, 0),
    mid: Math.max(nursingGross.mid - compulsoryAllocation.nursing, 0),
    high: Math.max(nursingGross.high - compulsoryAllocation.nursing, 0),
  }

  // 接送費同樣只保留強制險扣抵後的民事差額。
  const civilTransportationFee = Math.max(
    medicalReceipts.transportationFee - compulsoryAllocation.transportation,
    0,
  )

  // 6) 精神慰撫金規則引擎
  const pas = computePainAndSuffering(medical, courtName)
  const painML = predictPainRange({
    medical,
    courtName,
    rulesRegionalMid: pas.regionalMid,
  })
  const painReconcile = reconcileWithRules(painML, pas.regionalMid)

  // 7) 工作損失
  const workLoss = computeWorkLoss(person, courtName)
  const workLossExtended = computeWorkLossExtended({
    person,
    courtName,
    isSymptomFixed: medical.isSymptomFixed,
  })

  // 8) 勞動能力減損
  // 明確失能診斷書等級優先；否則才採規則引擎的 ROM 初篩結果。
  const documentedLevel =
    medical.hasDisabilityCertificate &&
    Number.isInteger(Number(medical.disabilityLevel)) &&
    Number(medical.disabilityLevel) >= 1 &&
    Number(medical.disabilityLevel) <= 15
      ? Number(medical.disabilityLevel)
      : null
  const rawLevel: number | null = documentedLevel ?? disability.possibleLevel ?? null
  const finalDisabilityLevel:
    1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | null =
    rawLevel !== null && rawLevel >= 1 && rawLevel <= 15
      ? (rawLevel as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15)
      : null

  // 6c) 精神慰撫金 Ensemble
  // legal-audit：只有案例資料明確拆出 damages.painAndSuffering 才能當 KNN target。
  // civilSettlement / totalInsurerPayout 不再當精神慰撫金 label。
  const practiceCases = findRelatedPracticeCases(courtName, finalDisabilityLevel, 3)
  const knnCases: Array<{
    caseNo: string
    amount: number
    targetKind: 'pain_and_suffering'
  }> = []
  for (const rawCase of practiceCases) {
    const c = rawCase as PracticeCaseWithPainTarget
    const amount = Number(c.damages?.painAndSuffering ?? 0)
    if (Number.isFinite(amount) && amount > 0) {
      knnCases.push({
        caseNo: c.caseNo,
        amount,
        targetKind: 'pain_and_suffering',
      })
    }
  }

  const painEnsemble = ensembleEstimate({
    rulesMid: pas.regionalMid,
    mlP50: painML.p50,
    knnCases,
    knnAvailable: knnCases.length > 0,
    mlConfidence: painML.confidence,
  })

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

  // 8b) 除疤／修疤費用
  const scarRevision = computeScarRevisionCost({
    medical,
    courtName,
    procedure: (medical.scarProcedure as ScarProcedure) ?? 'laser',
    prescribedSessions: medical.prescribedSessions,
    isKeloid: medical.isKeloid ?? medical.scarSeverity === 'keloid',
  })

  // 9) 車損財損
  // legal-audit：固定使用事故年份，避免同一案件隔年重算車齡改變。
  const vehicleDamage = computeVehicleDamage(property, basics.accidentDate)
  const propertyDamage = computePropertyDamage(property)

  // 10) 調解／法院責任計算
  const inferredMode =
    basics.calculationMode ??
    (fault.faultSource === 'court_judgment' ? 'litigation' : 'mediation')

  const thirdParty = computeThirdParty({
    basics: {
      ...basics,
      calculationMode: inferredMode,
    },
    civil: {
      civilMedicalExpense,
      civilNursingFeeLow: nursing.low,
      civilNursingFeeMid: nursing.mid,
      civilNursingFeeHigh: nursing.high,
      civilTransportationFee,
      workLoss: workLoss.amount,
      laborCapacityLossEstimate: labor.estimate,
      painAndSuffering: pas,
      vehicleDamage,
      propertyDamage,
    },
    compulsoryTotalApproved: compulsoryMedicalDeduction,
    otherFaultRatio: fault.otherFaultRatio,
  })

  // 11) 補件與風險
  const evidence = generateEvidence(input, disability, workLoss, pas)

  // 12) 強制險總額
  const compulsoryTotalEstimated = basics.hasCompulsoryInsurance
    ? compulsory.approved + disability.possibleAmount
    : 0

  const result: EstimationResult = {
    compulsoryItems: compulsory.items,
    compulsoryMedicalSubtotal: compulsory.subtotal,
    compulsoryMedicalApproved: basics.hasCompulsoryInsurance ? compulsory.approved : 0,
    compulsoryDisabilityAmount: basics.hasCompulsoryInsurance ? disability.possibleAmount : 0,
    compulsoryDeathAmount: 0,
    compulsoryTotalEstimated,

    disability,

    civilMedicalExpense,
    civilNursingFeeLow: nursing.low,
    civilNursingFeeMid: nursing.mid,
    civilNursingFeeHigh: nursing.high,
    civilTransportationFee,
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
      disability: {
        ...result.disability,
        possibleLevel: null,
        possibleAmount: 0,
        signals: [],
      },
      civilMedicalExpense: 0,
      civilNursingFeeLow: 0,
      civilNursingFeeMid: 0,
      civilNursingFeeHigh: 0,
      civilTransportationFee: 0,
      workLoss: 0,
      workLossExtended: {
        ...result.workLossExtended,
        amount: 0,
        calculationType: 'none',
      },
      laborCapacityLossEstimate: 0,
      laborCapacityLossHint: '未受傷，無勞動能力減損',
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
