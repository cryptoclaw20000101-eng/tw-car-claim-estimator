/**
 * Step 1：事故基本資料（v0.15.x 重構抽出）
 * 從 _form.tsx 拆出 — 1518 行太大，拆 Step 元件到 _steps/ 子目錄
 */

'use client'

import { useEffect } from 'react'
import {
  Collapse,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Switch,
} from 'antd'
import { CarOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { StepShell } from '@/components/StepShell'
import type { FormSchema } from '../_form'

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
      alertTitle="先填基本資料，其他資料可展開補充。"
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
          <Form.Item
            label="事故縣市 *"
            name={['basics', 'accidentCity']}
            rules={[{ required: true }]}
          >
            <Select options={cityOptions} onChange={onCityChange} />
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
      <Collapse
        className="!mt-2"
        items={[
          {
            key: 'supplement',
            label: '其他事故資料（選填）',
            children: (
              <>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item label="詳細事故地點" name={['basics', 'accidentLocation']}>
                      <Input
                        placeholder="例：西區美村路與五權路口"
                        autoComplete="street-address"
                        inputMode="text"
                        enterKeyHint="next"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="管轄法院" name={['basics', 'courtJurisdiction']}>
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="已有警方初步研判表"
                      name={['basics', 'hasPolicePreliminaryReport']}
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="已有車輛事故鑑定"
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
                      label="對方第三人責任險"
                      name={['basics', 'thirdPartyCoverageStatus']}
                      tooltip="不確定時請選「尚未確認」；系統只會顯示可向對方主張的民事責任，不會把它當成保險可賠。"
                    >
                      <Select
                        options={[
                          { value: 'unknown', label: '尚未確認' },
                          { value: 'insured', label: '已投保' },
                          { value: 'uninsured', label: '未投保／不適用' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label="人傷保額（每人）" name={['basics', 'thirdPartyBodilyLimit']}>
                      <InputNumber
                        min={0}
                        className="!w-full"
                        addonBefore="NT$"
                        placeholder="已確認保單再填"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label="財損保額" name={['basics', 'thirdPartyPropertyLimit']}>
                      <InputNumber
                        min={0}
                        className="!w-full"
                        addonBefore="NT$"
                        placeholder="已確認保單再填"
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <Form.Item
                      label="超額責任險額度（選填）"
                      name={['basics', 'excessLiabilityLimit']}
                    >
                      <InputNumber min={0} className="!w-full" addonBefore="NT$" />
                    </Form.Item>
                  </Col>
                </Row>
              </>
            ),
          },
        ]}
      />
    </StepShell>
  )
}
