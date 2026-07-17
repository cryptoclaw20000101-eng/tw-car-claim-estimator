/**
 * Step 1：事故基本資料（v0.15.x 重構抽出）
 * 從 _form.tsx 拆出 — 1518 行太大，拆 Step 元件到 _steps/ 子目錄
 */

'use client'

import { useEffect } from 'react'
import { Col, DatePicker, Form, Input, Radio, Row, Select, Switch, Typography } from 'antd'
import { CarOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { StepShell } from '@/components/StepShell'
import type { FormSchema } from '../_form'

const { Title } = Typography

export interface Step1BasicsProps {
  form: ReturnType<typeof Form.useForm<FormSchema>>[0]
  onCityChange: (v: string) => void
  cityOptions: { value: string; label: string }[]
  accidentTypeOptions: { value: string; label: string }[]
  injuredRoleOptions: { value: string; label: string }[]
}

export function Step1Basics({
  form,
  onCityChange,
  cityOptions,
  accidentTypeOptions,
  injuredRoleOptions,
}: Step1BasicsProps) {
  // v0.5.1 bugfix：DatePicker 在 Form.Item 控制下不能同時用 defaultValue
  // 改用 setFieldsValue 在 client 端注入 dayjs() 物件
  useEffect(() => {
    const cur = form.getFieldValue(['basics', 'accidentDate'])
    if (!cur) {
      form.setFieldsValue({ basics: { accidentDate: dayjs() } } as Record<string, unknown>)
    }
  }, [form])

  return (
    <StepShell
      icon={<CarOutlined />}
      title="事故基本資料"
      alertType="info"
      alertTitle="強制險採無過失主義，肇責比例只會影響第三人責任險的估算。"
    >
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            label="事故日期 *"
            name={['basics', 'accidentDate']}
            rules={[{ required: true }]}
            getValueProps={(value) => ({ value: value ? dayjs(value) : null })}
          >
            <DatePicker
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              onChange={(d: Dayjs | null) => {
                form.setFieldValue(['basics', 'accidentDate'], d?.format('YYYY-MM-DD') ?? '')
              }}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="事故地點" name={['basics', 'accidentLocation']}>
            <Input
              placeholder="例：臺中市西區美村路與五權路口（選填）"
              autoComplete="street-address"
              inputMode="text"
              enterKeyHint="next"
            />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            label="事故類型 *"
            name={['basics', 'accidentType']}
            rules={[{ required: true }]}
          >
            <Select options={accidentTypeOptions} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            label="受害人身分 *"
            name={['basics', 'injuredRole']}
            rules={[{ required: true }]}
          >
            <Select options={injuredRoleOptions} />
          </Form.Item>
        </Col>
      </Row>
      {/* v0.26.0e+：有無受傷必填。選「未受傷」時傷相關引擎強制 0（AGENTS §1 鐵律 ④）*/}
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            label="是否有受傷 *"
            name={['basics', 'isInjured']}
            rules={[{ required: true, message: '請選擇是否有受傷' }]}
          >
            <Radio.Group>
              <Radio value={true}>有受傷</Radio>
              <Radio value={false}>未受傷</Radio>
            </Radio.Group>
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item
            // v0.28.3+：移除 * 必填 — 這是車禍理賠工具，永遠是汽車交通事故
            label="是否為汽車交通事故"
            name={['basics', 'isAutomobileAccident']}
            valuePropName="checked"
          >
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            label="警方初步研判表"
            name={['basics', 'hasPolicePreliminaryReport']}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            label="車輛事故鑑定"
            name={['basics', 'hasAccidentAppraisal']}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item
            label="有強制險 *"
            name={['basics', 'hasCompulsoryInsurance']}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>
      </Row>

      <Title level={5} className="!mt-4">
        地區（自動帶入法院，可手改）
      </Title>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item label="事故縣市" name={['basics', 'accidentCity']}>
            <Select options={cityOptions} onChange={onCityChange} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item label="事故鄉鎮市區" name={['basics', 'accidentDistrict']}>
            <Input placeholder="例：西區" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item label="管轄法院" name={['basics', 'courtJurisdiction']}>
            <Input />
          </Form.Item>
        </Col>
      </Row>
    </StepShell>
  )
}
