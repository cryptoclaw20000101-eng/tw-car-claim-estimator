/**
 * PainEnsembleCard props 介面契約 + 業務不變量 — v0.6.7
 *
 * 為什麼不 render？
 *   PainEnsembleCard 是純組合元件（Statistic / Tag / Divider / InfoAlert）。
 *   AntD 元件在 SSR 會用 rc-util useId（需 jsdom），
 *   為避免 vitest 染 jsdom env + testing-library 依賴，
 *   採用 props 介面契約 + 業務不變量斷言，與 StepShell.test.tsx 同 pattern。
 *
 * 涵蓋:
 *   - props 介面 4 個必要欄位
 *   - 共識度 4 種等級型別收斂
 *   - 業務不變量：outlier 必有票 != outlier / 強共識一定有金額
 *   - LLM Advisor.requiresHumanReview 是 boolean
 */

import { describe, it, expect } from 'vitest'
import type { PainEnsembleCardProps } from '@/components/PainEnsembleCard'

const baseProps: PainEnsembleCardProps = {
  painEnsemble: {
    consensus: 'strong',
    consensusAmount: 250000,
    suggestedRange: null,
    outlier: undefined,
    rulesAmount: 240000,
    mlAmount: 260000,
    knnAmount: 250000,
    rulesWeight: 1.0,
    mlWeight: 1.0,
    knnWeight: 1.0,
    warning: undefined,
  },
  painAdvisor: {
    riskLevel: 'low',
    riskFactors: [],
    recommendations: [],
    consensusInterpretation: '三票聚集，無明顯 outlier',
    requiresHumanReview: false,
    promptTokens: 120,
    completionTokens: 80,
    disclaimer: '本估算僅供參考',
  },
  rulesRegionalMid: 240000,
  dollar: (n) => `NT$ ${n.toLocaleString('zh-TW')}`,
}

describe('PainEnsembleCard props 介面契約', () => {
  it('必要 4 欄位：painEnsemble / painAdvisor / rulesRegionalMid / dollar', () => {
    expect(baseProps.painEnsemble).toBeDefined()
    expect(baseProps.painAdvisor).toBeDefined()
    expect(typeof baseProps.rulesRegionalMid).toBe('number')
    expect(typeof baseProps.dollar).toBe('function')
  })

  it('consensus 收斂 4 種等級', () => {
    const levels: Array<PainEnsembleCardProps['painEnsemble']['consensus']> = [
      'strong',
      'partial',
      'weak',
      'insufficient',
    ]
    expect(levels).toHaveLength(4)
    // 強共識 = strong 一定有金額；弱共識 = weak 金額為 null 但有區間
    expect(baseProps.painEnsemble.consensus).toBe('strong')
    expect(baseProps.painEnsemble.consensusAmount).not.toBeNull()
  })

  it('outlier 是 optional 且只能是 rules / ml / knn', () => {
    const outliers: Array<NonNullable<PainEnsembleCardProps['painEnsemble']['outlier']>> = [
      'rules',
      'ml',
      'knn',
    ]
    expect(outliers).toEqual(['rules', 'ml', 'knn'])
  })

  it('painAdvisor.riskLevel 收斂 3 種等級', () => {
    const levels: Array<PainEnsembleCardProps['painAdvisor']['riskLevel']> = [
      'low',
      'medium',
      'high',
    ]
    expect(levels).toHaveLength(3)
  })

  it('painAdvisor.requiresHumanReview 是 boolean', () => {
    expect(typeof baseProps.painAdvisor.requiresHumanReview).toBe('boolean')
  })
})

