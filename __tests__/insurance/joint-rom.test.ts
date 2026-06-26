// =====================================================================
// 關節活動度（ROM）規則引擎 — 測試
// 守護 SPEC §四 失能初篩 + SPEC §七 失能等級對應
// =====================================================================

import { describe, it, expect } from 'vitest'
import {
  jointNormalRom,
  jointLabelZh,
  resolveNormalRom,
  levelFromRomLoss,
} from '@/lib/insurance/joint-rom'
import type { JointName } from '@/lib/insurance/types'

// =====================================================================
// 1. 常數表
// =====================================================================

describe('jointNormalRom / jointLabelZh — 常數表', () => {
  it('jointNormalRom 涵蓋全部 10 種關節', () => {
    const joints: JointName[] = [
      'shoulder', 'elbow', 'wrist', 'hip', 'knee',
      'ankle', 'finger', 'toe', 'cervical', 'lumbar',
    ]
    for (const j of joints) {
      expect(jointNormalRom[j]).toBeGreaterThan(0)
      expect(jointLabelZh[j]).toBeTruthy()
    }
  })

  it('jointLabelZh 提供中文標籤', () => {
    expect(jointLabelZh.shoulder).toBe('肩關節')
    expect(jointLabelZh.knee).toBe('膝關節')
    expect(jointLabelZh.cervical).toBe('頸椎')
    expect(jointLabelZh.lumbar).toBe('腰椎')
  })
})

// =====================================================================
// 2. resolveNormalRom — 正常 ROM 解析（含 fallback）
// =====================================================================

describe('resolveNormalRom — 正常 ROM 解析', () => {
  it('override > 0 時優先採用使用者輸入', () => {
    expect(resolveNormalRom('knee', 200)).toBe(200)
    expect(resolveNormalRom('shoulder', 100)).toBe(100)
  })

  it('override 為 0 / falsy 時 fallback 到預設表', () => {
    expect(resolveNormalRom('knee', 0)).toBe(jointNormalRom.knee) // 135
    expect(resolveNormalRom('shoulder', 0)).toBe(jointNormalRom.shoulder) // 180
  })

  it('override 為負數時 fallback 到預設表（防呆）', () => {
    expect(resolveNormalRom('knee', -10)).toBe(jointNormalRom.knee)
  })
})

// =====================================================================
// 3. levelFromRomLoss — 真實附表三分類（v0.6.6）
// 法源：強制汽車責任保險失能給付標準 §3 / §6 審核基準
//   - < 33% → 無明顯障害（severity=none, level=15）
//   - 33% ≤ loss < 50% → 運動障害（severity=motion, level=13）
//   - 50% ≤ loss < 100% → 顯著運動障害（severity=significant, level=11）
//   - 100% → 喪失機能（severity=lost, level=9）
// 對應條號（user 案例）：踝關節 20°/50° = 40% → 12-35 第 13 級
// =====================================================================

describe('levelFromRomLoss — 真實附表三分類', () => {
  it('負數 → severity=none + 第 15 級', () => {
    const r = levelFromRomLoss(-5)
    expect(r.severity).toBe('none')
    expect(r.level).toBe(15)
  })

  it('0% 邊界 → severity=none + 第 15 級', () => {
    const r = levelFromRomLoss(0)
    expect(r.severity).toBe('none')
    expect(r.level).toBe(15)
  })

  it('< 33% → severity=none（無明顯障害）', () => {
    expect(levelFromRomLoss(4.99).severity).toBe('none')
    expect(levelFromRomLoss(20).severity).toBe('none')
    expect(levelFromRomLoss(32.9).severity).toBe('none')
  })

  it('33% 邊界 → severity=motion + 第 13 級（剛好 1/3）', () => {
    const r = levelFromRomLoss(33)
    expect(r.severity).toBe('motion')
    expect(r.level).toBe(13)
  })

  it('< 50% → severity=motion（user 案例 40%）', () => {
    expect(levelFromRomLoss(40).severity).toBe('motion')
    expect(levelFromRomLoss(40).level).toBe(13)
    expect(levelFromRomLoss(49.9).severity).toBe('motion')
  })

  it('50% 邊界 → severity=significant + 第 11 級（剛好 1/2）', () => {
    const r = levelFromRomLoss(50)
    expect(r.severity).toBe('significant')
    expect(r.level).toBe(11)
  })

  it('< 100% → severity=significant', () => {
    expect(levelFromRomLoss(50).severity).toBe('significant')
    expect(levelFromRomLoss(75).severity).toBe('significant')
    expect(levelFromRomLoss(99.9).severity).toBe('significant')
  })

  it('100% 完整喪失 → severity=lost + 第 9 級', () => {
    const r = levelFromRomLoss(100)
    expect(r.severity).toBe('lost')
    expect(r.level).toBe(9)
  })

  it('> 100% 異常值 → 仍視為 lost + 第 9 級（防呆）', () => {
    const r = levelFromRomLoss(150)
    expect(r.severity).toBe('lost')
    expect(r.level).toBe(9)
  })

  it('回傳的 level 必為合法的 1-15 級', () => {
    for (const pct of [0, 33, 40, 50, 75, 99, 100, 150]) {
      const { level } = levelFromRomLoss(pct)
      expect(level).toBeGreaterThanOrEqual(1)
      expect(level).toBeLessThanOrEqual(15)
    }
  })

  it('confidence 隨 severity 提高（none < motion < significant ≤ lost）', () => {
    const none = levelFromRomLoss(0).confidence
    const motion = levelFromRomLoss(40).confidence
    const significant = levelFromRomLoss(60).confidence
    const lost = levelFromRomLoss(100).confidence
    expect(none).toBeLessThan(motion)
    expect(motion).toBeLessThan(significant)
    expect(significant).toBeLessThanOrEqual(lost)
  })
})
