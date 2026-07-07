/**
 * Step 7：地區 / 法院（v0.15.x+ 從 _form.tsx 抽出）
 */

'use client'

import { Form, Input, Row, Col } from 'antd'
import { ReadOutlined } from '@ant-design/icons'
import { StepShell } from '@/components/StepShell'
import { InfoAlert } from '@/components/InfoAlert'
import type { FormSchema } from '../_form'

export interface Step7RegionProps {
  form: ReturnType<typeof Form.useForm<FormSchema>>[0]
  /** 從 Step 1 帶入（已自動從 accidentCity 推導） */
  courtJurisdiction: string | undefined
}

export function Step7Region({ form, courtJurisdiction }: Step7RegionProps) {
  // Step 1 已填過「事故縣市 → 自動帶入管轄法院」三件組
  // Step 7 只留「聲請人/對方居住地」（必要 → 影響法院管轄 + 強制險理賠窗口）
  return (
    <StepShell
      icon={<ReadOutlined />}
      title="聲請人 / 對方居住地 + 管轄法院確認"
      alertType="info"
      alertTitle="地區係數只影響第三人責任險／民事損害賠償估算；強制險本身是全國法定標準，不受地區影響。"
      alertBody="若想更換管轄法院，請回 Step 1 改「事故縣市」自動重帶，或在「管轄法院」欄位上方取消唯讀（Step 1 路徑）。"
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
          <Form.Item label="對方居住地（鄉鎮市區）" name={['basics', 'defendantResidenceDistrict']}>
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
    </StepShell>
  )
}
