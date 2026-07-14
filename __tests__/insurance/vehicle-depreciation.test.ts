// =====================================================================
// v0.24.2+：車輛折舊計算守護（平均法 / 直線法）
// 來源：台灣保險業通用「平均折舊法（straight-line）」
// - 每年折舊金額固定（折舊年限分成等額）
// - 公式：折舊率 = 使用年數 / 折舊年限（最多 100%）
// - 例：折舊年限 5 年、車價 50 萬 → 每年折 10 萬，第 3 年折 30 萬 = 60%
// v0.24.0a 線性累進 → v0.24.2+ 統一改成平均法（不再區分汽/機）
// =====================================================================

import { describe, it, expect } from 'vitest'
import {
  computeVehicleDepreciationRate,
  computeDepreciatedVehicleValue,
  computeVehicleDamage,
} from '@/lib/insurance/third-party'

describe('computeVehicleDepreciationRate — 平均法 (straight-line)', () => {
  it('年數 ≤ 0 → 0% 折舊', () => {
    expect(computeVehicleDepreciationRate(0)).toBe(0)
    expect(computeVehicleDepreciationRate(-1)).toBe(0)
  })

  describe('汽車預設折舊年限 5 年', () => {
    it('第 1 年 = 1/5 = 20%', () => {
      expect(computeVehicleDepreciationRate(1, 5)).toBeCloseTo(0.2, 5)
    })
    it('第 2 年 = 2/5 = 40%', () => {
      expect(computeVehicleDepreciationRate(2, 5)).toBeCloseTo(0.4, 5)
    })
    it('第 3 年 = 3/5 = 60%', () => {
      expect(computeVehicleDepreciationRate(3, 5)).toBeCloseTo(0.6, 5)
    })
    it('第 4 年 = 4/5 = 80%', () => {
      expect(computeVehicleDepreciationRate(4, 5)).toBeCloseTo(0.8, 5)
    })
    it('第 5 年 = 100%（折舊完畢）', () => {
      expect(computeVehicleDepreciationRate(5, 5)).toBeCloseTo(1.0, 5)
    })
    it('第 10 年 = 100%（cap，不超過）', () => {
      expect(computeVehicleDepreciationRate(10, 5)).toBeCloseTo(1.0, 5)
    })
    it('第 20 年 = 100%（cap）', () => {
      expect(computeVehicleDepreciationRate(20, 5)).toBeCloseTo(1.0, 5)
    })
  })

  describe('機車預設折舊年限 3 年', () => {
    it('第 1 年 = 1/3 ≈ 33.3%', () => {
      expect(computeVehicleDepreciationRate(1, 3)).toBeCloseTo(1 / 3, 5)
    })
    it('第 2 年 = 2/3 ≈ 66.7%', () => {
      expect(computeVehicleDepreciationRate(2, 3)).toBeCloseTo(2 / 3, 5)
    })
    it('第 3 年 = 100%（折舊完畢）', () => {
      expect(computeVehicleDepreciationRate(3, 3)).toBeCloseTo(1.0, 5)
    })
    it('第 6 年 = 100%（cap）', () => {
      expect(computeVehicleDepreciationRate(6, 3)).toBeCloseTo(1.0, 5)
    })
    it('第 10 年 = 100%（cap）', () => {
      expect(computeVehicleDepreciationRate(10, 3)).toBeCloseTo(1.0, 5)
    })
  })

  it('機車（年限 3 年）折舊率永遠 ≥ 汽車（年限 5 年）同年數', () => {
    // 機車年限短 → 同年數折舊率較高（更早折舊完畢）
    for (let y = 1; y <= 5; y++) {
      const car = computeVehicleDepreciationRate(y, 5)
      const moto = computeVehicleDepreciationRate(y, 3)
      expect(moto).toBeGreaterThanOrEqual(car)
    }
  })

  it('年限超出範圍（< 3 或 > 10）→ clamp 到邊界', () => {
    expect(computeVehicleDepreciationRate(2, 1)).toBeCloseTo(2 / 3, 5) // clamp 到 3
    expect(computeVehicleDepreciationRate(2, 20)).toBeCloseTo(2 / 10, 5) // clamp 到 10
  })

  it('年限無效（NaN、0、負）→ 0%', () => {
    expect(computeVehicleDepreciationRate(2, NaN)).toBe(0)
    expect(computeVehicleDepreciationRate(2, 0)).toBe(0)
    expect(computeVehicleDepreciationRate(2, -3)).toBe(0)
  })
})

