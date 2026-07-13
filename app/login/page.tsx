import type { Metadata } from 'next'
import LoginForm from './_form'

/**
 * /login — 登入頁（v0.14.x 新增）
 *
 * 用 Supabase magic link 信箱登入：
 * - 輸入 email → 收信 → 點連結 → 自動登入
 * - 不需密碼（適合業務員手機使用）
 * - 沒設 env vars → 顯示「Supabase 未設定」提示
 */
export const metadata: Metadata = {
  title: '登入 | 車禍理賠估算器',
  description: '登入後可在多裝置同步你的估算記錄，不用重複填表。',
  openGraph: {
    title: '登入 | 車禍理賠估算器',
    description: '登入後可在多裝置同步你的估算記錄。',
    type: 'website',
    locale: 'zh_TW',
  },
  robots: {
    index: false,
    follow: true,
  },
}

export default function LoginPage() {
  return <LoginForm />
}
