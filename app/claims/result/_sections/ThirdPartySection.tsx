/**
 * ThirdPartySection — 第三人責任險估算（v0.15.x+ 從 _form.tsx 抽出，52 行）
 * 從 result/_form.tsx 拆出
 */

'use client'

import { Card, Col, Divider, Row, Statistic, Typography } from 'antd'
import { InfoAlert } from '@/components/InfoAlert'
import type { ClaimInput, EstimationResult } from '@/lib/insurance/types'

const { Title, Paragraph } = Typography

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
      <Divider>對方民事責任與第三人責任險</Divider>
      {result.vehicleDamage === null && (
        <InfoAlert
          type="warning"
          showIcon
          className="!mb-3"
          title="以下僅為已知項目小計，尚未包含車輛維修損失"
          body="補事故前車價後，請重新試算完整金額。"
        />
      )}
      <Row gutter={16}>
        <Col xs={8}>
          <Statistic
            title="可主張低標"
            value={t.thirdPartyEstimateLow}
            formatter={(v) => dollar(Number(v))}
          />
        </Col>
        <Col xs={8}>
          <Statistic
            title="可主張中標"
            value={t.thirdPartyEstimateMid}
            formatter={(v) => dollar(Number(v))}
            styles={{ content: { color: 'var(--accent)' } }}
          />
        </Col>
        <Col xs={8}>
          <Statistic
            title="可主張高標"
            value={t.thirdPartyEstimateHigh}
            formatter={(v) => dollar(Number(v))}
          />
        </Col>
      </Row>
      <Paragraph type="secondary" className="!mt-2 text-sm">
        民事總損害 {dollar(t.civilDamageTotalLow)} / {dollar(t.civilDamageTotalMid)} /{' '}
        {dollar(t.civilDamageTotalHigh)}· 乘對方肇責 {input.fault.otherFaultRatio}% 後有責金額{' '}
        {dollar(t.liableAmountLow)} / {dollar(t.liableAmountMid)} / {dollar(t.liableAmountHigh)}
      </Paragraph>
      {t.isFaultProvisional && (
        <InfoAlert
          type="warning"
          showIcon
          className="!mt-2"
          title="肇責尚未確認：本金額是情境試算"
          body="請待警方初判、事故鑑定、和解或判決確認比例後重新試算。"
        />
      )}
      {t.insurerPayableMid !== null && (
        <Paragraph type="secondary" className="!mt-2 text-sm">
          已填保額下的保險預估支付（低／中／高）：{dollar(t.insurerPayableLow ?? 0)} /{' '}
          {dollar(t.insurerPayableMid)} / {dollar(t.insurerPayableHigh ?? 0)}
          ；可能仍由對方負擔的差額：
          {dollar(t.uninsuredGapLow ?? 0)} / {dollar(t.uninsuredGapMid ?? 0)} /{' '}
          {dollar(t.uninsuredGapHigh ?? 0)}。
        </Paragraph>
      )}
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
