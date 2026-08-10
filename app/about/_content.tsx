'use client'

import Link from 'next/link'
import { Card, Space, Tag, Typography } from 'antd'
import { GithubOutlined, CodeOutlined, ToolOutlined } from '@ant-design/icons'

/**
 * 三票共識 SVG 插畫（about 頁用）
 * 3 條路徑（規則票 / ML 票 / KNN 票）匯聚成一個共識金額
 * 無外部依賴，inline SVG，可直接控制顏色/大小
 */
function EnsembleIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 280 180"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="三票共識示意圖：規則票 / ML 票 / KNN 票 匯聚成共識金額"
    >
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#eff6ff" />
          <stop offset="100%" stopColor="#fafafa" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="280" height="180" rx="12" fill="url(#bg)" />

      {/* 三條輸入路徑（左側三個圓點） */}
      <circle cx="40" cy="40" r="14" fill="#1e40af" />
      <text x="40" y="45" textAnchor="middle" fontSize="11" fill="white" fontWeight="600">
        規則
      </text>
      <circle cx="40" cy="90" r="14" fill="#0891b2" />
      <text x="40" y="95" textAnchor="middle" fontSize="11" fill="white" fontWeight="600">
        ML
      </text>
      <circle cx="40" cy="140" r="14" fill="#7c3aed" />
      <text x="40" y="145" textAnchor="middle" fontSize="11" fill="white" fontWeight="600">
        KNN
      </text>

      {/* 三條連線 → 中央匯聚點 */}
      <path
        d="M 54 40 Q 140 40 200 90"
        stroke="#1e40af"
        strokeWidth="2"
        fill="none"
        opacity="0.5"
      />
      <path d="M 54 90 L 200 90" stroke="#0891b2" strokeWidth="2" fill="none" opacity="0.5" />
      <path
        d="M 54 140 Q 140 140 200 90"
        stroke="#7c3aed"
        strokeWidth="2"
        fill="none"
        opacity="0.5"
      />

      {/* 共識輸出（右側矩形） */}
      <rect x="200" y="70" width="60" height="40" rx="6" fill="#1e40af" />
      <text x="230" y="88" textAnchor="middle" fontSize="9" fill="white" fontWeight="600">
        共識金額
      </text>
      <text x="230" y="102" textAnchor="middle" fontSize="11" fill="white" fontWeight="700">
        NT$
      </text>

      {/* 連線箭頭 */}
      <path
        d="M 200 90 L 196 86 M 200 90 L 196 94"
        stroke="#1e40af"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  )
}

const { Title, Paragraph, Text } = Typography

