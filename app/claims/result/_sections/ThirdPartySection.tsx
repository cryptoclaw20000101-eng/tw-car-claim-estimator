/**
 * ThirdPartySection — 民事責任／第三人責任險估算
 */

'use client'

import { Card, Col, Divider, Row, Statistic, Tag, Typography } from 'antd'
import type { ClaimInput, EstimationResult } from '@/lib/insurance/types'

const { Title, Paragraph } = Typography
const dollar = (n: number) => `NT$ ${(n ?? 0).toLocaleString('zh-TW')}`

type LegalAuditBasics = ClaimInput['basics'] & {
  calculationMode?: 'mediation' | 'litigation'
  thirdPartyCoverageStatus?: 'unknown' | 'yes' | 'no'
}

export function ThirdPartySection({
  result,
  input,
}: {
  result: EstimationResult
  input: ClaimInput
}) {
  const t = result.thirdParty
  const basics = input.basics as LegalAuditBasics
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
          <Statistic title="低標" value={t.thirdPartyEstimateLow} formatter={(v) => dollar(Number(v))} />
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
          <Statistic title="高標" value={t.thirdPartyEstimateHigh} formatter={(v) => dollar(Number(v))} />
        </Col>
      </Row>

      <Paragraph type="secondary" className="!mt-2 text-sm">
        民事總損害 {dollar(t.civilDamageTotalLow)} / {dollar(t.civilDamageTotalMid)} /{' '}
        {dollar(t.civilDamageTotalHigh)} · 對方肇責 {input.fault.otherFaultRatio}% 後之責任金額{' '}
        {dollar(t.liableAmountLow)} / {dollar(t.liableAmountMid)} / {dollar(t.liableAmountHigh)}
      </Paragraph>
      <Paragraph type="secondary" className="!text-sm">
        上方「低／中／高標」為依目前保單資料計算的保險可負擔額；若尚未確認保額，系統僅以責任金額暫代顯示，並不代表保險公司一定全額負擔。
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
