/**
 * RegionSection — 地區實務（v0.15.x+ 從 _form.tsx 抽出，112 行）
 * 從 result/_form.tsx 拆出
 */

'use client'

import { Card, Col, Collapse, Row, Space, Statistic, Typography } from 'antd'
import { ReadOutlined } from '@ant-design/icons'
import { InfoAlert } from '@/components/InfoAlert'
import {
  getMedianCourtCompensation,
  getCaseReferencesByCategory,
  getPrecedentCount,
} from '@/lib/data-sources/judicial'
import { getAverageFoiCompensation } from '@/lib/data-sources/foi'
import { findRelatedPrecedents } from '@/lib/estimate/precedents'
import type { EstimationResult } from '@/lib/insurance/types'

const { Title, Paragraph, Text, Divider } = Typography

const dollar = (n: number) => `NT$ ${(n ?? 0).toLocaleString('zh-TW')}`

export function RegionSection({ result }: { result: EstimationResult }) {
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
