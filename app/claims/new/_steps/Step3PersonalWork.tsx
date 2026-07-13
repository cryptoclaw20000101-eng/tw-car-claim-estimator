/**
 * Step 3：人身 / 工作（v0.19.0+ 合併原 Step3 人身 + Step7 居住地/法院）
 *
 * v0.19.0 7 → 4 步表單重構：把「聲請人/對方居住地 + 管轄法院」從 Step7 搬到這裡，
 * 因為這些欄位本質是「人 / 案件」的 metadata，與人身/工作同性質。
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
import { UserOutlined, InfoCircleOutlined, ReadOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import type { FormSchema } from '../_form'
import type { EmploymentType } from '@/lib/insurance/types'

const { Title } = Typography

export interface Step3PersonalWorkProps {
  form: ReturnType<typeof Form.useForm<FormSchema>>[0]
  employmentOptions: { value: EmploymentType; label: string }[]
  /** 從 Step 1 帶入（已自動從 accidentCity 推導） */
  courtJurisdiction: string | undefined
}

export function Step3PersonalWork({
  form,
  employmentOptions,
  courtJurisdiction,
}: Step3PersonalWorkProps) {
  // v0.5.3 bugfix: birthDate DatePicker 也會踩 rc-picker getUDayjs('') isValid 炸
  // 跟 Step1 一樣：mount 時若不是 dayjs 物件就塞 dayjs()（空字串轉 dayjs()，user 選完 onChange 會再轉回字串）
  useEffect(() => {
    const cur = form.getFieldValue(['person', 'birthDate'])
    if (!cur || typeof cur === 'string') {
      form.setFieldsValue({ person: { birthDate: dayjs() } } as Record<string, unknown>)
    }
  }, [form])

  return (
    <>
      <Card
        title={
          <>
            <UserOutlined className="mr-2" />
            受害人身分與工作
          </>
        }
        className="!mb-4"
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
              <Input
                placeholder="例：工程師"
                autoComplete="organization-title"
                enterKeyHint="next"
              />
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
            <Form.Item
              label="財產清單"
              name={['person', 'hasPropertyList']}
              valuePropName="checked"
            >
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

      {/* v0.19.0+：從原 Step7 合併的「聲請人/對方居住地 + 管轄法院」 */}
      <Card
        title={
          <>
            <ReadOutlined className="mr-2" />
            聲請人 / 對方居住地 + 管轄法院
          </>
        }
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              label="聲請人居住地（縣市）"
              name={['basics', 'claimantResidenceCity']}
              tooltip="理賠申請時保險公司會以這個地址作為通訊地址。建議填實際居住地（不一定等於戶籍）。"
            >
              <Input placeholder="例：臺中市" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              label="聲請人居住地（鄉鎮市區）"
              name={['basics', 'claimantResidenceDistrict']}
            >
              <Input placeholder="例：西區" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              label="對方居住地（縣市）"
              name={['basics', 'defendantResidenceCity']}
              tooltip="民事訴訟的「管轄法院」依被告住所地為主。若雙方不在同一縣市，可能影響訴訟便利度。"
            >
              <Input placeholder="例：臺中市" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              label="對方居住地（鄉鎮市區）"
              name={['basics', 'defendantResidenceDistrict']}
            >
              <Input placeholder="例：北區" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item label="管轄法院">
              <Input value={courtJurisdiction ?? ''} disabled prefix={<ReadOutlined />} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="保險公司分公司區域" name={['basics', 'insuranceCompanyBranchRegion']}>
              <Input placeholder="例：中部 / 北部" />
            </Form.Item>
          </Col>
        </Row>
      </Card>
    </>
  )
}

// 向後相容：保留舊 export name 以避免 _form.tsx import 改動
export { Step3PersonalWork as Step3Person }
export type { Step3PersonalWorkProps as Step3PersonProps }
