// =====================================================================
// v0.8.2 強制險醫材費新/舊法切換 — 計算引擎測試
// =====================================================================

import { describe, expect, it } from 'vitest'
import {
  calcMedicalMaterialOldLaw,
  computeCompulsoryMedical,
  computeCompulsoryMedicalByDate,
} from '@/lib/insurance/compulsory'
import type { CompulsoryMedicalInputs } from '@/lib/insurance/types'

// 共用 fixture：特殊材料 15000 + 一般醫材 5000 + 輔具 10000 = 30000
// 新法只看 special + assistive = 25000 → 套 2 萬上限 → approved = 20000
// 舊法看 3 項加總 = 30000 → 套 2 萬上限 → approved = 20000（同樣 20000，但 subItems 結構不同）
const HIGH_INPUT: CompulsoryMedicalInputs = {
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
  specialMaterialFee: 15_000,
  medicalMaterialFee: 5_000,
  assistiveDeviceFee: 10_000,
  transportationFee: 0,
  nursingFee: 0,
  nursingDays: 0,
}

// 差異案例：special 15000 + generalMaterial 30000 + assistive 5000
// 新法只看 special + assistive = 20000 → 套 2 萬上限 → approved = 20000
// 舊法 3 項加總 = 50000 → 套 2 萬上限 → approved = 20000
// 但 medicalMaterial 一般醫材 30000 不在新法上限範圍內（v0.2.5 邏輯：歸入「健保自付額」/「非健保必要」）
// 為測 approved 差異需重新設計案例
const DIFF_INPUT: CompulsoryMedicalInputs = {
  ...HIGH_INPUT,
  // 讓新舊法 approved 不同：舊法 3 項加總壓更緊，新法只算 2 項壓鬆
  specialMaterialFee: 8_000, // 新法算
  medicalMaterialFee: 15_000, // 舊法算 / 新法不計入 2 萬上限
  assistiveDeviceFee: 7_000, // 新法算
  // 新法：special + assistive = 15000 → 全額（沒超過 2 萬）→ approved = 15000
  // 舊法：3 項加總 = 30000 → 套 2 萬上限 → approved = 20000
}

const LOW_INPUT: CompulsoryMedicalInputs = {
  ...HIGH_INPUT,
  specialMaterialFee: 5_000,
  medicalMaterialFee: 2_000,
  assistiveDeviceFee: 3_000,
}

const EMPTY_INPUT: CompulsoryMedicalInputs = {
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
  specialMaterialFee: 0,
  medicalMaterialFee: 0,
  assistiveDeviceFee: 0,
  transportationFee: 0,
  nursingFee: 0,
  nursingDays: 0,
}

describe('calcMedicalMaterialOldLaw — 舊法版（事故日 < 2026-07-01）', () => {
  it('空輸入 → approved = 0, subItems 全 0', () => {
    const result = calcMedicalMaterialOldLaw(EMPTY_INPUT)
    expect(result.key).toBe('medicalMaterial')
    expect(result.applied).toBe(0)
    expect(result.approved).toBe(0)
    expect(result.subItems).toHaveLength(3)
    expect(result.subItems?.[0]?.approved).toBe(0)
  })

  it('高於 2 萬上限（30000）→ approved = 20000（合併按比例分攤）', () => {
    const result = calcMedicalMaterialOldLaw(HIGH_INPUT)
    expect(result.applied).toBe(30_000)
    expect(result.approved).toBe(20_000)
    // 比例 20000/30000 = 0.6667
    // special 15000 * 0.6667 = 10000
    // generalMaterial 5000 * 0.6667 = 3333 (round)
    // assistive 10000 * 0.6667 = 6667 (round)
    expect(result.subItems?.[0]?.applied).toBe(15_000)
    expect(result.subItems?.[1]?.applied).toBe(5_000)
    expect(result.subItems?.[2]?.applied).toBe(10_000)
    // 合計 = 20000
    const sumApproved = (result.subItems ?? []).reduce((s, x) => s + (x.approved ?? 0), 0)
    expect(sumApproved).toBe(20_000)
  })

  it('低於 2 萬上限（10000）→ approved = 10000 全額', () => {
    const result = calcMedicalMaterialOldLaw(LOW_INPUT)
    expect(result.applied).toBe(10_000)
    expect(result.approved).toBe(10_000)
    expect(result.reductionReason).toBeNull()
  })

  it('舊法 reductionReason 文案含「舊法合併計算」', () => {
    const result = calcMedicalMaterialOldLaw(HIGH_INPUT)
    expect(result.reductionReason).toContain('舊法合併計算')
  })

  it('舊法 label 含「（舊法合併）」', () => {
    const result = calcMedicalMaterialOldLaw(HIGH_INPUT)
    expect(result.label).toContain('（舊法合併）')
  })
})

