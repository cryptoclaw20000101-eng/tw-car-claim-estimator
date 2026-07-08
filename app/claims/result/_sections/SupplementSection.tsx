/**
 * SupplementSection — 需補件 + 風險提示（v0.15.x+ 從 _form.tsx 抽出，37 行）
 * 從 result/_form.tsx 拆出
 */

'use client'

import { Card, Typography } from 'antd'
import { AlertOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons'
import type { EstimationResult } from '@/lib/insurance/types'

const { Title, Paragraph } = Typography

export function SupplementSection({ result }: { result: EstimationResult }) {
  return (
    <Card>
      <Title level={5}>需補件</Title>
      {result.missingDocuments.length > 0 ? (
        <ul>
          {result.missingDocuments.map((m, i) => (
            <li key={i}>
              <AlertOutlined /> {m}
            </li>
          ))}
        </ul>
      ) : (
        <Paragraph type="success">
          <CheckCircleOutlined className="mr-2" />
          目前資料充足，無需補件。
        </Paragraph>
      )}

      <hr className="!my-4" />
      <Title level={5}>風險提示</Title>
      {result.riskNotes.length > 0 ? (
        <ul>
          {result.riskNotes.map((n, i) => (
            <li key={i}>
              <WarningOutlined className="mr-1 text-data-warning" /> {n}
            </li>
          ))}
        </ul>
      ) : (
        <Paragraph type="secondary">無</Paragraph>
      )}
    </Card>
  )
}