describe('computeDepreciatedVehicleValue', () => {
  it('沒填出廠年 → 不折舊', () => {
    const r = computeDepreciatedVehicleValue(500000, null, 5, 2026)
    expect(r.value).toBe(500000)
    expect(r.depreciationRate).toBe(0)
    expect(r.depreciationYears).toBe(0)
  })

  it('沒填折舊年限 → 不折舊（預設 5 但需手動提供）', () => {
    const r = computeDepreciatedVehicleValue(500000, 2022, null, 2026)
    expect(r.value).toBe(500000)
    expect(r.depreciationRate).toBe(0)
  })

  it('汽車 5 年前出廠（年限 5）→ 折舊 100%', () => {
    const r = computeDepreciatedVehicleValue(500000, 2021, 5, 2026)
    expect(r.yearsOld).toBe(5)
    expect(r.depreciationRate).toBeCloseTo(1.0, 5)
    expect(r.value).toBe(0) // 完全折舊
  })

  it('汽車 3 年前出廠（年限 5）→ 折舊 60%', () => {
    const r = computeDepreciatedVehicleValue(500000, 2023, 5, 2026)
    expect(r.yearsOld).toBe(3)
    expect(r.depreciationRate).toBeCloseTo(0.6, 5)
    expect(r.value).toBe(200000)
  })

  it('機車 3 年前出廠（年限 3）→ 折舊 100%', () => {
    const r = computeDepreciatedVehicleValue(200000, 2023, 3, 2026)
    expect(r.yearsOld).toBe(3)
    expect(r.depreciationRate).toBeCloseTo(1.0, 5)
    expect(r.value).toBe(0)
  })

  it('汽車 10 年前出廠（年限 5）→ 折舊 100%', () => {
    const r = computeDepreciatedVehicleValue(500000, 2016, 5, 2026)
    expect(r.yearsOld).toBe(10)
    expect(r.depreciationRate).toBeCloseTo(1.0, 5)
    expect(r.value).toBe(0)
  })

  it('當年出廠 → 0 年 → 0% 折舊', () => {
    const r = computeDepreciatedVehicleValue(500000, 2026, 5, 2026)
    expect(r.yearsOld).toBe(0)
    expect(r.depreciationRate).toBe(0)
    expect(r.value).toBe(500000)
  })

  it('未來出廠（事故年 < 出廠年）→ yearsOld 為 0，不折舊', () => {
    const r = computeDepreciatedVehicleValue(500000, 2030, 5, 2026)
    expect(r.yearsOld).toBe(0)
    expect(r.value).toBe(500000)
  })
})

