/**
 * DisabilitySection — 失能初篩（v0.15.x+ 從 _form.tsx 抽出，68 行）
 * 從 result/_form.tsx 拆出
 */

'use client'

import { Card, Divider, Space, Statistic, Tag, Typography } from 'antd'
import { InfoAlert } from '@/components/InfoAlert'
import type { EstimationResult } from '@/lib/insurance/types'

const { Title, Paragraph, Text } = Typography

const dollar = (n: number) => `NT$ ${(n ?? 0).toLocaleString('zh-TW')}`

export function DisabilitySection({ result }: { result: EstimationResult }) {
  const d = result.disability
  const colorMap: Record<string, string> = { A: 'green', B: 'blue', C: 'orange', D: 'red' }
  // v0.19.x+：當沒任何信號時，顯示「資料不足」而不是「分級 A」（避免誤導用戶）
  const hasSignals = d.signals.length > 0 || d.possibleLevel !== null
  return (
    <Card>
      <Space size="middle" className="!mb-3">
        {hasSignals ? (
          <Tag color={colorMap[d.screening]} style={{ fontSize: 18, padding: '4px 12px' }}>
            分級 {d.screening}
          </Tag>
        ) : (
          <Tag color="default" style={{ fontSize: 18, padding: '4px 12px' }}>
            資料不足，未判定
          </Tag>
        )}
        {d.possibleLevel && <Tag color="purple">可能失能等級：第 {d.possibleLevel} 級</Tag>}
        {d.possibleAmount > 0 && (
          <Statistic
            title="依等級推估金額"
            value={d.possibleAmount}
            formatter={(v) => dollar(Number(v))}
          />
        )}
      </Space>

      <Paragraph className="!mt-4">
        <Text strong>關鍵信號：</Text>
        {d.signals.length > 0 ? d.signals.join('、') : '（無明顯失能線索）'}
      </Paragraph>

      {d.romLossPercent !== null && d.jointName && (
        <Paragraph>
          <Text strong>{d.jointName} 關節</Text>活動度喪失約 {d.romLossPercent.toFixed(1)}%
        </Paragraph>
      )}

      <Divider />
      <Title level={5}>系統提示</Title>
      {d.notes.length > 0 ? (
        <ul>
          {d.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      ) : (
        <Paragraph type="secondary">無</Paragraph>
      )}

      {d.needsSupplement.length > 0 && (
        <>
          <Divider />
          <Title level={5}>需補件</Title>
          <ul>
            {d.needsSupplement.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </>
      )}

      <InfoAlert
        type="warning"
        showIcon
        className="!mt-4"
        title="失能等級須由醫院開立失能診斷書並經保險公司/評議/法院認定，本系統僅為初篩。"
      />
    </Card>
  )
}
