/**
 * 精神慰撫金參考區間卡
 *
 * 重要：本元件接收的 low / mid / high 全部來自 painAndSuffering，
 * 因此不得標示為「整案合理求償區間」。整案責任金額請看第三人責任區塊。
 */

'use client'

import { Card, Col, Row, Statistic, Tag, Typography } from 'antd'
import { CheckCircleOutlined, ExclamationCircleOutlined, WarningOutlined } from '@ant-design/icons'
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
  painAdvisor: {
    requiresHumanReview: boolean
    riskFactors: string[]
    disclaimer: string
  }
  missingDocuments: string[]
  dollar: (n: number) => string
}

function deriveCompleteness(
  missingDocumentsCount: number,
  mlConfidence: 'low' | 'medium' | 'high' | undefined,
): number {
  const missingPenalty = missingDocumentsCount * 12
  const mlPenalty = mlConfidence === 'low' ? 15 : mlConfidence === 'medium' ? 5 : 0
  return Math.max(0, Math.min(100, 100 - missingPenalty - mlPenalty))
}

export function EstimationRangeCard({
  pas,
  painEnsemble,
  painAdvisor,
  missingDocuments,
  dollar,
}: EstimationRangeCardProps) {
  const completeness = deriveCompleteness(missingDocuments.length, painEnsemble.mlConfidence)
  const completenessColor = completeness >= 80 ? 'green' : completeness >= 60 ? 'gold' : 'red'
  const completenessIcon =
    completeness >= 80 ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />

  return (
    <Card
      className="!mb-6"
      title={
        <span className="!text-base">
          <Title level={4} className="!mb-0 !inline-block">
            精神慰撫金參考區間
          </Title>
          <Tag color={completenessColor} icon={completenessIcon} className="!ml-3">
            資料完整度 {completeness}%
          </Tag>
        </span>
      }
    >
      <InfoAlert
        type="info"
        showIcon
        className="!mb-3"
        title="此卡只顯示精神慰撫金估算，不是整案總求償金額。整案民事責任與第三人責任險估算請以下方責任區塊為準。"
      />

      <Row gutter={16}>
        <Col xs={8}>
          <Statistic
            title="慰撫金保守值"
            value={pas.regionalLow}
            formatter={(v) => dollar(Number(v))}
            data-testid="range-conservative"
          />
        </Col>
        <Col xs={8}>
          <Statistic
            title="慰撫金一般值"
            value={pas.regionalMid}
            formatter={(v) => dollar(Number(v))}
            styles={{ content: { color: 'var(--accent)' } }}
            data-testid="range-baseline"
          />
        </Col>
        <Col xs={8}>
          <Statistic
            title="慰撫金積極值"
            value={pas.regionalHigh}
            formatter={(v) => dollar(Number(v))}
            data-testid="range-aggressive"
          />
        </Col>
      </Row>

      <Paragraph type="secondary" className="!mt-3 !text-xs">
        目前精神慰撫金參考區間：
        {dollar(pas.regionalLow)} ~ {dollar(pas.regionalHigh)}
        （共識度：{painEnsemble.consensus}）
      </Paragraph>

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
          title="目前慰撫金估算所需資料較完整"
          body="可參考上方區間作為精神慰撫金初步估算；實際認定仍須依個案證據、協商、評議或法院判斷。"
        />
      )}
    </Card>
  )
}
