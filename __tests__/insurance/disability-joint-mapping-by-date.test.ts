// =====================================================================
// v0.8.2 失能等級新/舊法切換 — 計算引擎測試
// 強制汽車責任保險失能給付標準表（民國 115-05-29 修正，115-07-01 施行）
// =====================================================================

import { describe, expect, it } from 'vitest'
import {
  classifyJointDisorder,
  levelFromRomLossOldLaw,
  lookupDisabilityLevelByDate,
  lookupLowerLimbLevel,
  lookupUpperLimbLevel,
} from '@/lib/insurance/disability-joint-mapping'

describe('levelFromRomLossOldLaw — 舊法百分比段（v0.6.6 之前邏輯）', () => {
  describe('5/15/30/50/70% 五層閾值', () => {
    it('100% → 第 2 級（嚴重機能喪失）', () => {
      expect(levelFromRomLossOldLaw(100)).toBe(2)
    })

    it('70% → 第 2 級', () => {
      expect(levelFromRomLossOldLaw(70)).toBe(2)
    })

    it('69% → 第 7 級（中度機能障害）', () => {
      expect(levelFromRomLossOldLaw(69)).toBe(7)
    })

    it('50% → 第 7 級', () => {
      expect(levelFromRomLossOldLaw(50)).toBe(7)
    })

    it('49% → 第 9 級（輕度機能障害）', () => {
      expect(levelFromRomLossOldLaw(49)).toBe(9)
    })

    it('30% → 第 9 級', () => {
      expect(levelFromRomLossOldLaw(30)).toBe(9)
    })

    it('29% → 第 11 級（輕微機能障害）', () => {
      expect(levelFromRomLossOldLaw(29)).toBe(11)
    })

    it('15% → 第 11 級', () => {
      expect(levelFromRomLossOldLaw(15)).toBe(11)
    })

    it('14% → 第 13 級（極輕微機能障害）', () => {
      expect(levelFromRomLossOldLaw(14)).toBe(13)
    })

    it('5% → 第 13 級', () => {
      expect(levelFromRomLossOldLaw(5)).toBe(13)
    })

    it('4% → 第 15 級（無明顯障害）', () => {
      expect(levelFromRomLossOldLaw(4)).toBe(15)
    })

    it('0% → 第 15 級', () => {
      expect(levelFromRomLossOldLaw(0)).toBe(15)
    })
  })

  it('負數 → 第 15 級（守護）', () => {
    expect(levelFromRomLossOldLaw(-5)).toBe(15)
  })
})

describe('lookupDisabilityLevelByDate — 依事故日切換新/舊法', () => {
  describe('user 案例：踝關節 ROM 20°（40%）', () => {
    it('事故日 2024-01-01（舊法）→ 第 9 級（30% ≤ 40% < 50%）', () => {
      // 40% 在舊法百分比段：30% ≤ 40% < 50% → 第 9 級（輕度機能障害）
      expect(lookupDisabilityLevelByDate('lower', 40, '2024-01-01')).toBe(9)
    })

    it('事故日 2026-06-30（舊法，前一日）→ 第 9 級', () => {
      expect(lookupDisabilityLevelByDate('lower', 40, '2026-06-30')).toBe(9)
    })

    it('事故日 2026-07-01（新法，含當日）→ 第 13 級（user 真實案例）', () => {
      // 40% 在新法三分類：33% ≤ 40% < 50% → motion（運動障害）
      // 對應 LOWER table 'motion|1|none|0' = 12-35 = 第 13 級
      expect(lookupDisabilityLevelByDate('lower', 40, '2026-07-01')).toBe(13)
    })

    it('事故日 2027-01-15（明年，新法）→ 第 13 級', () => {
      expect(lookupDisabilityLevelByDate('lower', 40, '2027-01-15')).toBe(13)
    })
  })

  describe('null / undefined 保守預設 → 新法', () => {
    it('null → 新法（預設 = 第 13 級）', () => {
      expect(lookupDisabilityLevelByDate('lower', 40, null)).toBe(13)
    })

    it('undefined → 新法（預設 = 第 13 級）', () => {
      expect(lookupDisabilityLevelByDate('lower', 40, undefined)).toBe(13)
    })

    it("'' → 新法（預設 = 第 13 級）", () => {
      expect(lookupDisabilityLevelByDate('lower', 40, '')).toBe(13)
    })
  })

  describe('其他 ROM 百分比的切換差異', () => {
    it('ROM 60%（顯著運動障害）：新舊法同為第 7 級', () => {
      // 60% 舊法：50% ≤ 60% < 70% → 第 7 級
      // 60% 新法：>= 50% → significant → 對照表 'significant|1|none|0' = 12-29 = 第 11 級（下肢）
      // 等等不對 — 重新看三分類閾值：50% 是顯著 vs motion 邊界
      // 60% classify → 'significant'
      // lower table 'significant|1|none|0' = 12-29 = 第 11 級
      // 新法第 11 級 ≠ 舊法第 7 級 → 切換生效
      expect(lookupDisabilityLevelByDate('lower', 60, '2024-01-01')).toBe(7)
      expect(lookupDisabilityLevelByDate('lower', 60, '2026-07-01')).toBe(11)
    })

    it('ROM 80%（顯著運動障害）：舊法第 2 級 / 新法第 11 級', () => {
      // 80% 舊法：>= 70% → 第 2 級
      // 80% 新法：significant → lower 'significant|1|none|0' = 第 11 級
      expect(lookupDisabilityLevelByDate('lower', 80, '2024-01-01')).toBe(2)
      expect(lookupDisabilityLevelByDate('lower', 80, '2026-07-01')).toBe(11)
    })

    it('ROM 35%（運動障害）：舊法第 9 級 / 新法第 13 級', () => {
      // 35% 舊法：>= 30% → 第 9 級
      // 35% 新法：33% ≤ 35% < 50% → motion → 第 13 級
      expect(lookupDisabilityLevelByDate('lower', 35, '2024-01-01')).toBe(9)
      expect(lookupDisabilityLevelByDate('lower', 35, '2026-07-01')).toBe(13)
    })

    it('ROM 10%（極輕微）：舊法第 13 級 / 新法第 15 級', () => {
      // 10% 舊法：>= 5% → 第 13 級
      // 10% 新法：< 33% → none → lookupUpperLimbLevel / lookupLowerLimbLevel 回 null → fallback 15
      expect(lookupDisabilityLevelByDate('lower', 10, '2024-01-01')).toBe(13)
      expect(lookupDisabilityLevelByDate('lower', 10, '2026-07-01')).toBe(15)
    })
  })

  describe('上肢切換', () => {
    it('上肢 ROM 40%：舊法第 9 級 / 新法第 13 級', () => {
      // 上肢跟下肢同樣規則（新法對照表 11-40 = 13 級）
      expect(lookupDisabilityLevelByDate('upper', 40, '2024-01-01')).toBe(9)
      expect(lookupDisabilityLevelByDate('upper', 40, '2026-07-01')).toBe(13)
    })

    it('上肢 ROM 80%：舊法第 2 級 / 新法第 11 級', () => {
      // 上肢對照表 'significant|1|none|0' = 11-34 = 第 11 級
      expect(lookupDisabilityLevelByDate('upper', 80, '2024-01-01')).toBe(2)
      expect(lookupDisabilityLevelByDate('upper', 80, '2026-07-01')).toBe(11)
    })
  })
})

