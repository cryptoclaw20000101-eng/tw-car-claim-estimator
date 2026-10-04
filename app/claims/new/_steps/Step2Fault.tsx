/**
 * Step 2：肇責（v0.15.x+ 從 _form.tsx 抽出）
 */

'use client'

import { Col, Form, InputNumber, Row, Select, Space, Switch, Typography } from 'antd'
import { AuditOutlined } from '@ant-design/icons'
import { StepShell } from '@/components/StepShell'
import type { FormSchema } from '../_form'

const { Title } = Typography

export interface Step2FaultProps {
  form: ReturnType<typeof Form.useForm<FormSchema>>[0]
  faultSourceOptions: { value: string; label: string }[]
}

export function Step2Fault({ form, faultSourceOptions }: Step2FaultProps) {
  const selfRatio = Form.useWatch(['fault', 'selfFaultRatio'], form) as number | undefined
  return (
    <StepShell
      icon={<AuditOutlined />}
      title="肇責比例"
      alertType="warning"
      alertTitle="強制險不乘肇責；第三人責任險的『有責金額』才會乘此比例。"
    >
      <Space orientation="vertical" size="middle" className="!w-full">
        <Title level={5} className="!mb-2">
          肇事責任比例（自動同步對方比例）
        </Title>
        <Form.Item name={['fault', 'otherFaultRatio']} hidden>
          <InputNumber />
        </Form.Item>
        <Row gutter={16} align="bottom">
          <Col xs={24} md={12}>
            <Form.Item
              label="己方肇責 (%) *"
              name={['fault', 'selfFaultRatio']}
              rules={[{ required: true }]}
              tooltip="肇事責任比例由警方初判或法院判決認定。本欄不影響強制險，只影響第三人責任險的可向對方求償金額。"
            >
              <InputNumber
                className="!w-full"
                min={0}
                max={100}
                step={5}
                onChange={(v) => {
                  const n = Number(v) || 0
                  form.setFieldValue(['fault', 'otherFaultRatio'], 100 - n)
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <div className="mb-6 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
              <span className="text-muted">對方肇責（自動同步）</span>
              <div className="mt-1 text-xl font-semibold tabular-nums">
                {100 - (selfRatio ?? 0)}%
              </div>
            </div>
          </Col>
        </Row>

        <Form.Item
          label="肇責來源"
          name={['fault', 'faultSource']}
          tooltip="若由警方初判、調委會調解、或法院判決決定，請選對應來源；尚未確定可選「不明」。"
        >
          <Select options={faultSourceOptions} />
        </Form.Item>
        <Form.Item label="肇責仍有爭議" name={['fault', 'isFaultDisputed']} valuePropName="checked">
          <Switch checkedChildren="是" unCheckedChildren="否" />
        </Form.Item>
      </Space>
    </StepShell>
  )
}
