// =====================================================================
// 三大關節障害對照表測試 — v0.6.6
//
// 法源：強制汽車責任保險失能給付標準表（民國 115-05-29 修正）
// PDF: doc_48f88159057e_附表-強制汽車責任保險失能給付標準表.pdf
//
// 守護關鍵條號對應（任一對照表錯了會害經紀人解釋錯誤的理賠金額）：
//   - 上肢 11-23 ~ 11-44（肩 + 肘 + 腕 三大關節）
//   - 下肢 12-18 ~ 12-37（髖 + 膝 + 踝 三大關節）
//
// 特別守護刺刺回報的 bug 案例：踝關節 ROM 喪失 20°（40%）→ 12-35 第 13 級
// =====================================================================

import { describe, it, expect } from 'vitest'
import {
  classifyJointDisorder,
  lookupUpperLimbLevel,
  lookupLowerLimbLevel,
  type LimbDisorderSummary,
} from '@/lib/insurance/disability-joint-mapping'

describe('classifyJointDisorder — 法源 §3 / §6 三分類', () => {
  it('喪失 0-32% → none（無明顯障害）', () => {
    expect(classifyJointDisorder(0)).toBe('none')
    expect(classifyJointDisorder(20)).toBe('none')
    expect(classifyJointDisorder(32.9)).toBe('none')
  })

  it('喪失 33-49% → motion（運動障害，最輕）', () => {
    expect(classifyJointDisorder(33)).toBe('motion')
    expect(classifyJointDisorder(40)).toBe('motion') // user 案例
    expect(classifyJointDisorder(49.9)).toBe('motion')
  })

  it('喪失 50-99% → significant（顯著運動障害，中度）', () => {
    expect(classifyJointDisorder(50)).toBe('significant')
    expect(classifyJointDisorder(75)).toBe('significant')
    expect(classifyJointDisorder(99.9)).toBe('significant')
  })

  it('喪失 100% → lost（完全強直/麻痺）', () => {
    expect(classifyJointDisorder(100)).toBe('lost')
  })

  it('負數 / 邊界保護', () => {
    expect(classifyJointDisorder(-5)).toBe('none')
  })

  it('user 案例：踝關節 ROM 喪失 20°（40%）→ motion', () => {
    // 踝關節正常 ROM 50°，喪失 20° = 40% → 1/3 ≤ 40% < 1/2 → 運動障害
    expect(classifyJointDisorder(40)).toBe('motion')
  })
})

describe('lookupUpperLimbLevel — 上肢三大關節對照（肩/肘/腕）', () => {
  it('11-23 兩上肢均喪失機能 → 第 2 級', () => {
    const result = lookupUpperLimbLevel(
      { count: 'full', severity: 'lost' },
      { count: 'full', severity: 'lost' },
    )
    expect(result).toEqual({ articleId: '11-23', level: 2 })
  })

  it('11-25 兩上肢三大關節各有一大關節喪失機能 → 第 6 級', () => {
    const result = lookupUpperLimbLevel(
      { count: '1', severity: 'lost' },
      { count: '1', severity: 'lost' },
    )
    expect(result).toEqual({ articleId: '11-25', level: 6 })
  })

  it('11-28 一上肢三大關節有一大關節喪失機能（另側正常）→ 第 9 級', () => {
    const result = lookupUpperLimbLevel(
      { count: '1', severity: 'lost' },
      { count: '0', severity: 'none' },
    )
    expect(result).toEqual({ articleId: '11-28', level: 9 })
  })

  it('11-40 一上肢三大關節有一大關節遺存運動障害（另側正常）→ 第 13 級', () => {
    // 對應刺刺 user 案例的上肢版
    const result = lookupUpperLimbLevel(
      { count: '1', severity: 'motion' },
      { count: '0', severity: 'none' },
    )
    expect(result).toEqual({ articleId: '11-40', level: 13 })
  })

  it('左/右對稱（順序不影響結果）', () => {
    const a = lookupUpperLimbLevel(
      { count: '1', severity: 'motion' },
      { count: '0', severity: 'none' },
    )
    const b = lookupUpperLimbLevel(
      { count: '0', severity: 'none' },
      { count: '1', severity: 'motion' },
    )
    expect(a).toEqual(b)
  })

  it('找不到對應條號 → null', () => {
    const result = lookupUpperLimbLevel(
      { count: 'full', severity: 'motion' },
      { count: 'full', severity: 'none' },
    )
    expect(result).toBeNull()
  })
})

