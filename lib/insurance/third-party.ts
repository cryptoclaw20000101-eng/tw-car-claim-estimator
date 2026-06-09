// =====================================================================
// 第三人責任險估算
// 公式（spec §八 6）：
//   民事損害總額 = 醫療差額 + 看護費 + 交通 + 工作損失 + 勞減 + 慰撫金 + 車損 + 財損
//   對方依法應賠 = 民事總額 × 對方肇責比例 / 100
//   第三人險可賠 = max(對方應賠 - 強制險已估, 0)
//   最終估算 = min(第三人險可賠, 體傷保額 + 財損保額 + 超額保額)
//
// 體傷/財損分上限（保額分離）
// =====================================================================

import type { PropertyDamageInputs, AccidentBasics, ThirdPartyEstimate, PainAndSufferingResult } from './types'
import { getRegionAdjustment } from './region-adjustments'

export interface CivilDamageInput {
  civilMedicalExpense: number
  civilNursingFeeLow: number
  civilNursingFeeMid: number
  civilNursingFeeHigh: number
  civilTransportationFee: number
  workLoss: number
  laborCapacityLossEstimate: number
  painAndSuffering: PainAndSufferingResult
  vehicleDamage: number
  propertyDamage: number
}

export interface ThirdPartyInput {
  basics: AccidentBasics
  civil: CivilDamageInput
  compulsoryTotalApproved: number
  otherFaultRatio: number
}

// --- 體傷 / 財損 分項打包 --------------------------------------------

function packBodilyCivil(c: CivilDamageInput, pas: 'Low' | 'Mid' | 'High') {
  const nursing = c.civilNursingFeeLow  // 中性取 low 入體傷（保守）
  return {
    medical: c.civilMedicalExpense,
    nursing: pas === 'High' ? c.civilNursingFeeHigh : pas === 'Mid' ? c.civilNursingFeeMid : nursing,
    transportation: c.civilTransportationFee,
    workLoss: c.workLoss,
    laborCapacity: c.laborCapacityLossEstimate,
    pas: pas === 'High' ? c.painAndSuffering.regionalHigh
       : pas === 'Mid' ? c.painAndSuffering.regionalMid
       : c.painAndSuffering.regionalLow,
  }
}

function packPropertyCivil(c: CivilDamageInput) {
  return {
    vehicle: c.vehicleDamage,
    property: c.propertyDamage,
  }
}

function sumBodily(c: ReturnType<typeof packBodilyCivil>): number {
  return c.medical + c.nursing + c.transportation + c.workLoss + c.laborCapacity + c.pas
}

function sumProperty(c: ReturnType<typeof packPropertyCivil>): number {
  return c.vehicle + c.property
}

// --- 主計算 ------------------------------------------------------------

