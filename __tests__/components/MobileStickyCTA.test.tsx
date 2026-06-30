/**
 * MobileStickyCTA SSR 渲染測試 — v0.8.1+
 *
 * 不變量（測試守護）：
 *   - 空 children 仍 render 容器
 *   - 左右按鈕都 render
 *   - 桌機/手機 CSS class 都出現（mobile-sticky-cta + md:static）
 *   - 容器 div 結構正確
 */

import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MobileStickyCTA } from '@/components/MobileStickyCTA'

describe('MobileStickyCTA SSR', () => {
  it('空 children 仍 render 容器', () => {
    const html = renderToString(<MobileStickyCTA />)
    expect(html).toContain('mobile-sticky-cta')
    expect(html).toContain('md:static')
  })

  it('左右按鈕都 render', () => {
    const html = renderToString(
      <MobileStickyCTA
        left={<button type="button">上一步</button>}
        right={<button type="button">下一步</button>}
      />,
    )
    expect(html).toContain('上一步')
    expect(html).toContain('下一步')
  })

  it('手機/桌機 CSS class 都存在', () => {
    const html = renderToString(<MobileStickyCTA left="L" right="R" />)
    // 手機（預設 sticky）
    expect(html).toContain('mobile-sticky-cta')
    // 桌機（md: 開頭 override）
    expect(html).toContain('md:static')
    expect(html).toContain('md:bg-transparent')
  })
})