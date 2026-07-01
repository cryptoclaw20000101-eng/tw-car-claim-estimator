// =====================================================================
// v0.8.2 法規版本切換判定 — 純函式測試
// =====================================================================

import { describe, expect, it } from 'vitest'
import { isNewLaw, NEW_LAW_CUTOFF, getLawVersionLabel } from '@/lib/data-sources/regulation-cutoff'

describe('isNewLaw — 強制險新法/舊法判定（v0.8.2+）', () => {
  it('NEW_LAW_CUTOFF 應為 2026-07-01（民國 115-07-01 強制險同日施行）', () => {
    expect(NEW_LAW_CUTOFF).toBe('2026-07-01')
  })

  describe('邊界日期', () => {
    it('2026-07-01（含當日）→ 新法', () => {
      expect(isNewLaw('2026-07-01')).toBe(true)
    })

    it('2026-06-30（前一日）→ 舊法', () => {
      expect(isNewLaw('2026-06-30')).toBe(false)
    })

    it('2026-07-02 → 新法', () => {
      expect(isNewLaw('2026-07-02')).toBe(true)
    })

    it('2025-12-31 → 舊法（去年）', () => {
      expect(isNewLaw('2025-12-31')).toBe(false)
    })

    it('2027-01-15 → 新法（明年）', () => {
      expect(isNewLaw('2027-01-15')).toBe(true)
    })
  })

  describe('容錯處理', () => {
    it('null → 新法（保守預設）', () => {
      expect(isNewLaw(null)).toBe(true)
    })

    it('undefined → 新法（保守預設）', () => {
      expect(isNewLaw(undefined)).toBe(true)
    })

    it("'' → 新法（保守預設）", () => {
      expect(isNewLaw('')).toBe(true)
    })

    it('非標準日期格式 → 舊法（避免誤判新法導致低估舊案件）', () => {
      expect(isNewLaw('invalid-date')).toBe(false)
      expect(isNewLaw('2026/07/01')).toBe(false) // 斜線分隔，無法解析
      expect(isNewLaw('07/01/2026')).toBe(false)
    })

    it('dayjs 物件 → 走 .format 風格字串前 10 碼比對', () => {
      // dayjs 物件 .format('YYYY-MM-DD') → 'YYYY-MM-DD' 字串；其他型別 fallback 為 undefined
      // 模擬：Date 物件 toString 可能含時間，這裡驗證字串前 10 碼邏輯
      const dateObj = new Date('2026-07-15T00:00:00Z')
      // Date.toString() 會含時間，但 slice(0, 10) 拿不到 'YYYY-MM-DD'，會 fallback 為 false（保守舊法）
      // 這是 design decision：避免時區轉換錯，保守走舊法
      expect(isNewLaw(dateObj as unknown as string)).toBe(false)
    })
  })

  describe('不變量', () => {
    it('同一日期呼叫兩次結果一致', () => {
      expect(isNewLaw('2026-07-01')).toBe(isNewLaw('2026-07-01'))
    })

    it('新法日期集合 ⊆ 全部日期（無重複判定）', () => {
      const dates = ['2026-07-01', '2026-07-02', '2027-01-01', '2030-12-31']
      for (const d of dates) {
        expect(isNewLaw(d)).toBe(true)
      }
    })

    it('舊法日期集合穩定', () => {
      const dates = ['2020-01-01', '2024-12-31', '2025-06-30', '2026-06-30']
      for (const d of dates) {
        expect(isNewLaw(d)).toBe(false)
      }
    })
  })
})

describe('getLawVersionLabel — UI 標籤', () => {
  it('新法日期 → 顯示「新法 (2026-07-01 起)」', () => {
    expect(getLawVersionLabel('2026-07-01')).toBe('新法 (2026-07-01 起)')
    expect(getLawVersionLabel('2027-01-15')).toBe('新法 (2026-07-01 起)')
  })

  it('舊法日期 → 顯示「舊法 (2026-07-01 前)」', () => {
    expect(getLawVersionLabel('2025-12-31')).toBe('舊法 (2026-07-01 前)')
    expect(getLawVersionLabel('2026-06-30')).toBe('舊法 (2026-07-01 前)')
  })

  it('null/undefined/空字串 → 預設新法標籤（保守）', () => {
    expect(getLawVersionLabel(null)).toBe('新法 (2026-07-01 起)')
    expect(getLawVersionLabel(undefined)).toBe('新法 (2026-07-01 起)')
    expect(getLawVersionLabel('')).toBe('新法 (2026-07-01 起)')
  })
})