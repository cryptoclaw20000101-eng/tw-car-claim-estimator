/**
 * PainEnsembleCard SSR 渲染測試 — v0.6.7 UI 結構驗證
 *
 * 為什麼用 renderToString 而不是 @testing-library？
 *   vitest config 鎖 node env 不染 jsdom/happy-dom，
 *   AntD 元件內部用 rc-util useId，jsdom 必須手動 mock；
 *   改用 react-dom/server 的 renderToString 純 SSR：
 *   - 不需 jsdom/happy-dom
 *   - AntD 在 SSR 階段用 React.createElement 不呼叫 useId（不會炸）
 *   - 直接驗證最終 HTML 結構
 *
 * 涵蓋:
 *   - 強共識 → HTML 含「共識估算金額」「🟢 高度共識」+ 規則/ML/KNN 三票字眼
 *   - 弱共識 → 顯示建議區間字串「NT$ X ~ NT$ Y」
 *   - 人工複核 → HTML 含「建議人工複核」+ red InfoAlert
 *   - disclaimer 永遠渲染
 *   - outlier → 該票的「outlier」標籤出現
 *   - KNN null → 該票「無相似案件」標籤出現
 */
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { PainEnsembleCard, type PainEnsembleCardProps } from '@/components/PainEnsembleCard'

const dollar = (n: number) => `NT$ ${n.toLocaleString('zh-TW')}`

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
    disclaimer: '本估算僅供參考，不構成法律意見',
  },
  rulesRegionalMid: 240000,
  dollar,
}

describe('PainEnsembleCard SSR HTML 結構', () => {
  it('強共識 → 渲染共識金額 + 高度共識 badge', () => {
    const html = renderToString(<PainEnsembleCard {...baseProps} />)
    expect(html).toContain('共識估算金額')
    expect(html).toContain('高度共識')
    expect(html).toContain('NT$ 250,000')
  })

  it('三票展開 → HTML 含規則/ML/KNN 三票字眼', () => {
    const html = renderToString(<PainEnsembleCard {...baseProps} />)
    // v0.6.7 UI 改用「規則算法 / 案例比對 / 歷史相似」三票標籤
    expect(html).toContain('規則算法')
    expect(html).toContain('案例比對')
    expect(html).toContain('歷史相似')
  })

  it('三票金額都渲染（規則 240K + ML 260K + KNN 250K）', () => {
    const html = renderToString(<PainEnsembleCard {...baseProps} />)
    expect(html).toContain('NT$ 240,000')
    expect(html).toContain('NT$ 260,000')
    expect(html).toContain('NT$ 250,000')
  })

  it('弱共識 → 顯示建議區間字串', () => {
    const props: PainEnsembleCardProps = {
      ...baseProps,
      painEnsemble: {
        ...baseProps.painEnsemble,
        consensus: 'weak',
        consensusAmount: null,
        suggestedRange: { low: 180000, high: 320000 },
        outlier: undefined,
        warning: '三票分散，建議人工複核',
      },
    }
    const html = renderToString(<PainEnsembleCard {...props} />)
    expect(html).toContain('弱共識')
    expect(html).toContain('NT$ 180,000')
    expect(html).toContain('NT$ 320,000')
    expect(html).toContain('建議人工複核')
  })

  it('outlier = rules → 規則票顯示 outlier 標籤', () => {
    const props: PainEnsembleCardProps = {
      ...baseProps,
      painEnsemble: {
        ...baseProps.painEnsemble,
        consensus: 'partial',
        outlier: 'rules',
      },
    }
    const html = renderToString(<PainEnsembleCard {...props} />)
    expect(html).toContain('部分共識')
    // 規則票的 outlier 標籤
    expect(html).toMatch(/規則算法[\s\S]*?outlier/)
  })

  it('KNN null → 該票顯示「無相似案件」標籤且 dim', () => {
    const props: PainEnsembleCardProps = {
      ...baseProps,
      painEnsemble: {
        ...baseProps.painEnsemble,
        consensus: 'insufficient',
        consensusAmount: null,
        knnAmount: null,
        knnWeight: 0,
        mlAmount: 0,
        mlWeight: 0,
      },
    }
    const html = renderToString(<PainEnsembleCard {...props} />)
    expect(html).toContain('無相似案件')
    expect(html).toContain('票數不足')
  })

  it('requiresHumanReview=true → 渲染紅框「建議人工複核」', () => {
    const props: PainEnsembleCardProps = {
      ...baseProps,
      painAdvisor: {
        ...baseProps.painAdvisor,
        riskLevel: 'high',
        riskFactors: ['失能等級超過預期', '保額可能不足'],
        recommendations: ['補失能鑑定報告', '加保第三人責任險'],
        requiresHumanReview: true,
      },
    }
    const html = renderToString(<PainEnsembleCard {...props} />)
    expect(html).toContain('建議人工複核')
    expect(html).toContain('風險高')
    expect(html).toContain('失能等級超過預期')
    expect(html).toContain('補失能鑑定報告')
  })

  it('LLM token 數顯示在人工複核警示內', () => {
    const props: PainEnsembleCardProps = {
      ...baseProps,
      painAdvisor: {
        ...baseProps.painAdvisor,
        requiresHumanReview: true,
        promptTokens: 350,
        completionTokens: 180,
      },
    }
    const html = renderToString(<PainEnsembleCard {...props} />)
    // React 在 SSR 用 <!-- --> 分隔數字字面值（避免 hydration warning），
    // 所以「350 prompt」不會連在一起。用獨立 substring 驗證
    expect(html).toContain('350')
    expect(html).toContain('prompt')
    expect(html).toContain('180')
    expect(html).toContain('completion')
  })

  it('disclaimer 永遠渲染（個資法 + 法律邊界）', () => {
    const props: PainEnsembleCardProps = {
      ...baseProps,
      painAdvisor: {
        ...baseProps.painAdvisor,
        disclaimer: '測試專用免責聲明',
      },
    }
    const html = renderToString(<PainEnsembleCard {...props} />)
    expect(html).toContain('測試專用免責聲明')
  })

  it('riskFactors 空時不渲染「風險因子：」標籤', () => {
    const html = renderToString(<PainEnsembleCard {...baseProps} />)
    expect(html).not.toContain('風險因子')
  })

  it('警告訊息 warning 顯示為 InfoAlert warning type', () => {
    const props: PainEnsembleCardProps = {
      ...baseProps,
      painEnsemble: {
        ...baseProps.painEnsemble,
        warning: '規則與 ML 差距 > 30%，diverge 警示',
      },
    }
    const html = renderToString(<PainEnsembleCard {...props} />)
    expect(html).toContain('規則與 ML 差距')
  })
})

