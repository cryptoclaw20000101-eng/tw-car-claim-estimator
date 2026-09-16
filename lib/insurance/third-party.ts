// =====================================================================
// 第三人責任／民事責任估算
//
// 2026 legal-audit：明確區分兩種實務試算情境
//   1) mediation（調解／和解）：先扣強制險，再乘對方肇責
//   2) litigation（法院裁判）：先過失相抵，再扣實際已領強制險
//
// 注意：
// - 強制險只處理人身，不得拿去扣車損／其他財損。
// - liableAmount = 過失相抵後、強制險扣抵前的「責任基準」。
// - thirdPartyEstimate = 依所選模式完成強制險扣抵後，再套保額所得的估算。
// - 第三人責任險的「保險可負擔額」受體傷、財損與超額保額限制。
// - 舊案件沒有 coverage 欄位時維持向後相容，但會明確標示為「責任金額參考」，
//   不宣稱保險公司一定會全額負擔。
// =====================================================================

import type {
  PropertyDamageInputs,
  AccidentBasics,
  ThirdPartyEstimate,
  PainAndSufferingResult,
} from './types'
import { getRegionAdjustment } from './region-adjustments'

export type ClaimCalculationMode = 'mediation' | 'litigation'
export type ThirdPartyCoverageStatus = 'unknown' | 'yes' | 'no'

type LegalAuditBasics = AccidentBasics & {
  /** 調解／法院兩套扣抵順序；舊資料未提供時預設 mediation */
  calculationMode?: ClaimCalculationMode
  /** 已實際領取、在本案欲扣抵的強制險給付；法院模式只扣實際已領金額 */
  compulsoryActuallyPaid?: number
  /** 第三人責任險狀態；unknown 代表尚未取得保單資料 */
  thirdPartyCoverageStatus?: ThirdPartyCoverageStatus
  /** 第三人責任險每人體傷限額 */
  thirdPartyBodilyLimit?: number
  /** 第三人責任險財損限額 */
  thirdPartyPropertyLimit?: number
  /** 超額責任險可用限額（本工具採合併剩餘責任簡化試算） */
  excessLiabilityLimit?: number
}

export interface CivilDamageInput {
  /** 已扣除強制險醫療認列額的醫療差額 */
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
  /** caller 目前傳入強制險「傷害醫療」預估認列額，用來還原未扣抵前的人身損害 */
  compulsoryTotalApproved: number
  otherFaultRatio: number
}

