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
import { ArrowRightOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

export default function HomeClient() {
  const reduce = useReducedMotion()
  const viewportOnce = { once: true, amount: 0.2 } as const
  return (
    <main id="main-content" className="dvh-screen flex flex-1 flex-col">
      {/* ============ Hero — 1 句話 + 1 CTA ============ */}
      <motion.section
        className="border-b border-border bg-background"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div className="mx-auto max-w-2xl px-6 py-20 text-center md:py-28">
          <Title level={1} className="!mb-8 !text-4xl !leading-tight md:!text-5xl">
            車禍理賠金額，5 分鐘算給你看。
          </Title>
          <Link href="/claims/new">
            <Button type="primary" size="large" icon={<ArrowRightOutlined />} iconPlacement="end">
              開始估算
            </Button>
          </Link>
          <div className="!mt-6 text-sm text-muted">填寫 → 計算 → 列印</div>
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
            <Text className="!text-xs text-muted">© 2026 tw-car-claim-estimator</Text>
            <Space size={12} wrap>
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
