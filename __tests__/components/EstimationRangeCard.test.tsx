// =====================================================================
// 精神慰撫金參考區間卡 — UI 元件測試
// =====================================================================

import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { EstimationRangeCard } from '@/app/claims/result/_sections/EstimationRangeCard'

function strip(html: string): string {
  return html.replace(/<!--\s*-->/g, '')
}

const dollar = (n: number) => `NT$${n.toLocaleString()}`

const minimalProps = {
  pas: { regionalLow: 200000, regionalMid: 320000, regionalHigh: 480000 },
  painEnsemble: {
    consensus: 'strong' as const,
    consensusAmount: 320000,
    mlConfidence: 'high' as const,
  },
  painAdvisor: {
    requiresHumanReview: false,
    riskFactors: [],
    disclaimer: '免責聲明',
  },
  missingDocuments: [],
  dollar,
}

describe('EstimationRangeCard — 精神慰撫金參考區間', () => {
  it('明確標示為精神慰撫金，不得冒充整案合理求償區間', () => {
    const html = strip(renderToString(<EstimationRangeCard {...minimalProps} />))
    expect(html).toContain('精神慰撫金參考區間')
    expect(html).toContain('不是整案總求償金額')
    expect(html).not.toContain('合理求償區間')
  })

  it('顯示三個慰撫金區間：保守 / 一般 / 積極', () => {
    const html = strip(renderToString(<EstimationRangeCard {...minimalProps} />))
    expect(html).toContain('慰撫金保守值')
    expect(html).toContain('慰撫金一般值')
    expect(html).toContain('慰撫金積極值')
  })

  it('三個區間都有 data-testid 方便 e2e 抓取', () => {
    const html = renderToString(<EstimationRangeCard {...minimalProps} />)
    expect(html).toContain('data-testid="range-conservative"')
    expect(html).toContain('data-testid="range-baseline"')
    expect(html).toContain('data-testid="range-aggressive"')
  })

  it('顯示慰撫金摘要 low ~ high', () => {
    const html = strip(renderToString(<EstimationRangeCard {...minimalProps} />))
    expect(html).toContain('NT$200,000')
    expect(html).toContain('NT$480,000')
    expect(html).toContain('目前精神慰撫金參考區間')
  })

  it('完整度 100%（無缺件、high confidence）', () => {
    const html = renderToString(<EstimationRangeCard {...minimalProps} />)
    expect(strip(html)).toContain('資料完整度 100%')
    expect(html).toContain('ant-tag-green')
  })

  it('完整度 < 80%（有缺件）→ 黃 tag', () => {
    const props = {
      ...minimalProps,
      missingDocuments: ['診斷書', '薪資扣減證明', '車損發票'],
    }
    const html = renderToString(<EstimationRangeCard {...props} />)
    expect(strip(html)).toContain('資料完整度 64%')
    expect(html).toContain('ant-tag-gold')
  })

  it('完整度 < 60%（大量缺件）→ 紅色 tag', () => {
    const props = {
      ...minimalProps,
      missingDocuments: Array.from({ length: 6 }, (_, i) => `缺件 ${i + 1}`),
    }
    const html = renderToString(<EstimationRangeCard {...props} />)
    expect(strip(html)).toContain('資料完整度 28%')
    expect(html).toContain('ant-tag-red')
  })

  it('有 missingDocuments → 列出每項缺件', () => {
    const props = {
      ...minimalProps,
      missingDocuments: ['診斷書', '薪資扣減證明', '車損發票'],
    }
    const html = strip(renderToString(<EstimationRangeCard {...props} />))
    expect(html).toContain('目前缺少 3 項關鍵文件')
    expect(html).toContain('診斷書')
    expect(html).toContain('薪資扣減證明')
    expect(html).toContain('車損發票')
  })

  it('無 missingDocuments → 不顯示缺件警告', () => {
    const html = strip(renderToString(<EstimationRangeCard {...minimalProps} />))
    expect(html).not.toContain('目前缺少')
  })

  it('requiresHumanReview=true → 顯示最大不確定因素', () => {
    const props = {
      ...minimalProps,
      painAdvisor: {
        requiresHumanReview: true,
        riskFactors: ['失能尚未定型', '無薪資扣減證明'],
        disclaimer: '免責',
      },
    }
    const html = strip(renderToString(<EstimationRangeCard {...props} />))
    expect(html).toContain('最大不確定因素')
    expect(html).toContain('失能尚未定型')
    expect(html).toContain('無薪資扣減證明')
  })

  it('requiresHumanReview=false + 無缺件 → 顯示資料較完整提示', () => {
    const html = strip(renderToString(<EstimationRangeCard {...minimalProps} />))
    expect(html).toContain('目前慰撫金估算所需資料較完整')
  })

  it('顯示共識度 consensus label', () => {
    const props = {
      ...minimalProps,
      painEnsemble: { ...minimalProps.painEnsemble, consensus: 'weak' as const },
    }
    const html = strip(renderToString(<EstimationRangeCard {...props} />))
    expect(html).toContain('共識度：weak')
  })

  it('painML confidence=low → 完整度額外扣 15%', () => {
    const props = {
      ...minimalProps,
      painEnsemble: { ...minimalProps.painEnsemble, mlConfidence: 'low' as const },
    }
    const html = strip(renderToString(<EstimationRangeCard {...props} />))
    expect(html).toContain('資料完整度 85%')
  })

  it('painML confidence=medium → 完整度額外扣 5%', () => {
    const props = {
      ...minimalProps,
      painEnsemble: { ...minimalProps.painEnsemble, mlConfidence: 'medium' as const },
    }
    const html = strip(renderToString(<EstimationRangeCard {...props} />))
    expect(html).toContain('資料完整度 95%')
  })
})
