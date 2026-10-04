/**
 * Step 3：人身 / 工作（v0.19.0+ 合併原 Step3 人身 + Step7 居住地/法院）
 *
 * v0.19.0 7 → 4 步表單重構：把「聲請人/對方居住地 + 管轄法院」從 Step7 搬到這裡，
 * 因為這些欄位本質是「人 / 案件」的 metadata，與人身/工作同性質。
 */

'use client'

import { useState } from 'react'
import { Col, Collapse, Form, Input, InputNumber, Row, Select, Switch } from 'antd'
import { UserOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { StepShell } from '@/components/StepShell'
import type { FormSchema } from '../_form'
import type { EmploymentType } from '@/lib/insurance/types'

export interface Step3PersonalWorkProps {
  form: ReturnType<typeof Form.useForm<FormSchema>>[0]
  employmentOptions: { value: EmploymentType; label: string }[]
}

export function Step3PersonalWork({ form, employmentOptions }: Step3PersonalWorkProps) {
  const [showIncomeDetails, setShowIncomeDetails] = useState(false)

  return (
    <StepShell
      icon={<UserOutlined />}
      title="受害人身分與工作"
      alertType="info"
      alertTitle="收入與休養天數會影響工作損失與勞動能力減損；沒有證明也可先估算，結果會列出補件。"
    >
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="事故時年齡" name={['person', 'age']}>
            <InputNumber style={{ width: '100%' }} min={0} max={120} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="職業" name={['person', 'occupation']}>
            <Input placeholder="例：工程師" autoComplete="organization-title" enterKeyHint="next" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item
        label="受僱類型 *"
        name={['person', 'employmentType']}
        rules={[{ required: true }]}
      >
        <Select options={employmentOptions} />
      </Form.Item>
      <Form.Item
        label="事故前 6 個月平均月薪（元）"
        name={['person', 'sixMonthAverageSalary']}
        tooltip={{
          title: '請填可由薪轉、扣繳憑單或薪資單佐證的平均月薪。按日計酬者可改填進階欄位。',
          icon: <InfoCircleOutlined />,
        }}
      >
        <InputNumber
          style={{ width: '100%' }}
          min={0}
          step={1000}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
        />
      </Form.Item>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            label="有薪資或所得證明"
            name={['person', 'hasSalaryTransferRecord']}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="有請假及扣薪證明" valuePropName="checked">
            <Switch
              onChange={(checked) =>
                form.setFieldsValue({
                  person: { hasLeaveCertificate: checked, hasSalaryDeductionProof: checked },
                })
              }
            />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="實際請假日數" name={['person', 'actualLeaveDays']}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="醫囑休養日數" name={['person', 'doctorOrderedRestDays']}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
        </Col>
      </Row>
      <Collapse
        activeKey={showIncomeDetails ? ['details'] : []}
        onChange={(keys) => setShowIncomeDetails(keys.includes('details'))}
        items={[
          {
            key: 'details',
            label: '進階收入與佐證（按日計酬、報稅或特殊案件才需填）',
            children: (
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item label="日薪（按件／日領者）" name={['person', 'dailyWage']}>
                    <InputNumber style={{ width: '100%' }} min={0} step={500} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="現職月薪" name={['person', 'monthlySalary']}>
                    <InputNumber style={{ width: '100%' }} min={0} step={1000} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="去年報稅所得" name={['person', 'lastYearTaxableIncome']}>
                    <InputNumber style={{ width: '100%' }} min={0} step={10_000} />
                  </Form.Item>
                </Col>
              </Row>
            ),
          },
        ]}
      />
    </StepShell>
  )
}

// 向後相容：保留舊 export name 以避免 _form.tsx import 改動
export { Step3PersonalWork as Step3Person }
export type { Step3PersonalWorkProps as Step3PersonProps }
