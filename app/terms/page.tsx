import type { Metadata } from 'next'
import TermsContent from './_content'

/**
 * /terms — 服務條款（v0.14.x 新增）
 *
 * 免責聲明的延伸，明確：
 * - 工具定位（試算 vs 判決）
 * - 使用者責任
 * - 智慧財產權
 * - 變更通知
 */
export const metadata: Metadata = {
  title: '服務條款 | 車禍理賠估算器',
  description:
    '使用本工具前請詳閱：估算結果僅供參考，不構成法律意見或保證。請諮詢保險經紀人或律師。',
  openGraph: {
    title: '服務條款 | 車禍理賠估算器',
    description: '估算結果僅供參考，不構成法律意見。',
    type: 'website',
    locale: 'zh_TW',
    url: '/terms',
  },
  alternates: { canonical: '/terms' },
  robots: {
    index: true,
    follow: true,
  },
}

export default function TermsPage() {
  return <TermsContent />
}
