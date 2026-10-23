// =====================================================================
// v0.20.0+ 結果頁區間卡 — UI 元件測試
//
// 對應 user 反饋「結果頁不要只強調單一金額」：
// - 顯示精神慰撫金參考區間（保守/一般/積極）
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
  it('顯示三個區間：參考下限 / 參考中值 / 參考上限', () => {
    const html = renderToString(<EstimationRangeCard {...minimalProps} />)
    expect(strip(html)).toContain('參考下限')
    expect(strip(html)).toContain('參考中值')
    expect(strip(html)).toContain('參考上限')
  })

  it('三個區間都有 data-testid 方便 e2e 抓取', () => {
    const html = renderToString(<EstimationRangeCard {...minimalProps} />)
    expect(html).toContain('data-testid="range-conservative"')
    expect(html).toContain('data-testid="range-baseline"')
    expect(html).toContain('data-testid="range-aggressive"')
  })

  it('顯示精神慰撫金參考區間摘要（low ~ high）', () => {
    const html = renderToString(<EstimationRangeCard {...minimalProps} />)
    expect(strip(html)).toContain('NT$200,000')
    expect(strip(html)).toContain('NT$480,000')
    expect(strip(html)).toContain('目前精神慰撫金參考區間')
  })

  // -----------------------------------------------------------------
  // 資料完整度
  // -----------------------------------------------------------------
  it('無缺件不等於資料完整或沒有風險', () => {
    const html = strip(renderToString(<EstimationRangeCard {...minimalProps} />))
    expect(html).not.toContain('資料完整度')
    expect(html).not.toContain('無重大不確定因素')
    expect(html).toContain('目前未列出待補項目')
    expect(html).toContain('不含醫療費、工作損失與財損')
  })

  it('顯示實際缺件數，不從模型信心度推導百分比', () => {
    const html = strip(
      renderToString(
        <EstimationRangeCard
          {...minimalProps}
          missingDocuments={['診斷書', '薪資證明']}
          painEnsemble={{ ...minimalProps.painEnsemble, mlConfidence: 'low' }}
        />,
      ),
    )
    expect(html).toContain('待補 2 項')
    expect(html).not.toContain('資料完整度')
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
    expect(strip(html)).toContain('目前未列出待補項目')
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
    expect(strip(html)).toContain('各方法結果差異較大')
  })
})
