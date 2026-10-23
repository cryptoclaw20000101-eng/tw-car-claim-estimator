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
import { Button, Collapse, Form, Radio, Row, Typography } from 'antd'
import { FileTextOutlined, PlusOutlined, ToolOutlined } from '@ant-design/icons'
import { InfoAlert } from '@/components/InfoAlert'
import { R2C } from './_R2C'
import type { FormSchema } from '../_form'

const { Title } = Typography

export interface Step5FeesAndPropertyProps {
  form: ReturnType<typeof Form.useForm<FormSchema>>[0]
  /** v0.26.0e+：是否有人受傷。true 時掛號費必填（受傷一定會掛號至少一次） */
  isInjured: boolean
}

export function Step5FeesAndProperty({ form, isInjured }: Step5FeesAndPropertyProps) {
  const [showMedicalAdvanced, setShowMedicalAdvanced] = useState(false)
  const [showPropertyAdvanced, setShowPropertyAdvanced] = useState(false)
  const [showWardCosts, setShowWardCosts] = useState(false)
  const hospitalizationDays =
    Form.useWatch(['medical', 'hospitalizationDays'], { form, preserve: true }) ?? 0
  const requiresNursingCare = Form.useWatch(['medical', 'requiresNursingCare'], {
    form,
    preserve: true,
  })
  const nursingDays = Form.useWatch(['medical', 'nursingDays'], { form, preserve: true }) ?? 0
  const nursingFee = Form.useWatch(['receipts', 'nursingFee'], { form, preserve: true }) ?? 0
  const wardFee = Form.useWatch(['receipts', 'wardFeeDifference'], { form, preserve: true }) ?? 0
  const wardDays = Form.useWatch(['receipts', 'wardFeeDays'], { form, preserve: true }) ?? 0
  const repairEstimate =
    Form.useWatch(['property', 'vehicleRepairEstimate'], { form, preserve: true }) ?? 0
  const repairInvoice =
    Form.useWatch(['property', 'vehicleRepairInvoice'], { form, preserve: true }) ?? 0
  const marketValue =
    Form.useWatch(['property', 'vehicleMarketValueBeforeAccident'], { form, preserve: true }) ?? 0
  const showWard = showWardCosts || hospitalizationDays > 0 || wardFee > 0 || wardDays > 0
  const showNursing = requiresNursingCare || nursingFee > 0 || nursingDays > 0
  const [repairSource, setRepairSource] = useState<'estimate' | 'invoice'>(() =>
    form.getFieldValue(['property', 'vehicleRepairInvoice']) > 0 ? 'invoice' : 'estimate',
  )

  const medicalItems: { items: { key: string; label: string; name: string }[] }[] = [
    {
      items: [
        { key: 'emergencyFee', label: '急診費', name: 'emergencyFee' },
        { key: 'ambulanceFee', label: '救護車費', name: 'ambulanceFee' },
        { key: 'nhiCopayment', label: '健保自付額', name: 'nhiCopayment' },
        { key: 'registrationFee', label: '掛號費', name: 'registrationFee' },
        { key: 'wardFeeDifference', label: '病房費差額', name: 'wardFeeDifference' },
        { key: 'wardFeeDays', label: '病房費天數', name: 'wardFeeDays' },
        { key: 'nursingFee', label: '看護費（強制險上限 36,000）', name: 'nursingFee' },
      ],
    },
  ]

  const medicalAdvancedItems: { key: string; label: string; name: string }[] = [
    {
      key: 'diagnosisCertificateFee',
      label: '診斷證明書費（每次限 1 份）',
      name: 'diagnosisCertificateFee',
    },
    {
      key: 'medicalRecordSummaryFee',
      label: '病歷摘要費（每次限 1 份）',
      name: 'medicalRecordSummaryFee',
    },
    { key: 'mealFee', label: '膳食費', name: 'mealFee' },
    { key: 'mealDays', label: '膳食天數', name: 'mealDays' },
    { key: 'prosthesisFee', label: '義肢費', name: 'prosthesisFee' },
    { key: 'dentureFee', label: '義齒費（每顆 10,000）', name: 'dentureFee' },
    { key: 'missingTeethCount', label: '缺牙數（最高採計 5 顆）', name: 'missingTeethCount' },
    { key: 'artificialEyeFee', label: '義眼費', name: 'artificialEyeFee' },
    {
      key: 'specialMaterialFee',
      label: '特殊材料費（骨材/鋼板/特材）',
      name: 'specialMaterialFee',
    },
    {
      key: 'medicalMaterialFee',
      label: '一般醫材費',
      name: 'medicalMaterialFee',
    },
    { key: 'assistiveDeviceFee', label: '輔具費（拐杖/輪椅/支架）', name: 'assistiveDeviceFee' },
    { key: 'transportationFee', label: '接送費', name: 'transportationFee' },
  ]

  const propertyCommonItems: { key: string; label: string; name: string }[] = [
    {
      key: 'repair',
      label: '維修費（元）',
      name: repairSource === 'invoice' ? 'vehicleRepairInvoice' : 'vehicleRepairEstimate',
    },
    { key: 'towingFee', label: '拖吊費', name: 'towingFee' },
    {
      key: 'vehicleMarketValueBeforeAccident',
      label: '事故前車價',
      name: 'vehicleMarketValueBeforeAccident',
    },
  ]

  const propertyAdvancedItems: { key: string; label: string; name: string }[] = [
    { key: 'salvageValue', label: '殘值', name: 'salvageValue' },
    // v0.24.2+：折舊計算欄位（選填；填了會代入平均法 / 直線折舊）
    {
      key: 'vehicleManufactureYear',
      label: '出廠年份（西元，選填）',
      name: 'vehicleManufactureYear',
    },
    {
      key: 'vehicleDepreciationYears',
      label: '折舊年限（汽車預設 5、機車 3）',
      name: 'vehicleDepreciationYears',
    },
    { key: 'rentalCarFee', label: '代步費', name: 'rentalCarFee' },
    { key: 'phoneDamage', label: '手機損壞', name: 'phoneDamage' },
    { key: 'helmetDamage', label: '安全帽損壞', name: 'helmetDamage' },
    { key: 'clothingDamage', label: '衣物損壞', name: 'clothingDamage' },
    { key: 'glassesDamage', label: '眼鏡損壞', name: 'glassesDamage' },
    { key: 'otherPropertyDamage', label: '其他財損', name: 'otherPropertyDamage' },
  ]

  return (
    <div className="space-y-4">
      {isInjured && (
        <InfoAlert type="info" showIcon title="依收據填寫實際金額；系統會依強制險給付上限估算。" />
      )}

      <Collapse
        defaultActiveKey={isInjured ? ['medical'] : ['property']}
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
                醫療費用
              </span>
            ),
            children: (
              <>
                <Title level={5} className="!mb-2">
                  常用
                </Title>
                <Row gutter={16} className="!mb-3">
                  {medicalItems[0].items.map((f) => (
                    <R2C
                      key={f.key}
                      name={['receipts', f.name]}
                      label={f.label}
                      hidden={
                        (f.key === 'nursingFee' && !showNursing) ||
                        (['wardFeeDifference', 'wardFeeDays'].includes(f.key) && !showWard)
                      }
                      // v0.26.0e+：受傷時掛號費必填（未受傷就沒掛號問題）
                      required={f.key === 'registrationFee' ? isInjured : false}
                    />
                  ))}
                </Row>

                {!showWard && (
                  <Button type="link" className="!px-0" onClick={() => setShowWardCosts(true)}>
                    補填住院／病房費用
                  </Button>
                )}
                {showNursing && (
                  <p className="mb-3 text-sm text-muted">
                    看護 {nursingDays} 天，日數沿用「傷勢與治療」；需修改時請返回前一步。
                  </p>
                )}

                {!showMedicalAdvanced && (
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() => setShowMedicalAdvanced(true)}
                    data-testid="show-medical-advanced"
                  >
                    ＋ 其他醫療費用
                  </Button>
                )}

                {showMedicalAdvanced && (
                  <>
                    <Title level={5} className="!mb-2 !mt-4">
                      其他醫療費用
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
                <fieldset className="mb-4">
                  <legend className="mb-2 text-sm">維修金額來源（填一份即可）</legend>
                  <Radio.Group
                    value={repairSource}
                    options={[
                      { value: 'estimate', label: '估價單' },
                      { value: 'invoice', label: '已修車發票' },
                    ]}
                    onChange={(e) => {
                      const source = e.target.value as 'estimate' | 'invoice'
                      const oldKey =
                        repairSource === 'invoice'
                          ? 'vehicleRepairInvoice'
                          : 'vehicleRepairEstimate'
                      const newKey =
                        source === 'invoice' ? 'vehicleRepairInvoice' : 'vehicleRepairEstimate'
                      if (newKey !== oldKey) {
                        const value = form.getFieldValue(['property', oldKey]) ?? 0
                        form.setFieldsValue({ property: { [oldKey]: 0, [newKey]: value } })
                        setRepairSource(source)
                      }
                    }}
                  />
                </fieldset>
                <Row gutter={16} className="!mb-3">
                  {propertyCommonItems.map((f) => (
                    <R2C
                      key={f.key}
                      name={['property', f.name]}
                      label={f.label}
                      hidden={
                        f.key === 'vehicleMarketValueBeforeAccident' &&
                        !(repairEstimate > 0 || repairInvoice > 0 || marketValue > 0)
                      }
                    />
                  ))}
                </Row>

                {(repairEstimate > 0 || repairInvoice > 0) && !(marketValue > 0) && (
                  <InfoAlert
                    type="warning"
                    showIcon
                    className="!mb-3"
                    title="車損待補事故前車價"
                    body="可先填市場行情參考價；不知道可先留白，車輛維修損失會標示待估，暫不列入總額。"
                  />
                )}

                {!showPropertyAdvanced && (
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() => setShowPropertyAdvanced(true)}
                    data-testid="show-property-advanced"
                  >
                    ＋ 其他財物損失
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
        ].filter((item) => isInjured || item.key !== 'medical')}
      />

      {/* 隱藏 Form：保留 Form context 讓 R2C 的 name={['receipts', x]} 仍能註冊欄位，
          即使 panel 折疊也保留 schema 欄位（AntD Form.useForm 自動收集所有 Form.Item） */}
      <Form component="div" style={{ display: 'none' }} aria-hidden="true" />
    </div>
  )
}
