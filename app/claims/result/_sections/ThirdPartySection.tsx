/**
 * ThirdPartySection — 第三人責任險估算（v0.15.x+ 從 _form.tsx 抽出，52 行）
 * 從 result/_form.tsx 拆出
 */

'use client'

import { Card, Col, Row, Statistic, Typography } from 'antd'
import type { ClaimInput, EstimationResult } from '@/lib/insurance/types'

const { Title, Paragraph, Divider } = Typography

const dollar = (n: number) => `NT$ ${(n ?? 0).toLocaleString('zh-TW')}`

export function ThirdPartySection({
  result,
  input,
}: {
  result: EstimationResult
  input: ClaimInput
}) {
  const t = result.thirdParty
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