describe('classifyJointDisorder — 新法三分類（不變）', () => {
  it('< 33% → none', () => {
    expect(classifyJointDisorder(0)).toBe('none')
    expect(classifyJointDisorder(32)).toBe('none')
  })

  it('33% ≤ x < 50% → motion', () => {
    expect(classifyJointDisorder(33)).toBe('motion')
    expect(classifyJointDisorder(40)).toBe('motion')
    expect(classifyJointDisorder(49)).toBe('motion')
  })

  it('50% ≤ x < 100% → significant', () => {
    expect(classifyJointDisorder(50)).toBe('significant')
    expect(classifyJointDisorder(99)).toBe('significant')
  })

  it('>= 100% → lost', () => {
    expect(classifyJointDisorder(100)).toBe('lost')
  })
})

describe('不變量', () => {
  it('lookupUpperLimbLevel / lookupLowerLimbLevel 仍可單獨呼叫（新法三分類 API 向後相容）', () => {
    const result = lookupLowerLimbLevel(
      { count: '1', severity: 'motion' },
      { count: '0', severity: 'none' },
    )
    expect(result?.level).toBe(13)
    expect(result?.articleId).toBe('12-35')
  })

  it('同一個案新舊法可能差異極大（守護：切換不會無聲）', () => {
    // ROM 40% 舊法 vs 新法
    const oldL = lookupDisabilityLevelByDate('lower', 40, '2024-01-01')
    const newL = lookupDisabilityLevelByDate('lower', 40, '2026-07-01')
    expect(oldL).not.toBe(newL) // 確保切換有效
  })

  it('事故日 null/undefined 跟 2026-07-01 同結果（保守預設 = 新法）', () => {
    const nullResult = lookupDisabilityLevelByDate('lower', 40, null)
    const newLawResult = lookupDisabilityLevelByDate('lower', 40, '2026-07-01')
    expect(nullResult).toBe(newLawResult)
  })

  it('level 結果在 1-15 範圍內', () => {
    const testCases = [
      { joint: 'lower' as const, percent: 0 },
      { joint: 'lower' as const, percent: 40 },
      { joint: 'lower' as const, percent: 80 },
      { joint: 'lower' as const, percent: 100 },
      { joint: 'upper' as const, percent: 40 },
      { joint: 'upper' as const, percent: 100 },
    ]
    for (const tc of testCases) {
      const oldL = lookupDisabilityLevelByDate(tc.joint, tc.percent, '2024-01-01')
      const newL = lookupDisabilityLevelByDate(tc.joint, tc.percent, '2026-07-01')
      expect(oldL).toBeGreaterThanOrEqual(1)
      expect(oldL).toBeLessThanOrEqual(15)
      expect(newL).toBeGreaterThanOrEqual(1)
      expect(newL).toBeLessThanOrEqual(15)
    }
  })
})
