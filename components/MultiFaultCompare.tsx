'use client'

/**
 * MultiFaultCompare — 多肇責比例並排比較（v0.12.0+ Phase B7）
 *
 * 業務員常見場景：客戶問「如果我們改口稱對方 70% 肇事呢？」
 * → 即時顯示 3 種肇責組合下第三人責任險的差異
 *
 * 顯示 3 種情境：
 * - 自己 30% / 對方 70%（積極進取）
 * - 自己 50% / 對方 50%（中間值，調解常用）
 * - 自己 70% / 對方 30%（保守穩妥）
 *
 * 假設：
 * - 只重算第三人責任險金額（不重算 6 大引擎）
 * - 民事損害金額不變，只乘肇責比例變動
 */

import { Card, Space, Typography } from 'antd'
import { FieldTimeOutlined } from '@ant-design/icons'

const { Text, Paragraph } = Typography

interface MultiFaultCompareProps {
  /** 民事損害賠償中標（不受肇責影響的基準金額）*/
  civilMidBaseline: number
  /** 體傷 / 財損分開的金額（從現有 result 拿）*/
  bodilyInjuryAmount?: number
  propertyDamageAmount?: number
}

export function MultiFaultCompare({
  civilMidBaseline,
  bodilyInjuryAmount = 0,
  propertyDamageAmount = 0,
}: MultiFaultCompareProps) {
  // 3 種肇責情境
  const scenarios = [
    { self: 30, other: 70, label: '積極進取', color: 'text-data-positive', desc: '客戶主張對方主要肇事' },
    { self: 50, other: 50, label: '中間調解', color: 'text-foreground', desc: '雙方各半，常見調解結果' },
    { self: 70, other: 30, label: '保守穩妥', color: 'text-data-warning', desc: '客戶承認較多責任' },
  ]

  return (
    <Card
      className="!mt-6"
      title={
        <Space size={6}>
          <FieldTimeOutlined />
          <span>不同肇責下第三人責任險試算</span>
        </Space>
      }
    >
      <Paragraph type="secondary" className="!mb-4 !text-sm">
        強制險不受肇責影響（依傷害程度計算）。以下為第三人責任險的「有責金額」（民事損害 × 對方肇責比例）。
      </Paragraph>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {scenarios.map((s) => {
          const otherRatio = s.other / 100
          // 體傷 / 財損分別乘肇責比例，加總
          const bodilyClaim = Math.round(bodilyInjuryAmount * otherRatio)
          const propertyClaim = Math.round(propertyDamageAmount * otherRatio)
          const totalClaim = bodilyClaim + propertyClaim

          return (
            <div
              key={s.self}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <Text strong className="!text-sm">
                  己方 {s.self}% / 對方 {s.other}%
                </Text>
                <Text className={`!text-xs ${s.color}`}>{s.label}</Text>
              </div>
              <div className="tabular-nums text-2xl font-semibold tracking-tight text-foreground">
                ${totalClaim.toLocaleString()}
              </div>
              <div className="mt-2 space-y-0.5 text-xs text-muted">
                {bodilyClaim > 0 && (
                  <div>體傷：${bodilyClaim.toLocaleString()}</div>
                )}
                {propertyClaim > 0 && (
                  <div>財損：${propertyClaim.toLocaleString()}</div>
                )}
              </div>
              <Text className="!mt-2 !block !text-xs italic text-muted opacity-80">
                {s.desc}
              </Text>
            </div>
          )
        })}
      </div>

      <Paragraph type="secondary" className="!mb-0 !mt-4 !text-xs">
        註：以上為民事損害基準 ${civilMidBaseline.toLocaleString()} 的簡化試算，實際金額還要看體傷 / 財損 cap 與保單上限。
      </Paragraph>
    </Card>
  )
}