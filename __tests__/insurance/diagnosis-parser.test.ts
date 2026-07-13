import { describe, it, expect } from 'vitest'
import {
  extractDiagnosisFeatures,
  recommendDisabilityLevel,
} from '@/lib/insurance/diagnosis-parser'

describe('extractDiagnosisFeatures', () => {
  it('空字串 → 空 features', () => {
    const f = extractDiagnosisFeatures('')
    expect(f.injuries).toHaveLength(0)
    expect(f.hasJoint).toBe(false)
    expect(f.hasRomNumber).toBe(false)
    expect(f.hasRomPercent).toBe(false)
  })

  it('完全骨折 + 踝關節 + ROM 30 度', () => {
    const f = extractDiagnosisFeatures('右踝關節完全骨折，ROM 30 度')
    expect(f.injuries.length).toBeGreaterThan(0)
    expect(f.joints).toContain('ankle')
    expect(f.hasRomNumber).toBe(true)
    const inj = f.injuries.find((i) => i.joint === 'ankle')
    expect(inj).toBeDefined()
    expect(inj!.romLossDegree).toBe(30)
  })

  it('截肢 → level 1 override 候選', () => {
    const f = extractDiagnosisFeatures('右小腿截肢')
    const amput = f.injuries.find((i) => i.type === 'amputation')
    expect(amput).toBeDefined()
    expect(amput!.side).toBe('right')
  })

  it('半身癱 → paralysis_hemiplegia', () => {
    const f = extractDiagnosisFeatures('患者因車禍導致半身癱瘓')
    const hp = f.injuries.find((i) => i.type === 'paralysis_hemiplegia')
    expect(hp).toBeDefined()
  })

  it('視力 0.1 → vision_loss with vision=0.1', () => {
    const f = extractDiagnosisFeatures('左眼視力 0.1，視力喪失')
    const v = f.injuries.find((i) => i.type === 'vision_loss')
    expect(v).toBeDefined()
    expect(v!.vision).toBeCloseTo(0.1, 2)
  })

  it('聽力 60 dB → hearing_loss with hearingDb=60', () => {
    const f = extractDiagnosisFeatures('右耳聽力 60 dB，聽力障礙')
    const h = f.injuries.find((i) => i.type === 'hearing_loss')
    expect(h).toBeDefined()
    expect(h!.hearingDb).toBe(60)
  })

  it('喪失 40% → romLossPercent=40', () => {
    const f = extractDiagnosisFeatures('膝關節 ROM 喪失 40%')
    expect(f.hasRomPercent).toBe(true)
    const inj = f.injuries.find((i) => i.joint === 'knee')
    expect(inj).toBeDefined()
    expect(inj!.romLossPercent).toBe(40)
  })

  it('雙側關鍵字 → side=bilateral', () => {
    const f = extractDiagnosisFeatures('雙側膝關節疼痛')
    const inj = f.injuries.find((i) => i.joint === 'knee')
    expect(inj?.side).toBe('bilateral')
  })

  it('只有關節沒傷勢關鍵字 → type=unknown', () => {
    const f = extractDiagnosisFeatures('左肩關節活動受限')
    const inj = f.injuries.find((i) => i.joint === 'shoulder')
    expect(inj).toBeDefined()
    expect(inj!.type).toBe('unknown')
  })
})