describe('computeCompulsoryMedicalByDate — 主計算依事故日切換', () => {
  it('事故日 2024-01-01（舊法）→ 走舊法合併邏輯', () => {
    const result = computeCompulsoryMedicalByDate(HIGH_INPUT, '2024-01-01')
    const medicalItem = result.items.find((it) => it.key === 'medicalMaterial')
    expect(medicalItem?.approved).toBe(20_000)
    expect(medicalItem?.label).toContain('（舊法合併）')
  })

  it('事故日 2026-06-30（舊法，前一日）→ 走舊法合併邏輯', () => {
    const result = computeCompulsoryMedicalByDate(HIGH_INPUT, '2026-06-30')
    const medicalItem = result.items.find((it) => it.key === 'medicalMaterial')
    expect(medicalItem?.approved).toBe(20_000)
    expect(medicalItem?.label).toContain('（舊法合併）')
  })

  it('事故日 2026-07-01（新法，含當日）→ 走新法拆 subItems 邏輯', () => {
    const result = computeCompulsoryMedicalByDate(HIGH_INPUT, '2026-07-01')
    const medicalItem = result.items.find((it) => it.key === 'medicalMaterial')
    // 新法只看 special + assistive（15000 + 10000 = 25000）→ 套 2 萬上限 → 20000
    // 一般醫材費（medicalMaterialFee 5000）不計入 2 萬上限範圍，歸入「健保自付額」/「非健保必要」處理
    expect(medicalItem?.approved).toBe(20_000)
    expect(medicalItem?.label).not.toContain('（舊法合併）')
  })

  it('事故日 2027-01-15（明年，新法）→ 走新法', () => {
    const result = computeCompulsoryMedicalByDate(HIGH_INPUT, '2027-01-15')
    const medicalItem = result.items.find((it) => it.key === 'medicalMaterial')
    expect(medicalItem?.approved).toBe(20_000)
  })

  it('事故日 null（未填，保守預設）→ 走新法', () => {
    const result = computeCompulsoryMedicalByDate(HIGH_INPUT, null)
    const medicalItem = result.items.find((it) => it.key === 'medicalMaterial')
    expect(medicalItem?.approved).toBe(20_000)
  })

  it('事故日 undefined → 走新法', () => {
    const result = computeCompulsoryMedicalByDate(HIGH_INPUT, undefined)
    const medicalItem = result.items.find((it) => it.key === 'medicalMaterial')
    expect(medicalItem?.approved).toBe(20_000)
  })

  it('同一個案 2024 vs 2026-07-01 subItems 結構不同（新法 2 項 / 舊法 3 項）', () => {
    const oldLaw = computeCompulsoryMedicalByDate(HIGH_INPUT, '2024-01-01')
    const newLaw = computeCompulsoryMedicalByDate(HIGH_INPUT, '2026-07-01')
    const oldItem = oldLaw.items.find((it) => it.key === 'medicalMaterial')
    const newItem = newLaw.items.find((it) => it.key === 'medicalMaterial')
    // 新法 subItems = 2 項（specialMaterial + assistiveDevice）
    expect(newItem?.subItems).toHaveLength(2)
    // 舊法 subItems = 3 項（specialMaterial + generalMaterial + assistiveDevice）
    expect(oldItem?.subItems).toHaveLength(3)
  })

  it('DIFF_INPUT：同一個案 2024 vs 2026-07-01 approved 算出不同（切換生效）', () => {
    // DIFF_INPUT: special 8000 + generalMaterial 15000 + assistive 7000
    // 新法只看 special + assistive = 15000（沒到 2 萬）→ approved = 15000
    // 舊法 3 項加總 = 30000 → 套 2 萬上限 → approved = 20000
    const oldLaw = computeCompulsoryMedicalByDate(DIFF_INPUT, '2024-01-01')
    const newLaw = computeCompulsoryMedicalByDate(DIFF_INPUT, '2026-07-01')
    const oldApproved = oldLaw.items.find((it) => it.key === 'medicalMaterial')?.approved ?? 0
    const newApproved = newLaw.items.find((it) => it.key === 'medicalMaterial')?.approved ?? 0
    expect(oldApproved).toBe(20_000)
    expect(newApproved).toBe(15_000)
    // 新法（拆 subItems）對一般醫材多的案件理賠較少（醫材 15000 不算 2 萬上限範圍）
    expect(newApproved).toBeLessThan(oldApproved)
  })

  it('DIFF_INPUT：新法 subItems 不含 generalMaterial 項目', () => {
    const newLaw = computeCompulsoryMedicalByDate(DIFF_INPUT, '2026-07-01')
    const newItem = newLaw.items.find((it) => it.key === 'medicalMaterial')
    const keys = (newItem?.subItems ?? []).map((s) => s.key)
    expect(keys).not.toContain('generalMaterial')
    expect(keys).toContain('specialMaterial')
    expect(keys).toContain('assistiveDevice')
  })

  it('subtotal 計算正確（強制險總額上限 20 萬）', () => {
    const oldLaw = computeCompulsoryMedicalByDate(HIGH_INPUT, '2024-01-01')
    const newLaw = computeCompulsoryMedicalByDate(HIGH_INPUT, '2026-07-01')
    // HIGH_INPUT 新舊法 medicalMaterial 都是 20000（都套 2 萬上限）
    // 其他 14 項都是 0，subtotal = 20000
    expect(oldLaw.subtotal).toBe(20_000)
    expect(oldLaw.approved).toBe(20_000)
    expect(newLaw.subtotal).toBe(20_000)
    expect(newLaw.approved).toBe(20_000)
  })

  it('DIFF_INPUT subtotal 計算差異（新法 15000 < 舊法 20000）', () => {
    const oldLaw = computeCompulsoryMedicalByDate(DIFF_INPUT, '2024-01-01')
    const newLaw = computeCompulsoryMedicalByDate(DIFF_INPUT, '2026-07-01')
    expect(oldLaw.subtotal).toBe(20_000)
    expect(newLaw.subtotal).toBe(15_000)
  })

  it('computeCompulsoryMedical（向後相容舊呼叫端）→ 仍走新法（預設）', () => {
    const result = computeCompulsoryMedical(HIGH_INPUT)
    const medicalItem = result.items.find((it) => it.key === 'medicalMaterial')
    expect(medicalItem?.approved).toBe(20_000)
  })
})