describe('lookupLowerLimbLevel — 下肢三大關節對照（髖/膝/踝）', () => {
  it('12-18 兩下肢均喪失機能 → 第 2 級', () => {
    const result = lookupLowerLimbLevel(
      { count: 'full', severity: 'lost' },
      { count: 'full', severity: 'lost' },
    )
    expect(result).toEqual({ articleId: '12-18', level: 2 })
  })

  it('12-20 兩下肢三大關節各有一大關節喪失機能 → 第 6 級', () => {
    const result = lookupLowerLimbLevel(
      { count: '1', severity: 'lost' },
      { count: '1', severity: 'lost' },
    )
    expect(result).toEqual({ articleId: '12-20', level: 6 })
  })

  it('12-23 一下肢三大關節有一大關節喪失機能 → 第 9 級', () => {
    const result = lookupLowerLimbLevel(
      { count: '1', severity: 'lost' },
      { count: '0', severity: 'none' },
    )
    expect(result).toEqual({ articleId: '12-23', level: 9 })
  })

  it('12-27 一下肢遺存顯著運動障害 → 第 7 級', () => {
    const result = lookupLowerLimbLevel(
      { count: 'full', severity: 'significant' },
      { count: '0', severity: 'none' },
    )
    expect(result).toEqual({ articleId: '12-27', level: 7 })
  })

  it('12-29 一下肢三大關節有一大關節遺存顯著運動障害 → 第 11 級', () => {
    const result = lookupLowerLimbLevel(
      { count: '1', severity: 'significant' },
      { count: '0', severity: 'none' },
    )
    expect(result).toEqual({ articleId: '12-29', level: 11 })
  })

  it('12-35 一下肢三大關節有一大關節遺存運動障害 → 第 13 級（user 案例）', () => {
    // 刺刺回報：踝關節 ROM 喪失 20° = 40% → motion → 一大關節 → 第 13 級
    const result = lookupLowerLimbLevel(
      { count: '1', severity: 'motion' },
      { count: '0', severity: 'none' },
    )
    expect(result).toEqual({ articleId: '12-35', level: 13 })
  })

  it('12-34 一下肢三大關節有二大關節遺存運動障害 → 第 11 級', () => {
    const result = lookupLowerLimbLevel(
      { count: '2', severity: 'motion' },
      { count: '0', severity: 'none' },
    )
    expect(result).toEqual({ articleId: '12-34', level: 11 })
  })

  it('12-33 一下肢遺存運動障害（三關節都 motion）→ 第 9 級', () => {
    const result = lookupLowerLimbLevel(
      { count: 'full', severity: 'motion' },
      { count: '0', severity: 'none' },
    )
    expect(result).toEqual({ articleId: '12-33', level: 9 })
  })

  it('左/右對稱（順序不影響結果）', () => {
    const a = lookupLowerLimbLevel(
      { count: '1', severity: 'motion' },
      { count: '0', severity: 'none' },
    )
    const b = lookupLowerLimbLevel(
      { count: '0', severity: 'none' },
      { count: '1', severity: 'motion' },
    )
    expect(a).toEqual(b)
    expect(a?.articleId).toBe('12-35')
    expect(a?.level).toBe(13)
  })

  it('兩下肢三大關節各有一大關節遺存運動障害（12-32）→ 第 11 級', () => {
    const result = lookupLowerLimbLevel(
      { count: '1', severity: 'motion' },
      { count: '1', severity: 'motion' },
    )
    expect(result).toEqual({ articleId: '12-32', level: 11 })
  })
})

describe('端到端：user 案例踝關節 20° 完整鏈', () => {
  it('踝關節正常 ROM 50°，喪失 20° → motion (40%) → 12-35 第 13 級', () => {
    const normalRom = 50
    const lossDegree = 20
    const lossPercent = (lossDegree / normalRom) * 100
    expect(lossPercent).toBe(40)

    const severity = classifyJointDisorder(lossPercent)
    expect(severity).toBe('motion')

    // 單側三大關節（髖/膝/踝）只有踝關節運動障害 → count='1'
    const summary: LimbDisorderSummary = { count: '1', severity }
    const result = lookupLowerLimbLevel(summary, { count: '0', severity: 'none' })
    expect(result?.articleId).toBe('12-35')
    expect(result?.level).toBe(13)
  })
})
