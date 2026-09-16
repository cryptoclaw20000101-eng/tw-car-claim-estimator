/**
 * Step 2：肇責／計算情境／責任險資料
 */

'use client'

import { Form, InputNumber, Radio, Select, Space, Switch, Typography } from 'antd'
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
  const calculationMode = Form.useWatch(['basics', 'calculationMode'], form) as
    | 'mediation'
    | 'litigation'
    | undefined
  const coverageStatus = Form.useWatch(['basics', 'thirdPartyCoverageStatus'], form) as
    | 'unknown'
    | 'yes'
    | 'no'
    | undefined

  return (
    <StepShell
      icon={<AuditOutlined />}
      title="肇責比例與計算情境"
      alertType="warning"
      alertTitle="強制險本身不乘肇責；調解與法院對強制險扣抵順序不同，請選擇目前案件情境。"
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
            tooltip="肇責比例不影響強制險本身，但會影響對方民事責任。"
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
            tooltip="自動計算（=100 − 己方肇責）。"
          >
            <InputNumber style={{ width: 200 }} min={0} max={100} disabled />
          </Form.Item>
        </Space>

        <Form.Item
          label="肇責來源"
          name={['fault', 'faultSource']}
          tooltip="法院判決來源若未另選計算情境，系統也會自動採法院模式。"
        >
          <Select options={faultSourceOptions} />
        </Form.Item>
        <Form.Item label="肇責仍有爭議" name={['fault', 'isFaultDisputed']} valuePropName="checked">
          <Switch checkedChildren="是" unCheckedChildren="否" />
        </Form.Item>

        <Typography.Paragraph type="secondary" className="!text-sm">
          己方 {selfRatio ?? 0}% / 對方 {100 - (selfRatio ?? 0)}%
        </Typography.Paragraph>

        <Title level={5} className="!mb-2 !mt-2">
          理賠計算情境
        </Title>
        <Form.Item
          label="目前用途 *"
          name={['basics', 'calculationMode']}
          initialValue="mediation"
          rules={[{ required: true, message: '請選擇調解或法院模式' }]}
        >
          <Radio.Group>
            <Radio.Button value="mediation">調解／和解試算</Radio.Button>
            <Radio.Button value="litigation">法院裁判試算</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Typography.Paragraph type="secondary" className="!text-sm !mt-0">
          {calculationMode === 'litigation'
            ? '法院模式：人身損害先做過失相抵，再扣本案實際已領取的強制險給付。'
            : '調解模式：保留現行實務試算方式，先扣強制險，再乘對方肇責；實際和解仍以雙方協議為準。'}
        </Typography.Paragraph>

        {calculationMode === 'litigation' && (
          <Form.Item
            label="本案實際已領強制險金額"
            name={['basics', 'compulsoryActuallyPaid']}
            initialValue={0}
            tooltip="只填已實際領取、法院計算時要扣抵的金額；尚未領取的預估強制險不要填入。"
          >
            <InputNumber min={0} step={1000} className="!w-full" addonAfter="元" />
          </Form.Item>
        )}

        <Title level={5} className="!mb-2 !mt-2">
          對方第三人責任險
        </Title>
        <Form.Item
          label="保險狀態"
          name={['basics', 'thirdPartyCoverageStatus']}
          initialValue="unknown"
        >
          <Select
            options={[
              { value: 'unknown', label: '尚未確認保單／保額' },
              { value: 'yes', label: '已確認有第三人責任險' },
              { value: 'no', label: '已確認無第三人責任險' },
            ]}
          />
        </Form.Item>

        {coverageStatus === 'yes' && (
          <Space direction="vertical" className="!w-full">
            <Form.Item
              label="每人體傷保額"
              name={['basics', 'thirdPartyBodilyLimit']}
              initialValue={0}
            >
              <InputNumber min={0} step={100000} className="!w-full" addonAfter="元" />
            </Form.Item>
            <Form.Item
              label="財損保額"
              name={['basics', 'thirdPartyPropertyLimit']}
              initialValue={0}
            >
              <InputNumber min={0} step={10000} className="!w-full" addonAfter="元" />
            </Form.Item>
            <Form.Item
              label="超額責任險保額"
              name={['basics', 'excessLiabilityLimit']}
              initialValue={0}
            >
              <InputNumber min={0} step={100000} className="!w-full" addonAfter="元" />
            </Form.Item>
          </Space>
        )}
      </Space>
    </StepShell>
  )
}
