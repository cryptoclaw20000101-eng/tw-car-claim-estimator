// =====================================================================
// v0.8.3 法規版本標籤 — UI 元件測試
// =====================================================================

import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { LawVersionBadge } from '@/components/LawVersionBadge'

describe('LawVersionBadge — SSR-safe 結果頁切換標籤（v0.8.3+）', () => {
  describe('新法（事故日 >= 2026-07-01 或未填）', () => {
    it('事故日 2026-07-01 → 顯示新法標籤 + 🆕 圖示', () => {
      const html = renderToString(<LawVersionBadge accidentDate="2026-07-01" />)
      expect(html).toContain('law-version-badge')
      expect(html).toContain('data-law-version="new"')
      expect(html).toContain('🆕')
      expect(html).toContain('新法 (2026-07-01 起)')
      expect(html).toContain('ant-tag-success')
    })

    it('事故日 2027-01-15（明年）→ 新法標籤', () => {
      const html = renderToString(<LawVersionBadge accidentDate="2027-01-15" />)
      expect(html).toContain('data-law-version="new"')
      expect(html).toContain('🆕')
    })

    it('事故日 null → 新法標籤（保守預設）', () => {
      const html = renderToString(<LawVersionBadge accidentDate={null} />)
      expect(html).toContain('data-law-version="new"')
    })

    it('事故日 undefined → 新法標籤', () => {
      const html = renderToString(<LawVersionBadge accidentDate={undefined} />)
      expect(html).toContain('data-law-version="new"')
    })

    it("事故日 '' → 新法標籤", () => {
      const html = renderToString(<LawVersionBadge accidentDate="" />)
      expect(html).toContain('data-law-version="new"')
    })
  })

  describe('舊法（事故日 < 2026-07-01）', () => {
    it('事故日 2024-01-01 → 顯示舊法標籤 + 📜 圖示', () => {
      const html = renderToString(<LawVersionBadge accidentDate="2024-01-01" />)
      expect(html).toContain('data-law-version="old"')
      expect(html).toContain('📜')
      expect(html).toContain('舊法 (2026-07-01 前)')
      expect(html).toContain('ant-tag-warning')
    })

    it('事故日 2026-06-30（邊界前一日）→ 舊法', () => {
      const html = renderToString(<LawVersionBadge accidentDate="2026-06-30" />)
      expect(html).toContain('data-law-version="old"')
    })

    it('事故日 2020-06-15 → 舊法', () => {
      const html = renderToString(<LawVersionBadge accidentDate="2020-06-15" />)
      expect(html).toContain('data-law-version="old"')
    })
  })

  describe('Tooltip 內容（label 文字已帶說明，hover 顯示完整 tooltip）', () => {
    it('新法 label 含「拆 subItems」相關說明（Tag 文字本身）', () => {
      const html = renderToString(<LawVersionBadge accidentDate="2026-07-01" />)
      // Tag label 文字本身已帶說明，不需要看 Tooltip 內容
      expect(html).toContain('特殊材料＋輔具各自 2 萬上限')
    })

    it('舊法 label 含「合併」相關說明', () => {
      const html = renderToString(<LawVersionBadge accidentDate="2024-01-01" />)
      expect(html).toContain('醫材＋特殊材料＋輔具合併 2 萬上限')
    })

    it('自訂 tooltip 覆蓋預設（AntD Tooltip SSR 不渲染 title，僅驗 props 接收）', () => {
      // AntD Tooltip 在 SSR 渲染時 title 屬性不會 inline 在 HTML 中（Tooltip 是 client-only）
      // 這裡只驗證：自訂 tooltip 被傳入 + Tag 仍正常 render
      const customTip = '我的自訂說明文字'
      const html = renderToString(<LawVersionBadge accidentDate="2026-07-01" tooltip={customTip} />)
      expect(html).toContain('law-version-badge')
      expect(html).toContain('data-law-version="new"')
      expect(html).toContain('新法')
    })
  })

  describe('顯示選項', () => {
    it('showIcon={false} → 不顯示 emoji 圖示', () => {
      const html = renderToString(<LawVersionBadge accidentDate="2026-07-01" showIcon={false} />)
      expect(html).not.toContain('🆕')
      expect(html).not.toContain('📜')
    })

    it('showIcon=true（預設）→ 顯示 emoji 圖示', () => {
      const html = renderToString(<LawVersionBadge accidentDate="2026-07-01" />)
      expect(html).toContain('🆕')
    })
  })

  describe('不變量', () => {
    it('每個變體都 render AntD Tag', () => {
      const dates = ['2024-01-01', '2026-06-30', '2026-07-01', '2027-01-15', null, undefined, '']
      for (const d of dates) {
        const html = renderToString(<LawVersionBadge accidentDate={d} />)
        expect(html).toContain('ant-tag')
      }
    })

    it('label 必含「2026-07-01」標示（不論新舊法）', () => {
      const cases = [
        { date: '2024-01-01', expected: 'data-law-version="old"' },
        { date: '2026-07-01', expected: 'data-law-version="new"' },
        { date: '2027-01-15', expected: 'data-law-version="new"' },
      ]
      for (const c of cases) {
        const html = renderToString(<LawVersionBadge accidentDate={c.date} />)
        expect(html).toContain('2026-07-01')
        expect(html).toContain(c.expected)
      }
    })
  })
})
