import type { Metadata } from 'next'
import AboutContent from './_content'

/**
 * /about — 關於我們（v0.14.x 新增）
 *
 * 展示：
 * - 工具定位（實務工具）
 * - 技術棧
 * - 開發團隊
 * - Open source 連結
 */
export const metadata: Metadata = {
  title: '計算方式與資料來源 | 台灣車禍理賠估算器',
  description:
    '了解台灣車禍理賠估算器如何區分強制險、民事損害與第三人責任險，以及失能、精神慰撫金、司法院公開裁判資料的計算方式、更新頻率與使用限制。',
  openGraph: {
    title: '計算方式與資料來源 | 台灣車禍理賠估算器',
    description: '查看理賠試算的計算方式、官方資料來源、更新頻率與使用限制。',
    type: 'website',
    locale: 'zh_TW',
    url: '/about',
  },
  alternates: { canonical: '/about' },
  robots: {
    index: true,
    follow: true,
  },
}

export default function AboutPage() {
  return <AboutContent />
}
