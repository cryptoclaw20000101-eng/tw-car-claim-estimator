/**
 * Step 4：傷勢與診斷（v0.20.0+ 從原 Step4Medical 拆出上半段）
 *
 * 內容：診斷書 + AI 推薦 + 醫院 + 治療歷程 + 失能保典 12 大類 + 傷勢細節
 * 不含：醫療收據（已搬到 Step5FeesAndProperty）+ 車損 / 財損（同上）
 *
 * 拆解理由：user 反饋「最後一步負擔過大」→ 5 步拆分：
 *   Step 4（本檔）：傷勢與診斷（medial section）
 *   Step 5：費用與財損（receipts + property，可展開）
 */

'use client'

import { useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
  DatePicker,
} from 'antd'
import {
  MedicineBoxOutlined,
  QuestionCircleOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { StepShell } from '@/components/StepShell'
import { Step4KnnPreview } from '@/components/Step4KnnPreview'
import { InfoAlert } from '@/components/InfoAlert'
import type { FormSchema } from '../_form'
import type { JointName } from '@/lib/insurance/types'
import {
  DISABILITY_CATEGORIES,
  DISABILITY_LEVELS,
  needsMMSE,
  type DisabilityCategory,
} from '@/lib/insurance/disability-categories'
import {
  extractDiagnosisFeatures,
  recommendDisabilityLevel,
  type LevelRecommendation,
} from '@/lib/insurance/diagnosis-parser'
import { DISABILITY_STANDARD_ITEMS } from '@/lib/insurance/disability-standard'

const { Title, Text, Paragraph } = Typography

export interface Step4DiagnosisProps {
  form: ReturnType<typeof Form.useForm<FormSchema>>[0]
  /** 從 Step 1 帶入的 accidentLocation（給 KNN 預視用）*/
  accidentLocationForKnn: string | undefined
}

const JOINT_OPTIONS: { value: JointName; label: string }[] = [
  { value: 'shoulder', label: '肩關節' },
  { value: 'elbow', label: '肘關節' },
  { value: 'wrist', label: '腕關節' },
  { value: 'hip', label: '髖關節' },
  { value: 'knee', label: '膝關節' },
  { value: 'ankle', label: '踝關節' },
  { value: 'finger', label: '手指關節' },
  { value: 'toe', label: '腳趾關節' },
  { value: 'cervical', label: '頸椎' },
  { value: 'lumbar', label: '腰椎' },
]

// 各關節「正常活動度」（v0.4.0+ 從醫學文獻整理）
const ROM_NORMAL: Record<JointName, number> = {
  shoulder: 180,
  elbow: 150,
  wrist: 80,
  hip: 120,
  knee: 135,
  ankle: 70,
  finger: 90,
  toe: 45,
  cervical: 60,
  lumbar: 60,
}

export function Step4Diagnosis({ form, accidentLocationForKnn }: Step4DiagnosisProps) {
  const jointName = Form.useWatch(['medical', 'jointName'], form) as JointName | null
  // v0.7.6+：KNN 即時預視 — 監聽失能等級 + 事故地點
  const disabilityLevelForKnn = Form.useWatch(['medical', 'disabilityLevel'], form) as
    number | undefined
  // v0.19.0+：診斷書 AI 推薦結果（rule-based parser）
  const [aiRecommendation, setAiRecommendation] = useState<LevelRecommendation | null>(null)

  // v0.5.3 bugfix: emergencyDate DatePicker 跟 birthDate 同症狀 — 收到空字串炸
  // 改用 getValueProps 在 client 端注入 dayjs() 物件
  // （父層 useEffect 已處理，這裡保留當 fallback: 若父層 setFieldsValue 沒生效就補上）
  const emergencyDate = Form.useWatch(['medical', 'emergencyDate'], form)
  useState(() => {
    if (!emergencyDate) {
      form.setFieldsValue({ medical: { emergencyDate: dayjs() } } as Record<string, unknown>)
    }
  })

  // 失能保典 12 大類（用於協助選擇診斷書對應部位）
  const disabilityCategory = Form.useWatch(['medical', 'disabilityCategory'], form) as
    DisabilityCategory | undefined
  const selectedTableItemIds =
    (Form.useWatch(['medical', 'disabilityTableItemIds'], form) as string[] | undefined) ?? []
  const selectedTableItems = DISABILITY_STANDARD_ITEMS.filter((item) =>
    selectedTableItemIds.includes(item.id),
  )
  const selectedCategorySeries = disabilityCategory ? Number(disabilityCategory.slice(0, 2)) : null
  const tableItemOptions = DISABILITY_STANDARD_ITEMS.filter(
    (item) =>
      selectedCategorySeries === null || Number(item.id.split('-')[0]) === selectedCategorySeries,
  ).map((item) => ({
    value: item.id,
    label: `${item.id}｜第 ${item.level} 級｜${item.status}`,
  }))

  const syncTableItems = (ids: string[]) => {
    const items = DISABILITY_STANDARD_ITEMS.filter((item) => ids.includes(item.id)).sort(
      (a, b) => a.level - b.level,
    )
    const levels = items.map((item) => item.level)
    form.setFieldValue(['medical', 'disabilityLevel'], levels[0])
    form.setFieldValue(['medical', 'additionalDisabilityLevels'], levels.slice(1))

    const seriesNumbers = new Set(items.map((item) => Number(item.id.split('-')[0])))
    if (seriesNumbers.size === 1) {
      const series = [...seriesNumbers][0]!
      const category = DISABILITY_CATEGORIES.find(
        (item) => Number(item.value.slice(0, 2)) === series,
      )
      if (category) form.setFieldValue(['medical', 'disabilityCategory'], category.value)
    }
  }

  return (
    <StepShell
      icon={<MedicineBoxOutlined />}
      title="傷勢與診斷"
      alertType="info"
      alertTitle="失能部位與等級以症狀固定後的診斷書為準；系統只作初步整理與補件提醒。"
      stepNumber={4}
    >
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            label="診斷描述"
            name={['medical', 'diagnosisText']}
            tooltip="貼上診斷書全文或關鍵段落，點「AI 推薦」取得初篩線索；仍須依診斷書選擇正式附表項次。"
          >
            <Input.TextArea
              rows={2}
              placeholder="例：左側脛骨平台粉碎性骨折 + 膝關節活動受限 ROM 30 度"
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          {/* AI 僅提供初篩線索，給付仍須由 204 項正式附表核對。 */}
          <Form.Item label="AI 初篩等級線索（rule-based）">
            <Space orientation="vertical" className="!w-full" size="small">
              <Button
                icon={<ThunderboltOutlined />}
                onClick={() => {
                  const text = form.getFieldValue(['medical', 'diagnosisText']) ?? ''
                  const features = extractDiagnosisFeatures(text)
                  const accidentDate = form.getFieldValue(['basics', 'accidentDate']) ?? ''
                  const accidentDateStr =
                    typeof accidentDate === 'string'
                      ? accidentDate
                      : accidentDate && typeof accidentDate === 'object' && 'format' in accidentDate
                        ? (accidentDate as { format: (s: string) => string }).format('YYYY-MM-DD')
                        : ''
                  const rec = recommendDisabilityLevel(features, accidentDateStr)
                  setAiRecommendation(rec)
                }}
                data-testid="ai-recommend-button"
              >
                AI 推薦
              </Button>
              {aiRecommendation && (
                <Card size="small" className="!bg-accent-soft/30">
                  <Space orientation="vertical" size="small" className="!w-full">
                    <Space>
                      {aiRecommendation.level !== null ? (
                        <Tag color="blue" className="!text-sm">
                          初篩第 {aiRecommendation.level} 級
                        </Tag>
                      ) : (
                        <Tag className="!text-sm">資料不足</Tag>
                      )}
                      <Tag
                        color={
                          aiRecommendation.confidence === 'high'
                            ? 'green'
                            : aiRecommendation.confidence === 'medium'
                              ? 'gold'
                              : aiRecommendation.confidence === 'low'
                                ? 'orange'
                                : 'default'
                        }
                      >
                        信心度：{aiRecommendation.confidence}
                      </Tag>
                      {aiRecommendation.requiresHumanReview && (
                        <Tag icon={<ExclamationCircleOutlined />} color="error">
                          需人工複核
                        </Tag>
                      )}
                      {aiRecommendation.level !== null && (
                        <Button
                          size="small"
                          type="link"
                          icon={<CheckCircleOutlined />}
                          onClick={() =>
                            form.setFieldValue(
                              ['medical', 'disabilityLevel'],
                              aiRecommendation.level,
                            )
                          }
                          data-testid="ai-adopt-button"
                        >
                          帶入供核對
                        </Button>
                      )}
                    </Space>
                    <details className="!text-xs">
                      <summary className="!cursor-pointer !text-muted">
                        推理過程（{aiRecommendation.reasoning.length} 步）
                      </summary>
                      <ol className="!mt-2 !ml-4 !text-xs">
                        {aiRecommendation.reasoning.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ol>
                    </details>
                    <Text type="secondary" className="!text-xs !mt-1">
                      {aiRecommendation.disclaimer} 不會取代正式附表項次的核對。
                    </Text>
                  </Space>
                </Card>
              )}
            </Space>
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="醫院名稱" name={['medical', 'hospitalName']}>
            <Input placeholder="例：中國醫藥大學附設醫院" />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item
            label="急診日期"
            name={['medical', 'emergencyDate']}
            getValueProps={(value) => ({ value: value ? dayjs(value) : null })}
          >
            <DatePicker
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              onChange={(d: Dayjs | null) =>
                form.setFieldValue(['medical', 'emergencyDate'], d?.format('YYYY-MM-DD') ?? '')
              }
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item label="門診次數" name={['medical', 'outpatientVisitCount']}>
            <InputNumber style={{ width: '100%' }} min={0} step={1} placeholder="例：12" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item label="住院天數" name={['medical', 'hospitalizationDays']}>
            <InputNumber style={{ width: '100%' }} min={0} step={1} placeholder="例：7" />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item label="是否手術" name={['medical', 'hasSurgery']} valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            label="是否復健"
            name={['medical', 'hasRehabilitation']}
            valuePropName="checked"
          >
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item label="復健次數" name={['medical', 'rehabilitationCount']}>
            <InputNumber style={{ width: '100%' }} min={0} step={1} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={12} md={6}>
          <Form.Item
            label="需看護"
            name={['medical', 'requiresNursingCare']}
            valuePropName="checked"
          >
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item
            label="看護日數"
            name={['medical', 'nursingDays']}
            tooltip="強制險看護每日 1,200 元 × 上限 30 日 = 36,000 元"
          >
            <InputNumber style={{ width: '100%' }} min={0} step={1} />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item
            label="症狀已固定"
            name={['medical', 'isSymptomFixed']}
            valuePropName="checked"
          >
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item
            label="有失能診斷書"
            name={['medical', 'hasDisabilityCertificate']}
            valuePropName="checked"
          >
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        </Col>
      </Row>

      <Title level={5} className="!mt-4">
        失能部位與等級（失能保典 12 大類）
      </Title>
      <InfoAlert
        type="info"
        showIcon
        className="!mb-4"
        title="失能等級必須以症狀固定後的失能診斷書所列附表項目為準。選大類只用來縮小選項；精神、神經與胸腹部臟器均依各項審核基準與專科資料認定。"
      />
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item label="失能種類（用來縮小附表選項）" name={['medical', 'disabilityCategory']}>
            <Select
              allowClear
              placeholder="可先選系列"
              options={DISABILITY_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={16}>
          <Form.Item
            label="診斷書附表項次（204 項，可複選）"
            name={['medical', 'disabilityTableItemIds']}
            tooltip="請選診斷書載明的正式附表項次。系統會以官方表核對等級；同一事故多項失能可複選。"
          >
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="例：12-29｜第 11 級｜一下肢三大關節中，有一大關節遺存顯著運動障害"
              options={tableItemOptions}
              onChange={syncTableItems}
            />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={16}>
          <Card size="small" className="!mb-4 !bg-accent-soft/30">
            {selectedTableItems.length > 0 ? (
              <Space orientation="vertical" size={2}>
                <Text strong>
                  已核對 {selectedTableItems.length} 項：
                  {selectedTableItems.map((item) => `${item.id}（第 ${item.level} 級）`).join('、')}
                </Text>
                <Text type="secondary" className="!text-xs">
                  失能等級與同一事故的多項合併規則，會由所選附表項次自動帶入。
                </Text>
              </Space>
            ) : (
              <Text type="secondary">選擇診斷書附表項次後，系統才會啟用失能給付試算。</Text>
            )}
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            label="事故前同部位既有失能等級（選填）"
            name={['medical', 'preExistingDisabilityLevel']}
            tooltip="僅在同一障害部位原已有失能時填寫。系統會依第 5 條扣除既有失能給付標準。"
          >
            <Select
              allowClear
              placeholder="無既有失能則留白"
              options={DISABILITY_LEVELS.map((level) => ({
                value: level.value,
                label: level.label,
              }))}
            />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item
            label="鑑定／職務分析勞減率（選填）"
            name={['medical', 'laborCapacityLossPercent']}
            tooltip="請填醫療鑑定或職務分析認定的百分比。未填時，系統僅以強制險失能等級提供參考值。"
          >
            <InputNumber min={0} max={100} precision={1} addonAfter="%" className="!w-full" />
          </Form.Item>
        </Col>
      </Row>

      {/* 即時 KNN 預視（v0.7.6+）— 選失能等級時邊看相似判例 */}
      {disabilityLevelForKnn != null && (
        <div className="!mt-3">
          <Step4KnnPreview
            disabilityLevel={disabilityLevelForKnn}
            accidentLocation={accidentLocationForKnn}
          />
        </div>
      )}

      <Title level={5} className="!mt-2">
        傷勢細節（失能規則引擎用）
      </Title>
      <Paragraph className="!text-xs !text-muted">
        失能規則引擎會根據以下條件自動算勞減比例
      </Paragraph>
      <Row gutter={16}>
        <Col xs={12} md={4}>
          <Form.Item
            label={
              <Space>
                <span>骨折</span>
                <Tooltip title="「骨折」會讓失能保典啟動更嚴格的認定公式。">
                  <QuestionCircleOutlined />
                </Tooltip>
              </Space>
            }
            name={['medical', 'hasFracture']}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item label="脫臼" name={['medical', 'hasDislocation']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item label="韌帶傷" name={['medical', 'hasLigamentInjury']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item
            label={
              <Space>
                <span>神經損傷</span>
                <Tooltip title="中樞神經損傷（如脊髓）會套 7 級以上認定。">
                  <QuestionCircleOutlined />
                </Tooltip>
              </Space>
            }
            name={['medical', 'hasNerveDamage']}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item
            label={
              <Space>
                <span>截肢</span>
                <Tooltip title="截肢 / 喪失功能會影響勞減比例 60-100%。">
                  <QuestionCircleOutlined />
                </Tooltip>
              </Space>
            }
            name={['medical', 'hasAmputation']}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item label="臟器損傷" name={['medical', 'hasOrganDamage']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={12} md={4}>
          <Form.Item label="有疤痕" name={['medical', 'hasScar']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item
            label="疤痕長度 (cm)"
            name={['medical', 'scarLengthCm']}
            tooltip="v0.4.0+ 對照「除疤/修疤費用 4 術式 × 北中南」表"
          >
            <InputNumber style={{ width: '100%' }} min={0} step={0.5} placeholder="例：5" />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item label="疤痕位置" name={['medical', 'scarLocation']}>
            <Input placeholder="例：左臉頰 / 右前臂" />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item
            label={
              <Space>
                <span>關節名稱</span>
                <Tooltip title="選了關節後才能填「受限角度」「正常角度」計算 ROM 損失。">
                  <QuestionCircleOutlined />
                </Tooltip>
              </Space>
            }
            name={['medical', 'jointName']}
          >
            <Select
              allowClear
              placeholder="選關節"
              options={JOINT_OPTIONS}
              onChange={(v) => {
                form.setFieldValue(
                  ['medical', 'romNormalDegree'],
                  v ? ROM_NORMAL[v as JointName] : 0,
                )
              }}
            />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={12} md={4}>
          <Form.Item
            label="關節活動受限"
            name={['medical', 'hasRangeOfMotionLimitation']}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item
            label="角度喪失 (度)"
            name={['medical', 'romLossDegree']}
            tooltip="關節活動度（ROM）由醫院量測或自行估計。填「正常活動度 − 現在能動到的最大角度」。0° 表示完全沒受限；填越大表示受限越嚴重。"
          >
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item label="正常活動度 (度)" name={['medical', 'romNormalDegree']}>
            <InputNumber style={{ width: '100%' }} min={0} disabled />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={12} md={6}>
          <Form.Item
            label="肌力減退"
            name={['medical', 'hasMuscleWeakness']}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item label="感覺喪失" name={['medical', 'hasSensoryLoss']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={12} md={6}>
          <Form.Item
            label={
              <Space>
                <span>永久障害</span>
                <Tooltip title="「永久障害」會讓勞減比例提高 20-30%。">
                  <QuestionCircleOutlined />
                </Tooltip>
              </Space>
            }
            name={['medical', 'hasPermanentImpairment']}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>
        {/* v0.28.3+：移除 A 型診斷書欄位（user 2026-07-17：任何診斷書本來就可以，不需區分）*/}
      </Row>

      {/* 心理衡鑑警示（v0.2.6+） */}
      {disabilityCategory && needsMMSE(disabilityCategory) && (
        <Alert
          type="info"
          showIcon
          className="!mt-3"
          message="此類型的專科審核資料依附表項次而定"
          description="精神或神經類障害應依所選項次的審核基準提供專科評估；並非所有案件都以 MMSE 或 ROM 為必要資料。"
        />
      )}

      {/* 關節選了才顯示角度填寫（v0.4.0+） */}
      {jointName && (
        <Card size="small" className="!mt-3 !bg-accent-soft/40 dark:!bg-accent-soft/20">
          <Title level={5} className="!mb-2">
            已選關節：{JOINT_OPTIONS.find((o) => o.value === jointName)?.label ?? jointName}
            （正常活動度 {ROM_NORMAL[jointName]} 度）
          </Title>
          <Paragraph className="!text-xs !text-muted">
            輸入「現在能動到的最大角度」會計算 ROM
            初篩線索與補件提示；給付等級仍以診斷書附表項次為準。
          </Paragraph>
        </Card>
      )}
    </StepShell>
  )
}