function nonNegative(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function resolveMode(basics: LegalAuditBasics): ClaimCalculationMode {
  return basics.calculationMode === 'litigation' ? 'litigation' : 'mediation'
}

function resolveCoverageStatus(basics: LegalAuditBasics): ThirdPartyCoverageStatus {
  const value = basics.thirdPartyCoverageStatus
  return value === 'yes' || value === 'no' ? value : 'unknown'
}

// --- 體傷 / 財損分項 ---------------------------------------------------

function packBodilyCivil(c: CivilDamageInput, pas: 'Low' | 'Mid' | 'High') {
  return {
    medical: c.civilMedicalExpense,
    nursing:
      pas === 'High'
        ? c.civilNursingFeeHigh
        : pas === 'Mid'
          ? c.civilNursingFeeMid
          : c.civilNursingFeeLow,
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

interface LiabilityBand {
  civilDamageTotal: number
  bodilyLiable: number
  propertyLiable: number
  /** 過失相抵後、強制險扣抵前責任基準 */
  liableAmount: number
}

/**
 * 計算單一 low/mid/high band 的民事責任。
 *
 * civilBodilyNet 是既有 caller 傳入的「已扣強制險醫療認列額」人身差額。
 * 因此先 + compulsoryEstimated 還原未扣抵前的人身損害，再依模式決定扣抵順序。
 *
 * 重要：
 * - liableAmount 保留「總損害 × 肇責」的過失相抵責任基準，方便調解／訴訟對照。
 * - bodilyLiable/propertyLiable 是完成所選模式扣抵後，真正送進保額計算的淨責任。
 */
function computeLiabilityBand(args: {
  civilBodilyNet: number
  propertyTotal: number
  ratio: number
  compulsoryEstimated: number
  compulsoryActuallyPaid: number
  mode: ClaimCalculationMode
}): LiabilityBand {
  const {
    civilBodilyNet,
    propertyTotal,
    ratio,
    compulsoryEstimated,
    compulsoryActuallyPaid,
    mode,
  } = args

  const grossBodilyDamage = Math.max(civilBodilyNet + compulsoryEstimated, 0)
  const civilDamageTotal = grossBodilyDamage + propertyTotal
  const liableAmount = Math.round(civilDamageTotal * ratio)

  let bodilyLiable: number
  if (mode === 'litigation') {
    // 法院模式：先過失相抵，再扣「實際已領」強制險。
    bodilyLiable = Math.max(
      Math.round(grossBodilyDamage * ratio) - compulsoryActuallyPaid,
      0,
    )
  } else {
    // 調解模式：先扣強制險再乘肇責。
    // 若已實領金額高於目前醫療預估（例如另有失能給付），以較高者作談判扣抵參考。
    const mediationDeduction = Math.max(compulsoryEstimated, compulsoryActuallyPaid)
    bodilyLiable = Math.round(Math.max(grossBodilyDamage - mediationDeduction, 0) * ratio)
  }

  // 車損／其他財損沒有強制險扣抵，只有過失相抵。
  const propertyLiable = Math.round(propertyTotal * ratio)
  return {
    civilDamageTotal,
    bodilyLiable,
    propertyLiable,
    liableAmount,
  }
}

function applyInsuranceCoverage(
  bodilyLiable: number,
  propertyLiable: number,
  basics: LegalAuditBasics,
): number {
  const status = resolveCoverageStatus(basics)

  // 舊資料／尚未取得保單：維持歷史輸出相容，但 UI/notes 必須標明這是責任金額參考。
  if (status === 'unknown') return bodilyLiable + propertyLiable
  if (status === 'no') return 0

  const bodilyLimit = nonNegative(basics.thirdPartyBodilyLimit)
  const propertyLimit = nonNegative(basics.thirdPartyPropertyLimit)
  const excessLimit = nonNegative(basics.excessLiabilityLimit)

  const primaryBodily = Math.min(bodilyLiable, bodilyLimit)
  const primaryProperty = Math.min(propertyLiable, propertyLimit)
  const remaining =
    Math.max(bodilyLiable - primaryBodily, 0) + Math.max(propertyLiable - primaryProperty, 0)
  const excess = Math.min(remaining, excessLimit)

  return primaryBodily + primaryProperty + excess
}

// --- 主計算 ------------------------------------------------------------

export function computeThirdParty(input: ThirdPartyInput): ThirdPartyEstimate {
  const { civil, otherFaultRatio } = input
  const basics = input.basics as LegalAuditBasics
  const mode = resolveMode(basics)
  const ratio = Math.min(Math.max(otherFaultRatio, 0), 100) / 100

  // 沒有強制險時，不應把「理論可認列」金額拿來做扣抵。
  const compulsoryEstimated = basics.hasCompulsoryInsurance
    ? nonNegative(input.compulsoryTotalApproved)
    : 0
  const compulsoryActuallyPaid = basics.hasCompulsoryInsurance
    ? nonNegative(basics.compulsoryActuallyPaid)
    : 0

  const bodilyLow = sumBodily(packBodilyCivil(civil, 'Low'))
  const bodilyMid = sumBodily(packBodilyCivil(civil, 'Mid'))
  const bodilyHigh = sumBodily(packBodilyCivil(civil, 'High'))
  const propertyTotal = sumProperty(packPropertyCivil(civil))

  const low = computeLiabilityBand({
    civilBodilyNet: bodilyLow,
    propertyTotal,
    ratio,
    compulsoryEstimated,
    compulsoryActuallyPaid,
    mode,
  })
  const mid = computeLiabilityBand({
    civilBodilyNet: bodilyMid,
    propertyTotal,
    ratio,
    compulsoryEstimated,
    compulsoryActuallyPaid,
    mode,
  })
  const high = computeLiabilityBand({
    civilBodilyNet: bodilyHigh,
    propertyTotal,
    ratio,
    compulsoryEstimated,
    compulsoryActuallyPaid,
    mode,
  })

  const thirdPartyEstimateLow = applyInsuranceCoverage(low.bodilyLiable, low.propertyLiable, basics)
  const thirdPartyEstimateMid = applyInsuranceCoverage(mid.bodilyLiable, mid.propertyLiable, basics)
  const thirdPartyEstimateHigh = applyInsuranceCoverage(
    high.bodilyLiable,
    high.propertyLiable,
    basics,
  )

  const notes: string[] = []
  if (mode === 'litigation') {
    notes.push('法院模式：人身損害先依對方肇責比例做過失相抵，再扣實際已領取的強制險給付。')
    if (compulsoryActuallyPaid === 0 && compulsoryEstimated > 0) {
      notes.push('目前「實際已領強制險」為 0；法院模式不會先扣尚未實際領取的預估金額。')
    }
  } else {
    notes.push('調解模式：人身損害先扣強制險，再乘對方肇責比例；實際和解金額仍以雙方協議為準。')
  }

  if (otherFaultRatio === 0) {
    notes.push('對方肇責比例為 0%，本試算的對方民事責任為 0。')
  } else if (otherFaultRatio < 100) {
    notes.push(`對方肇責 ${otherFaultRatio}%，財損及人身損害依所選模式計算過失相抵。`)
  }

  const coverageStatus = resolveCoverageStatus(basics)
  if (coverageStatus === 'unknown') {
    notes.push('尚未取得第三人責任險保額資料；目前「第三人責任險估算」僅沿用扣抵後責任金額參考，不代表保險公司一定全額負擔。')
  } else if (coverageStatus === 'no') {
    notes.push('已標示對方無第三人責任險；保險可負擔額為 0，剩餘民事責任原則上由責任人自行負擔。')
  } else {
    const bodilyLimit = nonNegative(basics.thirdPartyBodilyLimit)
    const propertyLimit = nonNegative(basics.thirdPartyPropertyLimit)
    const excessLimit = nonNegative(basics.excessLiabilityLimit)
    if (bodilyLimit === 0 || propertyLimit === 0) {
      notes.push('已標示有第三人責任險，但體傷或財損保額尚未完整輸入；未輸入的保額會以 0 計算。')
    }
    if (excessLimit > 0) {
      notes.push(`另納入超額責任險上限 ${excessLimit.toLocaleString('zh-TW')} 元的簡化試算。`)
    }
  }

  return {
    civilDamageTotalLow: low.civilDamageTotal,
    civilDamageTotalMid: mid.civilDamageTotal,
    civilDamageTotalHigh: high.civilDamageTotal,
    liableAmountLow: low.liableAmount,
    liableAmountMid: mid.liableAmount,
    liableAmountHigh: high.liableAmount,
    thirdPartyEstimateLow,
    thirdPartyEstimateMid,
    thirdPartyEstimateHigh,
    notes,
  }
}

// --- 車損計算 -----------------------------------------------------------

/**
 * 車輛折舊率計算（平均法／直線法的簡化試算）。
 * 這不是強制險計算；強制險不處理車損。
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

/** 折舊後車輛價值。 */
export function computeDepreciatedVehicleValue(
  marketValueBeforeAccident: number,
  manufactureYear: number | null | undefined,
  depreciationYears: number | null | undefined,
  accidentYear: number,
): { value: number; depreciationRate: number; yearsOld: number; depreciationYears: number } {
  if (manufactureYear == null || depreciationYears == null || !Number.isFinite(manufactureYear)) {
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

/**
 * 車損試算。
 * v0.29 legal-audit：優先使用事故日期，而不是「執行試算當年度」，避免同一案件隔年重算車齡改變。
 * accidentDate 可由第二參數或 property 上的相容欄位帶入。
 */
export function computeVehicleDamage(input: PropertyDamageInputs, accidentDate?: string): number {
  const repairCost = input.vehicleRepairInvoice || input.vehicleRepairEstimate
  if (repairCost === 0) return 0

  const embeddedAccidentDate = (input as PropertyDamageInputs & { accidentDate?: string }).accidentDate
  const rawDate = accidentDate || embeddedAccidentDate
  const parsedYear = rawDate ? Number(String(rawDate).slice(0, 4)) : Number.NaN
  const accidentYear = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear()

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
