'use client'

import Link from 'next/link'
import { Button, Typography, Space, Alert } from 'antd'
import { InfoAlert } from '@/components/InfoAlert'
import { motion, useReducedMotion } from 'framer-motion'
import { EnsembleHealthHeroCard } from '@/components/EnsembleHealthHeroCard'
import { InstallPWAButton, PWAHintCard } from '@/components/InstallPWAButton'
import { EstimateHistory } from '@/components/EstimateHistory'
import {
  CalculatorOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  EnvironmentOutlined,
  ArrowRightOutlined,
  CompassOutlined,
  ExperimentOutlined,
  ReadOutlined,
} from '@ant-design/icons'

const { Title, Paragraph, Text } = Typography

/**
 * 首頁 client component（v0.9.0+ 從 app/page.tsx 抽出）
 * - 對齊偏左（variance 8 預設 hero 不置中）
 * - 強調色單一 rose-700，不混紫藍漸層
 * - 5 大區塊改 bento grid 2fr/1fr/1fr 不對稱
 * - 無 emoji（AntD icons 取代）
 * - 數字 tabular-nums
 */
export default function HomeClient() {
  const reduce = useReducedMotion()
  // v0.10.0+：scroll-reveal 共用 viewport 設定（觸發一次、20% 可見時啟動）
  const viewportOnce = { once: true, amount: 0.2 } as const
  return (
    <main id="main-content" className="dvh-screen flex flex-1 flex-col">
      {/* ============ Hero — 偏左不置中 ============ */}
      <motion.section
        className="border-b border-border bg-background"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-6 py-16 md:grid-cols-12 md:py-24">
          <div className="md:col-span-7 md:pr-8">
            <Space size={6} className="!mb-4">
              <Text className="text-xs uppercase tracking-[0.18em] text-muted">v0.1 MVP</Text>
              <span className="text-muted">·</span>
              <Text className="text-xs uppercase tracking-[0.18em] text-muted">
                Taiwan Car-Claim Estimator
              </Text>
            </Space>
            <Title
              level={1}
              className="!mb-4 !text-4xl !leading-[1.05] !tracking-tight md:!text-6xl"
            >
              車禍理賠金額，
              <br />
              <span className="text-accent">5 分鐘</span>算給你看。
            </Title>
            <Paragraph className="!mb-8 !text-base text-muted md:!text-lg">
              依<strong className="text-foreground"> 強制汽車責任保險法 </strong>、
              <strong className="text-foreground"> 民法 §184-196 侵權行為 </strong>
              ，以及<strong className="text-foreground"> 6 個直轄市地方法院實務區間 </strong>
              ，自動產出 5 區估算結果。
            </Paragraph>
            <Space size={12} wrap>
              <Link href="/claims/new">
                <Button
                  type="primary"
                  size="large"
                  icon={<ArrowRightOutlined />}
                  iconPlacement="end"
                >
                  開始估算（7 步表單）
                </Button>
              </Link>
              {/* v0.8.0+：PWA 安裝按鈕 — Android 自動 prompt / iOS 顯示步驟 */}
              <InstallPWAButton />
            </Space>
            {/* v0.8.0+：提示卡 — 永遠顯示「可以裝成 app」 */}
            <PWAHintCard />
            <Space size={20} className="!mt-10" wrap>
              <Stat label="583 件真實判例" value="583" />
              <Divider />
              <Stat label="6 大計算引擎" value="6" />
              <Divider />
              <Stat label="39 件手動建檔" value="39" />
              <Divider />
              <Stat label="6 直轄市法院" value="6" />
              <Divider />
              <Stat label="26 縣市自動對應" value="26" />
              <Divider />
              <Stat label="強制險 15 細項" value="15" />
            </Space>
          </div>

          {/* Hero 右侧 — bento 重排 (v0.11.0+)：
              1 大格（Ensemble 健康度，accent 邊框為主視覺錨點）
              + 2 小格（引用法源 / 地區覆蓋 並排） */}
          <div className="md:col-span-5">
            {/* 主格：Ensemble 健康度 — 加大 padding、accent border 凸顯主視覺 */}
            <div className="rounded-lg border-2 border-accent/30 bg-surface p-5 shadow-[0_1px_0_rgba(190,18,60,0.04)]">
              <EnsembleHealthHeroCard />
            </div>

            {/* 次格 2 欄並排：引用法源 + 地區覆蓋 */}
            <div className="!mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface p-4 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
                <Space size={6} className="!mb-2">
                  <ReadOutlined />
                  <Text className="!text-xs !font-semibold uppercase tracking-wider text-foreground">
                    引用法源
                  </Text>
                </Space>
                <ul className="m-0 space-y-2 !text-xs text-muted">
                  <li>
                    <span className="text-foreground">強制汽車責任保險法 §27</span>
                    <br />
                    <span className="text-[11px] text-muted">
                      國家立法保障所有用路人，基本醫療與失能必賠
                    </span>
                  </li>
                  <li>
                    <span className="text-foreground">強制險給付標準 §2-§4</span>
                    <br />
                    <span className="text-[11px] text-muted">
                      15 細項法定上限（如醫療 20 萬、看護每日 1,200 元）
                    </span>
                  </li>
                  <li>
                    <span className="text-foreground">民法 §184 / §193-§195</span>
                    <br />
                    <span className="text-[11px] text-muted">
                      侵權行為 + 醫療 / 工作 / 精神慰撫金請求權
                    </span>
                  </li>
                  <li className="text-foreground">
                    6 直轄市地院慰撫金區間
                    <br />
                    <span className="text-[11px] text-muted">同類傷勢在不同地區法院的判賠區間</span>
                  </li>
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-surface-subtle p-4">
                <Space size={6} className="!mb-2">
                  <EnvironmentOutlined />
                  <Text className="!text-xs uppercase tracking-wider text-muted">地區覆蓋</Text>
                </Space>
                <Text className="!text-xs text-foreground">
                  6 直轄市地院 + 26 縣市自動對應
                  <br />
                  （台 / 臺異體字相容）
                </Text>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ============ 5 大區塊 — bento grid 2fr / 1fr / 1fr ============ */}
      <motion.section
        id="sections"
        className="bg-surface-subtle"
        // v0.10.0+：scroll reveal
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportOnce}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <Space size={6} className="!mb-2">
            <ExperimentOutlined />
            <Text className="!text-xs uppercase tracking-[0.18em] text-muted">
              Estimation Sections
            </Text>
          </Space>
          <Title level={2} className="!mb-3 !text-3xl !tracking-tight md:!text-4xl">
            5 區估算結果
          </Title>
          <Paragraph className="!mb-10 !text-base text-muted">
            每一區都是「試算」非「判決」。實際理賠仍須依保險公司審核、醫療資料、肇事責任、
            保單條款、金融評議或法院認定為準。
          </Paragraph>

          {/* Bento grid — 2fr/1fr 上面 + 1fr/1fr/1fr 下面（variance 8 不對稱） */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-2">
            {/* 主格：強制險 — 2fr 寬 */}
            <BentoCell
              icon={<SafetyCertificateOutlined />}
              index="01"
              title="強制險"
              subtitle="Compulsory Insurance"
              description="依 15 細項法定上限逐項試算"
              featured
            />
            <BentoCell
              icon={<CompassOutlined />}
              index="02"
              title="失能初篩"
              subtitle="Disability Screening"
              description="關節 ROM 量測 → 失能等級對照，不直接判定，給補件建議"
            />
            <BentoCell
              icon={<CalculatorOutlined />}
              index="03"
              title="第三人責任險"
              subtitle="Third-Party Liability"
              description="體傷 + 財損分開 cap，自動扣強制險已估金額"
            />
            <BentoCell
              icon={<FileTextOutlined />}
              index="04"
              title="補件清單"
              subtitle="Evidence Checklist"
              description="依空欄位自動產出需補件項目，避免估算不準"
            />
            <BentoCell
              icon={<EnvironmentOutlined />}
              index="05"
              title="地區實務參考"
              subtitle="Regional Court Data"
              description="金融評議中心案例 + 司法院判決區間"
            />
            {/* 第 6 格空白 bento，營造 variance */}
            <div className="hidden rounded-lg border border-dashed border-border md:flex md:items-center md:justify-center">
              <Text className="!text-xs uppercase tracking-wider text-muted">
                法源資料每 30 天更新
              </Text>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ============ 最近估算紀錄 — v0.12.0+ Phase B3（localStorage） ============ */}
      <EstimateHistory />

      {/* ============ Footer / 免責 ============ */}
      <motion.footer
        className="mt-auto border-t border-border bg-background"
        // v0.10.0+：scroll reveal
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportOnce}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="mx-auto w-full max-w-6xl px-6 py-10">
          <div className="flex flex-col items-start justify-between gap-2 text-xs text-muted md:flex-row md:items-center">
            <Space size={12} wrap>
              <Text className="!text-xs text-muted">
                © 2026 tw-car-claim-estimator · Built with Next.js 16 + AntD 6
              </Text>
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
            <Text className="!text-xs text-muted">v0.12.0 · 6 直轄市 + 26 縣市</Text>
          </div>
        </div>
      </motion.footer>
    </main>
  )
}

