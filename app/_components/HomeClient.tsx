'use client'

/**
 * 首頁 client component（v0.18.x+ 重新設計）
 *
 * 設計紀律：
 * - 對齊偏左（variance 8 預設 hero 不置中）
 * - 強調色單一 navy-700（保險公司專業感）
 * - 3 步驟 CTA 為主軸（填寫 → 計算 → 列印報告）
 * - 移除 EnsembleHealthHeroCard / 引用法源 / 地區覆蓋 / 5 大區塊 bento grid
 *   (太技術向, 業務員跟客戶說明不需要)
 * - 無 emoji（AntD icons 取代）
 * - 數字 tabular-nums
 *
 * v0.18.x+ 結構：Hero + 3 步驟 + EstimateHistory + Footer
 */

import Link from 'next/link'
import { Button, Typography, Space, Card, Col, Row } from 'antd'
import { motion, useReducedMotion } from 'framer-motion'
import { InstallPWAButton, PWAHintCard } from '@/components/InstallPWAButton'
import { EstimateHistory } from '@/components/EstimateHistory'
import {
  CalculatorOutlined,
  FileTextOutlined,
  DownloadOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'

const { Title, Paragraph, Text } = Typography

export default function HomeClient() {
  const reduce = useReducedMotion()
  const viewportOnce = { once: true, amount: 0.2 } as const
  return (
    <main id="main-content" className="dvh-screen flex flex-1 flex-col">
      {/* ============ Hero — 偏左不置中 ============ */}
      <motion.section
        className="border-b border-border bg-background"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <Space size={6} className="!mb-4">
            <Text className="text-xs uppercase tracking-[0.18em] text-muted">
              v0.18 · Taiwan Car-Claim Estimator
            </Text>
          </Space>
          <Title level={1} className="!mb-6 !text-4xl !leading-[1.1] !tracking-tight md:!text-6xl">
            車禍理賠金額，
            <br />
            <span className="text-accent">5 分鐘</span>算給你看。
          </Title>
          <Paragraph className="!mb-8 !max-w-3xl !text-base text-muted md:!text-lg">
            依<strong className="text-foreground"> 強制汽車責任保險法 </strong>、
            <strong className="text-foreground"> 民法 §184-196 侵權行為 </strong>
            ，以及<strong className="text-foreground"> 6 個直轄市地方法院實務區間 </strong>
            ，自動產出 5 區估算結果。
          </Paragraph>
          <Space size={12} wrap>
            <Link href="/claims/new">
              <Button type="primary" size="large" icon={<ArrowRightOutlined />} iconPlacement="end">
                開始估算（7 步表單）
              </Button>
            </Link>
            <Link href="/claims/batch">
              <Button size="large" icon={<FileTextOutlined />}>
                批次估算
              </Button>
            </Link>
            <InstallPWAButton />
          </Space>
          <PWAHintCard />
        </div>
      </motion.section>

      {/* ============ 3 步驟 CTA — 業務員跟客戶說明用 ============ */}
      <motion.section
        className="bg-surface-subtle"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportOnce}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <Space size={6} className="!mb-2">
            <CalculatorOutlined />
            <Text className="!text-xs uppercase tracking-[0.18em] text-muted">3 步驟</Text>
          </Space>
          <Title level={2} className="!mb-10 !text-3xl !tracking-tight md:!text-4xl">
            5 分鐘 3 步驟出估算
          </Title>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={viewportOnce}
                transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
              >
                <Card className="!h-full">
                  <div className="!mb-3 flex items-center gap-3">
                    <div className="flex !h-10 !w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                      <span className="!text-lg !font-bold">1</span>
                    </div>
                    <CalculatorOutlined className="!text-2xl text-muted" />
                  </div>
                  <Title level={4} className="!mb-2 !text-lg">
                    填寫
                  </Title>
                  <Paragraph className="!mb-3 !text-sm text-muted">
                    7
                    步表單，填寫車禍基本資料、失能等級、肇責比例等。資料不齊全時工具會提示補件，不會硬給假數字。
                  </Paragraph>
                  <Paragraph className="!mb-0 !text-xs text-muted">預估時間：3-5 分鐘</Paragraph>
                </Card>
              </motion.div>
            </Col>

            <Col xs={24} md={8}>
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={viewportOnce}
                transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
              >
                <Card className="!h-full">
                  <div className="!mb-3 flex items-center gap-3">
                    <div className="flex !h-10 !w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                      <span className="!text-lg !font-bold">2</span>
                    </div>
                    <CheckCircleOutlined className="!text-2xl text-muted" />
                  </div>
                  <Title level={4} className="!mb-2 !text-lg">
                    計算
                  </Title>
                  <Paragraph className="!mb-3 !text-sm text-muted">
                    6 種算法交叉計算（強制險 / 失能 / 民事 / 第三人 / 補件 /
                    地區），綜合給出合理區間。
                  </Paragraph>
                  <Paragraph className="!mb-0 !text-xs text-muted">預估時間：&lt; 1 秒</Paragraph>
                </Card>
              </motion.div>
            </Col>

            <Col xs={24} md={8}>
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={viewportOnce}
                transition={{ duration: 0.4, delay: 0.3, ease: 'easeOut' }}
              >
                <Card className="!h-full">
                  <div className="!mb-3 flex items-center gap-3">
                    <div className="flex !h-10 !w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                      <span className="!text-lg !font-bold">3</span>
                    </div>
                    <DownloadOutlined className="!text-2xl text-muted" />
                  </div>
                  <Title level={4} className="!mb-2 !text-lg">
                    列印
                  </Title>
                  <Paragraph className="!mb-3 !text-sm text-muted">
                    結果含 5 區明細（強制險 / 失能 / 民事 / 第三人 / 補件）+ 法源引用，下載 PDF
                    給客戶。
                  </Paragraph>
                  <Paragraph className="!mb-0 !text-xs text-muted">預估時間：10 秒</Paragraph>
                </Card>
              </motion.div>
            </Col>
          </Row>

          <div className="!mt-8 text-center">
            <Link href="/claims/new">
              <Button type="primary" size="large" icon={<ArrowRightOutlined />} iconPlacement="end">
                開始估算
              </Button>
            </Link>
          </div>
        </div>
      </motion.section>

      {/* ============ 最近估算紀錄 — v0.12.0+ Phase B3（localStorage） ============ */}
      <EstimateHistory />

      {/* ============ Footer / 免責 ============ */}
      <motion.footer
        className="mt-auto border-t border-border bg-background"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportOnce}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col items-start justify-between gap-2 text-xs text-muted md:flex-row md:items-center">
            <Space size={12} wrap>
              <Text className="!text-xs text-muted">© 2026 tw-car-claim-estimator</Text>
              <Link href="/about" className="!text-xs text-muted hover:text-accent">
                關於我們
              </Link>
              <Link href="/privacy" className="!text-xs text-muted hover:text-accent">
                隱私權政策
              </Link>
              <Link href="/terms" className="!text-xs text-muted hover:text-accent">
                服務條款
              </Link>
            </Space>
            <Text className="!text-xs text-muted">v0.18 · 6 直轄市 + 26 縣市</Text>
          </div>
        </div>
      </motion.footer>
    </main>
  )
}
