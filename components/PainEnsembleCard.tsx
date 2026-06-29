/**
 * PainEnsembleCard — 精神慰撫金 Ensemble 三票共識呈現（v0.6.7+）
 *
 * 設計目的：
 *   v0.6.0~v0.6.4 引擎端已算好 Ensemble 三票 + ML 信心度 + LLM Advisor，
 *   但結果頁 UI 還停在 v0.5.4 規則時代只看 regionalLow/Mid/High。
 *
 *   本元件把引擎算好的 `result.painEnsemble` + `result.painAdvisor` 渲染成：
 *   - 上方：共識金額（大字 + 共識度 badge）
 *   - 中間：三票展開（規則 / ML / KNN）
 *   - 下方：LLM Advisor 風險面板（低/中/高 + 風險因子 + 建議 + 人工複核旗標）
 *
 * 不變量（測試守護）：
 *   - strong + consensusAmount=null → 不可能（呼叫端須驗證）
 *   - outlier 一定有票 != outlier 標籤
 *   - Advisor.requiresHumanReview=true 時一定要在 UI 顯示警示
 *   - disclaimer 永遠顯示
 */

'use client'

import { Statistic, Tag, Tooltip, Divider, Row, Col, Typography } from 'antd'
import { InfoAlert } from './InfoAlert'
import { KnnDebugPanel } from './KnnDebugPanel'
import type { PracticeCaseWithKnn } from '@/lib/estimate/precedents'

const { Text, Paragraph } = Typography

type ConsensusLevel = 'strong' | 'partial' | 'weak' | 'insufficient'

interface PainEnsembleView {
  consensus: ConsensusLevel
  consensusAmount: number | null
  suggestedRange: { low: number; high: number } | null
  outlier?: 'rules' | 'ml' | 'knn'
  rulesAmount: number
  mlAmount: number
  knnAmount: number | null
  rulesWeight: number
  mlWeight: number
  knnWeight: number
  warning?: string
}

interface PainAdvisorView {
  riskLevel: 'low' | 'medium' | 'high'
  riskFactors: string[]
  recommendations: string[]
  consensusInterpretation: string
  requiresHumanReview: boolean
  promptTokens: number
  completionTokens: number
  disclaimer: string
}

export interface PainEnsembleCardProps {
  painEnsemble: PainEnsembleView
  painAdvisor: PainAdvisorView
  /** 規則票地區中標（顯示給人看票 vs 規則中標對齊用） */
  rulesRegionalMid: number
  /** 顯示用的金額格式化函式 */
  dollar: (n: number) => string
  /**
   * v0.7.3+ KNN debug — 給 KNN 票下方顯示「為什麼推薦這幾件」
   * 結果頁呼叫 findRelatedPracticeCases(..., true) 取得
   * 不傳 = 不顯示（向後相容）
   */
  knnDebugCases?: PracticeCaseWithKnn[]
}

const CONSENSUS_META: Record<ConsensusLevel, { label: string; color: string; tip: string }> = {
  strong: {
    label: '🟢 高度共識',
    color: 'green',
    tip: '三票差距 ≤20%，加權平均可靠',
  },
  partial: {
    label: '🟡 部分共識',
    color: 'gold',
    tip: '兩票聚集，一票 outlier，採聚集平均',
  },
  weak: {
    label: '🔴 弱共識',
    color: 'red',
    tip: '三票分散，僅顯示區間，建議人工複核',
  },
  insufficient: {
    label: '⚪ 票數不足',
    color: 'default',
    tip: '可計算票數 < 2，需補件或人工評估',
  },
}

const RISK_META: Record<'low' | 'medium' | 'high', { label: string; color: string }> = {
  low: { label: '風險低', color: 'green' },
  medium: { label: '風險中', color: 'gold' },
  high: { label: '風險高', color: 'red' },
}

