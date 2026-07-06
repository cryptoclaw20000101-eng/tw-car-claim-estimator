import type { Metadata } from 'next'
import BatchForm from './_form'

/**
 * /claims/batch — 批次估算多案件（v0.12.0+ Phase E1）
 */
export const metadata: Metadata = {
  title: '批次估算 — 多案件一鍵試算 | 車禍理賠估算器',
  description: '貼上 CSV 一次估算多個車禍理賠案件。業務員一天處理多案件不必逐筆填表，回傳結果表。',
  openGraph: {
    title: '批次估算 — 多案件一鍵試算 | 車禍理賠估算器',
    description: '貼上 CSV 一次估算多個車禍理賠案件。',
    type: 'website',
    locale: 'zh_TW',
  },
  robots: {
    index: false,
    follow: true,
  },
}

export default function BatchPage() {
  return <BatchForm />
}
