// =====================================================================
// levelFromRomLoss v0.6.6 severity 欄位測試 — 真實附表三分類
// 對應 joint-rom.ts 升級版（回傳 level + confidence + severity）
// =====================================================================

import { describe, it, expect } from 'vitest'
import { levelFromRomLoss } from '@/lib/insurance/joint-rom'

describe('levelFromRomLoss — v0.6.6 真實附表三分類', () => {
  it('< 33% 喪失 → severity=none + 第 15 級', () => {
    const r = levelFromRomLoss(0)
    expect(r.severity).toBe('none')
    expect(r.level).toBe(15)
  })

  it('20% 喪失 → severity=none（< 33%）', () => {
    const r = levelFromRomLoss(20)
    expect(r.severity).toBe('none')
    expect(r.level).toBe(15)
  })

  it('32% 喪失 → severity=none（剛好 < 33%）', () => {
    const r = levelFromRomLoss(32)
    expect(r.severity).toBe('none')
  })

  it('33% 喪失 → severity=motion + 第 13 級（剛好 1/3）', () => {
    const r = levelFromRomLoss(33)
    expect(r.severity).toBe('motion')
    expect(r.level).toBe(13)
  })

  it('40% 喪失 → severity=motion（user 案例：踝關節 20°/50°）', () => {
    const r = levelFromRomLoss(40)
    expect(r.severity).toBe('motion')
    expect(r.level).toBe(13)
  })

  it('49% 喪失 → severity=motion（剛好 < 50%）', () => {
    const r = levelFromRomLoss(49)
    expect(r.severity).toBe('motion')
  })

  it('50% 喪失 → severity=significant + 第 11 級（剛好 1/2）', () => {
    const r = levelFromRomLoss(50)
    expect(r.severity).toBe('significant')
    expect(r.level).toBe(11)
  })

  it('75% 喪失 → severity=significant', () => {
    const r = levelFromRomLoss(75)
    expect(r.severity).toBe('significant')
  })

  it('99% 喪失 → severity=significant（剛好 < 100%）', () => {
    const r = levelFromRomLoss(99)
    expect(r.severity).toBe('significant')
  })

  it('100% 喪失 → severity=lost + 第 9 級', () => {
    const r = levelFromRomLoss(100)
    expect(r.severity).toBe('lost')
    expect(r.level).toBe(9)
  })

  it('負數 → severity=none + level 15', () => {
    const r = levelFromRomLoss(-5)
    expect(r.severity).toBe('none')
    expect(r.level).toBe(15)
  })

  it('回傳 confidence 隨 severity 提高（none < motion < significant < lost）', () => {
    const none = levelFromRomLoss(0).confidence
    const motion = levelFromRomLoss(40).confidence
    const significant = levelFromRomLoss(60).confidence
    const lost = levelFromRomLoss(100).confidence
    expect(none).toBeLessThan(motion)
    expect(motion).toBeLessThan(significant)
    expect(significant).toBeLessThanOrEqual(lost)
  })
})
