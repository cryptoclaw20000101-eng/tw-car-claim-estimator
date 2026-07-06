import type { Metadata } from 'next'
import NewClaimForm from './_form'

/**
 * /claims/new server component（v0.9.0+ 從 client 改為 server）
 * - export metadata（v0.9.0 新增）
 * - 渲染 client 表單（NewClaimForm 含 framer-motion 與 AntD Form）
 *
 * 7 步驟輸入：事故基本 → 肇責 → 人身/工作 → 診斷書 → 醫療收據 → 車損 → 地區/法院
 */
export const metadata: Metadata = {
  title: '開始估算 — 7 步驟輸入資料 | 車禍理賠估算器',
  description:
    '依序輸入事故基本、肇責、人身工作、診斷書、醫療收據、車損、地區法院等資料，自動產出 5 區估算結果。包含強制險 15 細項、失能等級、第三人責任險、補件清單與地區實務。',
  openGraph: {
    title: '開始估算 — 7 步驟輸入資料 | 車禍理賠估算器',
    description:
      '依序輸入事故基本、肇責、人身工作、診斷書、醫療收據、車損、地區法院等資料，自動產出 5 區估算結果。',
    type: 'website',
    locale: 'zh_TW',
    siteName: '車禍理賠估算器',
  },
  robots: {
    index: false, // 表單頁不需要被索引（內部流程）
    follow: true,
  },
  alternates: {
    canonical: '/claims/new',
  },
}

export default function Page() {
  return <NewClaimForm />
}
