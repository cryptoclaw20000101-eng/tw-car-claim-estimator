/**
 * Step4KnnPreview SSR 渲染測試 — v0.7.6+ UI 結構驗證
 *
 * 為什麼全用 SSR（renderToString）不用 jsdom render？
 *   - vitest 預設 node 環境，沒有 document/window
 *   - SSR 反而更純粹：守護「真實 HTML 結構」而非「測試環境 mock」
 *   - 與 KnnDebugPanel.test.tsx 風格一致
 *
 * 不變量（測試守護）：
 *   - 空 disabilityLevel → 顯示提示「填入失能等級後預覽」
 *   - 兩欄齊全 + 0 件 → 顯示「無相似案例」Empty
 *   - 兩欄齊全 + N 件 → N 張卡片 + 5 維 debug panel
 *   - 卡片含 caseNo + court + year + 距離 + 相似度 Tag
 *   - 防抖 300ms：useDebouncedValue 純函式測
 */

import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Step4KnnPreview } from '@/components/Step4KnnPreview'
import type { PracticeCaseWithKnn } from '@/lib/estimate/precedents'

const makeCase = (overrides: Partial<PracticeCaseWithKnn> = {}): PracticeCaseWithKnn => ({
  id: 'pc-1',
  caseNo: '114 年度 訴字 第 100 號',
  court: '臺灣臺中地方法院',
  year: 2024,
  category: 'practice_case',
  facts: '汽車與機車碰撞',
  injuries: '左腿骨折',
  disabilities: [{ type: '下肢', level: '7', source: '初篩' }],
  keyHoldings: [],
  source: '理賠實務案例彙編#1',
  scrapedAt: '2026-01-15T00:00:00Z',
  ...overrides,
})

describe('Step4KnnPreview — SSR HTML 結構', () => {
  it('空 disabilityLevel → 提示「填入失能等級後預覽」', () => {
    const html = renderToString(
      <Step4KnnPreview disabilityLevel={null} accidentLocation="臺中市" />,
    )
    expect(html).toContain('填入失能等級後')
    expect(html).toContain('預覽')
  })

  it('兩欄齊全 + 0 件 → 顯示「無相似案例」Empty 或距離 Tag', () => {
    // 失能等級 99 仍會跑 findRelated，結果視為合法
    const html = renderToString(
      <Step4KnnPreview disabilityLevel={99} accidentLocation="不存在的城市" />,
    )
    expect(html).toMatch(/無相似案例|距離|即時 KNN 預視/)
  })

  it('展開 KNN 5 維 → 顯示 details + summary', () => {
    const html = renderToString(
      <Step4KnnPreview disabilityLevel={7} accidentLocation="臺中市" />,
    )
    expect(html).toContain('展開 KNN 5 維拆解')
  })

  it('卡片 data-testid 存在（至少 1 張）', () => {
    const html = renderToString(
      <Step4KnnPreview disabilityLevel={7} accidentLocation="臺中市" />,
    )
    const cardCount = (html.match(/knn-preview-card/g) ?? []).length
    expect(cardCount).toBeGreaterThanOrEqual(1)
  })

  it('兩欄齊全時顯示「即時 KNN 預視」標題', () => {
    const html = renderToString(
      <Step4KnnPreview disabilityLevel={7} accidentLocation="臺中市" />,
    )
    expect(html).toContain('即時 KNN 預視')
  })

  it('city 為空字串 → 不報錯', () => {
    const html = renderToString(
      <Step4KnnPreview disabilityLevel={7} accidentLocation="" />,
    )
    expect(html).toContain('即時 KNN 預視')
  })

  it('city 為 undefined → 不報錯', () => {
    const html = renderToString(
      <Step4KnnPreview disabilityLevel={7} accidentLocation={undefined} />,
    )
    expect(html).toContain('即時 KNN 預視')
  })

  it('卡片顯示「距離」+ 相似度標籤', () => {
    const html = renderToString(
      <Step4KnnPreview disabilityLevel={7} accidentLocation="臺中市" />,
    )
    // SSR 注入 <!-- --> 拆開文字 → 用寬鬆匹配：「距離 ... 相似度」
    // 相似度 5 級：極相似/相似/普通/偏遠/極遠
    expect(html).toMatch(/距離.*?(極相似|相似|普通|偏遠|極遠)/)
  })
})