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
// 3. levelFromRomLoss — 7 段等級對應（覆蓋全部邊界）
// =====================================================================

describe('levelFromRomLoss — 等級推估', () => {
  it('負數 → 推定等級 15（不適用）', () => {
    expect(levelFromRomLoss(-5)).toEqual({ level: 15, confidence: 0 })
  })

  it('0% 邊界 → 推定等級 15（無明顯失能）', () => {
    expect(levelFromRomLoss(0)).toEqual({ level: 15, confidence: 0.3 })
  })

  it('< 5% → 推定等級 15', () => {
    expect(levelFromRomLoss(4.99)).toEqual({ level: 15, confidence: 0.3 })
  })

  it('5% 邊界 → 推定等級 12', () => {
    expect(levelFromRomLoss(5)).toEqual({ level: 12, confidence: 0.5 })
  })

  it('< 15% → 推定等級 12', () => {
    expect(levelFromRomLoss(14)).toEqual({ level: 12, confidence: 0.5 })
  })

  it('15% 邊界 → 推定等級 9', () => {
    expect(levelFromRomLoss(15)).toEqual({ level: 9, confidence: 0.6 })
  })

  it('< 30% → 推定等級 9', () => {
    expect(levelFromRomLoss(29)).toEqual({ level: 9, confidence: 0.6 })
  })

  it('30% 邊界 → 推定等級 6', () => {
    expect(levelFromRomLoss(30)).toEqual({ level: 6, confidence: 0.7 })
  })

  it('< 50% → 推定等級 6', () => {
    expect(levelFromRomLoss(49)).toEqual({ level: 6, confidence: 0.7 })
  })

  it('50% 邊界 → 推定等級 4（重度）', () => {
    expect(levelFromRomLoss(50)).toEqual({ level: 4, confidence: 0.75 })
  })

  it('< 70% → 推定等級 4', () => {
    expect(levelFromRomLoss(69)).toEqual({ level: 4, confidence: 0.75 })
  })

  it('70% 邊界 → 推定等級 2（極重度）', () => {
    expect(levelFromRomLoss(70)).toEqual({ level: 2, confidence: 0.8 })
  })

  it('100% 完整喪失 → 推定等級 2', () => {
    expect(levelFromRomLoss(100)).toEqual({ level: 2, confidence: 0.8 })
  })

  it('> 100% 異常值 → 仍推定等級 2（防呆）', () => {
    expect(levelFromRomLoss(150)).toEqual({ level: 2, confidence: 0.8 })
  })

  it('回傳的 level 必為合法的 1-15 級', () => {
    for (const pct of [0, 5, 15, 30, 50, 70, 100]) {
      const { level } = levelFromRomLoss(pct)
      expect(level).toBeGreaterThanOrEqual(1)
      expect(level).toBeLessThanOrEqual(15)
    }
  })
})
