import type { Metadata } from 'next'
import PrivacyContent from './_content'

/**
 * /privacy — 隱私權政策（v0.14.x 新增）
 *
 * 為什麼需要：
 * - AGENTS §6 紅線要求 PII 保護
 * - v0.14.x 加了 Supabase 雲端 DB（用戶估算存雲端）
 * - 法律上需要明確告知使用者資料怎麼處理
 *
 * 重要：本文不是法律建議，僅是技術透明性說明
 * 正式法律文件請諮詢律師
 */
export const metadata: Metadata = {
  title: '隱私權政策 | 車禍理賠估算器',
  description:
    '我們如何保護您的個資：估算資料脫敏、雲端加密、可隨時刪除。本工具不蒐集姓名、身分證、車牌。',
  openGraph: {
    title: '隱私權政策 | 車禍理賠估算器',
    description: '估算資料脫敏、雲端加密、可隨時刪除。不蒐集姓名、身分證、車牌。',
    type: 'website',
    locale: 'zh_TW',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function PrivacyPage() {
  return <PrivacyContent />
}
