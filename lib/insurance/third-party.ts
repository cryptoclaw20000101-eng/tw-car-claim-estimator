// =====================================================================
// 第三人責任險估算
// 公式（spec §八 6）：
//   民事損害總額 = 醫療差額 + 看護費 + 交通 + 工作損失 + 勞減 + 慰撫金 + 車損 + 財損
//   對方依法應賠 = 民事總額 × 對方肇責比例 / 100
//   第三人險可賠 = max(對方應賠 - 強制險已估, 0)
//   最終估算 = 第三人險可賠  （v0.5.2: 無保額上限）
// =====================================================================

import type {
  PropertyDamageInputs,
  AccidentBasics,
  ThirdPartyEstimate,
  PainAndSufferingResult,
} from './types'
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
  const nursing = c.civilNursingFeeLow // 中性取 low 入體傷（保守）
  return {
    medical: c.civilMedicalExpense,
    nursing:
      pas === 'High' ? c.civilNursingFeeHigh : pas === 'Mid' ? c.civilNursingFeeMid : nursing,
    transportation: c.civilTransportationFee,
    workLoss: c.workLoss,
    laborCapacity: c.laborCapacityLossEstimate,
    pas:
      pas === 'High'
        ? c.painAndSuffering.regionalHigh
        : pas === 'Mid'
          ? c.painAndSuffering.regionalMid
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
  const { civil, otherFaultRatio } = input
  // v0.5.2: compulsoryTotalApproved 已隱含在 civilDamage 裡（caller 已扣過），不再使用
  void input.compulsoryTotalApproved
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

  // 第三人險可賠 = 對方依法應賠（CivilDamageInput 已是差額，已扣過 compulsory）
  // v0.5.2: 拿掉保額上限，民事差額全由第三人險吸收；不再二次扣 compulsory（Bug A）
  const thirdPartyEstimateLow = liableAmountLow
  const thirdPartyEstimateMid = liableAmountMid
  const thirdPartyEstimateHigh = liableAmountHigh

  const finalLow = thirdPartyEstimateLow
  const finalMid = thirdPartyEstimateMid
  const finalHigh = thirdPartyEstimateHigh

  const notes: string[] = []
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
    notes,
  }
}

// --- 車損計算（spec §六 Step 6） -------------------------------------

/**
 * 車輛折舊率計算（v0.24.0+ 新增）
 *
 * 採用台灣保險業通用線性累進公式：
 * - 汽車：第一年折舊 10%，之後每年 +10%（最高 70%）
 * - 機車：第一年折舊 18%，之後每年 +10%（最高 70%）
 *
 * 來源：強制汽車責任保險理賠實務 + 保發中心車輛折舊參考表
 *
 * @param yearsOld 已使用年數（事故年 - 出廠年，可為 0）
 * @param category 'car' | 'motorcycle'
 * @returns 折舊率（0.0 ~ 0.7）
 */
export function computeVehicleDepreciationRate(
  yearsOld: number,
  category: 'car' | 'motorcycle',
): number {
  if (yearsOld <= 0) return 0
  const firstYearDepreciation = category === 'motorcycle' ? 0.18 : 0.1
  const subsequentAnnual = 0.1
  const cap = 0.7
  const rate = firstYearDepreciation + (yearsOld - 1) * subsequentAnnual
  return Math.min(rate, cap)
}

/**
 * 折舊後車輛價值（v0.24.0+）
 *
 * 若有 vehicleManufactureYear + vehicleCategory 欄位 → 用折舊公式計算
 * 否則 → 直接用 vehicleMarketValueBeforeAccident（向後相容）
 */
export function computeDepreciatedVehicleValue(
  marketValueBeforeAccident: number,
  manufactureYear: number | null | undefined,
  category: 'car' | 'motorcycle' | null | undefined,
  accidentYear: number,
): { value: number; depreciationRate: number; yearsOld: number } {
  if (manufactureYear == null || category == null || !Number.isFinite(manufactureYear)) {
    // 沒資料 → 不折舊
    return { value: marketValueBeforeAccident, depreciationRate: 0, yearsOld: 0 }
  }
  const yearsOld = Math.max(0, accidentYear - manufactureYear)
  const depreciationRate = computeVehicleDepreciationRate(yearsOld, category)
  const value = Math.round(marketValueBeforeAccident * (1 - depreciationRate))
  return { value, depreciationRate, yearsOld }
}

export function computeVehicleDamage(input: PropertyDamageInputs): number {
  const repairCost = input.vehicleRepairInvoice || input.vehicleRepairEstimate
  if (repairCost === 0) return 0
  const accidentYear = new Date().getFullYear()
  // v0.24.0+：折舊計算（若有出廠年 + 車輛種類）
  const depreciated = computeDepreciatedVehicleValue(
    input.vehicleMarketValueBeforeAccident,
    input.vehicleManufactureYear,
    input.vehicleCategory,
    accidentYear,
  )
  const maxByMarket = depreciated.value - input.salvageValue
  if (maxByMarket <= 0) return 0
  return Math.min(repairCost, maxByMarket)
}

export function computePropertyDamage(input: PropertyDamageInputs): number {
  return (
    input.towingFee +
    input.rentalCarFee +
    input.phoneDamage +
    input.helmetDamage +
    input.clothingDamage +
    input.glassesDamage +
    input.otherPropertyDamage
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
