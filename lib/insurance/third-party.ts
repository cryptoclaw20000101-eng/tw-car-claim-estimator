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
 * 車輛折舊率計算（v0.24.2+ 統一用平均法 / 直線法）
 *
 * 採用台灣保險業通用「平均折舊法（straight-line）」：
 * - 每年折舊金額固定（折舊年限分成等額）
 * - 公式：折舊後價值 = 市場價 - (市場價 / 折舊年限) × 使用年數
 * - 折舊率 = 使用年數 / 折舊年限（最多 100%）
 * - 例：折舊年限 5 年、車價 50 萬 → 每年折 10 萬，第 3 年折 30 萬 = 60%
 *
 * v0.24.0a 線性累進（汽車/機車分開不同比例）→ v0.24.2+ 統一改成平均法
 *
 * 來源：強制汽車責任保險理賠實務 + 保發中心車輛折舊參考表
 * 預設折舊年限 5 年（台灣強制險汽車實務；機車實務 3 年）
 *
 * @param yearsOld 已使用年數（事故年 - 出廠年，可為 0）
 * @param depreciationYears 完整折舊年限（預設 5 年；範圍 3 ~ 10）
 * @returns 折舊率（0.0 ~ 1.0）
 */
export function computeVehicleDepreciationRate(
  yearsOld: number,
  depreciationYears: number = 5,
): number {
  if (yearsOld <= 0) return 0
  if (!Number.isFinite(depreciationYears) || depreciationYears <= 0) return 0
  const safeYears = Math.min(Math.max(depreciationYears, 3), 10)
  return Math.min(yearsOld / safeYears, 1)
}

/**
 * 折舊後車輛價值（v0.24.0+）
 *
 * 若有 vehicleManufactureYear + vehicleDepreciationYears 欄位 → 用平均法計算
 * 否則 → 直接用 vehicleMarketValueBeforeAccident（向後相容）
 */
export function computeDepreciatedVehicleValue(
  marketValueBeforeAccident: number,
  manufactureYear: number | null | undefined,
  depreciationYears: number | null | undefined,
  accidentYear: number,
): { value: number; depreciationRate: number; yearsOld: number; depreciationYears: number } {
  if (manufactureYear == null || depreciationYears == null || !Number.isFinite(manufactureYear)) {
    // 沒資料 → 不折舊
    return {
      value: marketValueBeforeAccident,
      depreciationRate: 0,
      yearsOld: 0,
      depreciationYears: 0,
    }
  }
  const yearsOld = Math.max(0, accidentYear - manufactureYear)
  const years = depreciationYears ?? 5
  const depreciationRate = computeVehicleDepreciationRate(yearsOld, years)
  const value = Math.round(marketValueBeforeAccident * (1 - depreciationRate))
  return { value, depreciationRate, yearsOld, depreciationYears: years }
}

export function computeVehicleDamage(input: PropertyDamageInputs): number {
  const repairCost = input.vehicleRepairInvoice || input.vehicleRepairEstimate
  if (repairCost === 0) return 0
  const accidentYear = new Date().getFullYear()
  // v0.24.2+：折舊計算（若有出廠年 + 折舊年限，採用平均法 / 直線折舊）
  const depreciated = computeDepreciatedVehicleValue(
    input.vehicleMarketValueBeforeAccident,
    input.vehicleManufactureYear,
    input.vehicleDepreciationYears,
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
