/**
 * LegalSection — 引用法源（v0.15.x+ 從 _form.tsx 抽出，41 行）
 * 從 result/_form.tsx 拆出
 */

'use client'

import { Card, Table, Typography } from 'antd'
import { listLegalReferences } from '@/lib/data-sources/legal-reference'
import type { LegalReference } from '@/lib/data-sources/types'

const { Title } = Typography

export function LegalSection() {
  const refs: LegalReference[] = listLegalReferences()
  return (
    <Card>
      <Title level={4}>引用法源</Title>
      <Table<LegalReference>
        size="small"
        rowKey="key"
        dataSource={refs}
        pagination={false}
        columns={[
          { title: '法規名稱', dataIndex: 'title' },
          { title: '生效日', dataIndex: 'effectiveDate', width: 120 },
          { title: '最後檢視', dataIndex: 'lastReviewed', width: 120 },
          {
            title: '重要條號',
            dataIndex: 'relevantArticles',
            width: 220,
            render: (v: string[]) => v.join('、'),
          },
          {
            title: 'URL',
            dataIndex: 'sourceUrl',
            width: 160,
            render: (v: string) => (
              <a href={v} target="_blank" rel="noreferrer">
                查閱
              </a>
            ),
          },
        ]}
      />
      <InfoAlert
        type="info"
        showIcon
        className="!mt-4"
        title="以上法源僅作估算依據；個案適用仍以最新法規及主管機關解釋為準。"
      />
    </Card>
  )
}