export default function AboutContent() {
  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col items-center bg-surface-subtle px-6 py-12"
    >
      <div className="w-full max-w-3xl">
        <Title level={1} className="!mb-2">
          台灣車禍理賠估算器的計算方式與資料來源
        </Title>
        <Paragraph type="secondary" className="!mb-6 !text-sm">
          臺灣車禍理賠估算工具 · Open source 個人專案
        </Paragraph>

        <EnsembleIllustration className="!mb-6 !w-full !max-w-md !mx-auto" />

        <Card>
          <Space orientation="vertical" size="large" className="!w-full">
            <Section
              title="工具定位"
              content={
                <Paragraph>
                  <strong>實務工具</strong>：保險經紀人、律師、業務員的日常估算輔助
                </Paragraph>
              }
            />

            <Section
              title="技術棧"
              icon={<ToolOutlined />}
              content={
                <>
                  <div className="flex flex-wrap gap-2">
                    <Tag color="blue">Next.js 16</Tag>
                    <Tag color="blue">React 19</Tag>
                    <Tag color="blue">TypeScript 5</Tag>
                    <Tag color="cyan">Ant Design 6</Tag>
                    <Tag color="cyan">Tailwind CSS 4</Tag>
                    <Tag color="purple">Framer Motion 12</Tag>
                    <Tag color="green">Railway Postgres</Tag>
                    <Tag color="green">JWT + bcrypt</Tag>
                    <Tag color="orange">Vitest 4</Tag>
                    <Tag color="orange">Playwright</Tag>
                  </div>
                  <Paragraph>
                    完整技術棧：見 GitHub repo 的 <code>package.json</code> 與{' '}
                    <code>AGENTS.md</code>。
                  </Paragraph>
                </>
              }
            />

            <Section
              title="6 大計算引擎"
              content={
                <>
                  <Paragraph>
                    1. <strong>強制險醫療</strong>：15 細項 × 法定上限（依事故日切換新/舊法）
                  </Paragraph>
                  <Paragraph>
                    2. <strong>失能給付</strong>：依強制汽車責任保險給付標準 §4，失能等級 1–15 級 ×
                    對應 金額（依事故日 2026-07-01 切換新/舊法）
                  </Paragraph>
                  <Paragraph>
                    3. <strong>民事損害賠償</strong>：6 大項（醫療差額 / 看護 / 工作損失 / 勞動減損
                    / 精神慰撫金 / 財產損失）
                  </Paragraph>
                  <Paragraph>
                    4. <strong>第三人責任險</strong>：體傷 + 財損分開計算，肇責比例分攤
                  </Paragraph>
                  <Paragraph>
                    5. <strong>補件 / 風險</strong>：缺文件清單 + 風險標示
                  </Paragraph>
                  <Paragraph>
                    6. <strong>地區實務</strong>：6 直轄市地方法院係數
                  </Paragraph>
                </>
              }
            />

            <Section
              title="精神慰撫金交叉檢核"
              content={
                <>
                  <Paragraph>
                    精神慰撫金沒有法定公式，因此以<strong>規則區間與同類判例統計交叉檢核</strong>：
                  </Paragraph>
                  <Paragraph>
                    <strong>規則票</strong>：15 等級區間 × 治療加成 × 6 地院係數
                  </Paragraph>
                  <Paragraph>
                    <strong>ML 票</strong>：153+ 件真實判決 anchor 中位數
                  </Paragraph>
                  <Paragraph>
                    <strong>相似案件</strong>：僅作案情比對；總賠償額不會混入慰撫金公式
                  </Paragraph>
                  <Paragraph>兩種可比較資料落差過大時，系統只顯示區間並提醒人工複核。</Paragraph>
                </>
              }
            />

            <Section
              title="資料來源"
              content={
                <>
                  <Paragraph>每月自動更新（cron 排程）：</Paragraph>
                  <Paragraph>
                    • <strong>司法院</strong>：200+ 件真實判決（醫療 / 失能 / 精神慰撫金）
                  </Paragraph>
                  <Paragraph>
                    • <strong>強制汽車責任保險法</strong>：第 27 條給付項目
                  </Paragraph>
                  <Paragraph>
                    • <strong>6 直轄市地方法院</strong>：慰撫金區間中位數
                  </Paragraph>
                </>
              }
            />

            <Section
              title="Open Source"
              icon={<CodeOutlined />}
              content={
                <>
                  <Paragraph>本工具以 MIT License 開源，歡迎 fork / 修改 / 部署。</Paragraph>
                  <Paragraph>
                    <GithubOutlined />{' '}
                    <a
                      href="https://github.com/cryptoclaw20000101-eng/tw-car-claim-estimator"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-accent hover:underline"
                    >
                      GitHub: tw-car-claim-estimator
                    </a>
                  </Paragraph>
                  <Paragraph>
                    主要 commit 規範：<code>AGENTS.md §4</code>（Conventional Commits + scope 限定）
                  </Paragraph>
                </>
              }
            />

            <Section
              title="免責"
              content={
                <Paragraph>
                  重大理賠決策請以正式專業意見為準。
                  <br />
                  <Link href="/terms" className="text-accent hover:underline">
                    完整服務條款
                  </Link>
                  {' · '}
                  <Link href="/privacy" className="text-accent hover:underline">
                    隱私權政策
                  </Link>
                </Paragraph>
              }
            />

            <Section
              title="聯絡"
              content={
                <Paragraph>
                  建議 / bug / 合作：請在 GitHub repo 開 issue。
                  <br />
                  <Text type="secondary" className="!text-xs">
                    ※ 本工具不提供個案理賠意見；重大或爭議案件請洽保險經紀人或律師。
                  </Text>
                  <br />
                  <Link href="/" className="text-accent hover:underline">
                    ← 回首頁
                  </Link>
                </Paragraph>
              }
            />
          </Space>
        </Card>
      </div>
    </main>
  )
}

function Section({
  title,
  icon,
  content,
}: {
  title: string
  icon?: React.ReactNode
  content: React.ReactNode
}) {
  return (
    <div>
      <Title level={3} className="!mb-2 !flex !items-center !gap-2 !text-xl">
        {icon}
        {title}
      </Title>
      <div>{content}</div>
    </div>
  )
}
