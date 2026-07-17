// =====================================================================
// v0.8.4 法規切換 CLI 工具 — 純函式測試
// =====================================================================

import { describe, expect, it } from 'vitest'
import { isNewLaw, getLawVersionLabel, NEW_LAW_CUTOFF } from '@/lib/data-sources/regulation-cutoff'
import { computeCompulsoryMedicalByDate } from '@/lib/insurance/compulsory'
import { lookupDisabilityLevelByDate } from '@/lib/insurance/disability-joint-mapping'
import type { CompulsoryMedicalInputs } from '@/lib/insurance/types'

// 重現 CLI 的關鍵計算邏輯（避免 import scripts/law-cutoff.ts 的 Node-only 程式碼）
// CLI 的純函式計算跟 lib/insurance/* 完全一致，這裡只驗證「CLI 串接計算引擎」的正確性

describe('CLI 串接計算引擎 — v0.8.4', () => {
  describe('日期判定串接', () => {
    it('CLI 場景 1: 2024-03-15 事故 → 判定舊法', () => {
      expect(isNewLaw('2024-03-15')).toBe(false)
      expect(getLawVersionLabel('2024-03-15')).toBe('舊法 (2026-07-01 前)')
    })

    it('CLI 場景 2: 2026-07-01 事故 → 判定新法（邊界當日）', () => {
      expect(isNewLaw('2026-07-01')).toBe(true)
      expect(getLawVersionLabel('2026-07-01')).toBe('新法 (2026-07-01 起)')
    })

    it('CLI 場景 3: 2027-01-15 事故 → 判定新法', () => {
      expect(isNewLaw('2027-01-15')).toBe(true)
    })

    it('CLI 場景 4: 未填事故日 → 保守預設新法', () => {
      expect(isNewLaw(null)).toBe(true)
    })
  })

  describe('醫材費差異估算（CLI 主功能）', () => {
    const makeMedicalInput = (
      special: number,
      general: number,
      assistive: number,
    ): CompulsoryMedicalInputs => ({
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
      specialMaterialFee: special,
      medicalMaterialFee: general,
      assistiveDeviceFee: assistive,
      transportationFee: 0,
      nursingFee: 0,
      nursingDays: 0,
    })

    it('差異案例（special 8000 + general 15000 + assistive 7000）：舊法 20000 / 新法 15000', () => {
      const input = makeMedicalInput(8000, 15000, 7000)
      const oldLaw = computeCompulsoryMedicalByDate(input, '2024-01-01')
      const newLaw = computeCompulsoryMedicalByDate(input, '2026-07-01')
      const oldApproved = oldLaw.items.find((it) => it.key === 'medicalMaterial')?.approved ?? 0
      const newApproved = newLaw.items.find((it) => it.key === 'medicalMaterial')?.approved ?? 0
      expect(oldApproved).toBe(20_000)
      expect(newApproved).toBe(15_000)
      // CLI 會輸出「差異: -5000」+ 📉 emoji
      expect(newApproved - oldApproved).toBe(-5_000)
    })

    it('全額案例（special 5000 + general 0 + assistive 3000 = 8000）：新舊法同為 8000', () => {
      const input = makeMedicalInput(5000, 0, 3000)
      const oldLaw = computeCompulsoryMedicalByDate(input, '2024-01-01')
      const newLaw = computeCompulsoryMedicalByDate(input, '2026-07-01')
      const oldApproved = oldLaw.items.find((it) => it.key === 'medicalMaterial')?.approved ?? 0
      const newApproved = newLaw.items.find((it) => it.key === 'medicalMaterial')?.approved ?? 0
      // 都沒超過 2 萬上限，全額給付
      expect(oldApproved).toBe(8_000)
      expect(newApproved).toBe(8_000)
      expect(newApproved - oldApproved).toBe(0)
    })

    it('零輸入 → CLI 顯示「未填醫材費明細」（approved = 0）', () => {
      const input = makeMedicalInput(0, 0, 0)
      const oldLaw = computeCompulsoryMedicalByDate(input, '2024-01-01')
      const newLaw = computeCompulsoryMedicalByDate(input, '2026-07-01')
      const oldApproved = oldLaw.items.find((it) => it.key === 'medicalMaterial')?.approved ?? 0
      const newApproved = newLaw.items.find((it) => it.key === 'medicalMaterial')?.approved ?? 0
      expect(oldApproved).toBe(0)
      expect(newApproved).toBe(0)
    })

    it('subItems 數量：舊法 3 項 / 新法 2 項', () => {
      const input = makeMedicalInput(8000, 15000, 7000)
      const oldLaw = computeCompulsoryMedicalByDate(input, '2024-01-01')
      const newLaw = computeCompulsoryMedicalByDate(input, '2026-07-01')
      const oldItem = oldLaw.items.find((it) => it.key === 'medicalMaterial')
      const newItem = newLaw.items.find((it) => it.key === 'medicalMaterial')
      expect(oldItem?.subItems?.length).toBe(3)
      expect(newItem?.subItems?.length).toBe(2)
    })
  })

  describe('失能等級差異估算（CLI 主功能）', () => {
    it('User 案例：ROM 40% 下肢 → 舊法第 9 級 / 新法第 13 級', () => {
      expect(lookupDisabilityLevelByDate('lower', 40, '2024-01-01')).toBe(9)
      expect(lookupDisabilityLevelByDate('lower', 40, '2026-07-01')).toBe(13)
      // CLI 會輸出「差異: 切換生效（新法 13 級較高）」
      expect(
        lookupDisabilityLevelByDate('lower', 40, '2026-07-01') -
          lookupDisabilityLevelByDate('lower', 40, '2024-01-01'),
      ).toBe(4)
    })

    it('上肢 ROM 40% → 同樣新舊法切換差異', () => {
      expect(lookupDisabilityLevelByDate('upper', 40, '2024-01-01')).toBe(9)
      expect(lookupDisabilityLevelByDate('upper', 40, '2026-07-01')).toBe(13)
    })

    it('ROM 80% → 舊法第 2 級 / 新法第 11 級（切換大差異）', () => {
      expect(lookupDisabilityLevelByDate('lower', 80, '2024-01-01')).toBe(2)
      expect(lookupDisabilityLevelByDate('lower', 80, '2026-07-01')).toBe(11)
    })

    it('ROM 5% → 舊法第 13 級 / 新法第 15 級（fallback）', () => {
      // 5% 舊法：>= 5% → 第 13 級（極輕微機能障害）
      // 5% 新法：< 33% → classifyJointDisorder 回 'none' → 查表 null → fallback 15
      expect(lookupDisabilityLevelByDate('lower', 5, '2024-01-01')).toBe(13)
      expect(lookupDisabilityLevelByDate('lower', 5, '2026-07-01')).toBe(15)
    })

    it('ROM 0% → 新舊法同為第 15 級', () => {
      expect(lookupDisabilityLevelByDate('lower', 0, '2024-01-01')).toBe(15)
      expect(lookupDisabilityLevelByDate('lower', 0, '2026-07-01')).toBe(15)
    })
  })

  describe('CLI 計算邊界 — 切換日當日', () => {
    it('事故日 = 2026-07-01（切換當日）→ 走新法', () => {
      const isNew = isNewLaw('2026-07-01')
      expect(isNew).toBe(true)
      // CLI 顯示「距離切換日: 0 天」
    })

    it('事故日 = 2026-06-30（切換前日）→ 走舊法', () => {
      expect(isNewLaw('2026-06-30')).toBe(false)
    })
  })

  describe('NEW_LAW_CUTOFF 常數', () => {
    it('新法施行日應為 2026-07-01', () => {
      expect(NEW_LAW_CUTOFF).toBe('2026-07-01')
    })
  })
})