describe('recommendDisabilityLevel', () => {
  it('截肢 → level 1 (high confidence)', () => {
    const f = extractDiagnosisFeatures('右小腿截肢')
    const r = recommendDisabilityLevel(f, '2026-01-01')
    expect(r.level).toBe(1)
    expect(r.confidence).toBe('high')
    expect(r.requiresHumanReview).toBe(false)
    expect(r.disclaimer).toContain('rule-based parser')
  })

  it('四肢癱 → level 1', () => {
    const f = extractDiagnosisFeatures('四肢癱瘓')
    const r = recommendDisabilityLevel(f)
    expect(r.level).toBe(1)
    expect(r.confidence).toBe('high')
  })

  it('半身癱 → level 2', () => {
    const f = extractDiagnosisFeatures('半身癱')
    const r = recommendDisabilityLevel(f)
    expect(r.level).toBe(2)
    expect(r.confidence).toBe('high')
  })

  it('踝關節 ROM 40% → 失能等級（high confidence）', () => {
    // 踝關節 normal ROM = 50，喪失 40% → 約 level 9 (新法 motion)
    const f = extractDiagnosisFeatures('踝關節活動度受限，ROM 喪失 40%')
    const r = recommendDisabilityLevel(f, '2026-08-01') // 新法
    expect(r.level).not.toBeNull()
    expect(r.confidence).toMatch(/high|medium/)
    expect(r.reasoning.length).toBeGreaterThan(0)
  })

  it('只有關鍵字沒數字 → level 13 + low confidence + requiresHumanReview', () => {
    const f = extractDiagnosisFeatures('患者骨折，神經損傷')
    const r = recommendDisabilityLevel(f)
    expect(r.level).toBe(13)
    expect(r.confidence).toBe('low')
    expect(r.requiresHumanReview).toBe(true)
  })

  it('完全無資料 → level null + none confidence', () => {
    const f = extractDiagnosisFeatures('')
    const r = recommendDisabilityLevel(f)
    expect(r.level).toBeNull()
    expect(r.confidence).toBe('none')
    expect(r.requiresHumanReview).toBe(true)
  })

  it('新/舊法切換 — 同一 ROM 40% 踝關節', () => {
    const oldLawText = '踝關節 ROM 喪失 40%'
    const f = extractDiagnosisFeatures(oldLawText)
    const r2024 = recommendDisabilityLevel(f, '2024-01-01') // 舊法
    const r2026 = recommendDisabilityLevel(f, '2026-08-01') // 新法
    // 兩者應該都給出非 null level，但可能不同
    expect(r2024.level).not.toBeNull()
    expect(r2026.level).not.toBeNull()
  })

  it('reasoning 永遠包含 disclaimer', () => {
    const f = extractDiagnosisFeatures('骨折')
    const r = recommendDisabilityLevel(f)
    expect(r.disclaimer.length).toBeGreaterThan(0)
  })

  it('reasoning trace 至少 1 行', () => {
    const f = extractDiagnosisFeatures('截肢')
    const r = recommendDisabilityLevel(f)
    expect(r.reasoning.length).toBeGreaterThan(0)
  })
})

describe('integrity invariants', () => {
  it('level 1-15 範圍', () => {
    const texts = ['截肢', '四肢癱', '半身癱', '粉碎性骨折 神經損傷', 'ROM 喪失 50%']
    for (const t of texts) {
      const f = extractDiagnosisFeatures(t)
      const r = recommendDisabilityLevel(f)
      if (r.level !== null) {
        expect(r.level).toBeGreaterThanOrEqual(1)
        expect(r.level).toBeLessThanOrEqual(15)
      }
    }
  })

  it('confidence score 在 0-1 範圍', () => {
    const texts = ['截肢', '骨折', 'ROM 50%', '', 'foobar']
    for (const t of texts) {
      const f = extractDiagnosisFeatures(t)
      const r = recommendDisabilityLevel(f)
      expect(r.confidenceScore).toBeGreaterThanOrEqual(0)
      expect(r.confidenceScore).toBeLessThanOrEqual(1)
    }
  })

  it('low/none confidence 永遠 requiresHumanReview=true', () => {
    const cases = [
      { text: '', desc: '空' },
      { text: '骨折', desc: '只有關鍵字' },
    ]
    for (const { text } of cases) {
      const f = extractDiagnosisFeatures(text)
      const r = recommendDisabilityLevel(f)
      if (r.confidence === 'low' || r.confidence === 'none') {
        expect(r.requiresHumanReview).toBe(true)
      }
    }
  })
})
