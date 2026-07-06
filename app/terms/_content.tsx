'use client'

import Link from 'next/link'
import { Card, Space, Typography } from 'antd'
import { WarningOutlined } from '@ant-design/icons'

const { Title, Paragraph } = Typography

export default function TermsContent() {
  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col items-center bg-surface-subtle px-6 py-12"
    >
      <div className="w-full max-w-3xl">
        <Title level={1} className="!mb-2">
          服務條款
        </Title>
        <Paragraph type="secondary" className="!mb-6 !text-sm">
          最後更新：2026-07-06
        </Paragraph>

        <Card>
          <Space direction="vertical" size="large" className="!w-full">
            <Section
              title="工具定位"
              icon={<WarningOutlined />}
              content={
                <Paragraph>
                  本工具（車禍理賠估算器）是<strong>試算工具</strong>，
                  不是法律意見、不是保險公司報價、不是律師諮詢。
                  <br />
                  <strong>「試算」≠「判決」</strong>。
                  實際理賠金額依保險公司審核、醫療資料、肇事責任、保單條款、
                  金融評議結果、法院認定及雙方和解結果為準。
                </Paragraph>
              }
            />

            <Section
              title="鐵律（永不改）"
              content={
                <>
                  <Paragraph>1. 強制險採無過失主義（不乘肇責比例）</Paragraph>
                  <Paragraph>2. 精神慰撫金 / 工作損失 / 車損不放入強制險</Paragraph>
                  <Paragraph>3. 資料不足不硬算（顯示需補件清單，不給假數字）</Paragraph>
                </>
              }
            />

            <Section
              title="使用者責任"
              content={
                <>
                  <Paragraph>
                    1. <strong>估算資料正確性</strong>：本工具不驗證您輸入的資料是否真實。
                    故意填寫不實資料（如謊報失能等級）可能影響估算結果，並可能觸法。
                  </Paragraph>
                  <Paragraph>
                    2. <strong>理賠決策</strong>
                    ：實際理賠決策請以保險公司、律師、調解委員會的正式意見為準。
                    本工具僅供「業務員初步估算」、「客戶理解大致金額」用途。
                  </Paragraph>
                  <Paragraph>
                    3. <strong>法律糾紛</strong>：若因使用本工具估算結果導致理賠糾紛，
                    開發者不承擔任何法律責任。
                  </Paragraph>
                </>
              }
            />

            <Section
              title="估算引擎準確性"
              content={
                <>
                  <Paragraph>
                    <strong>6 大引擎</strong>：強制 / 失能 / 民事 / 第三人 / 補件 / 地區。
                  </Paragraph>
                  <Paragraph>
                    <strong>Ensemble 三票</strong>：精神慰撫金用「規則公式 / ML 統計 / KNN
                    相似案件」三票共識。
                  </Paragraph>
                  <Paragraph>
                    <strong>資料來源</strong>：司法院判決、強制汽車責任保險法、6
                    直轄市地院實務區間。 每月更新。
                  </Paragraph>
                  <Paragraph>
                    <strong>已知限制</strong>：精神慰撫金為主觀，估算區間可能 50% 偏差。
                    個案情節差異大，最終以調解 / 判決為準。
                  </Paragraph>
                </>
              }
            />

            <Section
              title="智慧財產權"
              content={
                <>
                  <Paragraph>
                    本工具<strong>程式碼</strong>以 MIT License 開源（歡迎 fork / 修改）。
                  </Paragraph>
                  <Paragraph>
                    估算引擎使用的「真實判例資料」整理自司法院公開判決， 屬公共財，無版權問題。
                  </Paragraph>
                  <Paragraph>商標「車禍理賠估算器」為本工具名稱，使用時請保留出處。</Paragraph>
                </>
              }
            />

            <Section
              title="變更通知"
              content={
                <Paragraph>
                  本條款可能因法規修正或功能調整而更新。 更新會在 GitHub commit history
                  留記錄，並在下次登入時於首頁顯示通知。
                </Paragraph>
              }
            />

            <Section
              title="聯絡"
              content={
                <Paragraph>
                  條款問題：請在 GitHub repo 開 issue。
                  <br />
                  <Link href="/" className="text-accent hover:underline">
                    ← 回首頁
                  </Link>
                </Paragraph>
              }
            />
          </Space>
        </Card>

        <Paragraph type="secondary" className="!mt-6 !text-center !text-xs">
          ※ 本條款為技術透明性說明，非正式法律文件。
        </Paragraph>
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
