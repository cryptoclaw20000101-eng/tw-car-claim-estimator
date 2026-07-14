// =====================================================================
// v0.24.0+：車輛折舊計算守護
// 來源：台灣保險業通用線性累進公式
// - 汽車：第一年 10%，之後每年 +10%（cap 70%）
// - 機車：第一年 18%，之後每年 +10%（cap 70%）
// =====================================================================

import { describe, it, expect } from 'vitest'
import {
  computeVehicleDepreciationRate,
  computeDepreciatedVehicleValue,
  computeVehicleDamage,
} from '@/lib/insurance/third-party'

describe('computeVehicleDepreciationRate — 保險通用線性累進', () => {
  it('年數 ≤ 0 → 0% 折舊', () => {
    expect(computeVehicleDepreciationRate(0, 'car')).toBe(0)
    expect(computeVehicleDepreciationRate(-1, 'car')).toBe(0)
  })

  describe('汽車（car）— 第一年 10%，之後每年 +10%', () => {
    it('第 1 年 = 10%', () => {
      expect(computeVehicleDepreciationRate(1, 'car')).toBeCloseTo(0.1, 5)
    })
    it('第 2 年 = 20%', () => {
      expect(computeVehicleDepreciationRate(2, 'car')).toBeCloseTo(0.2, 5)
    })
    it('第 3 年 = 30%', () => {
      expect(computeVehicleDepreciationRate(3, 'car')).toBeCloseTo(0.3, 5)
    })
    it('第 5 年 = 50%', () => {
      expect(computeVehicleDepreciationRate(5, 'car')).toBeCloseTo(0.5, 5)
    })
    it('第 10 年 = 70%（cap）', () => {
      expect(computeVehicleDepreciationRate(10, 'car')).toBeCloseTo(0.7, 5)
    })
    it('第 20 年 = 70%（cap，不超過）', () => {
      expect(computeVehicleDepreciationRate(20, 'car')).toBeCloseTo(0.7, 5)
    })
  })

  describe('機車（motorcycle）— 第一年 18%，之後每年 +10%', () => {
    it('第 1 年 = 18%', () => {
      expect(computeVehicleDepreciationRate(1, 'motorcycle')).toBeCloseTo(0.18, 5)
    })
    it('第 2 年 = 28%', () => {
      expect(computeVehicleDepreciationRate(2, 'motorcycle')).toBeCloseTo(0.28, 5)
    })
    it('第 3 年 = 38%', () => {
      expect(computeVehicleDepreciationRate(3, 'motorcycle')).toBeCloseTo(0.38, 5)
    })
    it('第 6 年 = 68%', () => {
      expect(computeVehicleDepreciationRate(6, 'motorcycle')).toBeCloseTo(0.68, 5)
    })
    it('第 10 年 = 70%（cap）', () => {
      expect(computeVehicleDepreciationRate(10, 'motorcycle')).toBeCloseTo(0.7, 5)
    })
  })

  it('機車折舊率永遠 ≥ 汽車折舊率（同年數）', () => {
    for (let y = 1; y <= 10; y++) {
      const car = computeVehicleDepreciationRate(y, 'car')
      const moto = computeVehicleDepreciationRate(y, 'motorcycle')
      expect(moto).toBeGreaterThanOrEqual(car)
    }
  })
})

describe('computeDepreciatedVehicleValue', () => {
  it('沒填出廠年 → 不折舊', () => {
    const r = computeDepreciatedVehicleValue(500000, null, 'car', 2026)
    expect(r.value).toBe(500000)
    expect(r.depreciationRate).toBe(0)
  })

  it('沒填車輛種類 → 不折舊', () => {
    const r = computeDepreciatedVehicleValue(500000, 2022, null, 2026)
    expect(r.value).toBe(500000)
  })

  it('汽車 5 年前出廠 → 折舊 50%', () => {
    const r = computeDepreciatedVehicleValue(500000, 2021, 'car', 2026)
    expect(r.yearsOld).toBe(5)
    expect(r.depreciationRate).toBeCloseTo(0.5, 5)
    expect(r.value).toBe(250000)
  })

  it('機車 3 年前出廠 → 折舊 38%', () => {
    const r = computeDepreciatedVehicleValue(200000, 2023, 'motorcycle', 2026)
    expect(r.yearsOld).toBe(3)
    expect(r.depreciationRate).toBeCloseTo(0.38, 5)
    expect(r.value).toBe(124000)
  })

  it('汽車 10 年前出廠 → 折舊 70%（cap）', () => {
    const r = computeDepreciatedVehicleValue(500000, 2016, 'car', 2026)
    expect(r.yearsOld).toBe(10)
    expect(r.depreciationRate).toBeCloseTo(0.7, 5)
    expect(r.value).toBe(150000)
  })

  it('當年出廠 → 0 年 → 0% 折舊', () => {
    const r = computeDepreciatedVehicleValue(500000, 2026, 'car', 2026)
    expect(r.yearsOld).toBe(0)
    expect(r.depreciationRate).toBe(0)
    expect(r.value).toBe(500000)
  })

  it('未來出廠（事故年 < 出廠年）→ yearsOld 為 0，不折舊', () => {
    const r = computeDepreciatedVehicleValue(500000, 2030, 'car', 2026)
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
    // 維修 6 萬 vs 折舊後市場價 30 萬 → 6 萬（受折舊前計算）
    expect(r).toBe(60000)
  })

  it('汽車 5 年前出廠，維修費 25 萬 → 折舊限制', () => {
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
      vehicleCategory: 'car',
    })
    // 事故前車價 50 萬 * (1 - 0.5) = 25 萬
    // 維修 25 萬 ≤ 25 萬 → 25 萬
    expect(r).toBe(250000)
  })

  it('汽車 10 年前出廠，維修費 30 萬 → 被折舊限制（max 15 萬）', () => {
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
      vehicleCategory: 'car',
    })
    // 折舊 70% → 50 萬 * 0.3 = 15 萬
    // 維修 30 萬 > 15 萬 → 受折舊限制 = 15 萬
    expect(r).toBe(150000)
  })

  it('機車 3 年前出廠，維修費 4 萬 → 折舊 38%（max 12.4 萬）', () => {
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
      vehicleCategory: 'motorcycle',
    })
    // 折舊 38% → 20 萬 * 0.62 = 12.4 萬（取整 124000）
    // 維修 4 萬 ≤ 12.4 萬 → 4 萬
    expect(r).toBe(40000)
  })

  it('折舊後殘值 ≤ 0 → 車損 0', () => {
    const r = computeVehicleDamage({
      vehicleRepairEstimate: 100000,
      vehicleRepairInvoice: 0,
      vehicleMarketValueBeforeAccident: 500000,
      salvageValue: 250000, // 折舊後 50 萬 * 0.3 = 15 萬 - 25 萬殘值 = -10 萬
      towingFee: 0,
      rentalCarFee: 0,
      phoneDamage: 0,
      helmetDamage: 0,
      clothingDamage: 0,
      glassesDamage: 0,
      otherPropertyDamage: 0,
      vehicleManufactureYear: 2016,
      vehicleCategory: 'car',
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
