// =====================================================================
// v0.20.0+ 結果頁區間卡 — UI 元件測試
//
// 對應 user 反饋「結果頁不要只強調單一金額」：
// - 顯示合理求償區間（保守/一般/積極）
// - 顯示資料完整度（UI 推導）
// - 顯示缺件清單
// - 顯示需人工判斷項
//
// 對齊 AGENTS §0「不保證金額」+ §1「資料不足不硬算」精神。
//
// SSR-safe 測試風格（沿用 LawVersionBadge.test.tsx / PainEnsembleCard.test.tsx）
// =====================================================================

import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { EstimationRangeCard } from '@/app/claims/result/_sections/EstimationRangeCard'

/** React 19 SSR 在 text node + number 拼接處插入 <!-- --> 分隔符，避免 hydration 漂移。 */
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

describe('EstimationRangeCard — SSR-safe 結果頁區間卡（v0.20.0+）', () => {
  // -----------------------------------------------------------------
  // 區間呈現（保守/一般/積極）
  // -----------------------------------------------------------------
  it('顯示三個區間：保守估算 / 一般估算 / 積極求償區間', () => {
    const html = renderToString(<EstimationRangeCard {...minimalProps} />)
    expect(strip(html)).toContain('保守估算')
    expect(strip(html)).toContain('一般估算')
    expect(strip(html)).toContain('積極求償區間')
  })

  it('三個區間都有 data-testid 方便 e2e 抓取', () => {
    const html = renderToString(<EstimationRangeCard {...minimalProps} />)
    expect(html).toContain('data-testid="range-conservative"')
    expect(html).toContain('data-testid="range-baseline"')
    expect(html).toContain('data-testid="range-aggressive"')
  })

  it('顯示合理求償區間摘要（low ~ high）', () => {
    const html = renderToString(<EstimationRangeCard {...minimalProps} />)
    expect(strip(html)).toContain('NT$200,000')
    expect(strip(html)).toContain('NT$480,000')
    expect(strip(html)).toContain('目前合理求償區間')
  })

  // -----------------------------------------------------------------
  // 資料完整度
  // -----------------------------------------------------------------
  it('完整度 100%（無缺件、high confidence）→ 顯示 100% + 綠色 + 成功 icon', () => {
    const html = renderToString(<EstimationRangeCard {...minimalProps} />)
    expect(strip(html)).toContain('資料完整度 100%')
    expect(html).toContain('ant-tag-green')
  })

  it('完整度 < 80%（有缺件）→ 顯示較低百分比 + 黃 tag', () => {
    const props = {
      ...minimalProps,
      missingDocuments: ['診斷書', '薪資扣減證明', '車損發票'],
    }
    const html = renderToString(<EstimationRangeCard {...props} />)
    // 100 - 3*12 = 64
    expect(strip(html)).toContain('資料完整度 64%')
    expect(html).toContain('ant-tag-gold')
  })

  it('完整度 < 60%（大量缺件）→ 紅色 tag', () => {
    const props = {
      ...minimalProps,
      missingDocuments: Array.from({ length: 6 }, (_, i) => `缺件 ${i + 1}`),
    }
    const html = renderToString(<EstimationRangeCard {...props} />)
    // 100 - 6*12 = 28
    expect(strip(html)).toContain('資料完整度 28%')
    expect(html).toContain('ant-tag-red')
  })

  // -----------------------------------------------------------------
  // 缺件清單
  // -----------------------------------------------------------------
  it('有 missingDocuments → 列出每項缺件', () => {
    const props = {
      ...minimalProps,
      missingDocuments: ['診斷書', '薪資扣減證明', '車損發票'],
    }
    const html = renderToString(<EstimationRangeCard {...props} />)
    expect(strip(html)).toContain('目前缺少 3 項關鍵文件')
    expect(strip(html)).toContain('診斷書')
    expect(strip(html)).toContain('薪資扣減證明')
    expect(strip(html)).toContain('車損發票')
  })

  it('無 missingDocuments → 不顯示缺件警告', () => {
    const html = renderToString(<EstimationRangeCard {...minimalProps} />)
    expect(strip(html)).not.toContain('目前缺少')
  })

  // -----------------------------------------------------------------
  // 人工判斷項
  // -----------------------------------------------------------------
  it('requiresHumanReview=true → 顯示「最大不確定因素」+ riskFactors', () => {
    const props = {
      ...minimalProps,
      painAdvisor: {
        requiresHumanReview: true,
        riskFactors: ['失能尚未定型', '無薪資扣減證明'],
        disclaimer: '免責',
      },
    }
    const html = renderToString(<EstimationRangeCard {...props} />)
    expect(strip(html)).toContain('最大不確定因素')
    expect(strip(html)).toContain('失能尚未定型')
    expect(strip(html)).toContain('無薪資扣減證明')
  })

  it('requiresHumanReview=false + 無缺件 → 顯示「資料充足」綠色提示', () => {
    const html = renderToString(<EstimationRangeCard {...minimalProps} />)
    expect(strip(html)).toContain('資料充足')
  })

  // -----------------------------------------------------------------
  // 共識度顯示
  // -----------------------------------------------------------------
  it('顯示共識度 consensus label', () => {
    const props = {
      ...minimalProps,
      painEnsemble: { ...minimalProps.painEnsemble, consensus: 'weak' as const },
    }
    const html = renderToString(<EstimationRangeCard {...props} />)
    expect(strip(html)).toContain('共識度：weak')
  })

  // -----------------------------------------------------------------
  // mlConfidence 影響完整度
  // -----------------------------------------------------------------
  it('painML confidence=low → 完整度額外扣 15%', () => {
    const props = {
      ...minimalProps,
      painEnsemble: { ...minimalProps.painEnsemble, mlConfidence: 'low' as const },
    }
    const html = renderToString(<EstimationRangeCard {...props} />)
    // 100 - 0*12 - 15 = 85
    expect(strip(html)).toContain('資料完整度 85%')
  })

  it('painML confidence=medium → 完整度額外扣 5%', () => {
    const props = {
      ...minimalProps,
      painEnsemble: { ...minimalProps.painEnsemble, mlConfidence: 'medium' as const },
    }
    const html = renderToString(<EstimationRangeCard {...props} />)
    // 100 - 0*12 - 5 = 95
    expect(strip(html)).toContain('資料完整度 95%')
  })
})
