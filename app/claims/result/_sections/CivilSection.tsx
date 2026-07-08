/**
 * CivilSection — 民事損害（v0.15.x+ 從 _form.tsx 抽出，234 行）
 * 從 result/_form.tsx 拆出
 *
 * 排序邏輯（理賠時的閱讀順序）：
 *   ① 民事醫療 + 民事看護 → ② 除疤 / 修疤 → ③ 精神慰撫金（Ensemble）
 *   ④ 勞動能力減損（失能延伸）→ ⑤ 工作損失（擴充版）→ ⑥ 車損 / 財損
 * ※ 基本「工作損失」與「擴充版」合併為一，避免重複顯示。
 */

'use client'

import { Card, Col, Divider, Row, Statistic, Typography } from 'antd'
import { InfoAlert } from '@/components/InfoAlert'
import { PainEnsembleCard } from '@/components/PainEnsembleCard'
import { findRelatedPracticeCases } from '@/lib/estimate/precedents'
import type { EstimationResult } from '@/lib/insurance/types'

const { Paragraph } = Typography

const dollar = (n: number) => `NT$ ${(n ?? 0).toLocaleString('zh-TW')}`

export function CivilSection({ result }: { result: EstimationResult }) {
  const pas = result.painAndSuffering
  return (
    <Card>
      <Row gutter={16} className="!mb-4">
        <Col xs={12}>
          <Statistic
            title="民事醫療差額"
            value={result.civilMedicalExpense}
            formatter={(v) => dollar(Number(v))}
          />
        </Col>
        <Col xs={12}>
          <Statistic
            title="民事看護（中標）"
            value={result.civilNursingFeeMid}
            formatter={(v) => dollar(Number(v))}
          />
        </Col>
      </Row>

      <Divider>除疤 / 修疤費用（4 術式 × 北中南）</Divider>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Statistic
            title="估算金額（中）"
            value={result.scarRevision.estimate}
            formatter={(v) => dollar(Number(v))}
            styles={{ content: { color: 'var(--accent)' } }}
          />
        </Col>
        <Col xs={8}>
          <Statistic
            title="低標"
            value={result.scarRevision.estimateLow}
            formatter={(v) => dollar(Number(v))}
          />
        </Col>
        <Col xs={8}>
          <Statistic
            title="高標"
            value={result.scarRevision.estimateHigh}
            formatter={(v) => dollar(Number(v))}
          />
        </Col>
      </Row>
      <Row gutter={16} className="!mt-2">
        <Col xs={12} md={6}>
          <Statistic
            title="採用術式"
            value={
              result.scarRevision.procedure === 'revision_surgery'
                ? '修疤手術'
                : result.scarRevision.procedure === 'laser'
                  ? '雷射'
                  : result.scarRevision.procedure === 'facelift'
                    ? '拉皮'
                    : result.scarRevision.procedure === 'injection'
                      ? '注射（蟹足腫/PRP）'
                      : result.scarRevision.procedure === 'dermabrasion'
                        ? '磨皮'
                        : '未指定'
            }
          />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="療程次數" value={result.scarRevision.totalSessions} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="地區係數" value={result.scarRevision.regionalMultiplier} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic
            title="單價 / 單位"
            value={`${dollar(result.scarRevision.breakdown.perUnitCost)} × ${result.scarRevision.breakdown.units}`}
          />
        </Col>
      </Row>
      {result.scarRevision.hint && (
        <InfoAlert type="warning" showIcon className="!mt-2" title={result.scarRevision.hint} />
      )}
      {result.scarRevision.precedents.length > 0 && (
        <Paragraph type="secondary" className="!mt-2 !text-xs">
          依據：{result.scarRevision.precedents.join('；')}
        </Paragraph>
      )}
      {result.scarRevision.notes.length > 0 && (
        <Paragraph type="secondary" className="!mt-1 !text-xs">
          {result.scarRevision.notes.join(' · ')}
        </Paragraph>
      )}

      <Divider>精神慰撫金（依 {result.region.courtName} 係數）</Divider>
      <Row gutter={16}>
        <Col xs={8}>
          <Statistic title="低標" value={pas.regionalLow} formatter={(v) => dollar(Number(v))} />
        </Col>
        <Col xs={8}>
          <Statistic
            title="中標"
            value={pas.regionalMid}
            formatter={(v) => dollar(Number(v))}
            styles={{ content: { color: 'var(--accent)' } }}
          />
        </Col>
        <Col xs={8}>
          <Statistic title="高標" value={pas.regionalHigh} formatter={(v) => dollar(Number(v))} />
        </Col>
      </Row>
      <Paragraph type="secondary" className="!mt-2 text-sm">
        基礎值 {dollar(pas.baseLow)} / {dollar(pas.baseMid)} / {dollar(pas.baseHigh)} × 地區係數{' '}
        {pas.regionalMultiplier}· 嚴重度評分 {pas.severityScore} / 100（{pas.severityLevel}）
      </Paragraph>

      {/* v0.6.7 精神慰撫金 Ensemble 三票共識 + LLM 顧問複核 */}
      {/* v0.7.3+ KNN debug：多呼叫一次拿 withKnnDebug=true 給 PainEnsembleCard 顯示推薦理由 */}
      <PainEnsembleCard
        painEnsemble={result.painEnsemble}
        painAdvisor={result.painAdvisor}
        rulesRegionalMid={pas.regionalMid}
        dollar={dollar}
        knnDebugCases={findRelatedPracticeCases(
          result.region.courtName,
          result.disability.possibleLevel,
          3,
          true,
        )}
      />

      <Divider>工作損失（擴充版：短期/長期/退休分流）</Divider>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Statistic
            title="擴充版估算"
            value={result.workLossExtended.amount}
            formatter={(v) => dollar(Number(v))}
            styles={{ content: { color: 'var(--accent)' } }}
          />
        </Col>
        <Col xs={12} md={4}>
          <Statistic
            title="計算類型"
            value={
              result.workLossExtended.calculationType === 'short_term'
                ? '短期（日薪）'
                : result.workLossExtended.calculationType === 'long_term'
                  ? result.workLossExtended.isRetired
                    ? '已退休'
                    : '長期（霍夫曼）'
                  : '資料不足'
            }
          />
        </Col>
        <Col xs={12} md={4}>
          <Statistic title="霍夫曼年數" value={result.workLossExtended.hoffmannYears} />
        </Col>
        <Col xs={12} md={4}>
          <Statistic title="休養月數" value={result.workLossExtended.restMonths} />
        </Col>
        <Col xs={12} md={4}>
          <Statistic
            title="證據強度"
            value={
              result.workLossExtended.evidenceStrength === 'high'
                ? '充足'
                : result.workLossExtended.evidenceStrength === 'medium'
                  ? '中等'
                  : '不足'
            }
          />
        </Col>
      </Row>
      {result.workLossExtended.hint && (
        <InfoAlert type="info" showIcon className="!mt-2" title={result.workLossExtended.hint} />
      )}
      {result.workLossExtended.notes.length > 0 && (
        <Paragraph type="secondary" className="!mt-2 !text-xs">
          {result.workLossExtended.notes.join(' · ')}
        </Paragraph>
      )}

      <Divider>勞動能力減損（終身）</Divider>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Statistic
            title="估算金額"
            value={result.laborCapacityLossEstimate}
            formatter={(v) => dollar(Number(v))}
          />
        </Col>
        <Col xs={12} md={4}>
          <Statistic title="計算終點年齡" value={result.laborCapacityRetirementAge} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="失能等級" value={result.disability.possibleLevel ?? '—'} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic
            title="等級信心"
            value={`${(result.disability.confidenceScore * 100).toFixed(0)}%`}
          />
        </Col>
      </Row>
      {result.laborCapacityLossHint && (
        <Paragraph type="secondary" className="!mt-2 !text-sm">
          {result.laborCapacityLossHint}
        </Paragraph>
      )}
      {result.laborCapacityLossNotes.length > 0 && (
        <Paragraph type="secondary" className="!mt-1 !text-xs">
          {result.laborCapacityLossNotes.join(' · ')}
        </Paragraph>
      )}

      <Divider>車損 / 財損（第三人責任險）</Divider>
      <Row gutter={16}>
        <Col xs={12}>
          <Statistic
            title="車損"
            value={result.vehicleDamage}
            formatter={(v) => dollar(Number(v))}
          />
        </Col>
        <Col xs={12}>
          <Statistic
            title="財損"
            value={result.propertyDamage}
            formatter={(v) => dollar(Number(v))}
          />
        </Col>
      </Row>
    </Card>
  )
}
