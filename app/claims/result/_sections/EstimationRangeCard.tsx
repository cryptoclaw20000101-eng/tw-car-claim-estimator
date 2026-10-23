/** 精神慰撫金參考區間。缺件數僅表示目前待補項目，不推導完整度或成功機率。 */

'use client'

import { Card, Col, Row, Statistic, Tag, Typography } from 'antd'
import { WarningOutlined } from '@ant-design/icons'
import { InfoAlert } from '@/components/InfoAlert'

const { Title, Paragraph } = Typography

export interface EstimationRangeCardProps {
  /** 精神慰撫金區間結果（含 regionalLow/Mid/High） */
  pas: {
    regionalLow: number
    regionalMid: number
    regionalHigh: number
  }
  /** 精神慰撫金 Ensemble 結果（含 mlConfidence） */
  painEnsemble: {
    consensus: 'strong' | 'partial' | 'weak' | 'insufficient'
    consensusAmount: number | null
    mlConfidence?: 'low' | 'medium' | 'high'
  }
  /** 規則產生的風險提醒與人工複核需求 */
  painAdvisor: {
    requiresHumanReview: boolean
    riskFactors: string[]
    disclaimer: string
  }
  /** 缺件清單 */
  missingDocuments: string[]
  /** 金額格式化函式 */
  dollar: (n: number) => string
}

export function EstimationRangeCard({
  pas,
  painEnsemble,
  painAdvisor,
  missingDocuments,
  dollar,
}: EstimationRangeCardProps) {
  const consensusLabels = {
    strong: '各方法結果接近',
    partial: '部分方法結果接近',
    weak: '各方法結果差異較大',
    insufficient: '比對資料不足',
  }

  return (
    <Card
      className="!mb-6"
      title={
        <span className="flex flex-wrap items-center gap-2 whitespace-normal !text-base">
          <Title level={4} className="!mb-0 !inline-block">
            精神慰撫金參考區間
          </Title>
          <Tag color={missingDocuments.length > 0 ? 'gold' : 'default'}>
            {missingDocuments.length > 0 ? `待補 ${missingDocuments.length} 項` : '未列出待補項目'}
          </Tag>
        </span>
      }
    >
      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Statistic
            title="參考下限"
            value={pas.regionalLow}
            formatter={(v) => dollar(Number(v))}
            data-testid="range-conservative"
          />
        </Col>
        <Col xs={24} sm={8}>
          <Statistic
            title="參考中值"
            value={pas.regionalMid}
            formatter={(v) => dollar(Number(v))}
            styles={{ content: { color: 'var(--accent)' } }}
            data-testid="range-baseline"
          />
        </Col>
        <Col xs={24} sm={8}>
          <Statistic
            title="參考上限"
            value={pas.regionalHigh}
            formatter={(v) => dollar(Number(v))}
            data-testid="range-aggressive"
          />
        </Col>
      </Row>

      <Paragraph type="secondary" className="!mt-3 !text-xs">
        目前精神慰撫金參考區間：
        {dollar(pas.regionalLow)} ~ {dollar(pas.regionalHigh)}（
        {consensusLabels[painEnsemble.consensus]}）
      </Paragraph>

      <Paragraph type="secondary" className="!text-xs">
        僅涵蓋精神慰撫金，不含醫療費、工作損失與財損；仍須依個案資料核對。
      </Paragraph>

      {/* 缺件清單：列舉 missingDocuments */}
      {missingDocuments.length > 0 && (
        <InfoAlert
          type="warning"
          showIcon
          className="!mt-3"
          title={`目前缺少 ${missingDocuments.length} 項關鍵文件`}
          body={
            <ul className="!mt-2 !ml-4 !text-sm">
              {missingDocuments.map((doc, i) => (
                <li key={i}>
                  <WarningOutlined className="!mr-1" />
                  {doc}
                </li>
              ))}
            </ul>
          }
        />
      )}

      {/* 人工判斷項：painAdvisor.requiresHumanReview 時顯示 */}
      {painAdvisor.requiresHumanReview && (
        <InfoAlert
          type="error"
          showIcon
          className="!mt-3"
          title="最大不確定因素（建議人工複核）"
          body={
            <ul className="!mt-2 !ml-4 !text-sm">
              {painAdvisor.riskFactors.map((factor, i) => (
                <li key={i}>{factor}</li>
              ))}
            </ul>
          }
        />
      )}

      {missingDocuments.length === 0 && !painAdvisor.requiresHumanReview && (
        <InfoAlert
          type="success"
          showIcon
          className="!mt-3"
          title="目前未列出待補項目"
          body="這表示系統目前沒有列出缺件；文件內容與實際可主張金額仍需核對。"
        />
      )}
    </Card>
  )
}
