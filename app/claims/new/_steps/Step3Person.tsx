/**
 * Step 3：受害人身分與工作（v0.15.x+ 從 _form.tsx 抽出，165 行）
 */

'use client'

import { useEffect } from 'react'
import {
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Switch,
  Typography,
} from 'antd'
import { UserOutlined, InfoCircleOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import type { FormSchema } from '../_form'
import type { EmploymentType } from '@/lib/insurance/types'

const { Title } = Typography

export interface Step3PersonProps {
  form: ReturnType<typeof Form.useForm<FormSchema>>[0]
  employmentOptions: { value: EmploymentType; label: string }[]
}

export function Step3Person({ form, employmentOptions }: Step3PersonProps) {
  // v0.5.3 bugfix: birthDate DatePicker 也會踩 rc-picker getUDayjs('') isValid 炸
  // 跟 Step1 一樣：mount 時若不是 dayjs 物件就塞 dayjs()（空字串轉 dayjs()，user 選完 onChange 會再轉回字串）
  useEffect(() => {
    const cur = form.getFieldValue(['person', 'birthDate'])
    if (!cur || typeof cur === 'string') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      form.setFieldsValue({ person: { birthDate: dayjs() } } as any)
    }
  }, [form])
  return (
    <Card
      title={
        <>
          <UserOutlined className="mr-2" />
          受害人身分與工作
        </>
      }
    >
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item
            label="出生年月日"
            name={['person', 'birthDate']}
            getValueProps={(value) => ({ value: value ? dayjs(value) : null })}
          >
            <DatePicker
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              onChange={(d: Dayjs | null) => {
                const iso = d?.format('YYYY-MM-DD') ?? ''
                form.setFieldValue(['person', 'birthDate'], iso)
                if (d) {
                  const age = dayjs().diff(d, 'year')
                  form.setFieldValue(['person', 'age'], age)
                }
              }}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item label="年齡（自動）" name={['person', 'age']}>
            <InputNumber style={{ width: '100%' }} min={0} max={120} disabled />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
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
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            label="事故前 6 月平均月薪（元）"
            name={['person', 'sixMonthAverageSalary']}
            tooltip={{
              title:
                '需附「事故前 6 個月薪資證明」（如薪轉單、扣繳憑單）。無證明者，工作損失改按基本工資估算（金額較低）。',
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
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="現職月薪（元）" name={['person', 'monthlySalary']}>
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={1000}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="日薪（按件/日領者）" name={['person', 'dailyWage']}>
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={500}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="去年報稅所得（元）" name={['person', 'lastYearTaxableIncome']}>
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={10_000}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>
        </Col>
      </Row>
      <Title level={5} className="!mt-4">
        工作損失佐證
      </Title>
      <Row gutter={16}>
        <Col xs={12} md={6}>
          <Form.Item label="財產清單" name={['person', 'hasPropertyList']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item
            label="薪轉證明"
            name={['person', 'hasSalaryTransferRecord']}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item
            label="請假證明"
            name={['person', 'hasLeaveCertificate']}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item
            label="扣薪證明"
            name={['person', 'hasSalaryDeductionProof']}
            valuePropName="checked"
          >
            <Switch />
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
    </Card>
  )
}
