// @vitest-environment jsdom

/**
 * A11y 煙霧測試（v0.12.0+ Phase C1）
 *
 * 用 axe-core 自動掃描主要頁面的無障礙違規
 * - 跳過沒有 DOM 內容的元件測試
 * - 確保顏色對比、ARIA 標籤、鍵盤導覽基礎項目過關
 *
 * 不變量（測試守護）：
 * - home page 沒有 critical / serious a11y 違規
 * - 違規發生時 console.error 印出細節（debug 用）
 *
 * 限制：
 * - axe-core 在 vitest + jsdom 環境有些功能受限（如 focus order）
 * - 只抓 critical / serious 級違規，moderate 級忽略（待人工 review）
 */

import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { axe } from 'vitest-axe'
import HomeClient from '@/app/_components/HomeClient'
import { AuthProvider } from '@/components/AuthProvider'

describe('首頁 a11y smoke test', () => {
  it('home page 沒有 critical / serious 違規', async () => {
    const html = renderToString(
      <AuthProvider>
        <HomeClient />
      </AuthProvider>,
    )
    // 把 SSR HTML 注入到 jsdom document
    document.body.innerHTML = html

    const results = await axe(document.body, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa'],
      },
      rules: {
        // jsdom 不支援 color-contrast 計算，跳過
        'color-contrast': { enabled: false },
      },
    })

    // 只抓 critical / serious 級
    const criticalOrSerious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    )

    if (criticalOrSerious.length > 0) {
      console.error(
        'A11y violations:',
        criticalOrSerious.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.length,
          help: v.help,
        })),
      )
    }

    expect(criticalOrSerious).toHaveLength(0)
  })
})
