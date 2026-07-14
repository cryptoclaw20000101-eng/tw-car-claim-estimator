/**
 * Step 5：費用與財損（v0.20.0+ 從原 Step4Medical 拆出下半段）
 *
 * 兩個 panel（Collapse）：
 * - Panel 1：醫療收據（強制險 §2 列舉 19 細項）
 *   - 常用區（永遠展開）：急診/救護/健保自付/掛號/病房差額/看護
 *   - [+ 新增其他費用] 按鈕展開剩餘 12 個欄位
 * - Panel 2：車損 / 財損
 *   - 常用區（永遠展開）：估價/發票/拖吊
 *   - [+ 新增其他費用] 按鈕展開剩餘 8 個欄位
 *
 * 拆解理由：user 反饋「最後一步負擔過大」→ 5 步拆分：
 *   Step 4：傷勢與診斷（Step4Diagnosis）
 *   Step 5（本檔）：費用與財損（receipts + property，可展開）
 */

'use client'

import { useState } from 'react'
import { Button, Collapse, Form, Row, Typography } from 'antd'
import { FileTextOutlined, PlusOutlined, ToolOutlined } from '@ant-design/icons'
import { InfoAlert } from '@/components/InfoAlert'
import { R2C } from './_R2C'
import type { FormSchema } from '../_form'

const { Title } = Typography

export interface Step5FeesAndPropertyProps {
  form: ReturnType<typeof Form.useForm<FormSchema>>[0]
}

