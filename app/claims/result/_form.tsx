'use client'

/**
 * 結果頁（v0.14.x — 1269 lines）
 *
 * ⚠️ 此檔案過大，建議 v0.15.x 拆 Section 元件到 _sections/ 子目錄：
 *   - _sections/CompulsorySection.tsx
 *   - _sections/DisabilitySection.tsx
 *   - _sections/PracticeCasesSection.tsx
 *   - _sections/CivilSection.tsx
 *   - _sections/ThirdPartySection.tsx
 *   - _sections/SupplementSection.tsx
 *   - _sections/RegionSection.tsx
 *   - _sections/LegalSection.tsx
 *
 * 拆解風險：每 Section 都用 useState / useEffect / antd 元件，
 * 內部互相引用（input / result 從 hydrated state 來）。
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
import type { ClaimInput, EstimationResult } from '@/lib/insurance/types'
import { estimateClaim } from '@/lib/insurance'
import { SAMPLE_INPUT } from '@/lib/insurance/sample'
import {
  getMedianCourtCompensation,
  getCaseReferencesByCategory,
} from '@/lib/data-sources/judicial'
import {
  findRelatedPrecedents,
  getPrecedentCount,
  findRelatedPracticeCases,
} from '@/lib/estimate/precedents'
// v0.12.0+ Phase B3：localStorage 歷史記錄
import { saveEstimateHistory, buildHistoryEntry } from '@/lib/estimate-history'
// v0.14.x：雲端持久化（Supabase + localStorage fallback）
import { saveEstimate } from '@/lib/estimate-storage'
// v0.14.x：登入狀態
import { useAuth } from '@/components/AuthProvider'
import { getAverageFoiCompensation } from '@/lib/data-sources/foi'
import { listLegalReferences, isLegalReferenceStale } from '@/lib/data-sources/legal-reference'
import type { LegalReference } from '@/lib/data-sources/types'

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

  // v0.12.0+ Phase B3：估算成功後自動寫入 localStorage 歷史（脫敏後）
  // v0.14.x：登入時改存 Supabase 雲端（fallback 到 localStorage）
  // 用 useEffect 確保只在 client 跑（避免 SSR 報錯）
  useEffect(() => {
    if (!input || !result) return
    void (async () => {
      try {
        await saveEstimate(
          input,
          result,
          user?.id ?? null,
        )
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
              onClick: () => window.print(),
              label: '下載 PDF',
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
          {/* 副格 2：失能初篩 — 縮小到 text-base */}
          <div className="bg-surface p-5">
            <div className="mb-2 text-xs uppercase tracking-[0.18em] text-muted">失能初篩</div>
            <div className="text-base font-semibold tracking-tight">
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
            </div>
            <div className="mt-1 text-xs text-muted">
              {result.disability.possibleLevel
                ? `可能等級：第 ${result.disability.possibleLevel} 級`
                : '資料不足以判定'}
            </div>
          </div>
        </div>

        {/* v0.12.0+ Phase B7：多肇責比例並排比較 */}
        <MultiFaultCompare
          civilMidBaseline={result.thirdParty.civilDamageTotalMid}
          bodilyInjuryAmount={result.civilMedicalExpense + result.workLoss}
          propertyDamageAmount={result.propertyDamage}
        />

        <div className="sticky top-0 z-10 -mx-6 mb-6 bg-surface-subtle/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface-subtle/80">
          <Tabs
            type="card"
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
function CompulsorySection({ result }: { result: EstimationResult }) {
  const rows = result.compulsoryItems
  const totalApplied = rows.reduce((s, r) => s + r.applied, 0)
  const totalApproved = rows.reduce((s, r) => s + r.approved, 0)
  return (
    <Card>
      <Row gutter={16} className="!mb-4">
        <Col xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0, ease: 'easeOut' }}
          >
            <Statistic title="申請小計" value={totalApplied} formatter={(v) => dollar(Number(v))} />
          </motion.div>
        </Col>
        <Col xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: 'easeOut' }}
          >
            <Statistic
              title="預估可認列"
              value={totalApproved}
              formatter={(v) => dollar(Number(v))}
              styles={{ content: { color: 'var(--accent)' } }}
            />
          </motion.div>
        </Col>
        <Col xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16, ease: 'easeOut' }}
          >
            <Statistic
              title="失能給付"
              value={result.compulsoryDisabilityAmount}
              formatter={(v) => dollar(Number(v))}
            />
          </motion.div>
        </Col>
        <Col xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.24, ease: 'easeOut' }}
          >
            <Statistic
              title="死亡給付"
              value={result.compulsoryDeathAmount}
              formatter={(v) => dollar(Number(v))}
            />
          </motion.div>
        </Col>
      </Row>
      <InfoAlert
        type="info"
        showIcon
        className="!mb-3"
        title={`強制險總估算：${dollar(result.compulsoryTotalEstimated)}`}
        body="含醫療、失能、死亡。精神慰撫金、工作損失、車損不計入強制險（法律強制）。"
      />
      <Table
        size="small"
        rowKey="key"
        dataSource={rows}
        pagination={false}
        columns={[
          { title: '項目', dataIndex: 'label', width: 140 },
          { title: '申請', dataIndex: 'applied', render: (v: number) => dollar(v), width: 110 },
          {
            title: '預估可認',
            dataIndex: 'approved',
            render: (v: number) => <Text strong>{dollar(v)}</Text>,
            width: 130,
          },
          {
            title: '法定上限',
            dataIndex: 'legalCap',
            render: (v: number | null) => (v ? dollar(v) : '—'),
            width: 100,
          },
          {
            title: '刪減原因',
            dataIndex: 'reductionReason',
            render: (v: string | null) => (v ? <Tag color="orange">{v}</Tag> : '—'),
          },
          {
            title: '補件建議',
            dataIndex: 'supplementHint',
            render: (v: string | null) => v ?? '—',
          },
        ]}
      />
    </Card>
  )
}

