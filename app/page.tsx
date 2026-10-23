import type { Metadata } from 'next'
import { CONTENT_LAST_REVIEWED, SITE_URL } from '@/lib/seo'
import HomeClient from './_components/HomeClient'

/**
 * 首頁 server component（v0.9.0+ 從 client 重構為 server）
 * - 負責 export metadata（SEO / OG / Twitter）
 * - 把實際 UI 渲染交給 HomeClient（client component，內含 framer-motion）
 *
 * 為什麼這樣拆：
 * - metadata 只能在 Server Component export（Next.js App Router 規定）
 * - framer-motion / hooks 需要 'use client'，所以 UI 部分必須是 client
 * - 兩者用 server→client 的標準 pattern 串起來
 *
 * SEO 重要欄位：
 * - title: 明確含關鍵字「車禍理賠金額估算器」「初步試算」
 * - description: 含「強制汽車責任保險法」「民法侵權行為」「6 直轄市地方法院」
 * - openGraph: type=website, locale=zh_TW, 對齊 Facebook / LINE 分享預覽
 */
export const metadata: Metadata = {
  title: '台灣車禍理賠金額估算器 | 初步試算',
  description:
    '依強制汽車責任保險法、民法侵權行為與地方法院實務，協助初步整理體傷理賠資料。提供強制險、失能初篩、民事損害、第三人責任險、補件與法源資訊。',
  openGraph: {
    title: '台灣車禍理賠金額估算器 | 初步試算',
    description: '依強制汽車責任保險法、民法侵權行為與地方法院實務，協助初步整理體傷理賠資料。',
    type: 'website',
    locale: 'zh_TW',
    siteName: '車禍理賠估算器',
  },
  twitter: {
    card: 'summary_large_image',
    title: '台灣車禍理賠金額估算器 | 初步試算',
    description: '依強制汽車責任保險法、民法侵權行為與地方法院實務，協助初步整理體傷理賠資料。',
  },
  alternates: {
    canonical: '/',
  },
}

export function buildHomeJsonLd(baseUrl = SITE_URL) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${normalizedBaseUrl}/#website`,
        url: `${normalizedBaseUrl}/`,
        name: '台灣車禍理賠金額估算器',
        inLanguage: 'zh-Hant',
      },
      {
        '@type': 'WebApplication',
        '@id': `${normalizedBaseUrl}/#application`,
        url: `${normalizedBaseUrl}/`,
        name: '台灣車禍理賠金額估算器',
        description: '依事故、醫療、收入與法院公開資料，協助整理車禍體傷理賠項目及初步試算範圍。',
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web',
        browserRequirements: 'Requires JavaScript',
        inLanguage: 'zh-Hant',
        isAccessibleForFree: true,
        dateModified: CONTENT_LAST_REVIEWED,
        author: {
          '@type': 'Person',
          name: '理賠顧問小鄭',
        },
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'TWD',
        },
      },
    ],
  }
}

export default function Page() {
  const jsonLd = buildHomeJsonLd()

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <HomeClient />
    </>
  )
}