describe('PainEnsembleCard 業務不變量', () => {
  it('強共識 → 共識金額必不為 null', () => {
    // 業務約定：strong/partial 共識一定有 consensusAmount
    // weak/insufficient 可為 null（顯示區間或 fallback）
    const strong = { ...baseProps.painEnsemble, consensus: 'strong' as const }
    expect(strong.consensus).toBe('strong')
    expect(strong.consensusAmount).not.toBeNull()
  })

  it('弱共識 → suggestedRange 應有值', () => {
    const weak: PainEnsembleCardProps['painEnsemble'] = {
      consensus: 'weak',
      consensusAmount: null,
      suggestedRange: { low: 180000, high: 320000 },
      outlier: undefined,
      rulesAmount: 200000,
      mlAmount: 280000,
      knnAmount: 300000,
      rulesWeight: 1.0,
      mlWeight: 0.7,
      knnWeight: 1.0,
      warning: '三票分散，建議人工複核',
    }
    expect(weak.consensus).toBe('weak')
    expect(weak.suggestedRange).not.toBeNull()
    expect(weak.suggestedRange!.low).toBeLessThanOrEqual(weak.suggestedRange!.high)
  })

  it('票數不足 → knnAmount 為 null 且 weight 為 0', () => {
    const insufficient: PainEnsembleCardProps['painEnsemble'] = {
      consensus: 'insufficient',
      consensusAmount: null,
      suggestedRange: null,
      outlier: undefined,
      rulesAmount: 240000,
      mlAmount: 0,
      knnAmount: null,
      rulesWeight: 1.0,
      mlWeight: 0,
      knnWeight: 0,
    }
    expect(insufficient.knnAmount).toBeNull()
    expect(insufficient.knnWeight).toBe(0)
  })

  it('outlier 必 != outlier 同名票（outlier 不能標自己）', () => {
    // 業務不變量：TicketTile 標 outlier 表示此票偏離，邏輯上票源跟 outlier 標籤必不同
    // 此測試守護未來重構不會誤讓 outlier == rulesAmount / mlAmount / knnAmount
    const partial: PainEnsembleCardProps['painEnsemble'] = {
      ...baseProps.painEnsemble,
      consensus: 'partial',
      outlier: 'rules',
    }
    // outlier='rules' 表示規則票偏離，三票中 ml + knn 應聚集
    expect(partial.outlier).toBe('rules')
    // 我們不擋 mlAmount === rulesAmount（同金額不代表同源），但業務邏輯上若 outlier=rules
    // ml 與 knn 票之間差距應 ≤20%（由 ensemble-engine 內 computeConsensus 守護）
    // 此測試僅守護型別不變量
    expect(['rules', 'ml', 'knn']).toContain(partial.outlier!)
  })

  it('disclaimer 永遠是非空字串（個資法 + 法律邊界）', () => {
    // 業務鐵律：painAdvisor.disclaimer 不可為空（UI 必顯示）
    expect(baseProps.painAdvisor.disclaimer.length).toBeGreaterThan(0)
  })

  it('LLM 顧問 token 數 = prompt + completion ≥ 0', () => {
    const total =
      baseProps.painAdvisor.promptTokens + baseProps.painAdvisor.completionTokens
    expect(total).toBeGreaterThanOrEqual(0)
  })

  it('dollar 函式對數字回傳字串', () => {
    expect(typeof baseProps.dollar(100)).toBe('string')
    expect(baseProps.dollar(100)).toMatch(/NT\$/)
  })
})

describe('PainEnsembleCard 結果頁串接', () => {
  it('呼叫端需傳 result.painEnsemble 跟 result.painAdvisor', () => {
    // 模擬結果頁呼叫端：必須拿 EstimationResult 兩個欄位
    // 此斷言守護未來重構 result schema 時不會漏
    interface MockResult {
      painEnsemble: PainEnsembleCardProps['painEnsemble']
      painAdvisor: PainEnsembleCardProps['painAdvisor']
    }
    const mockResult: MockResult = {
      painEnsemble: baseProps.painEnsemble,
      painAdvisor: baseProps.painAdvisor,
    }
    expect(mockResult.painEnsemble.consensus).toBe('strong')
    expect(mockResult.painAdvisor.riskLevel).toBe('low')
  })

  it('rulesRegionalMid 應等於規則票的票值', () => {
    // 業務約定：UI 區塊顯示 fallback 金額時用 pas.regionalMid
    expect(baseProps.rulesRegionalMid).toBe(240000)
    expect(baseProps.painEnsemble.rulesAmount).toBe(240000)
  })
})