// ============== ② 失能初篩 ==============
function DisabilitySection({ result }: { result: EstimationResult }) {
  const d = result.disability
  const colorMap: Record<string, string> = { A: 'green', B: 'blue', C: 'orange', D: 'red' }
  return (
    <Card>
      <Space size="middle" className="!mb-3">
        <Tag color={colorMap[d.screening]} style={{ fontSize: 18, padding: '4px 12px' }}>
          分級 {d.screening}
        </Tag>
        {d.possibleLevel && <Tag color="purple">可能失能等級：第 {d.possibleLevel} 級</Tag>}
        {d.possibleAmount > 0 && (
          <Statistic
            title="依等級推估金額"
            value={d.possibleAmount}
            formatter={(v) => dollar(Number(v))}
          />
        )}
      </Space>

      <Paragraph className="!mt-4">
        <Text strong>關鍵信號：</Text>
        {d.signals.length > 0 ? d.signals.join('、') : '（無明顯失能線索）'}
      </Paragraph>

      {d.romLossPercent !== null && d.jointName && (
        <Paragraph>
          <Text strong>{d.jointName} 關節</Text>活動度喪失約 {d.romLossPercent.toFixed(1)}%
        </Paragraph>
      )}

      <Divider />
      <Title level={5}>系統提示</Title>
      {d.notes.length > 0 ? (
        <ul>
          {d.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      ) : (
        <Paragraph type="secondary">無</Paragraph>
      )}

      {d.needsSupplement.length > 0 && (
        <>
          <Divider />
          <Title level={5}>需補件</Title>
          <ul>
            {d.needsSupplement.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </>
      )}

      <InfoAlert
        type="warning"
        showIcon
        className="!mt-4"
        title="失能等級須由醫院開立失能診斷書並經保險公司/評議/法院認定，本系統僅為初篩。"
      />
    </Card>
  )
}

// ============== ②b 理賠實務案例（理賠案例集） ==============
// 給結果頁顯示「同縣市/同年/同失能等級」的理賠實務案例
// 來源：data/precedents/practice-cases.json（category='practice_case'）
// v0.7.3+ KNN debug：傳 withKnnDebug=true 取得 5 維距離拆解
function PracticeCasesSection({ result }: { result: EstimationResult }) {
  const refs = findRelatedPracticeCases(
    result.region.courtName,
    result.disability.possibleLevel,
    3,
    true, // v0.7.3+ KNN debug
  )
  if (refs.length === 0) return null
  return (
    <Card>
      <Title level={4}>
        <FileTextOutlined className="mr-2" />
        理賠實務案例參考（{refs.length} 件）
      </Title>
      <Paragraph type="secondary" className="!text-xs !mb-3">
        以下案例為理賠實務案例彙編（非法院公開判決），依「同縣市 / 同年份 / 同失能等級」配對。
        點開可看完整和解條件、勞減計算、霍夫曼公式。
      </Paragraph>
      <Collapse
        size="small"
        items={refs.map((r) => {
          const ls = r.laborLoss
          const sm = r.settlement
          return {
            key: r.id,
            label: (
              <Space>
                <Text strong>{r.caseNo}</Text>
                <Tag color="blue">{r.court}</Tag>
                {r.knnDistance !== undefined && (
                  <Tag color="purple" className="!text-xs">
                    KNN 距離 {r.knnDistance.toFixed(2)}
                  </Tag>
                )}
                {sm?.totalInsurerPayout ? (
                  <Tag color="green">保險給付 {dollar(sm.totalInsurerPayout)}</Tag>
                ) : null}
              </Space>
            ),
            children: (
              <Space orientation="vertical" size={6} className="!w-full">
                <div>
                  <Text type="secondary" className="!text-xs">
                    事實：
                  </Text>
                  <Paragraph className="!mt-1 !mb-1 !text-sm">{r.facts}</Paragraph>
                </div>
                <div>
                  <Text type="secondary" className="!text-xs">
                    傷勢：
                  </Text>
                  <Paragraph className="!mt-1 !mb-1 !text-sm">{r.injuries}</Paragraph>
                </div>
                {r.disabilities.length > 0 && (
                  <div>
                    <Text type="secondary" className="!text-xs">
                      失能等級：
                    </Text>
                    {r.disabilities.map((d, i) => (
                      <Tag
                        key={i}
                        color={
                          parseInt(d.level) <= 5
                            ? 'red'
                            : parseInt(d.level) <= 10
                              ? 'orange'
                              : 'default'
                        }
                      >
                        {d.type} 第{d.level}級（{d.source}）
                      </Tag>
                    ))}
                  </div>
                )}
                {ls && (ls.hoffmannCalculation || ls.annualIncome) && (
                  <div>
                    <Text type="secondary" className="!text-xs">
                      勞減計算：
                    </Text>
                    <Paragraph className="!mt-1 !mb-1 !text-sm">
                      {ls.hoffmannCalculation ?? '—'}
                      {ls.tool && (
                        <a href={ls.tool} target="_blank" rel="noreferrer" className="!ml-2">
                          霍夫曼試算工具 ↗
                        </a>
                      )}
                    </Paragraph>
                  </div>
                )}
                {sm && (sm.civilSettlement || sm.settlementReason) && (
                  <div>
                    <Text type="secondary" className="!text-xs">
                      和解：
                    </Text>
                    <Paragraph className="!mt-1 !mb-1 !text-sm">
                      {sm.civilSettlement ? `民事和解金 ${dollar(sm.civilSettlement)}。` : ''}
                      {sm.settlementReason ?? ''}
                    </Paragraph>
                  </div>
                )}
                {r.keyHoldings.length > 0 && (
                  <div>
                    <Text type="secondary" className="!text-xs">
                      勝訴要點：
                    </Text>
                    <ul className="!mt-1">
                      {r.keyHoldings.map((h, i) => (
                        <li key={i} className="!text-sm">
                          {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Text type="secondary" className="!text-xs !mt-2">
                  來源：{r.source} · 收錄 {r.scrapedAt.split('T')[0]}
                </Text>
              </Space>
            ),
          }
        })}
      />
      {/* v0.7.3+ KNN debug：每件被推薦案例的 5 維距離拆解 + 解釋 */}
      <KnnDebugPanel cases={refs} title="🔍 KNN 推薦理由（debug）" />
    </Card>
  )
}

// ============== ③ 民事損害 ==============
// 排序邏輯（理賠時的閱讀順序）：
//   ① 醫療延伸（除疤 = 醫療必要費用）→ ② 精神慰撫金 → ③ 工作損失（擴充）→
//   ④ 勞動能力減損（失能延伸）→ ⑤ 車損 / 財損
// ※ 基本「工作損失」與「擴充版」合併為一，避免重複顯示。
function CivilSection({ result }: { result: EstimationResult }) {
  const pas = result.painAndSuffering
  return (
    <Card>
      <Row gutter={16} className="!mb-4">
        <Col xs={12}>
          <Statistic
            title="民事醫療差額"
            value={result.civilMedicalExpense}
            formatter={(v) => dollar(Number(v))}
          />
        </Col>
        <Col xs={12}>
          <Statistic
            title="民事看護（中標）"
            value={result.civilNursingFeeMid}
            formatter={(v) => dollar(Number(v))}
          />
        </Col>
      </Row>

      <Divider>除疤 / 修疤費用（4 術式 × 北中南）</Divider>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Statistic
            title="估算金額（中）"
            value={result.scarRevision.estimate}
            formatter={(v) => dollar(Number(v))}
            styles={{ content: { color: 'var(--accent)' } }}
          />
        </Col>
        <Col xs={8}>
          <Statistic
            title="低標"
            value={result.scarRevision.estimateLow}
            formatter={(v) => dollar(Number(v))}
          />
        </Col>
        <Col xs={8}>
          <Statistic
            title="高標"
            value={result.scarRevision.estimateHigh}
            formatter={(v) => dollar(Number(v))}
          />
        </Col>
      </Row>
      <Row gutter={16} className="!mt-2">
        <Col xs={12} md={6}>
          <Statistic
            title="採用術式"
            value={
              result.scarRevision.procedure === 'revision_surgery'
                ? '修疤手術'
                : result.scarRevision.procedure === 'laser'
                  ? '雷射'
                  : result.scarRevision.procedure === 'facelift'
                    ? '拉皮'
                    : result.scarRevision.procedure === 'injection'
                      ? '注射（蟹足腫/PRP）'
                      : result.scarRevision.procedure === 'dermabrasion'
                        ? '磨皮'
                        : '未指定'
            }
          />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="療程次數" value={result.scarRevision.totalSessions} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="地區係數" value={result.scarRevision.regionalMultiplier} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic
            title="單價 / 單位"
            value={`${dollar(result.scarRevision.breakdown.perUnitCost)} × ${result.scarRevision.breakdown.units}`}
          />
        </Col>
      </Row>
      {result.scarRevision.hint && (
        <InfoAlert type="warning" showIcon className="!mt-2" title={result.scarRevision.hint} />
      )}
      {result.scarRevision.precedents.length > 0 && (
        <Paragraph type="secondary" className="!mt-2 !text-xs">
          依據：{result.scarRevision.precedents.join('；')}
        </Paragraph>
      )}
      {result.scarRevision.notes.length > 0 && (
        <Paragraph type="secondary" className="!mt-1 !text-xs">
          {result.scarRevision.notes.join(' · ')}
        </Paragraph>
      )}

      <Divider>精神慰撫金（依 {result.region.courtName} 係數）</Divider>
      <Row gutter={16}>
        <Col xs={8}>
          <Statistic title="低標" value={pas.regionalLow} formatter={(v) => dollar(Number(v))} />
        </Col>
        <Col xs={8}>
          <Statistic
            title="中標"
            value={pas.regionalMid}
            formatter={(v) => dollar(Number(v))}
            styles={{ content: { color: 'var(--accent)' } }}
          />
        </Col>
        <Col xs={8}>
          <Statistic title="高標" value={pas.regionalHigh} formatter={(v) => dollar(Number(v))} />
        </Col>
      </Row>
      <Paragraph type="secondary" className="!mt-2 text-sm">
        基礎值 {dollar(pas.baseLow)} / {dollar(pas.baseMid)} / {dollar(pas.baseHigh)} × 地區係數{' '}
        {pas.regionalMultiplier}· 嚴重度評分 {pas.severityScore} / 100（{pas.severityLevel}）
      </Paragraph>

      {/* v0.6.7 精神慰撫金 Ensemble 三票共識 + LLM 顧問複核 */}
      {/* v0.7.3+ KNN debug：多呼叫一次拿 withKnnDebug=true 給 PainEnsembleCard 顯示推薦理由 */}
      <PainEnsembleCard
        painEnsemble={result.painEnsemble}
        painAdvisor={result.painAdvisor}
        rulesRegionalMid={pas.regionalMid}
        dollar={dollar}
        knnDebugCases={findRelatedPracticeCases(
          result.region.courtName,
          result.disability.possibleLevel,
          3,
          true,
        )}
      />

      <Divider>工作損失（擴充版：短期/長期/退休分流）</Divider>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Statistic
            title="擴充版估算"
            value={result.workLossExtended.amount}
            formatter={(v) => dollar(Number(v))}
            styles={{ content: { color: 'var(--accent)' } }}
          />
        </Col>
        <Col xs={12} md={4}>
          <Statistic
            title="計算類型"
            value={
              result.workLossExtended.calculationType === 'short_term'
                ? '短期（日薪）'
                : result.workLossExtended.calculationType === 'long_term'
                  ? result.workLossExtended.isRetired
                    ? '已退休'
                    : '長期（霍夫曼）'
                  : '資料不足'
            }
          />
        </Col>
        <Col xs={12} md={4}>
          <Statistic title="霍夫曼年數" value={result.workLossExtended.hoffmannYears} />
        </Col>
        <Col xs={12} md={4}>
          <Statistic title="休養月數" value={result.workLossExtended.restMonths} />
        </Col>
        <Col xs={12} md={4}>
          <Statistic
            title="證據強度"
            value={
              result.workLossExtended.evidenceStrength === 'high'
                ? '充足'
                : result.workLossExtended.evidenceStrength === 'medium'
                  ? '中等'
                  : '不足'
            }
          />
        </Col>
      </Row>
      {result.workLossExtended.hint && (
        <InfoAlert type="info" showIcon className="!mt-2" title={result.workLossExtended.hint} />
      )}
      {result.workLossExtended.notes.length > 0 && (
        <Paragraph type="secondary" className="!mt-2 !text-xs">
          {result.workLossExtended.notes.join(' · ')}
        </Paragraph>
      )}

      <Divider>勞動能力減損（終身）</Divider>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Statistic
            title="估算金額"
            value={result.laborCapacityLossEstimate}
            formatter={(v) => dollar(Number(v))}
          />
        </Col>
        <Col xs={12} md={4}>
          <Statistic title="計算終點年齡" value={result.laborCapacityRetirementAge} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="失能等級" value={result.disability.possibleLevel ?? '—'} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic
            title="等級信心"
            value={`${(result.disability.confidenceScore * 100).toFixed(0)}%`}
          />
        </Col>
      </Row>
      {result.laborCapacityLossHint && (
        <Paragraph type="secondary" className="!mt-2 !text-sm">
          {result.laborCapacityLossHint}
        </Paragraph>
      )}
      {result.laborCapacityLossNotes.length > 0 && (
        <Paragraph type="secondary" className="!mt-1 !text-xs">
          {result.laborCapacityLossNotes.join(' · ')}
        </Paragraph>
      )}

      <Divider>車損 / 財損（第三人責任險）</Divider>
      <Row gutter={16}>
        <Col xs={12}>
          <Statistic
            title="車損"
            value={result.vehicleDamage}
            formatter={(v) => dollar(Number(v))}
          />
        </Col>
        <Col xs={12}>
          <Statistic
            title="財損"
            value={result.propertyDamage}
            formatter={(v) => dollar(Number(v))}
          />
        </Col>
      </Row>
    </Card>
  )
}

// ============== ④ 第三人責任險 ==============
function ThirdPartySection({ result, input }: { result: EstimationResult; input: ClaimInput }) {
  const t = result.thirdParty
  // v0.5.2: 拿掉「未填寫第三人責任險」空狀態（永遠有第三人險）+ 4 個 Cap Statistic
  // input 仍傳入以顯示「乘己方肇責 %」段落
  return (
    <Card>
      <Divider>第三人責任險估算（不含強制險，v0.5.2 起無保額上限）</Divider>
      <Row gutter={16}>
        <Col xs={8}>
          <Statistic
            title="低標"
            value={t.thirdPartyEstimateLow}
            formatter={(v) => dollar(Number(v))}
          />
        </Col>
        <Col xs={8}>
          <Statistic
            title="中標"
            value={t.thirdPartyEstimateMid}
            formatter={(v) => dollar(Number(v))}
            styles={{ content: { color: 'var(--accent)' } }}
          />
        </Col>
        <Col xs={8}>
          <Statistic
            title="高標"
            value={t.thirdPartyEstimateHigh}
            formatter={(v) => dollar(Number(v))}
          />
        </Col>
      </Row>
      <Paragraph type="secondary" className="!mt-2 text-sm">
        民事總損害 {dollar(t.civilDamageTotalLow)} / {dollar(t.civilDamageTotalMid)} /{' '}
        {dollar(t.civilDamageTotalHigh)}· 乘己方肇責 {input.fault.selfFaultRatio}% 後有責金額{' '}
        {dollar(t.liableAmountLow)} / {dollar(t.liableAmountMid)} / {dollar(t.liableAmountHigh)}
      </Paragraph>
      {t.notes.length > 0 && (
        <>
          <Divider />
          <Title level={5}>系統提示</Title>
          <ul>
            {t.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}

// ============== ⑤ 補件 / 風險 ==============
function SupplementSection({ result }: { result: EstimationResult }) {
  return (
    <Card>
      <Title level={5}>需補件</Title>
      {result.missingDocuments.length > 0 ? (
        <ul>
          {result.missingDocuments.map((m, i) => (
            <li key={i}>
              <AlertOutlined /> {m}
            </li>
          ))}
        </ul>
      ) : (
        <Paragraph type="success">
          <CheckCircleOutlined className="mr-2" />
          目前資料充足，無需補件。
        </Paragraph>
      )}

      <Divider />
      <Title level={5}>風險提示</Title>
      {result.riskNotes.length > 0 ? (
        <ul>
          {result.riskNotes.map((n, i) => (
            <li key={i}>
              <WarningOutlined className="mr-1 text-data-warning" /> {n}
            </li>
          ))}
        </ul>
      ) : (
        <Paragraph type="secondary">無</Paragraph>
      )}
    </Card>
  )
}

// ============== ⑥ 地區實務 ==============
function RegionSection({ result }: { result: EstimationResult }) {
  const courtName = result.region.courtName
  const medianAmount = getMedianCourtCompensation(courtName, 'pain_and_suffering')
  const refs = getCaseReferencesByCategory('pain_and_suffering').filter(
    (r) => r.courtName === courtName,
  )
  // FoiDisputeCategory 沒有 pain_and_suffering，改用 nursing_fee / work_loss 平均
  const foiNursingAvg = getAverageFoiCompensation('nursing_fee')
  const foiWorkLossAvg = getAverageFoiCompensation('work_loss')
  return (
    <Card>
      <Title level={4}>{courtName} 地區係數</Title>
      <Row gutter={16} className="!mb-3">
        <Col xs={12} md={6}>
          <Statistic title="慰撫金係數" value={result.region.painAndSufferingMultiplier} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic
            title="看護日額（中）"
            value={result.region.nursingDailyRateMid}
            formatter={(v) => `${Number(v).toLocaleString()} 元/日`}
          />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="工作損失嚴格度" value={result.region.workLossEvidenceStrictness} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="車損折舊嚴格度" value={result.region.vehicleDepreciationStrictness} />
        </Col>
      </Row>
      <InfoAlert
        type="info"
        showIcon
        className="!mb-4"
        title={result.region.regionNotes}
        body={`資料信心：${result.region.confidenceLevel}`}
      />

      <Divider>司法院同類判決中位數（精神慰撫金）</Divider>
      {medianAmount !== null ? (
        <Paragraph>
          {courtName} 精神慰撫金中位數：<Text strong>{dollar(medianAmount)}</Text>
        </Paragraph>
      ) : (
        <Paragraph type="secondary">無資料</Paragraph>
      )}

      {/* 真實判例引註 — 從 scripts/scrape-judgments.ts 抓的司法院真實判決 */}
      {(() => {
        const realRefs = findRelatedPrecedents(courtName, result.painAndSuffering.regionalMid, 3)
        if (realRefs.length === 0) return null
        return (
          <>
            <Paragraph strong className="!mt-4 !mb-2">
              <ReadOutlined className="mr-1" />
              真實判例引註（依據：{getPrecedentCount()} 件司法院真實判決）
            </Paragraph>
            <Paragraph type="secondary" className="!text-xs !mb-2">
              依「精神慰撫金金額」與「法院」挑選最相關的真實判決
            </Paragraph>
            <Collapse
              size="small"
              items={realRefs.map((r) => ({
                key: `real-${r.caseId}`,
                label: `${r.caseId} · ${r.amount !== null ? dollar(r.amount) : '（無具體金額）'}`,
                children: (
                  <Space orientation="vertical" size={4}>
                    <Text className="!text-sm">{r.summary}</Text>
                    <Text type="secondary" className="!text-xs">
                      {r.keyReasoning}
                    </Text>
                    <Text type="secondary" className="!text-xs">
                      {r.referenceNote}
                    </Text>
                  </Space>
                ),
              }))}
            />
          </>
        )
      })()}

      {refs.length > 0 && (
        <Collapse
          items={refs.slice(0, 3).map((r) => ({
            key: r.caseId,
            label: `${r.caseId} · ${r.amount !== null ? dollar(r.amount) : '（無具體金額）'}（區間 ${dollar(r.amountLow)}-${dollar(r.amountHigh)}）`,
            children: (
              <Space orientation="vertical">
                <Text>{r.summary}</Text>
                <Text type="secondary" className="!text-xs">
                  {r.keyReasoning}
                </Text>
              </Space>
            ),
          }))}
        />
      )}

      <Divider>金融評議中心同類平均</Divider>
      <Paragraph>
        看護費類平均：{foiNursingAvg !== null ? dollar(foiNursingAvg) : '—'} · 工作損失類平均：
        {foiWorkLossAvg !== null ? dollar(foiWorkLossAvg) : '—'}
      </Paragraph>
      <Paragraph type="secondary" className="!text-xs">
        ※ 金融評議中心資料含調解/評議結果，金額區間較法院判決彈性；精神慰撫金非 Foi
        評議主要類別，故不列。
      </Paragraph>
    </Card>
  )
}

// ============== ⑦ 法源依據 ==============
function LegalSection() {
  const refs: LegalReference[] = listLegalReferences()
  return (
    <Card>
      <Title level={4}>引用法源</Title>
      <Table<LegalReference>
        size="small"
        rowKey="key"
        dataSource={refs}
        pagination={false}
        columns={[
          { title: '法規名稱', dataIndex: 'title' },
          { title: '生效日', dataIndex: 'effectiveDate', width: 120 },
          { title: '最後檢視', dataIndex: 'lastReviewed', width: 120 },
          {
            title: '重要條號',
            dataIndex: 'relevantArticles',
            width: 220,
            render: (v: string[]) => v.join('、'),
          },
          {
            title: 'URL',
            dataIndex: 'sourceUrl',
            width: 160,
            render: (v: string) => (
              <a href={v} target="_blank" rel="noreferrer">
                查閱
              </a>
            ),
          },
        ]}
      />
      <InfoAlert
        type="info"
        showIcon
        className="!mt-4"
        title="以上法源僅作估算依據；個案適用仍以最新法規及主管機關解釋為準。"
      />
    </Card>
  )
}

/**
 * v0.10.0+：Tab content wrapper — 切 tab 時淡入
 * AntD Tabs 預設 destroyOnHide=true（v5+）→ 切換 tab 會 re-mount children
 * 因此 motion initial/animate 在每次切換時都會觸發
 *
 * 用法：包在 Tabs items 每個 children 外層
 *   children: <TabContent><CompulsorySection result={result} /></TabContent>
 */
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
