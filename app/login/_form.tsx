'use client'

/**
 * LoginForm — Email + password 登入 (v0.17.x 重寫)
 *
 * 從 Supabase magic link 切換到 email + password
 * 走 /api/auth/signin + /api/auth/signup
 *
 * v0.19.x+ 密碼強度提示 (註冊模式 only):
 * 12+ 字符 + 數字 + 大寫 — 即時 Progress bar + 弱/中/強
 * 業務設計: 業務員註冊時直接看到強度, 不必 server 回 400 才知
 */

import { useState } from 'react'
import Link from 'next/link'
import { Alert, Button, Card, Checkbox, Input, Progress, Space, Typography } from 'antd'
import { LockOutlined, MailOutlined } from '@ant-design/icons'
import { useAuth } from '@/components/AuthProvider'

const { Title, Paragraph, Text } = Typography

type PasswordStrength = 'weak' | 'medium' | 'strong' | null

function checkPasswordStrength(password: string): PasswordStrength {
  if (!password) return null
  if (password.length < 12) return 'weak'
  const hasDigit = /\d/.test(password)
  const hasUpper = /[A-Z]/.test(password)
  if (hasDigit && hasUpper) return 'strong'
  return 'medium'
}

const STRENGTH_LABEL: Record<Exclude<PasswordStrength, null>, string> = {
  weak: '弱',
  medium: '中',
  strong: '強',
}

const STRENGTH_COLOR: Record<Exclude<PasswordStrength, null>, string> = {
  weak: 'bg-red-500',
  medium: 'bg-amber-500',
  strong: 'bg-emerald-500',
}

const STRENGTH_PERCENT: Record<Exclude<PasswordStrength, null>, number> = {
  weak: 33,
  medium: 66,
  strong: 100,
}

export default function LoginForm() {
  const { signIn, signUp, signOut, user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // v0.27.0+：註冊需勾選「個資及隱私權同意書」（AGENTS §6 紅線）
  const [privacyConsent, setPrivacyConsent] = useState(false)

  const strength = checkPasswordStrength(password)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    // v0.18.x+ 註冊需確認密碼：兩次輸入相同才送 API
    if (isSignUp) {
      if (!confirmPassword) {
        setError('請再次輸入密碼以確認')
        return
      }
      if (password !== confirmPassword) {
        setError('兩次密碼輸入不一致，請重新輸入')
        return
      }
      if (!privacyConsent) {
        setError('請先閱讀並同意個資及隱私權同意書')
        return
      }
    }
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
                placeholder={isSignUp ? '密碼（12+ 字符 + 數字 + 大寫）' : '密碼'}
                prefix={<LockOutlined />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={isSignUp ? 12 : 8}
                disabled={submitting}
                data-testid="login-password"
              />
              {isSignUp && (
                <Input.Password
                  placeholder="再次輸入密碼"
                  prefix={<LockOutlined />}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={submitting}
                  status={confirmPassword && confirmPassword !== password ? 'error' : ''}
                  data-testid="login-confirm-password"
                  className="!mt-3"
                />
              )}
              {isSignUp && password && strength && (
                <div data-testid="password-strength">
                  <Progress
                    percent={STRENGTH_PERCENT[strength]}
                    strokeColor={
                      STRENGTH_COLOR[strength] === 'bg-red-500'
                        ? '#ef4444'
                        : STRENGTH_COLOR[strength] === 'bg-amber-500'
                          ? '#f59e0b'
                          : '#10b981'
                    }
                    showInfo={false}
                    size="small"
                  />
                  <Text className="!mt-1 !text-xs text-muted">
                    密碼強度：{STRENGTH_LABEL[strength]}
                    {strength === 'weak' && '（至少 12 字符，需含數字與大寫）'}
                    {strength === 'medium' && '（已含 12+ 字符 + 數字或大寫其一）'}
                  </Text>
                </div>
              )}
              {isSignUp && (
                // v0.27.0+：個資及隱私權同意書（依個人資料保護法 §8 / 民法 §18）
                <Checkbox
                  checked={privacyConsent}
                  onChange={(e) => setPrivacyConsent(e.target.checked)}
                  data-testid="privacy-consent"
                >
                  <Text className="!text-sm">
                    我已閱讀並同意{' '}
                    <Link
                      href="/privacy"
                      target="_blank"
                      rel="noopener"
                      className="text-accent hover:underline"
                    >
                      個資及隱私權同意書
                    </Link>
                  </Text>
                </Checkbox>
              )}
              <Button
                type="primary"
                size="large"
                htmlType="submit"
                block
                loading={submitting}
                disabled={!email || !password || (isSignUp && !privacyConsent)}
                data-testid="login-submit"
              >
                {isSignUp ? '註冊' : '登入'}
              </Button>
              <Button
                type="link"
                block
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setConfirmPassword('')
                  setPrivacyConsent(false)
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
            {' · '}
            {/* v0.27.3+：管理員後台入口（從 /login 也能直接進）*/}
            <Link href="/admin" className="text-muted hover:text-accent hover:underline">
              管理員後台
            </Link>
          </Paragraph>
        </Space>
      </Card>
    </main>
  )
}
