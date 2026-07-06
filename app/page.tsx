import type { Metadata } from 'next'
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
 * - title: 明確含關鍵字「車禍理賠金額估算器」「5 分鐘」
 * - description: 含「強制汽車責任保險法」「民法侵權行為」「6 直轄市地方法院」
 * - openGraph: type=website, locale=zh_TW, 對齊 Facebook / LINE 分享預覽
 */
export const metadata: Metadata = {
  title: '台灣車禍理賠金額估算器 — 5 分鐘算給你看',
  description:
    '依強制汽車責任保險法、民法侵權行為及 6 個直轄市地方法院實務，快速估算體傷理賠金額。包含強制險、失能初篩、第三人責任險、補件清單、地區實務 5 區估算。',
  openGraph: {
    title: '台灣車禍理賠金額估算器 — 5 分鐘算給你看',
    description:
      '依強制汽車責任保險法、民法侵權行為及 6 個直轄市地方法院實務，快速估算體傷理賠金額。',
    type: 'website',
    locale: 'zh_TW',
    siteName: '車禍理賠估算器',
  },
  twitter: {
    card: 'summary_large_image',
    title: '台灣車禍理賠金額估算器 — 5 分鐘算給你看',
    description:
      '依強制汽車責任保險法、民法侵權行為及 6 個直轄市地方法院實務，快速估算體傷理賠金額。',
  },
  alternates: {
    canonical: '/',
  },
}

export default function Page() {
  return <HomeClient />
}
