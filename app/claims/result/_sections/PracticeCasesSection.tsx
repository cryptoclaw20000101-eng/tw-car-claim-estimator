/**
 * PracticeCasesSection — 理賠實務案例參考（v0.15.x+ 從 _form.tsx 抽出，126 行）
 * 從 result/_form.tsx 拆出
 */

'use client'

import { Card, Collapse, Space, Tag, Typography } from 'antd'
import { FileTextOutlined } from '@ant-design/icons'
import { KnnDebugPanel } from '@/components/KnnDebugPanel'
import { findRelatedPracticeCases } from '@/lib/estimate/precedents'
import type { EstimationResult } from '@/lib/insurance/types'

const { Title, Paragraph, Text } = Typography

const dollar = (n: number) => `NT$ ${(n ?? 0).toLocaleString('zh-TW')}`

export function PracticeCasesSection({ result }: { result: EstimationResult }) {
  const refs = findRelatedPracticeCases(
    result.region.courtName,
    result.disability.possibleLevel,
    3,
    true, // v0.7.3+ KNN debug
  )
  if (refs.length === 0) return null
  return (
    <Card>
      <Title level={4}>
        <FileTextOutlined className="mr-2" />
        理賠實務案例參考（{refs.length} 件）
      </Title>
      <Paragraph type="secondary" className="!text-xs !mb-3">
        以下案例為理賠實務案例彙編（非法院公開判決），依「同縣市 / 同年份 / 同失能等級」配對。
        點開可看完整和解條件、勞減計算、霍夫曼公式。
      </Paragraph>
      <Collapse
        size="small"
        items={refs.map((r) => {
          const ls = r.laborLoss
          const sm = r.settlement
          return {
            key: r.id,
            label: (
              <Space>
                <Text strong>{r.caseNo}</Text>
                <Tag color="blue">{r.court}</Tag>
                {r.knnDistance !== undefined && (
                  <Tag color="purple" className="!text-xs">
                    KNN 距離 {r.knnDistance.toFixed(2)}
                  </Tag>
                )}
                {sm?.totalInsurerPayout ? (
                  <Tag color="green">保險給付 {dollar(sm.totalInsurerPayout)}</Tag>
                ) : null}
              </Space>
            ),
            children: (
              <Space orientation="vertical" size={6} className="!w-full">
                <div>
                  <Text type="secondary" className="!text-xs">
                    事實：
                  </Text>
                  <Paragraph className="!mt-1 !mb-1 !text-sm">{r.facts}</Paragraph>
                </div>
                <div>
                  <Text type="secondary" className="!text-xs">
                    傷勢：
                  </Text>
                  <Paragraph className="!mt-1 !mb-1 !text-sm">{r.injuries}</Paragraph>
                </div>
                {r.disabilities.length > 0 && (
                  <div>
                    <Text type="secondary" className="!text-xs">
                      失能等級：
                    </Text>
                    {r.disabilities.map((d, i) => (
                      <Tag
                        key={i}
                        color={
                          parseInt(d.level) <= 5
                            ? 'red'
                            : parseInt(d.level) <= 10
                              ? 'orange'
                              : 'default'
                        }
                      >
                        {d.type} 第{d.level}級（{d.source}）
                      </Tag>
                    ))}
                  </div>
                )}
                {ls && (ls.hoffmannCalculation || ls.annualIncome) && (
                  <div>
                    <Text type="secondary" className="!text-xs">
                      勞減計算：
                    </Text>
                    <Paragraph className="!mt-1 !mb-1 !text-sm">
                      {ls.hoffmannCalculation ?? '—'}
                      {ls.tool && (
                        <a href={ls.tool} target="_blank" rel="noreferrer" className="!ml-2">
                          霍夫曼試算工具 ↗
                        </a>
                      )}
                    </Paragraph>
                  </div>
                )}
                {sm && (sm.civilSettlement || sm.settlementReason) && (
                  <div>
                    <Text type="secondary" className="!text-xs">
                      和解：
                    </Text>
                    <Paragraph className="!mt-1 !mb-1 !text-sm">
                      {sm.civilSettlement ? `民事和解金 ${dollar(sm.civilSettlement)}。` : ''}
                      {sm.settlementReason ?? ''}
                    </Paragraph>
                  </div>
                )}
                {r.keyHoldings.length > 0 && (
                  <div>
                    <Text type="secondary" className="!text-xs">
                      勝訴要點：
                    </Text>
                    <ul className="!mt-1">
                      {r.keyHoldings.map((h, i) => (
                        <li key={i} className="!text-sm">
                          {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Text type="secondary" className="!text-xs !mt-2">
                  來源：{r.source} · 收錄 {r.scrapedAt.split('T')[0]}
                </Text>
              </Space>
            ),
          }
        })}
      />
      {/* v0.7.3+ KNN debug：每件被推薦案例的 5 維距離拆解 + 解釋 */}
      <KnnDebugPanel cases={refs} title="KNN 推薦理由（debug）" />
    </Card>
  )
}