export function computeThirdParty(input: ThirdPartyInput): ThirdPartyEstimate {
  const { basics, civil, compulsoryTotalApproved, otherFaultRatio } = input
  const ratio = otherFaultRatio / 100

  const bodilyLow = packBodilyCivil(civil, 'Low')
  const bodilyMid = packBodilyCivil(civil, 'Mid')
  const bodilyHigh = packBodilyCivil(civil, 'High')
  const property = packPropertyCivil(civil)

  const bodilyTotalLow = sumBodily(bodilyLow)
  const bodilyTotalMid = sumBodily(bodilyMid)
  const bodilyTotalHigh = sumBodily(bodilyHigh)
  const propertyTotal = sumProperty(property)

  const civilDamageTotalLow = bodilyTotalLow + propertyTotal
  const civilDamageTotalMid = bodilyTotalMid + propertyTotal
  const civilDamageTotalHigh = bodilyTotalHigh + propertyTotal

  // 對方依法應賠
  const liableAmountLow = Math.round(civilDamageTotalLow * ratio)
  const liableAmountMid = Math.round(civilDamageTotalMid * ratio)
  const liableAmountHigh = Math.round(civilDamageTotalHigh * ratio)

  // 第三人險可賠 = 對方應賠 - 強制險已估
  const thirdPartyEstimateLow = Math.max(liableAmountLow - compulsoryTotalApproved, 0)
  const thirdPartyEstimateMid = Math.max(liableAmountMid - compulsoryTotalApproved, 0)
  const thirdPartyEstimateHigh = Math.max(liableAmountHigh - compulsoryTotalApproved, 0)

  // 保額限制（體傷 + 財損 + 超額）
  const totalCap = basics.thirdPartyBodilyLimit + basics.thirdPartyPropertyLimit + basics.excessLiabilityLimit

  // 體傷 vs 財損的實際用量
  // 第三人險體傷保額優先用於體傷，財損保額優先用於財損，超額兩者共用
  const bodilyCapLimit = basics.thirdPartyBodilyLimit
  const propertyCapLimit = basics.thirdPartyPropertyLimit

  // 體傷被保額限制後
  // 注意：CivilDamageInput 已是「民事差額」（已扣過強制險核准），
  // 所以 bodilyPay = min(bodilyLiable, bodilyCapLimit) 不再二次扣 compulsory
  const bodilyLiableLow = Math.round(bodilyTotalLow * ratio)
  const bodilyLiableMid = Math.round(bodilyTotalMid * ratio)
  const bodilyLiableHigh = Math.round(bodilyTotalHigh * ratio)
  const propertyLiable = Math.round(propertyTotal * ratio)

  const bodilyPayLow = Math.max(Math.min(bodilyLiableLow, bodilyCapLimit), 0)
  const bodilyPayMid = Math.max(Math.min(bodilyLiableMid, bodilyCapLimit), 0)
  const bodilyPayHigh = Math.max(Math.min(bodilyLiableHigh, bodilyCapLimit), 0)

  const propertyPay = Math.max(Math.min(propertyLiable, propertyCapLimit), 0)

  // 第三人險體傷實際可賠
  const bodilyFinalLow = Math.min(bodilyPayLow, bodilyCapLimit)
  const bodilyFinalMid = Math.min(bodilyPayMid, bodilyCapLimit)
  const bodilyFinalHigh = Math.min(bodilyPayHigh, bodilyCapLimit)

  // 第三人險財損實際可賠
  const propertyFinal = Math.min(propertyPay, propertyCapLimit)

  // 最終 = 體傷實際 + 財損實際
  const finalLow = bodilyFinalLow + propertyFinal
  const finalMid = bodilyFinalMid + propertyFinal
  const finalHigh = bodilyFinalHigh + propertyFinal

  // 檢查是否撞上限
  const usedBodilyCap = bodilyFinalLow >= bodilyCapLimit || bodilyFinalMid >= bodilyCapLimit || bodilyFinalHigh >= bodilyCapLimit
  const usedPropertyCap = propertyFinal >= propertyCapLimit

  const notes: string[] = []
  if (!basics.hasThirdPartyInsurance) {
    notes.push('未投保第三人責任險，本估算僅供民事和解參考')
  }
  if (totalCap === 0 && basics.hasThirdPartyInsurance) {
    notes.push('第三人責任險保額未填，請補體傷/財損/超額保額')
  }
  if (otherFaultRatio === 0) {
    notes.push('對方肇責比例為 0，第三人責任險不會理賠')
  }
  if (otherFaultRatio < 100) {
    notes.push(`對方肇責 ${otherFaultRatio}%，第三人險僅理賠該比例`)
  }

  return {
    civilDamageTotalLow,
    civilDamageTotalMid,
    civilDamageTotalHigh,
    liableAmountLow,
    liableAmountMid,
    liableAmountHigh,
    thirdPartyEstimateLow: finalLow,
    thirdPartyEstimateMid: finalMid,
    thirdPartyEstimateHigh: finalHigh,
    bodilyCap: bodilyCapLimit,
    propertyCap: propertyCapLimit,
    usedBodilyCap,
    usedPropertyCap,
    notes,
  }
}

// --- 車損計算（spec §六 Step 6） -------------------------------------

export function computeVehicleDamage(input: PropertyDamageInputs): number {
  const repairCost = input.vehicleRepairInvoice || input.vehicleRepairEstimate
  if (repairCost === 0) return 0
  const maxByMarket = input.vehicleMarketValueBeforeAccident - input.salvageValue
  if (maxByMarket <= 0) return 0
  return Math.min(repairCost, maxByMarket)
}

export function computePropertyDamage(input: PropertyDamageInputs): number {
  return (
    input.towingFee
    + input.rentalCarFee
    + input.phoneDamage
    + input.helmetDamage
    + input.clothingDamage
    + input.glassesDamage
    + input.otherPropertyDamage
  )
}

// 輔助：取得地區車損折舊嚴格度提示
export function getVehicleDepreciationHint(courtName: string): string {
  const r = getRegionAdjustment(courtName)
  switch (r.vehicleDepreciationStrictness) {
    case 'high':
      return `${r.courtName} 對車損修復費、零件折舊、事故前車價與殘值爭議可能較明顯，建議補估價單、發票、照片、行情資料。`
    case 'medium':
      return '建議補估價單、修車發票、車損照片與事故前車價資料。'
    case 'low':
      return '仍需修車證明與車損照片。'
  }
}
