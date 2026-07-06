'use client'

import Link from 'next/link'
import { Card, Space, Tag, Typography } from 'antd'
import { GithubOutlined, CodeOutlined, ToolOutlined } from '@ant-design/icons'

const { Title, Paragraph, Text } = Typography

export default function AboutContent() {
  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col items-center bg-surface-subtle px-6 py-12"
    >
      <div className="w-full max-w-3xl">
        <Title level={1} className="!mb-2">
          關於我們
        </Title>
        <Paragraph type="secondary" className="!mb-6 !text-sm">
          臺灣車禍理賠估算工具 · Open source 個人專案
        </Paragraph>

        <Card>
          <Space direction="vertical" size="large" className="!w-full">
            <Section
              title="工具定位"
              content={
                <>
                  <Paragraph>
                    <strong>雙重身份</strong>：
                  </Paragraph>
                  <Paragraph>
                    1. <strong>實務工具</strong>：保險經紀人、律師、業務員的日常估算輔助
                  </Paragraph>
                  <Paragraph>
                    2. <strong>iPAS AI 應用規劃師備考作品</strong>：展示 Ensemble、LLM、Agent 等 AI
                    概念
                  </Paragraph>
                </>
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
                    <Tag color="green">Supabase Postgres</Tag>
                    <Tag color="green">Supabase Auth</Tag>
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
                    2. <strong>失能初篩</strong>：4 級（A/B/C/D）+ 14 級失能金額
                  </Paragraph>
                  <Paragraph>
                    3. <strong>民事損害賠償</strong>：5 大項（醫療差額 / 看護 / 工作損失 / 勞動減損
                    / 精神慰撫金）
                  </Paragraph>
                  <Paragraph>
                    4. <strong>第三人責任險</strong>：體傷 + 財損分開 cap，肇責比例分攤
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
              title="精神慰撫金 Ensemble 三票"
              content={
                <>
                  <Paragraph>
                    精神慰撫金沒有法定公式，所以用<strong>三票共識</strong>：
                  </Paragraph>
                  <Paragraph>
                    🎯 <strong>規則票</strong>：8 級區間 × 治療加成 × 6 地院係數
                  </Paragraph>
                  <Paragraph>
                    📊 <strong>ML 票</strong>：13+ 件真實判決 anchor 中位數
                  </Paragraph>
                  <Paragraph>
                    🔍 <strong>KNN 票</strong>：200+ 司法院案例最相似 K 件平均
                  </Paragraph>
                  <Paragraph>
                    三票差距 ≤ 20% 視為共識 → 加權平均。差距大 → 警告「需人工複核」。
                  </Paragraph>
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
                  本工具是個人練習作品 + 業務輔助工具，
                  <strong>不是保險公司或律師事務所的官方產品</strong>。
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
                    ※ 本工具不提供個案理賠諮詢，請洽保險經紀人或律師。
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
