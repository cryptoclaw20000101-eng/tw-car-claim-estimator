'use client'

/**
 * LoginForm — Email + password 登入 (v0.17.x 重寫)
 *
 * 從 Supabase magic link 切換到 email + password
 * 走 /api/auth/signin + /api/auth/signup
 */

import { useState } from 'react'
import Link from 'next/link'
import { Alert, Button, Card, Input, Space, Typography } from 'antd'
import { LockOutlined, MailOutlined } from '@ant-design/icons'
import { useAuth } from '@/components/AuthProvider'

const { Title, Paragraph } = Typography

export default function LoginForm() {
  const { signIn, signUp, signOut, user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setSubmitting(true)
    setError(null)
    const result = isSignUp ? await signUp(email, password) : await signIn(email, password)
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
    }
  }

  if (user) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center bg-surface-subtle px-6 py-16">
        <Card className="w-full max-w-md text-center">
          <Title level={2} className="!mb-3">
            已登入
          </Title>
          <Paragraph className="!mb-4">{user.email}</Paragraph>
          <Space>
            <Link href="/claims/new">
              <Button type="primary">開始估算</Button>
            </Link>
            <Button onClick={signOut}>登出</Button>
          </Space>
        </Card>
      </main>
    )
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
              {isSignUp ? '註冊' : '登入'}
            </Title>
            <Paragraph type="secondary" className="!mb-0 !text-sm">
              {isSignUp ? '建立帳號以跨裝置同步估算歷史。' : '登入以跨裝置同步估算歷史。'}
            </Paragraph>
          </div>

          {error && <Alert type="error" showIcon message={error} />}

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
                disabled={submitting}
                data-testid="login-email"
              />
              <Input.Password
                size="large"
                placeholder="密碼（至少 8 字符）"
                prefix={<LockOutlined />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={submitting}
                data-testid="login-password"
              />
              <Button
                type="primary"
                size="large"
                htmlType="submit"
                block
                loading={submitting}
                disabled={!email || !password}
                data-testid="login-submit"
              >
                {isSignUp ? '註冊' : '登入'}
              </Button>
              <Button
                type="link"
                block
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError(null)
                }}
              >
                {isSignUp ? '已有帳號？登入' : '沒帳號？註冊'}
              </Button>
            </Space>
          </form>

          <Paragraph type="secondary" className="!mb-0 !text-center !text-xs">
            沒登入仍可估算, 但只存在 localStorage (瀏覽器清掉就消失)
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
