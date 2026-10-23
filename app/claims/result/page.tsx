import type { Metadata } from 'next'
import ResultClient from './_result-client'

/**
 * /claims/result server component（v0.9.0+ 從 client 改為 server）
 * - export metadata（v0.9.0 新增）
 * - 渲染 client wrapper（_result-client.tsx → dynamic + ssr:false → _form.tsx）
 *
 * 為什麼不直接 dynamic import：
 * - Next.js 16 不允許 server component 用 ssr:false dynamic
 * - 必須 client wrapper 包一層
 *
 * 8 Tabs：強制險、失能初篩、理賠實務案例、民事損害、第三人責任險、補件/風險、地區實務、法源依據
 */
export const metadata: Metadata = {
  title: '估算結果 | 8 項試算與依據 | 車禍理賠估算器',
  description:
    '查看強制險、失能、理賠實務案例、民事損害、第三人責任險、補件、地區實務與法源依據。結果僅供初步試算與資料整理。',
  openGraph: {
    title: '估算結果 | 8 項試算與依據 | 車禍理賠估算器',
    description: '查看 8 項理賠試算與依據，包含強制險、民事損害、第三人責任險、補件與法源資訊。',
    type: 'website',
    locale: 'zh_TW',
    siteName: '車禍理賠估算器',
  },
  twitter: {
    card: 'summary_large_image',
    title: '估算結果 | 8 項試算與依據 | 車禍理賠估算器',
    description: '查看 8 項理賠試算與依據，包含強制險、民事損害、第三人責任險、補件與法源資訊。',
  },
  robots: {
    index: false, // 結果頁依 sessionStorage，不該被索引
    follow: true,
  },
  alternates: {
    canonical: '/claims/result',
  },
}

export default function ResultPage() {
  return <ResultClient />
}
