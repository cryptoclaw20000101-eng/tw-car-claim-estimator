/**
 * Step 2：肇責（v0.15.x+ 從 _form.tsx 抽出）
 */

'use client'

import { Col, Form, InputNumber, Row, Select, Space, Switch } from 'antd'
import { AuditOutlined } from '@ant-design/icons'
import { StepShell } from '@/components/StepShell'
import type { FormSchema } from '../_form'

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
      alertTitle="肇責只影響第三人責任險；強制險不看肇責。"
    >
      <Space orientation="vertical" size="middle" className="!w-full">
        <Form.Item name={['fault', 'otherFaultRatio']} hidden>
          <InputNumber />
        </Form.Item>
        <Row gutter={16} align="bottom">
          <Col xs={24} md={12}>
            <Form.Item
              label="我方肇責 (%) *"
              name={['fault', 'selfFaultRatio']}
              rules={[{ required: true }]}
              tooltip="依警方初判或法院判決填寫；尚未確定時可先估填。"
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
              <span className="text-muted">對方肇責</span>
              <div className="mt-1 text-xl font-semibold tabular-nums">
                {100 - (selfRatio ?? 0)}%
              </div>
            </div>
          </Col>
        </Row>

        <Form.Item
          label="肇責來源"
          name={['fault', 'faultSource']}
          tooltip="尚未確定時保留「尚未確認」，比例僅作本次試算假設。"
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
