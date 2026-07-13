/**
 * 結果頁區間卡（v0.20.0+ 新增）
 *
 * 對應 user 反饋「結果頁不要只強調單一金額」：
 * - 顯示合理求償區間（保守/一般/積極）取代單一數字
 * - 顯示資料完整度（UI 推導百分比）
 * - 顯示缺件清單（從 missingDocuments）
 * - 顯示需人工判斷項（從 painAdvisor.requiresHumanReview）
 *
 * 對齊 AGENTS.md §0「不保證金額」+ §1「資料不足不硬算」精神：
 * - 區間呈現 > 單一金額（降低使用者把結果當保證金額的風險）
 * - 完整度 + 缺件 + 人工複核：讓使用者 / 業務員 / 律師清楚看到「這個估算的
 *   不確定性在哪裡」
 *
 * 設計決定：
 * - 不新建 estimationCompleteness 欄位：在 UI 層即時推導（保持
 *   EstimationResult 介面向後相容，零 snapshot 測試破壞）
 * - 完整度公式（保守版）：100 - missingDocuments.length * 12 -
 *   (painEnsemble.mlConfidence === 'low' ? 15 : 'medium' ? 5 : 0)
 *   // TODO: review formula with user
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
  /** LLM 顧問複核結果（containsHumanReview + riskFactors） */
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

/**
 * 推導資料完整度（UI 層即時算，不污染 EstimationResult）
 * TODO: review formula with user（v0.20.0 保守版）
 */
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
            合理求償區間
          </Title>
          <Tag color={completenessColor} icon={completenessIcon} className="!ml-3">
            資料完整度 {completeness}%
          </Tag>
        </span>
      }
    >
      <Row gutter={16}>
        <Col xs={8}>
          <Statistic
            title="保守估算"
            value={pas.regionalLow}
            formatter={(v) => dollar(Number(v))}
            data-testid="range-conservative"
          />
        </Col>
        <Col xs={8}>
          <Statistic
            title="一般估算"
            value={pas.regionalMid}
            formatter={(v) => dollar(Number(v))}
            styles={{ content: { color: 'var(--accent)' } }}
            data-testid="range-baseline"
          />
        </Col>
        <Col xs={8}>
          <Statistic
            title="積極求償區間"
            value={pas.regionalHigh}
            formatter={(v) => dollar(Number(v))}
            data-testid="range-aggressive"
          />
        </Col>
      </Row>

      <Paragraph type="secondary" className="!mt-3 !text-xs">
        目前合理求償區間：
        {dollar(pas.regionalLow)} ~ {dollar(pas.regionalHigh)}
        （共識度：{painEnsemble.consensus}）
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
          title="資料充足、無重大不確定因素"
          body="可參考上方區間作為初步求償依據，但實際金額仍須依保險公司 / 評議 / 法院認定為準。"
        />
      )}
    </Card>
  )
}
