'use client'

/**
 * 全站 Error Boundary — taste-skill v1 anti-slop 紀律：
 * - 不恐慌（無巨大紅色驚嘆號 + 紅底）
 * - 給「重試」和「回首頁」兩個 escape hatch（不讓用戶卡死）
 * - 對齊偏左（variance 8）→ 2fr + 1fr bento
 * - dev 模式才顯示錯誤細節（防洩漏到 prod）
 * - 零 emoji
 * - dev 模式額外提供「複製錯誤訊息」按鈕（給技術用戶貼 GitHub issue）
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button, Typography, Alert, message as antdMessage } from 'antd'
import { InfoAlert } from '@/components/InfoAlert'
import { ReloadOutlined, HomeOutlined, BugOutlined, AlertOutlined, CopyOutlined, CheckOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'

const { Title, Paragraph, Text } = Typography

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    // 送到監控（這裡先 console.error；正式接 Sentry 之類再改）
    console.error('[app/error.tsx] 全站錯誤捕獲：', error)
  }, [error])

  const handleCopy = async () => {
    // 組裝診斷資訊（給技術用戶貼 GitHub issue）
    const lines: string[] = [
      `錯誤類型：${error.name || 'UnknownError'}`,
      `訊息：${error.message || '（無訊息）'}`,
    ]
    if (error.digest) lines.push(`Digest：${error.digest}`)
    if (error.stack) lines.push(`Stack：\n${error.stack}`)
    lines.push(`頁面：${typeof window !== 'undefined' ? window.location.href : '(server)'}`)
    lines.push(`時間：${new Date().toISOString()}`)
    const text = lines.join('\n')

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback（HTTP 環境或舊瀏覽器）：隱藏 textarea + execCommand
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      antdMessage.success('已複製錯誤訊息到剪貼簿')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      antdMessage.error('複製失敗，請手動選取 console 內的錯誤訊息')
    }
  }

  return (
    <main className="dvh-screen flex flex-1 flex-col items-center px-6 py-16 md:py-24">
      <div className="w-full max-w-5xl">
        {/* Bento 2fr+1fr（variance 8，不對稱） */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* 主格 2fr：錯誤說明 + CTA */}
          <motion.div
            className="rounded-lg border border-border bg-surface p-8 md:col-span-2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-accent">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              <AlertOutlined />
              <span>Error · 系統錯誤</span>
            </div>
            <Title level={1} className="!mb-3 !text-3xl !leading-tight !tracking-tight md:!text-5xl">
              出了點狀況
            </Title>
            <Paragraph className="!mb-6 !text-base text-muted md:!text-lg">
              本頁在渲染時發生未預期錯誤。你可以試著 <Text strong>重試</Text>，
              或 <Text strong>回到首頁</Text> 重新開始估算。
            </Paragraph>
            <div className="flex flex-wrap gap-3">
              <Button type="primary" size="large" icon={<ReloadOutlined />} onClick={reset}>
                重試一次
              </Button>
              <Link href="/">
                <Button size="large" icon={<HomeOutlined />}>
                  回到首頁
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* 次格 1fr：錯誤診斷（dev 才顯示細節） */}
          <motion.div
            className="rounded-lg border border-border bg-surface-subtle p-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
          >
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted">
              <BugOutlined />
              <span>Diagnostic</span>
            </div>
            <Paragraph className="!mb-2 !text-sm text-foreground">
              <Text strong>錯誤類型：</Text>
              <br />
              <Text code className="!text-xs">
                {error.name || 'UnknownError'}
              </Text>
            </Paragraph>
            <Paragraph className="!mb-2 !text-sm text-foreground">
              <Text strong>訊息：</Text>
              <br />
              <Text className="!text-xs text-muted">
                {error.message || '（無訊息）'}
              </Text>
            </Paragraph>
            {error.digest && (
              <Paragraph className="!mb-2 !text-sm text-foreground">
                <Text strong>Digest：</Text>
                <br />
                <Text code className="!text-xs">
                  {error.digest}
                </Text>
              </Paragraph>
            )}
            {process.env.NODE_ENV !== 'production' && (
              <Button
                size="small"
                icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                onClick={handleCopy}
                className="!mt-2"
              >
                {copied ? '已複製' : '複製錯誤訊息'}
              </Button>
            )}
          </motion.div>
        </div>

        {/* dev 模式額外提示（prod 不會渲染這塊） */}
        {process.env.NODE_ENV !== 'production' && (
          <InfoAlert
            type="info"
            showIcon
            className="!mt-6"
            title="開發模式提示"
            body={
              <>
                正式部署後此 Alert 與「Diagnostic」診斷卡都不會顯示，
                只剩 <Text strong>重試 / 回到首頁</Text> 兩個按鈕。
                完整 stack 請打開瀏覽器 DevTools console。
              </>
            }
          />
        )}
      </div>
    </main>
  )
}