describe('不變量 — 切換不會破壞其他項', () => {
  it('舊法 / 新法 其他 14 個項目計算結果完全相同（DIFF_INPUT 切換生效）', () => {
    const oldLaw = computeCompulsoryMedicalByDate(DIFF_INPUT, '2024-01-01')
    const newLaw = computeCompulsoryMedicalByDate(DIFF_INPUT, '2026-07-01')
    expect(oldLaw.items).toHaveLength(newLaw.items.length)
    for (let i = 0; i < oldLaw.items.length; i++) {
      const oldItem = oldLaw.items[i]!
      const newItem = newLaw.items[i]!
      if (oldItem.key === 'medicalMaterial') {
        // 只有 medicalMaterial 不同
        expect(oldItem.approved).not.toBe(newItem.approved)
        expect(oldItem.approved).toBe(20_000) // 舊法
        expect(newItem.approved).toBe(15_000) // 新法
      } else {
        // 其他 14 項完全相同
        expect(oldItem.approved).toBe(newItem.approved)
        expect(oldItem.applied).toBe(newItem.applied)
      }
    }
  })

  it('approved <= legalCap（每個 item 都守上限）', () => {
    const oldLaw = computeCompulsoryMedicalByDate(HIGH_INPUT, '2024-01-01')
    const newLaw = computeCompulsoryMedicalByDate(HIGH_INPUT, '2026-07-01')
    for (const item of [...oldLaw.items, ...newLaw.items]) {
      if (item.legalCap !== null) {
        expect(item.approved).toBeLessThanOrEqual(item.legalCap!)
      }
    }
  })
})
