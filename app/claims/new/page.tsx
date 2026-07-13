import type { Metadata } from 'next'
import NewClaimForm from './_form'

/**
 * /claims/new server component（v0.9.0+ 從 client 改為 server）
 * - export metadata（v0.9.0 新增）
 * - 渲染 client 表單（NewClaimForm 含 framer-motion 與 AntD Form）
 *
 * v0.20.0+：5 步驟輸入（user 反饋「最後一步負擔過大」→ 拆 Step4Medical）：
 *   1. 事故基本 → 2. 肇責 → 3. 人身/工作 → 4. 傷勢與診斷 → 5. 費用與財損
 */
export const metadata: Metadata = {
  title: '開始估算 — 5 步驟輸入資料 | 車禍理賠估算器',
  description:
    '依序輸入事故基本、肇責、人身工作、傷勢診斷、費用財損等資料，自動產出 5 區估算結果。包含強制險 15 細項、失能等級、第三人責任險、補件清單與地區實務。',
  openGraph: {
    title: '開始估算 — 5 步驟輸入資料 | 車禍理賠估算器',
    description:
      '依序輸入事故基本、肇責、人身工作、傷勢診斷、費用財損等資料，自動產出 5 區估算結果。',
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
