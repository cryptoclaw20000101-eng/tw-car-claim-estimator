/**
 * Step 5：醫療收據（v0.15.x+ 從 _form.tsx 抽出，68 行）
 *
 * 22 欄位塞一張 Card 但分 4 Section — 救人/住院/義肢/特殊材料
 * 對應強制汽車責任保險給付標準 §2 第 1-3 項（醫療給付 15 細項）
 * 不在強制險範圍：精神慰撫金 / 工作損失 / 車損（這 3 項走第三人責任險）
 */

'use client'

import { Col, Form, InputNumber, Row, Typography } from 'antd'
import { FileTextOutlined } from '@ant-design/icons'
import { StepShell } from '@/components/StepShell'
import type { FormSchema } from '../_form'

const { Title } = Typography

export function Step5Receipts({ form }: { form: ReturnType<typeof Form.useForm<FormSchema>>[0] }) {
  return (
    <StepShell
      icon={<FileTextOutlined />}
      title="醫療收據（強制險 15 細項）"
      alertType="info"
      alertTitle="依強制汽車責任保險給付標準 §2 細項填寫；看護費有 1,200 元/日、30 日硬上限（會自動套用）。"
      alertBody="本表單只收醫療相關；精神慰撫金 / 工作損失 / 車損請勿填入此處（法律強制不併入強制險，會在 Step 3 工作、Step 6 車損分開算）。"
    >
      <Section title="救護與掛號（急診/救護/掛號/診斷書）">
        <R2C name={['receipts', 'emergencyFee']} label="急診費" />
        <R2C name={['receipts', 'ambulanceFee']} label="救護車費" />
        <R2C name={['receipts', 'nhiCopayment']} label="健保自付額" />
        <R2C name={['receipts', 'registrationFee']} label="掛號費" />
        <R2C name={['receipts', 'diagnosisCertificateFee']} label="診斷書費" />
        <R2C name={['receipts', 'nonNhiNecessaryMedicalFee']} label="非健保必要醫療" />
      </Section>
      <Section title="住院（病房/膳食）">
        <R2C name={['receipts', 'wardFeeDifference']} label="病房費差額" />
        <R2C name={['receipts', 'wardFeeDays']} label="病房費天數" />
        <R2C name={['receipts', 'mealFee']} label="膳食費" />
        <R2C name={['receipts', 'mealDays']} label="膳食天數" />
      </Section>
      <Section title="義肢 / 齒 / 眼（按缺損部位）">
        <R2C name={['receipts', 'prosthesisFee']} label="義肢費" />
        <R2C name={['receipts', 'dentureFee']} label="義齒費" />
        <R2C name={['receipts', 'missingTeethCount']} label="缺牙數" />
        <R2C name={['receipts', 'artificialEyeFee']} label="義眼費" />
      </Section>
      <Section title="特殊材料 / 輔具 / 其他（v0.2.5+ 2 萬上限只限「特殊材料+輔具」）">
        {/* v0.2.5+：拆「醫材費」為「特殊材料費」+「一般醫材歸健保自付額」；2 萬上限只限特殊材料 + 輔具 */}
        <R2C name={['receipts', 'specialMaterialFee']} label="特殊材料費（骨材/鋼板/特材）" />
        <R2C name={['receipts', 'assistiveDeviceFee']} label="輔具費（拐杖/輪椅/支架）" />
        <R2C name={['receipts', 'transportationFee']} label="接送費" />
        <R2C name={['receipts', 'nursingFee']} label="看護費" />
        <R2C name={['receipts', 'nursingDays']} label="看護天數" />
        <R2C name={['receipts', 'otherNecessaryMedicalFee']} label="其他必要醫療" />
      </Section>
    </StepShell>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="!mb-4">
      <Title level={5} className="!mb-2">
        {title}
      </Title>
      <Row gutter={16}>{children}</Row>
    </div>
  )
}

function R2C({ name, label }: { name: [string, string]; label: string }) {
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