// AGENTS §2.1：_props 真的 unused（型別只給 React component contract）
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Step5FeesAndProperty(_props: Step5FeesAndPropertyProps) {
  const [showMedicalAdvanced, setShowMedicalAdvanced] = useState(false)
  const [showPropertyAdvanced, setShowPropertyAdvanced] = useState(false)

  const medicalItems: { items: { key: string; label: string; name: string }[] }[] = [
    {
      items: [
        { key: 'emergencyFee', label: '急診費', name: 'emergencyFee' },
        { key: 'ambulanceFee', label: '救護車費', name: 'ambulanceFee' },
        { key: 'nhiCopayment', label: '健保自付額', name: 'nhiCopayment' },
        { key: 'registrationFee', label: '掛號費', name: 'registrationFee' },
        { key: 'wardFeeDifference', label: '病房費差額', name: 'wardFeeDifference' },
        { key: 'wardFeeDays', label: '病房費天數', name: 'wardFeeDays' },
        { key: 'nursingFee', label: '看護費', name: 'nursingFee' },
        { key: 'nursingDays', label: '看護天數', name: 'nursingDays' },
      ],
    },
  ]

  const medicalAdvancedItems: { key: string; label: string; name: string }[] = [
    { key: 'diagnosisCertificateFee', label: '診斷書費', name: 'diagnosisCertificateFee' },
    {
      key: 'nonNhiNecessaryMedicalFee',
      label: '非健保必要醫療',
      name: 'nonNhiNecessaryMedicalFee',
    },
    { key: 'mealFee', label: '膳食費', name: 'mealFee' },
    { key: 'mealDays', label: '膳食天數', name: 'mealDays' },
    { key: 'prosthesisFee', label: '義肢費', name: 'prosthesisFee' },
    { key: 'dentureFee', label: '義齒費', name: 'dentureFee' },
    { key: 'missingTeethCount', label: '缺牙數', name: 'missingTeethCount' },
    { key: 'artificialEyeFee', label: '義眼費', name: 'artificialEyeFee' },
    {
      key: 'specialMaterialFee',
      label: '特殊材料費（骨材/鋼板/特材）',
      name: 'specialMaterialFee',
    },
    {
      key: 'medicalMaterialFee',
      label: '一般醫材（v0.2.5+ 向後相容）',
      name: 'medicalMaterialFee',
    },
    { key: 'assistiveDeviceFee', label: '輔具費（拐杖/輪椅/支架）', name: 'assistiveDeviceFee' },
    { key: 'transportationFee', label: '接送費', name: 'transportationFee' },
    { key: 'otherNecessaryMedicalFee', label: '其他必要醫療', name: 'otherNecessaryMedicalFee' },
  ]

  const propertyCommonItems: { key: string; label: string; name: string }[] = [
    { key: 'vehicleRepairEstimate', label: '估價單金額', name: 'vehicleRepairEstimate' },
    { key: 'vehicleRepairInvoice', label: '發票金額', name: 'vehicleRepairInvoice' },
    { key: 'towingFee', label: '拖吊費', name: 'towingFee' },
  ]

  const propertyAdvancedItems: { key: string; label: string; name: string }[] = [
    {
      key: 'vehicleMarketValueBeforeAccident',
      label: '事故前車價',
      name: 'vehicleMarketValueBeforeAccident',
    },
    { key: 'salvageValue', label: '殘值', name: 'salvageValue' },
    // v0.24.0+：折舊計算欄位（選填；填了會代入保險通用折舊率）
    {
      key: 'vehicleManufactureYear',
      label: '出廠年份（西元，選填）',
      name: 'vehicleManufactureYear',
    },
    { key: 'vehicleCategory', label: '車輛種類（汽/機車，選填）', name: 'vehicleCategory' },
    { key: 'rentalCarFee', label: '代步費', name: 'rentalCarFee' },
    { key: 'phoneDamage', label: '手機損壞', name: 'phoneDamage' },
    { key: 'helmetDamage', label: '安全帽損壞', name: 'helmetDamage' },
    { key: 'clothingDamage', label: '衣物損壞', name: 'clothingDamage' },
    { key: 'glassesDamage', label: '眼鏡損壞', name: 'glassesDamage' },
    { key: 'otherPropertyDamage', label: '其他財損', name: 'otherPropertyDamage' },
  ]

  return (
    <div className="space-y-4">
      <InfoAlert
        type="info"
        showIcon
        title="依強制汽車責任保險給付標準 §2 細項填寫；看護費有 1,200 元/日、30 日硬上限（會自動套用）。"
        body="本表單只收醫療相關；精神慰撫金 / 工作損失 / 車損請勿填入醫療區（法律強制不併入強制險）。"
      />

      <Collapse
        defaultActiveKey={['medical', 'property']}
        items={[
          {
            key: 'medical',
            // v0.20.4+：forceRender 確保 panel 折疊時 children（Form.Item）也 render，
            // 否則 Form schema 沒註冊 receipts 欄位，validateFields() 拿不到值
            // → estimateClaim 用預設值（0）→ 強制險 0 元 production bug
            forceRender: true,
            label: (
              <span className="font-medium">
                <FileTextOutlined className="mr-2" />
                醫療收據（強制險 §2 列舉）
              </span>
            ),
            children: (
              <>
                <Title level={5} className="!mb-2">
                  常用
                </Title>
                <Row gutter={16} className="!mb-3">
                  {medicalItems[0].items.map((f) => (
                    <R2C key={f.key} name={['receipts', f.name]} label={f.label} />
                  ))}
                </Row>

                {!showMedicalAdvanced && (
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() => setShowMedicalAdvanced(true)}
                    data-testid="show-medical-advanced"
                  >
                    新增其他費用（{medicalAdvancedItems.length} 項進階欄位）
                  </Button>
                )}

                {showMedicalAdvanced && (
                  <>
                    <Title level={5} className="!mb-2 !mt-4">
                      進階
                    </Title>
                    <Row gutter={16}>
                      {medicalAdvancedItems.map((f) => (
                        <R2C key={f.key} name={['receipts', f.name]} label={f.label} />
                      ))}
                    </Row>
                  </>
                )}
              </>
            ),
          },
          {
            key: 'property',
            // v0.20.4+：同 medical panel，forceRender 確保 Form.Item 永遠註冊
            forceRender: true,
            label: (
              <span className="font-medium">
                <ToolOutlined className="mr-2" />
                車損 / 財損
              </span>
            ),
            children: (
              <>
                <Title level={5} className="!mb-2">
                  車輛（常用）
                </Title>
                <Row gutter={16} className="!mb-3">
                  {propertyCommonItems.map((f) => (
                    <R2C key={f.key} name={['property', f.name]} label={f.label} />
                  ))}
                </Row>

                {!showPropertyAdvanced && (
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() => setShowPropertyAdvanced(true)}
                    data-testid="show-property-advanced"
                  >
                    新增其他費用（{propertyAdvancedItems.length} 項進階欄位）
                  </Button>
                )}

                {showPropertyAdvanced && (
                  <>
                    <Title level={5} className="!mb-2 !mt-4">
                      其他財損
                    </Title>
                    <Row gutter={16}>
                      {propertyAdvancedItems.map((f) => (
                        <R2C key={f.key} name={['property', f.name]} label={f.label} />
                      ))}
                    </Row>
                  </>
                )}
              </>
            ),
          },
        ]}
      />

      {/* 隱藏 Form：保留 Form context 讓 R2C 的 name={['receipts', x]} 仍能註冊欄位，
          即使 panel 折疊也保留 schema 欄位（AntD Form.useForm 自動收集所有 Form.Item） */}
      <Form component="div" style={{ display: 'none' }} aria-hidden="true" />
    </div>
  )
}