describe('computeVehicleDamage — 折舊 + 維修成本交互', () => {
  it('沒填出廠年 → 用事故前車價（向後相容）', () => {
    const r = computeVehicleDamage({
      vehicleRepairEstimate: 60000,
      vehicleRepairInvoice: 0,
      vehicleMarketValueBeforeAccident: 500000,
      salvageValue: 200000,
      towingFee: 0,
      rentalCarFee: 0,
      phoneDamage: 0,
      helmetDamage: 0,
      clothingDamage: 0,
      glassesDamage: 0,
      otherPropertyDamage: 0,
    })
    // 維修 6 萬 vs 折舊前市場價 30 萬 → 6 萬
    expect(r).toBe(60000)
  })

  it('汽車 5 年前出廠（年限 5），維修費 25 萬 → 完全折舊 → 0', () => {
    const r = computeVehicleDamage({
      vehicleRepairEstimate: 250000,
      vehicleRepairInvoice: 0,
      vehicleMarketValueBeforeAccident: 500000,
      salvageValue: 0,
      towingFee: 0,
      rentalCarFee: 0,
      phoneDamage: 0,
      helmetDamage: 0,
      clothingDamage: 0,
      glassesDamage: 0,
      otherPropertyDamage: 0,
      vehicleManufactureYear: 2021,
      vehicleDepreciationYears: 5,
    })
    // 折舊 100% → 殘值 0 → maxByMarket = 0 - 0 = 0
    expect(r).toBe(0)
  })

  it('汽車 3 年前出廠（年限 5），維修費 25 萬 → 折舊 60% → max 20 萬', () => {
    const r = computeVehicleDamage({
      vehicleRepairEstimate: 250000,
      vehicleRepairInvoice: 0,
      vehicleMarketValueBeforeAccident: 500000,
      salvageValue: 0,
      towingFee: 0,
      rentalCarFee: 0,
      phoneDamage: 0,
      helmetDamage: 0,
      clothingDamage: 0,
      glassesDamage: 0,
      otherPropertyDamage: 0,
      vehicleManufactureYear: 2023,
      vehicleDepreciationYears: 5,
    })
    // 折舊 60% → 殘值 20 萬
    // 維修 25 萬 > 20 萬 → 受折舊限制 = 20 萬
    expect(r).toBe(200000)
  })

  it('汽車 10 年前出廠（年限 5），維修費 30 萬 → 完全折舊 → 0', () => {
    const r = computeVehicleDamage({
      vehicleRepairEstimate: 300000,
      vehicleRepairInvoice: 0,
      vehicleMarketValueBeforeAccident: 500000,
      salvageValue: 0,
      towingFee: 0,
      rentalCarFee: 0,
      phoneDamage: 0,
      helmetDamage: 0,
      clothingDamage: 0,
      glassesDamage: 0,
      otherPropertyDamage: 0,
      vehicleManufactureYear: 2016,
      vehicleDepreciationYears: 5,
    })
    // 折舊 100% → 殘值 0 → 車損 0
    expect(r).toBe(0)
  })

  it('機車 3 年前出廠（年限 3），維修費 4 萬 → 完全折舊 → 0', () => {
    const r = computeVehicleDamage({
      vehicleRepairEstimate: 40000,
      vehicleRepairInvoice: 0,
      vehicleMarketValueBeforeAccident: 200000,
      salvageValue: 0,
      towingFee: 0,
      rentalCarFee: 0,
      phoneDamage: 0,
      helmetDamage: 0,
      clothingDamage: 0,
      glassesDamage: 0,
      otherPropertyDamage: 0,
      vehicleManufactureYear: 2023,
      vehicleDepreciationYears: 3,
    })
    // 折舊 100% → 殘值 0 → 車損 0
    expect(r).toBe(0)
  })

  it('折舊後殘值 ≤ 殘值欄位 → 車損 0', () => {
    // 50 萬車、3 年前出廠（年限 10）→ 殘值 35 萬
    // 再扣 25 萬殘值 → maxByMarket = 10 萬
    // 但本測是檢查「折舊後值 ≤ 殘值欄位」→ 車損 0
    const r = computeVehicleDamage({
      vehicleRepairEstimate: 100000,
      vehicleRepairInvoice: 0,
      vehicleMarketValueBeforeAccident: 100000,
      salvageValue: 100000, // 等於市場價 → maxByMarket = 0
      towingFee: 0,
      rentalCarFee: 0,
      phoneDamage: 0,
      helmetDamage: 0,
      clothingDamage: 0,
      glassesDamage: 0,
      otherPropertyDamage: 0,
      vehicleManufactureYear: 2024,
      vehicleDepreciationYears: 5,
    })
    expect(r).toBe(0)
  })

  it('維修費 0 → 車損 0（無資料）', () => {
    const r = computeVehicleDamage({
      vehicleRepairEstimate: 0,
      vehicleRepairInvoice: 0,
      vehicleMarketValueBeforeAccident: 500000,
      salvageValue: 0,
      towingFee: 0,
      rentalCarFee: 0,
      phoneDamage: 0,
      helmetDamage: 0,
      clothingDamage: 0,
      glassesDamage: 0,
      otherPropertyDamage: 0,
    })
    expect(r).toBe(0)
  })
})
