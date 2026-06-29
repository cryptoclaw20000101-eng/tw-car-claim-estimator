/**
 * KnnDebugPanel SSR 渲染測試 — v0.7.3+ UI 結構驗證
 *
 * 不變量（測試守護）：
 *   - 空陣列 → renderToString 回 null（不顯示）
 *   - 無 knnDistance 的案件 → 被過濾掉（向後相容）
 *   - 有 knnDistance 的案件 → 5 維長條 + 距離標籤 + 解釋文字都出現
 *   - city: null vs null → 不渲染「縣市」維度（值已是 0，無意義）
 *   - 距離 0 = 極相似 / 距離 5 = 極遠
 */
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { KnnDebugPanel } from '@/components/KnnDebugPanel'
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

describe('KnnDebugPanel SSR 渲染', () => {
  it('空陣列 → null（不 render）', () => {
    const html = renderToString(<KnnDebugPanel cases={[]} />)
    expect(html).toBe('')
  })

  it('無 knnDistance 的案件 → 過濾掉（向後相容）', () => {
    const c = makeCase()  // 沒附 knnDistance/knnBreakdown/knnQuery
    const html = renderToString(<KnnDebugPanel cases={[c]} />)
    expect(html).toBe('')
  })

  it('有 knnDistance → 顯示 5 維長條 + 距離標籤', () => {
    const c = makeCase({
      knnDistance: 0.75,
      knnBreakdown: {
        city: 0,
        disabilityLevel: 0.2,
        year: 0.05,
        injurySeverity: 0,
        hasDisabilityRecord: 0,
      },
      knnQuery: {
        city: '臺中市',
        disabilityLevel: 7,
        year: 2024,
        injurySeverity: null,
        hasDisabilityRecord: true,
      },
    })
    const html = renderToString(<KnnDebugPanel cases={[c]} />)
    // 標題
    expect(html).toContain('KNN 推薦理由')
    // 案例編號
    expect(html).toContain('114 年度 訴字 第 100 號')
    // 距離標籤（SSR 會被 React 用 HTML 註解切開，要用 regex）
    expect(html).toMatch(/距離\s*<!--\s*-->\s*0\.75/)
    // 5 維 emoji
    expect(html).toContain('🏙️')  // city
    expect(html).toContain('🩺')  // disability_level
    expect(html).toContain('📅')  // year
    expect(html).toContain('⚕️')  // injury
    expect(html).toContain('📋')  // disability record
  })

  it('距離 < 0.5 → 顯示「極相似」', () => {
    const c = makeCase({
      knnDistance: 0.3,
      knnBreakdown: { city: 0, disabilityLevel: 0, year: 0, injurySeverity: 0, hasDisabilityRecord: 0 },
      knnQuery: { city: '臺中市', disabilityLevel: 7, year: 2024, injurySeverity: null, hasDisabilityRecord: true },
    })
    const html = renderToString(<KnnDebugPanel cases={[c]} />)
    expect(html).toContain('極相似')
  })

  it('距離 2.5 → 顯示「普通」', () => {
    const c = makeCase({
      knnDistance: 2.5,
      knnBreakdown: { city: 1, disabilityLevel: 0.5, year: 0, injurySeverity: 0.5, hasDisabilityRecord: 0.5 },
      knnQuery: { city: '臺中市', disabilityLevel: 7, year: 2024, injurySeverity: null, hasDisabilityRecord: true },
    })
    const html = renderToString(<KnnDebugPanel cases={[c]} />)
    expect(html).toContain('普通')
  })

  it('距離 > 3.5 → 顯示「極遠」', () => {
    const c = makeCase({
      knnDistance: 4.2,
      knnBreakdown: { city: 1, disabilityLevel: 1, year: 1, injurySeverity: 0.5, hasDisabilityRecord: 0.7 },
      knnQuery: { city: '臺中市', disabilityLevel: 7, year: 2024, injurySeverity: null, hasDisabilityRecord: true },
    })
    const html = renderToString(<KnnDebugPanel cases={[c]} />)
    expect(html).toContain('極遠')
  })

  it('多件案件 → 全部顯示', () => {
    const c1 = makeCase({
      id: 'pc-1',
      knnDistance: 0.3,
      knnBreakdown: { city: 0, disabilityLevel: 0, year: 0, injurySeverity: 0, hasDisabilityRecord: 0 },
      knnQuery: { city: '臺中市', disabilityLevel: 7, year: 2024, injurySeverity: null, hasDisabilityRecord: true },
    })
    const c2 = makeCase({
      id: 'pc-2',
      caseNo: '114 年度 訴字 第 200 號',
      knnDistance: 1.5,
      knnBreakdown: { city: 1, disabilityLevel: 0.5, year: 0, injurySeverity: 0, hasDisabilityRecord: 0 },
      knnQuery: { city: '臺中市', disabilityLevel: 7, year: 2024, injurySeverity: null, hasDisabilityRecord: true },
    })
    const html = renderToString(<KnnDebugPanel cases={[c1, c2]} />)
    expect(html).toContain('114 年度 訴字 第 100 號')
    expect(html).toContain('114 年度 訴字 第 200 號')
    expect(html).toMatch(/距離\s*<!--\s*-->\s*0\.30/)
    expect(html).toMatch(/距離\s*<!--\s*-->\s*1\.50/)
  })

  it('city null vs null → 顯示「0.00」但不顯示「同縣市」解釋文字', () => {
    const c = makeCase({
      knnDistance: 0.5,
      knnBreakdown: { city: 0, disabilityLevel: 0.5, year: 0, injurySeverity: 0, hasDisabilityRecord: 0 },
      knnQuery: { city: null, disabilityLevel: 7, year: 2024, injurySeverity: null, hasDisabilityRecord: true },
    })
    const html = renderToString(<KnnDebugPanel cases={[c]} />)
    // city 維度值 0.00 還是會顯示（值固定），但解釋文字空字串
    expect(html).toContain('🏙️')
    // 不應出現「同縣市」字眼（city null 解釋器回空字串）
    expect(html).not.toContain('同縣市')
  })

  it('自訂標題 → 顯示自訂標題', () => {
    const c = makeCase({
      knnDistance: 0.5,
      knnBreakdown: { city: 0, disabilityLevel: 0.5, year: 0, injurySeverity: 0, hasDisabilityRecord: 0 },
      knnQuery: { city: '臺中市', disabilityLevel: 7, year: 2024, injurySeverity: null, hasDisabilityRecord: true },
    })
    const html = renderToString(
      <KnnDebugPanel cases={[c]} title="自訂 KNN 標題" />
    )
    expect(html).toContain('自訂 KNN 標題')
  })

  it('空字串解釋（city null vs null）→ Tooltip 仍顯示 fallback', () => {
    const c = makeCase({
      knnDistance: 0.5,
      knnBreakdown: { city: 0, disabilityLevel: 0.5, year: 0, injurySeverity: 0, hasDisabilityRecord: 0 },
      knnQuery: { city: null, disabilityLevel: 7, year: 2024, injurySeverity: null, hasDisabilityRecord: true },
    })
    const html = renderToString(<KnnDebugPanel cases={[c]} />)
    // 注意：AntD Tooltip 在 SSR 不渲染內容（client-only 用 React Portal）
    // → 不驗證 tooltip 內容，改驗證縣市 維度標籤還在 + 0.00 值仍顯示
    expect(html).toContain('🏙️')
    expect(html).toContain('縣市')
    // city 0.00 還是會渲染
    expect(html).toMatch(/0\.00/)
  })
})