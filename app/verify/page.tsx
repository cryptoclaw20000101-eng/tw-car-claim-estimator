'use client'

/**
 * /verify — Email 驗證頁面（v0.19.x+）
 *
 * 用戶註冊後收到 email 點連結 → 進此頁面 → 觸發驗證 API → 顯示結果
 * 業務設計: 驗證成功 → 引導登入
 */

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button, Card, Result, Spin } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'

type Status = 'loading' | 'success' | 'error'

export default function VerifyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState<string>('驗證中...')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('缺少驗證 token。請從 email 連結重新點擊。')
      return
    }
    fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setStatus('success')
          setMessage(data.message || 'Email 驗證成功')
        } else {
          setStatus('error')
          setMessage(data.error || '驗證失敗')
        }
      })
      .catch(() => {
        setStatus('error')
        setMessage('驗證請求失敗, 請稍後再試')
      })
  }, [token])

  if (status === 'loading') {
    return (
      <main className="dvh-screen flex flex-1 items-center justify-center bg-background px-6">
        <Card className="!w-full !max-w-md">
          <div className="flex flex-col items-center gap-4 py-12">
            <Spin size="large" />
            <p className="text-base text-muted">{message}</p>
          </div>
        </Card>
      </main>
    )
  }

  if (status === 'success') {
    return (
      <main className="dvh-screen flex flex-1 items-center justify-center bg-background px-6">
        <Result
          status="success"
          icon={<CheckCircleOutlined className="!text-accent" />}
          title="Email 驗證成功"
          subTitle={message}
          extra={[
            <Button type="primary" key="login" onClick={() => router.push('/login')}>
              前往登入
            </Button>,
          ]}
        />
      </main>
    )
  }

  return (
    <main className="dvh-screen flex flex-1 items-center justify-center bg-background px-6">
      <Result
        status="error"
        icon={<CloseCircleOutlined />}
        title="驗證失敗"
        subTitle={message}
        extra={[
          <Link key="home" href="/">
            <Button>回首頁</Button>
          </Link>,
          <Button key="retry" type="primary" onClick={() => router.push('/login')}>
            重新登入
          </Button>,
        ]}
      />
    </main>
  )
}
