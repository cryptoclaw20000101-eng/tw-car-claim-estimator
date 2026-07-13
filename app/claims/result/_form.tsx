'use client'

/**
 * 結果頁（v0.14.x — 結果頁主控組件，1286 → 496 行 v0.15.x 拆 8 個 Section）
 *
 * Section 元件（8 個）已全拆到 _sections/ 子目錄（v0.15.x+ 6808672 + cb6f0fe + e0e0e0e）：
 *   - _sections/CompulsorySection.tsx
 *   - _sections/DisabilitySection.tsx
 *   - _sections/PracticeCasesSection.tsx
 *   - _sections/CivilSection.tsx
 *   - _sections/ThirdPartySection.tsx
 *   - _sections/SupplementSection.tsx
 *   - _sections/RegionSection.tsx
 *   - _sections/LegalSection.tsx
 *
 * 本檔只負責：Tabs / Hero / 法源 / 客戶精簡模式 toggle / 分享 / 列印 / 批次估算按鈕
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Row,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  Collapse,
  // v0.12.0+ Phase B5：分享連結 toast
  message,
} from 'antd'

// v0.12.0+ Phase B5：分享成功 / 失敗 toast
const antdMessage = message
import { InfoAlert } from '@/components/InfoAlert'
import { LawVersionBadge } from '@/components/LawVersionBadge'
import { PainEnsembleCard } from '@/components/PainEnsembleCard'
import { KnnDebugPanel } from '@/components/KnnDebugPanel'
import { MobileStickyCTA } from '@/components/MobileStickyCTA'
// v0.13.x：共用 PageBreadcrumb 元件
import { PageBreadcrumb } from '@/components/PageBreadcrumb'
// v0.12.0+ Phase B7：多肇責比例並排比較
import { MultiFaultCompare } from '@/components/MultiFaultCompare'
// v0.12.0+ Phase B5：分享連結
import { encodeShareHash } from '@/lib/share-link'
import {
  ArrowLeftOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  AlertOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  BankOutlined,
  ReadOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  // v0.12.0+ Phase E2/E3/B5：下載 PDF + 客戶精簡模式 + 分享連結
  FilePdfOutlined,
  CompressOutlined,
  ExpandOutlined,
  ShareAltOutlined,
  WarningOutlined,
  EditOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import { motion, useReducedMotion } from 'framer-motion'
import dynamic from 'next/dynamic'
import type { ClaimInput, EstimationResult } from '@/lib/insurance/types'
import { estimateClaim } from '@/lib/insurance'
import { SAMPLE_INPUT } from '@/lib/insurance/sample'
import {
  getMedianCourtCompensation,
  getCaseReferencesByCategory,
} from '@/lib/data-sources/judicial'
import { findRelatedPrecedents, findRelatedPracticeCases } from '@/lib/estimate/precedents'
// v0.12.0+ Phase B3：localStorage 歷史記錄
import { saveEstimateHistory, buildHistoryEntry } from '@/lib/estimate-history'
// v0.14.x：雲端持久化（Supabase + localStorage fallback）
import { saveEstimate } from '@/lib/estimate-storage'
// v0.14.x：登入狀態
import { useAuth } from '@/components/AuthProvider'
import { getAverageFoiCompensation } from '@/lib/data-sources/foi'
import { listLegalReferences, isLegalReferenceStale } from '@/lib/data-sources/legal-reference'
import type { LegalReference } from '@/lib/data-sources/types'
// v0.18.x+ 動態載入 8 個 Section 元件（每 section 獨立 chunk；只有當前 tab 才 mount）
// 比起 destroyOnHidden 更進一步：完全 lazy load，減少首次 result page 的 JS bundle
const CompulsorySection = dynamic(
  () => import('./_sections/CompulsorySection').then((m) => m.CompulsorySection),
  { ssr: false },
)
const DisabilitySection = dynamic(
  () => import('./_sections/DisabilitySection').then((m) => m.DisabilitySection),
  { ssr: false },
)
const PracticeCasesSection = dynamic(
  () => import('./_sections/PracticeCasesSection').then((m) => m.PracticeCasesSection),
  { ssr: false },
)
const CivilSection = dynamic(() => import('./_sections/CivilSection').then((m) => m.CivilSection), {
  ssr: false,
})
const ThirdPartySection = dynamic(
  () => import('./_sections/ThirdPartySection').then((m) => m.ThirdPartySection),
  { ssr: false },
)
const SupplementSection = dynamic(
  () => import('./_sections/SupplementSection').then((m) => m.SupplementSection),
  { ssr: false },
)
const RegionSection = dynamic(
  () => import('./_sections/RegionSection').then((m) => m.RegionSection),
  { ssr: false },
)
const LegalSection = dynamic(() => import('./_sections/LegalSection').then((m) => m.LegalSection), {
  ssr: false,
})

// 結果頁依賴 sessionStorage 與 AntD Table / Statistic，必須 client runtime

const { Title, Paragraph, Text } = Typography

const dollar = (n: number) => `NT$ ${(n ?? 0).toLocaleString('zh-TW')}`

export default function ResultForm() {
  // v0.12.0+ Phase E3：客戶精簡模式（隱藏技術細節，給客戶看的精簡版）
  const [compactMode, setCompactMode] = useState(false)
  // v0.14.x：用戶登入狀態
  const { user } = useAuth()

  // v0.12.0+ Phase B5：分享連結 handler
  const handleShare = async () => {
    if (!input || !result) return
    try {
      const hash = encodeShareHash(input, result)
      if (!hash) {
        antdMessage.error('產生分享連結失敗')
        return
      }
      const url = `${window.location.origin}/claims/result#${hash}`
      await navigator.clipboard.writeText(url)
      antdMessage.success('已複製分享連結到剪貼簿')
    } catch {
      antdMessage.error('複製失敗，請手動複製網址')
    }
  }

  // 用 lazy initializer 在第一次 render 時同步讀 sessionStorage，
  // 避免在 useEffect 內同步 setState 觸發 cascading render
  // （符合 react-hooks/set-state-in-effect 規則）
  const [hydrated] = useState(() => {
    if (typeof window === 'undefined') return { input: null, result: null, stale: false }
    // v0.18.x+ sessionStorage 版本檢查：避免舊版資料殘留導致 crash
    const STORAGE_VERSION = 'v2'
    if (sessionStorage.getItem('claim-storage-version') !== STORAGE_VERSION) {
      sessionStorage.removeItem('claim-input')
      sessionStorage.removeItem('claim-result')
      sessionStorage.setItem('claim-storage-version', STORAGE_VERSION)
    }
    // v0.18.x+ 過期檢查：超過 1 小時的估算視為過期
    const ts = sessionStorage.getItem('claim-storage-ts')
    if (ts && Date.now() - parseInt(ts, 10) > 60 * 60 * 1000) {
      sessionStorage.removeItem('claim-input')
      sessionStorage.removeItem('claim-result')
      sessionStorage.removeItem('claim-storage-ts')
    }
    const rawInput = sessionStorage.getItem('claim-input')
    const rawResult = sessionStorage.getItem('claim-result')
    if (!rawInput || !rawResult) return { input: null, result: null, stale: false }
    const input = JSON.parse(rawInput) as ClaimInput
    const result = JSON.parse(rawResult) as EstimationResult
    // 檢查法源時效（isLegalReferenceStale 是同步函數）
    let stale = false
    try {
      const all = listLegalReferences()
      stale = all.some((r) => isLegalReferenceStale(r))
    } catch {
      /* ignore */
    }
    return { input, result, stale }
  })

  // 拿掉 useEffect redirect：Empty state + 「看估算範例」按鈕就是設計好的 UX 入口
  // 若強制 redirect 會在使用者點按鈕前把他送走（race condition）
  // 不用 useRouter：點按鈕用 window.location.assign 整頁 reload 觸發 useState lazy init
  const input = hydrated.input
  const result = hydrated.result
  const stale = hydrated.stale

  // v0.16.x 完整 PDF 估算書：自動產生唯一估算編號（用 input + timestamp hash）
  // 列印時跟時間戳印在封面，確保試算可追溯
  const estimateId = input
    ? (() => {
        // 簡易 djb2 hash (input JSON 字串) → 8 字符 hex
        const s = JSON.stringify(input) + Date.now()
        let h = 5381
        for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
        const ts = new Date()
        const stamp = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}`
        return `TCE-${stamp}-${(h >>> 0).toString(16).padStart(8, '0').slice(0, 8).toUpperCase()}`
      })()
    : null

  // v0.12.0+ Phase B3：估算成功後自動寫入 localStorage 歷史（脫敏後）
  // v0.14.x：登入時改存 Supabase 雲端（fallback 到 localStorage）
  // 用 useEffect 確保只在 client 跑（避免 SSR 報錯）
  useEffect(() => {
    if (!input || !result) return
    void (async () => {
      try {
        await saveEstimate(input, result, user?.id ?? null)
      } catch {
        // silent fail
      }
    })()
    // 只在 mount 時跑一次（result 變動不重複存）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!input || !result) {
    return (
      <main
        id="main-content"
        className="flex flex-1 flex-col items-center justify-center bg-surface-subtle px-6 py-16"
      >
        <div className="w-full max-w-md text-center">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div className="!mt-2">
                <Text className="!block !text-base !text-foreground">尚無估算資料</Text>
                <Text type="secondary" className="!mt-1 !block !text-sm">
                  請先填寫 7 步表單以產生估算結果。
                </Text>
              </div>
            }
          />
          <div className="!mt-2 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/claims/new">
              <Button type="primary" size="large" icon={<EditOutlined />}>
                開始估算（7 步表單）
              </Button>
            </Link>
            <Button
              size="large"
              icon={<EyeOutlined />}
              onClick={() => {
                // 跑示範估算 → 寫 sessionStorage → 整頁 reload 觸發 useState lazy init
                // （最 surgical 方案；不用破壞既有 useState/hydrated 結構）
                const result = estimateClaim(SAMPLE_INPUT)
                sessionStorage.setItem('claim-input', JSON.stringify(SAMPLE_INPUT))
                sessionStorage.setItem('claim-result', JSON.stringify(result))
                sessionStorage.setItem('claim-storage-version', 'v2') // v0.18.x+
                window.location.assign('/claims/result')
              }}
            >
              看估算範例
            </Button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main
      id="main-content"
      data-compact={compactMode}
      className="flex flex-1 flex-col items-center px-6 py-8 bg-surface-subtle"
    >
      {/* v0.16.x 列印專用封面 (平時 hidden, @media print 顯示) */}
      <div className="print-only hidden w-full max-w-5xl !bg-white !p-12" data-testid="print-cover">
        <div className="!mb-8 !border-b-2 !border-black !pb-4">
          <div className="!text-2xl !font-bold !text-black">車禍理賠金額試算書</div>
          <div className="!mt-1 !text-sm !text-black">Car-Claim Estimation Report</div>
        </div>
        <div className="!mb-6 !grid !grid-cols-2 !gap-4 !text-sm !text-black">
          <div>
            <div className="!font-semibold">估算編號</div>
            <div className="!font-mono">{estimateId ?? '—'}</div>
          </div>
          <div>
            <div className="!font-semibold">估算時間</div>
            <div>{new Date().toLocaleString('zh-TW')}</div>
          </div>
          <div>
            <div className="!font-semibold">工具版本</div>
            <div>v0.16.x · tw-car-claim-estimator</div>
          </div>
          <div>
            <div className="!font-semibold">事故地點</div>
            <div>{input?.basics?.accidentLocation ?? '—'}</div>
          </div>
        </div>
        <div className="!mt-8 !rounded !border-2 !border-black !p-4 !text-xs !text-black">
          <div className="!mb-2 !font-bold">免責聲明</div>
          <div>
            本試算書僅供參考，金額依《強制汽車責任保險法》、《民法》侵權行為及 6
            直轄市地方法院實務區間推算，<strong>不構成法律意見</strong>。
            實際理賠仍須依保險公司審核、醫療資料、肇事責任、保單條款、金融評議或法院認定為準。
          </div>
        </div>
        <div className="!mt-4 !text-center !text-xs !text-black">— 第 1 頁 —</div>
        <div className="!mt-2 !text-center !text-xs !text-black">製作 by 信安保經小鄭</div>
      </div>

      <div className="w-full max-w-5xl">
        <PageBreadcrumb
          back={{
            kind: 'link',
            href: '/claims/new',
            label: '重新估算',
            icon: <ArrowLeftOutlined />,
          }}
          actions={[
            {
              kind: 'button',
              onClick: () => {
                // v0.18.x 會員限定：未登入跳登入頁（估算本身開放所有訪客）
                if (!user) {
                  antdMessage.warning('PDF 報告產出為會員限定功能，請先登入')
                  setTimeout(() => {
                    window.location.href = '/login?redirect=/claims/result'
                  }, 800)
                  return
                }
                window.print()
              },
              // v0.18.x 視覺化：未登入時按鈕文字加提示
              label: user ? '下載 PDF' : '下載 PDF（需登入）',
              icon: <FilePdfOutlined />,
              testId: 'download-pdf',
            },
            {
              kind: 'button',
              onClick: handleShare,
              label: '分享連結',
              icon: <ShareAltOutlined />,
              testId: 'share-link',
            },
            {
              kind: 'button',
              onClick: () => setCompactMode(!compactMode),
              label: compactMode ? '展開技術細節' : '客戶精簡模式',
              icon: compactMode ? <ExpandOutlined /> : <CompressOutlined />,
              testId: 'toggle-compact-mode',
            },
          ]}
          showHome={true}
        />

        <Title level={2} className="!mb-2">
          <BarChartOutlined className="mr-2 text-accent" />
          估算結果
        </Title>
        <Paragraph type="secondary" className="!mb-4">
          事故地點：{input.basics.accidentLocation || '（未填）'} · {input.basics.accidentDate} ·
          管轄法院：{result.region.courtName}
          <span className="ml-2">
            <LawVersionBadge accidentDate={input.basics.accidentDate} />
          </span>
        </Paragraph>

        {stale && (
          <InfoAlert
            type="warning"
            showIcon
            className="!mb-4"
            title="法源資料已超過 6 個月未更新"
            body="本結果所引用的法規/判例資料可能已過期，建議洽詢保險公司或理賠顧問確認最新規定。"
          />
        )}

        <InfoAlert
          type="error"
          showIcon
          className="!mb-6"
          title="免責聲明"
          body="本結果為依使用者輸入及公開法源/案例之初步估算，非最終理賠金額。實際理賠須依保險公司審核、醫療資料、肇事責任、保單條款、評議/判決結果及雙方和解結果為準。"
        />

        {/* ============ Hero Stat — 4 大關鍵數字 (v0.11.0+ 主數字放大 2x + accent ring) ============ */}
        <div className="!mb-6 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border transition-all duration-200 hover:shadow-md md:grid-cols-4">
          {/* 主格 2fr：強制險總估算 — 放大 2x + accent 左邊條 + accent text */}
          <div className="relative bg-surface p-5 md:col-span-2 md:p-6">
            {/* v0.11.0+：主格 accent 左邊條強調主視覺 */}
            <span aria-hidden className="absolute left-0 top-0 h-full w-1 bg-accent" />
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-accent">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              <span>強制險總估算（主視覺）</span>
            </div>
            <div className="tabular-nums text-4xl font-bold tracking-tight text-accent md:text-5xl">
              {dollar(result.compulsoryTotalEstimated)}
            </div>
            <div className="mt-2 text-xs text-muted">
              含醫療 {dollar(result.compulsoryItems.reduce((s, r) => s + r.approved, 0))} / 失能{' '}
              {dollar(result.compulsoryDisabilityAmount)} / 死亡{' '}
              {dollar(result.compulsoryDeathAmount)}
            </div>
          </div>
          {/* 副格 1：民事中標 — 縮小到 text-base */}
          <div className="bg-surface p-5">
            <div className="mb-2 text-xs uppercase tracking-[0.18em] text-muted">民事中標</div>
            <div className="tabular-nums text-base font-semibold tracking-tight text-foreground">
              {dollar(result.painAndSuffering.regionalMid)}
            </div>
            <div className="mt-1 text-xs text-muted">
              精神慰撫金 × {result.region.courtName} 係數
            </div>
          </div>
          {/* 副格 2：失能初篩 — 縮小到 text-base
              v0.19.x+：當沒信號時顯示「資料不足」而非「分級 A」（避免誤導）*/}
          <div className="bg-surface p-5">
            <div className="mb-2 text-xs uppercase tracking-[0.18em] text-muted">失能初篩</div>
            <div className="text-base font-semibold tracking-tight">
              {result.disability.signals.length > 0 || result.disability.possibleLevel !== null ? (
                <span
                  style={{
                    color: {
                      A: 'var(--data-positive)',
                      B: 'var(--accent)',
                      C: 'var(--data-warning)',
                      D: 'var(--data-negative)',
                    }[result.disability.screening],
                  }}
                >
                  分級 {result.disability.screening}
                </span>
              ) : (
                <span className="text-muted">資料不足</span>
              )}
            </div>
            <div className="mt-1 text-xs text-muted">
              {result.disability.possibleLevel
                ? `可能等級：第 ${result.disability.possibleLevel} 級`
                : '需補失能診斷書 + ROM 才能評估'}
            </div>
          </div>
        </div>

        {/* v0.12.0+ Phase B7：多肇責比例並排比較 */}
        <MultiFaultCompare
          civilMidBaseline={result.thirdParty?.civilDamageTotalMid ?? 0}
          bodilyInjuryAmount={(result.civilMedicalExpense ?? 0) + (result.workLoss ?? 0)}
          propertyDamageAmount={result.propertyDamage ?? 0}
        />

        <div className="sticky top-0 z-10 -mx-6 mb-6 bg-surface-subtle/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface-subtle/80">
          <Tabs
            type="card"
            destroyOnHidden
            defaultActiveKey="compulsory"
            items={[
              {
                key: 'compulsory',
                label: (
                  <span>
                    <SafetyCertificateOutlined /> ① 強制險
                  </span>
                ),
                children: (
                  <TabContent>
                    <CompulsorySection result={result} />
                  </TabContent>
                ),
              },
              {
                key: 'disability',
                label: (
                  <span>
                    <FileTextOutlined /> ② 失能初篩
                  </span>
                ),
                children: (
                  <TabContent>
                    <DisabilitySection result={result} />
                  </TabContent>
                ),
              },
              {
                key: 'practice',
                label: (
                  <span>
                    <FileTextOutlined /> ②b 理賠實務案例
                  </span>
                ),
                children: (
                  <TabContent>
                    <PracticeCasesSection result={result} />
                  </TabContent>
                ),
              },
              {
                key: 'civil',
                label: (
                  <span>
                    <DollarOutlined /> ③ 民事損害
                  </span>
                ),
                children: (
                  <TabContent>
                    <CivilSection result={result} />
                  </TabContent>
                ),
              },
              {
                key: 'third',
                label: (
                  <span>
                    <BankOutlined /> ④ 第三人責任險
                  </span>
                ),
                children: (
                  <TabContent>
                    <ThirdPartySection result={result} input={input} />
                  </TabContent>
                ),
              },
              {
                key: 'supplement',
                label: (
                  <span>
                    <AlertOutlined /> ⑤ 補件 / 風險
                  </span>
                ),
                children: (
                  <TabContent>
                    <SupplementSection result={result} />
                  </TabContent>
                ),
              },
              {
                key: 'region',
                label: (
                  <span>
                    <EnvironmentOutlined /> ⑥ 地區實務
                  </span>
                ),
                children: (
                  <TabContent>
                    <RegionSection result={result} />
                  </TabContent>
                ),
              },
              {
                key: 'legal',
                label: (
                  <span>
                    <ReadOutlined /> ⑦ 法源依據
                  </span>
                ),
                children: (
                  <TabContent>
                    <LegalSection />
                  </TabContent>
                ),
              },
            ]}
          />
        </div>

        {/* v0.8.1+：結果頁底部手機 sticky CTA（避免長結果頁要滑回頂部操作） */}
        <MobileStickyCTA
          left={
            <Link href="/claims/new">
              <Button block icon={<ArrowLeftOutlined />}>
                重新估算
              </Button>
            </Link>
          }
          right={
            <Link href="/">
              <Button block type="primary">
                回首頁
              </Button>
            </Link>
          }
        />
      </div>
    </main>
  )
}

// ============== ① 強制險 ==============
function TabContent({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
