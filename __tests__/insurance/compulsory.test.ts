// =====================================================================
// 強制汽車責任保險 細項計算測試
// 涵蓋 spec §十八 測試案例 1、4、5
// =====================================================================

import { describe, it, expect } from 'vitest'
import { computeCompulsoryMedical, COMPULSORY_LIMITS } from '@/lib/insurance/compulsory'
import type { CompulsoryMedicalInputs } from '@/lib/insurance/types'

const zero: CompulsoryMedicalInputs = {
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
  assistiveDeviceFee: 0,
  transportationFee: 0,
  nursingFee: 0,
  nursingDays: 0,
  otherNecessaryMedicalFee: 0,
}

describe('強制險傷害醫療細項 — 零輸入', () => {
  it('全為 0 時 approved 應為 0', () => {
    const r = computeCompulsoryMedical(zero)
    expect(r.approved).toBe(0)
    expect(r.subtotal).toBe(0)
    expect(r.items).toHaveLength(15)
  })
})

describe('測試案例 1：單純擦挫傷（spec §十八 案例 1）', () => {
  it('醫療收據 8,000 + 接送 1,000 → 強制險 9,000，無失能線索', () => {
    const input: CompulsoryMedicalInputs = {
      ...zero,
      nhiCopayment: 8_000,
      transportationFee: 1_000,
    }
    const r = computeCompulsoryMedical(input)
    expect(r.approved).toBe(9_000)
    expect(r.approved).toBeLessThanOrEqual(COMPULSORY_LIMITS.TOTAL_MEDICAL_CAP)
  })
})

describe('測試案例 4：車損與財損（強制險只估醫療）', () => {
  it('醫療收據 5,000 → 強制險 5,000', () => {
    const input: CompulsoryMedicalInputs = {
      ...zero,
      nhiCopayment: 5_000,
    }
    const r = computeCompulsoryMedical(input)
    expect(r.approved).toBe(5_000)
  })
})

describe('測試案例 5：強制險 + 第三人險混合', () => {
  it('醫療收據 250,000 → 強制險上限 200,000', () => {
    const input: CompulsoryMedicalInputs = {
      ...zero,
      nhiCopayment: 250_000,
    }
    const r = computeCompulsoryMedical(input)
    expect(r.approved).toBe(200_000)  // 上限截斷
    expect(r.approved).toBe(COMPULSORY_LIMITS.TOTAL_MEDICAL_CAP)
  })

  it('看護 40 日 → 強制險看護只認 30 日（1,200 × 30 = 36,000）', () => {
    const input: CompulsoryMedicalInputs = {
      ...zero,
      nursingFee: 48_000,  // 申請 40 日 × 1,200
      nursingDays: 40,
    }
    const r = computeCompulsoryMedical(input)
    const nursingItem = r.items.find(i => i.key === 'nursingFee')!
    expect(nursingItem.applied).toBe(48_000)
    expect(nursingItem.approved).toBe(36_000)  // 1,200 × 30
    expect(nursingItem.legalCap).toBe(36_000)
    expect(nursingItem.reductionReason).toContain('30')
  })
})

describe('細項上限規則（spec §六 Step 5）', () => {
  it('病房費差額單日超 1,500 → 刪減', () => {
    const input: CompulsoryMedicalInputs = {
      ...zero,
      wardFeeDifference: 2_000 * 3,  // 申請 6,000
      wardFeeDays: 3,
    }
    const r = computeCompulsoryMedical(input)
    const ward = r.items.find(i => i.key === 'wardFee')!
    expect(ward.legalCap).toBe(1_500 * 3)  // 4,500
    expect(ward.approved).toBe(4_500)
    expect(ward.reductionReason).toContain('1,500')
  })

  it('膳食費單日超 180 → 刪減', () => {
    const input: CompulsoryMedicalInputs = {
      ...zero,
      mealFee: 250 * 5,
      mealDays: 5,
    }
    const r = computeCompulsoryMedical(input)
    const meal = r.items.find(i => i.key === 'mealFee')!
    expect(meal.legalCap).toBe(180 * 5)
    expect(meal.approved).toBe(900)
  })

  it('義齒 6 齒 → 上限 50,000（每齒 10,000 × 6 = 60,000 被截）', () => {
    const input: CompulsoryMedicalInputs = {
      ...zero,
      dentureFee: 60_000,
      missingTeethCount: 6,
    }
    const r = computeCompulsoryMedical(input)
    const dent = r.items.find(i => i.key === 'dentureFee')!
    expect(dent.legalCap).toBe(50_000)
    expect(dent.approved).toBe(50_000)
    expect(dent.reductionReason).toBeTruthy()
  })

  it('醫材 + 輔具 25,000 → 上限 20,000', () => {
    const input: CompulsoryMedicalInputs = {
      ...zero,
      medicalMaterialFee: 15_000,
      assistiveDeviceFee: 10_000,
    }
    const r = computeCompulsoryMedical(input)
    const med = r.items.find(i => i.key === 'medicalMaterial')!
    expect(med.applied).toBe(25_000)
    expect(med.approved).toBe(20_000)
  })

  it('接送費 25,000 → 上限 20,000', () => {
    const input: CompulsoryMedicalInputs = {
      ...zero,
      transportationFee: 25_000,
    }
    const r = computeCompulsoryMedical(input)
    const trans = r.items.find(i => i.key === 'transportationFee')!
    expect(trans.legalCap).toBe(20_000)
    expect(trans.approved).toBe(20_000)
  })

  it('義眼 15,000 → 上限 10,000', () => {
    const input: CompulsoryMedicalInputs = {
      ...zero,
      artificialEyeFee: 15_000,
    }
    const r = computeCompulsoryMedical(input)
    const eye = r.items.find(i => i.key === 'artificialEyeFee')!
    expect(eye.legalCap).toBe(10_000)
    expect(eye.approved).toBe(10_000)
  })
})

describe('spec §十四 輸出範例：健保自付 18,600 + 診斷書 1,000 + 接送 3,000 + 看護 12,000', () => {
  it('強制險認列 34,600', () => {
    const input: CompulsoryMedicalInputs = {
      ...zero,
      nhiCopayment: 18_600,
      diagnosisCertificateFee: 1_000,
      transportationFee: 3_000,
      nursingFee: 12_000,
      nursingDays: 10,  // 1,200 × 10 = 12,000
    }
    const r = computeCompulsoryMedical(input)
    expect(r.approved).toBe(34_600)
  })
})
