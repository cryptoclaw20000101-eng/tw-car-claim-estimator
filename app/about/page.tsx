import type { Metadata } from 'next'
import AboutContent from './_content'

/**
 * /about — 關於我們（v0.14.x 新增）
 *
 * 展示：
 * - 工具定位（iPAS 練習作品 + 實務工具）
 * - 技術棧
 * - 開發團隊
 * - Open source 連結
 */
export const metadata: Metadata = {
  title: '關於我們 | 車禍理賠估算器',
  description:
    '臺灣車禍理賠估算工具：6 大計算引擎 + Ensemble 三票共識 + 司法院真實判例。open source 個人專案。',
  openGraph: {
    title: '關於我們 | 車禍理賠估算器',
    description: '6 大計算引擎 + Ensemble 三票共識 + 司法院真實判例。',
    type: 'website',
    locale: 'zh_TW',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function AboutPage() {
  return <AboutContent />
}
