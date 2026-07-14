/**
 * Step 2：肇責（v0.15.x+ 從 _form.tsx 抽出）
 */

'use client'

import { Form, InputNumber, Select, Space, Switch, Typography } from 'antd'
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
      <Space direction="vertical" size="middle" className="!w-full">
        <Title level={5} className="!mb-2">
          肇事責任比例（自動同步對方比例）
        </Title>
        <Space size="middle" wrap>
          <Form.Item
            label="己方肇責 (%) *"
            name={['fault', 'selfFaultRatio']}
            rules={[{ required: true }]}
            tooltip="肇事責任比例由警方初判或法院判決認定。本欄不影響強制險（強制險不乘肇責），只影響第三人責任險的「可向對方求償」金額。"
          >
            <InputNumber
              style={{ width: 200 }}
              min={0}
              max={100}
              step={5}
              onChange={(v) => {
                const n = Number(v) || 0
                form.setFieldValue(['fault', 'otherFaultRatio'], 100 - n)
              }}
            />
          </Form.Item>
          <Form.Item
            label="對方肇責 (%)"
            name={['fault', 'otherFaultRatio']}
            tooltip="自動計算（=100 − 己方肇責）。若未確定，可暫時填 50/50 後再勾「肇責仍有爭議」。"
          >
            <InputNumber style={{ width: 200 }} min={0} max={100} disabled />
          </Form.Item>
        </Space>

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
        <Typography.Paragraph type="secondary" className="!text-sm">
          己方 {selfRatio ?? 0}% / 對方 {100 - (selfRatio ?? 0)}%
        </Typography.Paragraph>
      </Space>
    </StepShell>
  )
}
