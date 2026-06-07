// =====================================================================
// 失能等級金額表 — 測試
// 守護 SPEC §七 強制險失能等級金額 + 新舊制切換（2026-07-01 界線）
// =====================================================================

import { describe, it, expect } from 'vitest'
import {
  disabilityBenefitTableNew,
  disabilityBenefitTableOld,
  NEW_SYSTEM_CUTOFF,
  pickDisabilityTable,
  lookupDisabilityAmount,
} from '@/lib/insurance/disability-tables'
import type { DisabilityLevel } from '@/lib/insurance/types'

// =====================================================================
// 1. 常數表完整性
// =====================================================================

describe('disabilityBenefitTable — 常數表', () => {
  it('新制表涵蓋 1-15 全部等級', () => {
    for (let level = 1; level <= 15; level++) {
      const key = level as DisabilityLevel
      expect(disabilityBenefitTableNew[key]).toBeGreaterThan(0)
    }
  })

  it('舊制表涵蓋 1-15 全部等級', () => {
    for (let level = 1; level <= 15; level++) {
      const key = level as DisabilityLevel
      expect(disabilityBenefitTableOld[key]).toBeGreaterThan(0)
    }
  })

  it('新制金額 ≥ 舊制（修法提高）', () => {
    for (let level = 1; level <= 15; level++) {
      const key = level as DisabilityLevel
      expect(disabilityBenefitTableNew[key]).toBeGreaterThanOrEqual(
        disabilityBenefitTableOld[key],
      )
    }
  })

  it('等級越輕金額越少（單調遞減）', () => {
    // 第 1 級最重、第 15 級最輕
    expect(disabilityBenefitTableNew[1]).toBeGreaterThan(disabilityBenefitTableNew[2])
    expect(disabilityBenefitTableNew[1]).toBeGreaterThan(disabilityBenefitTableNew[15])
    expect(disabilityBenefitTableNew[14]).toBeGreaterThan(disabilityBenefitTableNew[15])
  })

  it('新制 1 級應為最高額（300 萬）', () => {
    expect(disabilityBenefitTableNew[1]).toBe(3_000_000)
  })
})

// =====================================================================
// 2. pickDisabilityTable — 新舊制切換
// =====================================================================

describe('pickDisabilityTable — 新舊制切換', () => {
  it('沒填事故日期 → fallback 到新制（安全預設）', () => {
    expect(pickDisabilityTable('')).toBe(disabilityBenefitTableNew)
  })

  it('事故日期 < 2026-07-01 → 舊制', () => {
    expect(pickDisabilityTable('2026-06-30')).toBe(disabilityBenefitTableOld)
    expect(pickDisabilityTable('2025-12-31')).toBe(disabilityBenefitTableOld)
    expect(pickDisabilityTable('2020-01-01')).toBe(disabilityBenefitTableOld)
  })

  it('事故日期 = 2026-07-01 → 新制（界線當日）', () => {
    expect(pickDisabilityTable('2026-07-01')).toBe(disabilityBenefitTableNew)
  })

  it('事故日期 > 2026-07-01 → 新制', () => {
    expect(pickDisabilityTable('2026-07-02')).toBe(disabilityBenefitTableNew)
    expect(pickDisabilityTable('2027-01-01')).toBe(disabilityBenefitTableNew)
  })

  it('NEW_SYSTEM_CUTOFF 常數值 = 2026-07-01', () => {
    expect(NEW_SYSTEM_CUTOFF).toBe('2026-07-01')
  })
})

// =====================================================================
// 3. lookupDisabilityAmount — 等級查金額
// =====================================================================

describe('lookupDisabilityAmount — 等級查金額', () => {
  it('有效等級回傳對應金額', () => {
    expect(lookupDisabilityAmount(1, disabilityBenefitTableNew)).toBe(3_000_000)
    expect(lookupDisabilityAmount(15, disabilityBenefitTableNew)).toBe(80_000)
  })

  it('無效等級（undefined）回傳 0（防呆）', () => {
    expect(lookupDisabilityAmount(99 as DisabilityLevel, disabilityBenefitTableNew)).toBe(0)
    expect(lookupDisabilityAmount(undefined as unknown as DisabilityLevel, disabilityBenefitTableNew)).toBe(0)
  })
})