export function PainEnsembleCard({
  painEnsemble,
  painAdvisor,
  rulesRegionalMid,
  dollar,
  knnDebugCases,
}: PainEnsembleCardProps) {
  const meta = CONSENSUS_META[painEnsemble.consensus]
  const riskMeta = RISK_META[painAdvisor.riskLevel]

  // 主顯示金額 = 共識金額（如有）> 規則中標（fallback）
  const headlineAmount =
    painEnsemble.consensusAmount !== null ? painEnsemble.consensusAmount : rulesRegionalMid

  // 區間顯示
  const showSuggestedRange =
    painEnsemble.consensus === 'weak' &&
    painEnsemble.suggestedRange !== null

  return (
    <div className="!mt-3">
      {/* 上方：共識金額 + badge */}
      <Row gutter={16} align="middle">
        <Col xs={24} md={12}>
          <Statistic
            title={
              <span>
                共識估算金額{' '}
                <Tooltip title={meta.tip}>
                  <Tag color={meta.color} className="!ml-1">
                    {meta.label}
                  </Tag>
                </Tooltip>
              </span>
            }
            value={headlineAmount}
            formatter={(v) => dollar(Number(v))}
            styles={{ content: { color: 'var(--accent)' } }}
          />
          {painEnsemble.consensusAmount === null && (
            <Text type="secondary" className="!text-xs">
              顯示規則票中標（共識無法計算時 fallback）
            </Text>
          )}
        </Col>
        <Col xs={24} md={12}>
          {showSuggestedRange && painEnsemble.suggestedRange ? (
            <Statistic
              title="建議區間（弱共識時）"
              value={`${dollar(painEnsemble.suggestedRange.low)} ~ ${dollar(painEnsemble.suggestedRange.high)}`}
              styles={{ content: { fontSize: 18 } }}
            />
          ) : (
            <Statistic
              title="票數"
              value={
                [
                  painEnsemble.rulesWeight > 0 ? '規則' : null,
                  painEnsemble.mlWeight > 0 ? 'ML' : null,
                  painEnsemble.knnWeight > 0 ? 'KNN' : null,
                ]
                  .filter(Boolean)
                  .join(' + ') || '0'
              }
            />
          )}
        </Col>
      </Row>

      {/* 警告訊息（diverge 等） */}
      {painEnsemble.warning && (
        <InfoAlert
          type="warning"
          showIcon
          className="!mt-2"
          title={painEnsemble.warning}
        />
      )}

      {/* 三票展開 */}
      <Divider plain className="!mt-3 !mb-2 !text-xs">
        三票展開
      </Divider>
      <Row gutter={12}>
        <Col xs={24} md={8}>
          <TicketTile
            label="🎯 規則票"
            amount={painEnsemble.rulesAmount}
            weight={painEnsemble.rulesWeight}
            outlier={painEnsemble.outlier === 'rules'}
            note={painEnsemble.outlier === 'rules' ? 'outlier' : undefined}
            dollar={dollar}
          />
        </Col>
        <Col xs={24} md={8}>
          <TicketTile
            label="📊 ML 票"
            amount={painEnsemble.mlAmount}
            weight={painEnsemble.mlWeight}
            outlier={painEnsemble.outlier === 'ml'}
            note={painEnsemble.outlier === 'ml' ? 'outlier' : undefined}
            dollar={dollar}
          />
        </Col>
        <Col xs={24} md={8}>
          <TicketTile
            label="🔍 KNN 票"
            amount={painEnsemble.knnAmount ?? 0}
            weight={painEnsemble.knnWeight}
            outlier={painEnsemble.outlier === 'knn'}
            note={
              painEnsemble.knnAmount === null
                ? '無相似案件'
                : painEnsemble.outlier === 'knn'
                  ? 'outlier'
                  : undefined
            }
            dim={painEnsemble.knnAmount === null}
            dollar={dollar}
          />
        </Col>
      </Row>

      {/* v0.7.3+ KNN 推薦理由面板 — 顯示每個被推薦案例的 5 維距離拆解 */}
      {knnDebugCases && knnDebugCases.length > 0 && (
        <KnnDebugPanel cases={knnDebugCases} title="🔍 KNN 票 · 推薦理由（debug）" />
      )}

      {/* LLM Advisor 風險面板 */}
      <Divider plain className="!mt-3 !mb-2 !text-xs">
        LLM 理賠顧問複核（靜態 mock · 部署模式請見 AGENTS.md §13）
      </Divider>
      <div className="!mb-2">
        <Tag color={riskMeta.color} className="!mr-2">
          {riskMeta.label}
        </Tag>
        <Text type="secondary" className="!text-xs">
          {painAdvisor.consensusInterpretation}
        </Text>
      </div>

      {painAdvisor.riskFactors.length > 0 && (
        <Paragraph className="!text-xs !mb-2">
          <Text strong>風險因子：</Text>
          {painAdvisor.riskFactors.join(' · ')}
        </Paragraph>
      )}

      {painAdvisor.recommendations.length > 0 && (
        <Paragraph className="!text-xs !mb-2">
          <Text strong>建議：</Text>
          {painAdvisor.recommendations.join(' · ')}
        </Paragraph>
      )}

      {/* 人工複核旗標 */}
      {painAdvisor.requiresHumanReview && (
        <InfoAlert
          type="error"
          showIcon
          className="!mt-2"
          title="建議人工複核"
          body={
            <>
              引擎判定此案件需保經業務員 / 律師親自 review，請以實際會客面談為準。
              <br />
              <Text type="secondary" className="!text-xs">
                計算成本：{painAdvisor.promptTokens} prompt + {painAdvisor.completionTokens} completion tokens
              </Text>
            </>
          }
        />
      )}

      <Paragraph type="secondary" className="!text-xs !mt-2 !mb-0">
        {painAdvisor.disclaimer}
      </Paragraph>
    </div>
  )
}

interface TicketTileProps {
  label: string
  amount: number
  weight: number
  outlier: boolean
  note?: string
  dim?: boolean
  dollar: (n: number) => string
}

function TicketTile({ label, amount, weight, outlier, note, dim, dollar }: TicketTileProps) {
  return (
    <div
      className={`!p-2 rounded border ${
        outlier ? 'border-red-300 bg-red-50/30' : 'border-border'
      } ${dim ? 'opacity-50' : ''}`}
    >
      <div className="!text-xs">{label}</div>
      <div className="tabular-nums text-lg font-semibold">{dollar(amount)}</div>
      <div className="!text-xs text-muted">
        權重 {weight.toFixed(2)}
        {note && <Tag color={outlier ? 'red' : 'default'} className="!ml-1 !text-xs">{note}</Tag>}
      </div>
    </div>
  )
}
