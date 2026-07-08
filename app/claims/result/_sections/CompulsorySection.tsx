/**
 * CompulsorySection — 強制險估算（v0.15.x+ 從 _form.tsx 抽出，101 行）
 * 從 result/_form.tsx 拆出
 */

'use client'

import { Card, Col, Row, Statistic, Table, Tag, Typography } from 'antd'
import { motion } from 'framer-motion'
import { InfoAlert } from '@/components/InfoAlert'
import type { EstimationResult } from '@/lib/insurance/types'

const { Text } = Typography

const dollar = (n: number) => `NT$ ${(n ?? 0).toLocaleString('zh-TW')}`

export function CompulsorySection({ result }: { result: EstimationResult }) {
  const rows = result.compulsoryItems
  const totalApplied = rows.reduce((s, r) => s + r.applied, 0)
  const totalApproved = rows.reduce((s, r) => s + r.approved, 0)
  return (
    <Card>
      <Row gutter={16} className="!mb-4">
        <Col xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0, ease: 'easeOut' }}
          >
            <Statistic title="申請小計" value={totalApplied} formatter={(v) => dollar(Number(v))} />
          </motion.div>
        </Col>
        <Col xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: 'easeOut' }}
          >
            <Statistic
              title="預估可認列"
              value={totalApproved}
              formatter={(v) => dollar(Number(v))}
              styles={{ content: { color: 'var(--accent)' } }}
            />
          </motion.div>
        </Col>
        <Col xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16, ease: 'easeOut' }}
          >
            <Statistic
              title="失能給付"
              value={result.compulsoryDisabilityAmount}
              formatter={(v) => dollar(Number(v))}
            />
          </motion.div>
        </Col>
        <Col xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.24, ease: 'easeOut' }}
          >
            <Statistic
              title="死亡給付"
              value={result.compulsoryDeathAmount}
              formatter={(v) => dollar(Number(v))}
            />
          </motion.div>
        </Col>
      </Row>
      <InfoAlert
        type="info"
        showIcon
        className="!mb-3"
        title={`強制險總估算：${dollar(result.compulsoryTotalEstimated)}`}
        body="含醫療、失能、死亡。精神慰撫金、工作損失、車損不計入強制險（法律強制）。"
      />
      <Table
        size="small"
        rowKey="key"
        dataSource={rows}
        pagination={false}
        columns={[
          { title: '項目', dataIndex: 'label', width: 140 },
          { title: '申請', dataIndex: 'applied', render: (v: number) => dollar(v), width: 110 },
          {
            title: '預估可認',
            dataIndex: 'approved',
            render: (v: number) => <Text strong>{dollar(v)}</Text>,
            width: 130,
          },
          {
            title: '法定上限',
            dataIndex: 'legalCap',
            render: (v: number | null) => (v ? dollar(v) : '—'),
            width: 100,
          },
          {
            title: '刪減原因',
            dataIndex: 'reductionReason',
            render: (v: string | null) => (v ? <Tag color="orange">{v}</Tag> : '—'),
          },
          {
            title: '補件建議',
            dataIndex: 'supplementHint',
            render: (v: string | null) => v ?? '—',
          },
        ]}
      />
    </Card>
  )
}
