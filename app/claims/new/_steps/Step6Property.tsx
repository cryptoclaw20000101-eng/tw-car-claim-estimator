/**
 * Step 6：車損 / 財損（v0.15.x+ 從 _form.tsx 抽出，36 行）
 */

'use client'

import { Card, Col, Form, InputNumber, Row, Typography } from 'antd'
import { ToolOutlined } from '@ant-design/icons'
import type { FormSchema } from '../_form'

const { Title } = Typography

export function Step6Property({ form }: { form: ReturnType<typeof Form.useForm<FormSchema>>[0] }) {
  return (
    <Card
      title={
        <>
          <ToolOutlined className="mr-2" />
          車損 / 財損
        </>
      }
    >
      <Title level={5}>車輛</Title>
      <Row gutter={16}>
        <R2C name={['property', 'vehicleRepairEstimate']} label="估價單金額" />
        <R2C name={['property', 'vehicleRepairInvoice']} label="發票金額" />
        <R2C name={['property', 'vehicleMarketValueBeforeAccident']} label="事故前車價" />
        <R2C name={['property', 'salvageValue']} label="殘值" />
      </Row>
      <Row gutter={16}>
        <R2C name={['property', 'towingFee']} label="拖吊費" />
        <R2C name={['property', 'rentalCarFee']} label="代步費" />
      </Row>
      <Title level={5} className="!mt-4">
        其他財損
      </Title>
      <Row gutter={16}>
        <R2C name={['property', 'phoneDamage']} label="手機損壞" />
        <R2C name={['property', 'helmetDamage']} label="安全帽損壞" />
        <R2C name={['property', 'clothingDamage']} label="衣物損壞" />
        <R2C name={['property', 'glassesDamage']} label="眼鏡損壞" />
        <R2C name={['property', 'otherPropertyDamage']} label="其他財損" />
      </Row>
    </Card>
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
