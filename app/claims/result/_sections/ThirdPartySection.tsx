/**
 * ThirdPartySection — 民事責任／第三人責任險估算
 */

'use client'

import { Card, Col, Divider, Row, Statistic, Tag, Typography } from 'antd'
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
  const basics = input.basics
  const mode =
    basics.calculationMode ??
    (input.fault.faultSource === 'court_judgment' ? 'litigation' : 'mediation')
  const coverageStatus = basics.thirdPartyCoverageStatus ?? 'unknown'

  return (
    <Card>
      <Divider>民事責任／第三人責任險試算</Divider>
      <Paragraph>
        <Tag color={mode === 'litigation' ? 'blue' : 'gold'}>
          {mode === 'litigation' ? '法院裁判模式' : '調解／和解模式'}
        </Tag>
        <Tag>
          {coverageStatus === 'yes'
            ? '已輸入第三人險保額'
            : coverageStatus === 'no'
              ? '已確認無第三人險'
              : '第三人險保額未確認'}
        </Tag>
      </Paragraph>

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
        {dollar(t.civilDamageTotalHigh)} · 對方肇責 {input.fault.otherFaultRatio}% 後、強制險扣抵前責任基準{' '}
        {dollar(t.liableAmountLow)} / {dollar(t.liableAmountMid)} / {dollar(t.liableAmountHigh)}
      </Paragraph>
      <Paragraph type="secondary" className="!text-sm">
        上方「低／中／高標」才是依所選調解／法院公式完成強制險扣抵後，再套用目前第三人責任險保額所得的估算；若保額未確認，系統僅暫以扣抵後責任金額顯示，不代表保險公司一定全額負擔。
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
