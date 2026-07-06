'use client'

/**
 * LoginForm — Magic link 信箱登入（v0.14.x 新增）
 */

import { useState } from 'react'
import Link from 'next/link'
import { Alert, Button, Card, Input, Space, Typography } from 'antd'
import { MailOutlined } from '@ant-design/icons'
import { InfoAlert } from '@/components/InfoAlert'
import { useAuth } from '@/components/AuthProvider'

const { Title, Paragraph, Text } = Typography

export default function LoginForm() {
  const { signInWithMagicLink, configured } = useAuth()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setSending(true)
    setError(null)
    const result = await signInWithMagicLink(email)
    setSending(false)
    if (result.error) {
      setError(result.error)
    } else {
      setSent(true)
    }
  }

  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col items-center justify-center bg-surface-subtle px-6 py-16"
    >
      <Card className="w-full max-w-md">
        <Space direction="vertical" size="middle" className="!w-full">
          <div>
            <Title level={2} className="!mb-2">
              登入
            </Title>
            <Paragraph type="secondary" className="!mb-0 !text-sm">
              輸入你的 email，我們會寄送一次性登入連結。
              <br />
              點連結即可登入，不需密碼。
            </Paragraph>
          </div>

          {!configured && (
            <InfoAlert
              type="warning"
              showIcon
              title="Supabase 未設定"
              body={
                <>
                  目前是開發模式，雲端登入功能未啟用。
                  <br />
                  設定 <code>NEXT_PUBLIC_SUPABASE_URL</code> + <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> 環境變數即可啟用。
                </>
              }
            />
          )}

          {error && (
            <Alert type="error" showIcon message={error} />
          )}

          {sent ? (
            <InfoAlert
              type="success"
              showIcon
              title="登入連結已寄出"
              body={
                <>
                  請到 <strong>{email}</strong> 收信，點連結完成登入。
                  <br />
                  連結 1 小時內有效。
                </>
              }
            />
          ) : (
            <form onSubmit={handleSubmit}>
              <Space direction="vertical" size="middle" className="!w-full">
                <Input
                  size="large"
                  type="email"
                  placeholder="you@example.com"
                  prefix={<MailOutlined />}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={!configured || sending}
                  data-testid="login-email"
                />
                <Button
                  type="primary"
                  size="large"
                  htmlType="submit"
                  block
                  loading={sending}
                  disabled={!configured || !email}
                  data-testid="login-submit"
                >
                  {sending ? '寄送中…' : '寄送登入連結'}
                </Button>
              </Space>
            </form>
          )}

          <Paragraph type="secondary" className="!mb-0 !text-center !text-xs">
            還沒帳號？輸入 email 即可自動註冊。
            <br />
            <Link href="/" className="text-accent hover:underline">
              ← 回首頁
            </Link>
          </Paragraph>
        </Space>
      </Card>
    </main>
  )
}