describe('PainEnsembleCard props 介面契約（補強）', () => {
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
  })

  it('painAdvisor.riskLevel 收斂 3 種等級', () => {
    const levels: Array<PainEnsembleCardProps['painAdvisor']['riskLevel']> = [
      'low',
      'medium',
      'high',
    ]
    expect(levels).toHaveLength(3)
  })

  it('outlier 是 optional 且只能是 rules / ml / knn', () => {
    const outliers: Array<NonNullable<PainEnsembleCardProps['painEnsemble']['outlier']>> = [
      'rules',
      'ml',
      'knn',
    ]
    expect(outliers).toEqual(['rules', 'ml', 'knn'])
  })
})

describe('PainEnsembleCard 業務不變量（補強）', () => {
  it('強共識 → 共識金額必不為 null', () => {
    expect(baseProps.painEnsemble.consensus).toBe('strong')
    expect(baseProps.painEnsemble.consensusAmount).not.toBeNull()
  })

  it('弱共識 → suggestedRange 應有值', () => {
    const weak: PainEnsembleCardProps['painEnsemble'] = {
      ...baseProps.painEnsemble,
      consensus: 'weak',
      consensusAmount: null,
      suggestedRange: { low: 180000, high: 320000 },
    }
    expect(weak.suggestedRange).not.toBeNull()
    expect(weak.suggestedRange!.low).toBeLessThanOrEqual(weak.suggestedRange!.high)
  })

  it('dollar 函式對數字回傳字串', () => {
    expect(typeof dollar(100)).toBe('string')
    expect(dollar(100)).toMatch(/NT\$/)
  })
})
