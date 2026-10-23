/** Repair-cost reference, separate from whole-vehicle market-value depreciation.
 * Only replacement parts depreciate. Labor and paint stay unchanged.
 * Sources: 基隆地院114年度基小字2056號、苗栗地院113年度苗簡字50號。
 * This is a reference scenario, before fault allocation or a market-value cap.
 */
export interface RepairDepreciationInput {
  vehicleType: 'car' | 'motorcycle'
  manufactureDate: string
  accidentDate: string
  parts: number | null
  labor: number | null
  paint: number | null
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null
}

export function computeRepairDepreciation(input: RepairDepreciationInput) {
  const { parts, labor, paint } = input
  if ([parts, labor, paint].some((v) => v === null || !Number.isFinite(v) || v! < 0)) return null
  if (input.vehicleType !== 'car' && input.vehicleType !== 'motorcycle') return null
  const annualRate = input.vehicleType === 'car' ? 0.369 : 0.536
  const usefulYears = input.vehicleType === 'car' ? 5 : 3
  let monthsUsed = 0
  if (parts! > 0) {
    const manufacture = parseDate(input.manufactureDate)
    const accident = parseDate(input.accidentDate)
    if (!manufacture || !accident || manufacture > accident) return null
    monthsUsed =
      (accident.getUTCFullYear() - manufacture.getUTCFullYear()) * 12 +
      accident.getUTCMonth() -
      manufacture.getUTCMonth()
    if (accident.getUTCDate() > manufacture.getUTCDate()) monthsUsed += 1
  }
  const fullYears = Math.floor(monthsUsed / 12)
  const remainingMonths = monthsUsed % 12
  const remainingRatio =
    monthsUsed >= usefulYears * 12
      ? 0.1
      : Math.max(0.1, (1 - annualRate) ** fullYears * (1 - (annualRate * remainingMonths) / 12))
  const partsAfterDepreciation = Math.round(parts! * remainingRatio)
  const originalTotal = parts! + labor! + paint!
  return {
    monthsUsed,
    annualRate,
    usefulYears,
    partsAfterDepreciation,
    depreciationAmount: parts! - partsAfterDepreciation,
    originalTotal,
    total: partsAfterDepreciation + labor! + paint!,
  }
}
