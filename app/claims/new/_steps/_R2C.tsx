/**
 * 共用 R2C helper（從 Step4Medical.tsx 抽出）
 * Row + Col 12/8 排版，金額格式化（千分位）
 *
 * 給 Step5FeesAndProperty 使用（醫療費 + 車損都走金額欄位）
 */
'use client'

import { Col, Form, InputNumber } from 'antd'

export function R2C({ name, label }: { name: [string, string]; label: string }) {
  return (
    <Col xs={12} md={8}>
      <Form.Item label={label} name={name}>
        <InputNumber
          style={{ width: '100%' }}
          min={0}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
        />
      </Form.Item>
    </Col>
  )
}