// ============== Sub-components ==============

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Space orientation="vertical" size={2}>
      <span className="tabular-nums text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </span>
      <span className="text-xs uppercase tracking-wider text-muted">{label}</span>
    </Space>
  )
}

function Divider() {
  return <span aria-hidden className="hidden h-8 w-px bg-border md:inline-block" />
}

function BentoCell({
  icon,
  index,
  title,
  subtitle,
  description,
  featured = false,
}: {
  icon: React.ReactNode
  index: string
  title: string
  subtitle: string
  description: string
  featured?: boolean
}) {
  return (
    <div
      className={[
        'group rounded-lg border bg-surface p-6 transition-colors',
        'border-border hover:border-border-strong',
        featured ? 'md:col-span-2 md:row-span-2' : '',
      ].join(' ')}
    >
      <Space size={8} className="!mb-3">
        <span className="text-lg text-accent">{icon}</span>
        <span className="tabular-nums text-xs font-mono uppercase tracking-wider text-muted">
          {index}
        </span>
      </Space>
      <Title level={3} className="!mb-1 !text-xl !tracking-tight">
        {title}
      </Title>
      <Text className="!mb-3 !text-xs uppercase tracking-wider text-muted">{subtitle}</Text>
      <Paragraph
        className={['!mb-0 !text-sm text-muted', featured ? 'md:!text-base' : ''].join(' ')}
      >
        {description}
      </Paragraph>
    </div>
  )
}

function IronRow({ label, desc, reason }: { label: string; desc: string; reason?: string }) {
  return (
    <div className="bg-background p-5">
      <Space size={6} className="!mb-1">
        <span className="text-accent">/</span>
        <Text className="!text-sm !font-semibold text-foreground">{label}</Text>
      </Space>
      <Text className="!text-sm text-muted">{desc}</Text>
      {reason && (
        <Text className="!mt-2 !text-xs italic text-muted opacity-80">為什麼：{reason}</Text>
      )}
    </div>
  )
}

/**
 * v0.12.0+ Phase A6：FAQ 卡片子元件
 * Q 在上、A 在下，hover 加陰影提示可閱讀
 */
function FaqCard({ q, a }: { q: string; a: string }) {
  return (
    <div className="group rounded-lg border border-border bg-surface p-5 transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <Text strong className="!text-sm text-foreground">
        Q · {q}
      </Text>
      <Paragraph className="!mt-2 !mb-0 !text-sm text-muted">{a}</Paragraph>
    </div>
  )
}
