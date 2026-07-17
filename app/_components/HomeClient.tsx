'use client'

/**
 * 首頁 client component（v0.18.x+ 極簡版）
 *
 * v0.18.x+ 設計紀律：user 2026-07-10 要求「小工具 → 越簡單越直白越好」
 * - 1 句話標題 + 1 個主 CTA
 * - 3 步驟改 1 行 inline（不 3 個 card）
 * - 移除 PWA / 批次估算 / 3 步驟 card / 任何 v0.18 標籤
 * - 保留 EstimateHistory（localStorage）+ Footer
 */

import Link from 'next/link'
import { Button, Typography, Space } from 'antd'
import { motion, useReducedMotion } from 'framer-motion'
import { EstimateHistory } from '@/components/EstimateHistory'
import { ArrowRightOutlined, UserAddOutlined } from '@ant-design/icons'
// v0.23.1+：user 反饋「找不到登入鍵」，在 HomeClient 加 useAuth + 明顯登入 CTA
import { useAuth } from '@/components/AuthProvider'

const { Title, Text } = Typography

export default function HomeClient() {
  const reduce = useReducedMotion()
  const viewportOnce = { once: true, amount: 0.2 } as const
  // v0.23.1+：user 反饋找不到登入鍵 — 在 Hero CTA 旁加明顯登入連結
  const { user } = useAuth()
  return (
    <main id="main-content" className="dvh-screen flex flex-1 flex-col">
      {/* ============ Hero — 1 句話 + 1 CTA ============ */}
      {/* v0.18.x+ LCP 優化：Hero 文字 (LCP 元素) 不做 fade-in，初始即 opacity:1
          動畫只保留給 below-the-fold (whileInView)，hero 第一屏立即可見 */}
      <motion.section
        className="border-b border-border bg-background"
        initial={false}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mx-auto max-w-2xl px-6 py-20 text-center md:py-28">
          <Title level={1} className="!mb-8 !text-4xl !leading-tight md:!text-5xl">
            車禍理賠金額，5 分鐘算給你看。
          </Title>
          {/* v0.23.1+：Hero CTA 旁加登入 / 顯示已登入狀態（user 反饋找不到登入鍵） */}
          <Space size={12} wrap className="!justify-center">
            <Link href="/claims/new">
              <Button type="primary" size="large" icon={<ArrowRightOutlined />} iconPosition="end">
                開始估算
              </Button>
            </Link>
            {user ? (
              <Text className="!text-sm text-muted">已登入：{user.email ?? '用戶'}</Text>
            ) : (
              <Link href="/login">
                <Button size="large" icon={<UserAddOutlined />} data-testid="hero-login-button">
                  註冊 / 登入（雲端同步估算）
                </Button>
              </Link>
            )}
          </Space>
        </div>
      </motion.section>

      <EstimateHistory />

      {/* ============ Footer ============ */}
      <motion.footer
        className="mt-auto border-t border-border bg-background"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportOnce}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div className="mx-auto max-w-2xl px-6 py-8">
          <div className="flex flex-col items-center gap-2 text-xs text-muted md:flex-row md:justify-between">
            {/* v0.24.1+：footer 改成「理賠顧問小鄭製作」 */}
            <Text className="!text-xs text-muted">© 2026 理賠顧問小鄭製作</Text>
            <Space size={12} wrap>
              {/* v0.27.6+：管理員後台入口已從 footer 移除（v0.27.0 admin gate 已守住 URL，
                  不需要公開連結暴露路徑）*/}
              <Link href="/about" className="!text-xs text-muted hover:text-accent">
                關於
              </Link>
              <Link href="/privacy" className="!text-xs text-muted hover:text-accent">
                隱私
              </Link>
              <Link href="/terms" className="!text-xs text-muted hover:text-accent">
                條款
              </Link>
            </Space>
          </div>
        </div>
      </motion.footer>
    </main>
  )
}
