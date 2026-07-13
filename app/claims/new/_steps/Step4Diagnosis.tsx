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
  getDefaultLevel,
  isCompulsoryExclusion,
  needsMMSE,
  type DisabilityCategory,
} from '@/lib/insurance/disability-categories'
import {
  extractDiagnosisFeatures,
  recommendDisabilityLevel,
  type LevelRecommendation,
} from '@/lib/insurance/diagnosis-parser'

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

  // 失能保典 12 大類（v0.5.0+ 用 Cascader 選大類 + 等級兩步選）
  // v0.2.5+：選大類會自動帶出該類常見等級
  const disabilityCategory = Form.useWatch(['medical', 'disabilityCategory'], form) as
    DisabilityCategory | undefined

  return (
    <StepShell
      icon={<MedicineBoxOutlined />}
      title="傷勢與診斷"
      alertType="info"
      alertTitle="失能保典 12 大類（如骨骼／神經／眼耳等），從大類選完會自動帶出該類常見等級，可手改。"
      stepNumber={4}
    >
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            label="診斷描述"
            name={['medical', 'diagnosisText']}
            tooltip="貼上診斷書全文或關鍵段落，點「AI 推薦」自動建議失能等級"
          >
            <Input.TextArea
              rows={2}
              placeholder="例：左側脛骨平台粉碎性骨折 + 膝關節活動受限 ROM 30 度"
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          {/* v0.19.0+：AI 推薦失能等級按鈕 + 結果面板 */}
          <Form.Item label="AI 推薦失能等級（rule-based）">
            <Space direction="vertical" className="!w-full" size="small">
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
                  <Space direction="vertical" size="small" className="!w-full">
                    <Space>
                      {aiRecommendation.level !== null ? (
                        <Tag color="blue" className="!text-sm">
                          建議第 {aiRecommendation.level} 級
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
                          採用建議
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
                      {aiRecommendation.disclaimer}
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
        title="選大類會自動帶出該類常見等級（可手改）。精神/神經類需附心理衡鑑報告；胸腹部臟器類強制險部分項目不給付。"
      />
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="失能種類（12 大類）" name={['medical', 'disabilityCategory']}>
            <Select
              allowClear
              placeholder="選大類"
              options={DISABILITY_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
              onChange={(v) => {
                if (v) {
                  const defaultLvl = getDefaultLevel(v as DisabilityCategory)
                  form.setFieldValue(['medical', 'disabilityLevel'], defaultLvl)
                } else {
                  form.setFieldValue(['medical', 'disabilityLevel'], undefined)
                }
              }}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item
            label={
              <Space>
                <span>失能等級（1=最重 / 15=最輕）</span>
                <Tooltip title="失能等級須由醫院開立「失能診斷書」並經保險公司 / 評議 / 法院認定，本欄為初步篩選用途。">
                  <QuestionCircleOutlined />
                </Tooltip>
              </Space>
            }
            name={['medical', 'disabilityLevel']}
          >
            <Select
              allowClear
              placeholder="選大類後自動帶出"
              options={DISABILITY_LEVELS.map((l) => ({ value: l.value, label: l.label }))}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item label="對應勞減比例">
            <DisabilityLevelTag />
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
        <Col xs={12} md={6}>
          <Form.Item
            label={
              <Space>
                <span>A 型診斷書</span>
                <Tooltip title="身心障礙鑑定 A 型（舊制，極重度）會影響勞減比例 80-100%。">
                  <QuestionCircleOutlined />
                </Tooltip>
              </Space>
            }
            name={['medical', 'hasClassADiagnosisCertificate']}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>
      </Row>

      {/* 強制險排除警示（v0.2.5+） */}
      {disabilityCategory && isCompulsoryExclusion(disabilityCategory) && (
        <Alert
          type="warning"
          showIcon
          className="!mt-3"
          message={`${disabilityCategory} 屬於強制險部分項目排除範圍`}
          description="此類型在強制汽車責任保險法 §27 給付標準中可能部分排除，建議改用第三人責任險估算。"
        />
      )}

      {/* 心理衡鑑警示（v0.2.6+） */}
      {disabilityCategory && needsMMSE(disabilityCategory) && (
        <Alert
          type="info"
          showIcon
          className="!mt-3"
          message="此類型需附心理衡鑑報告"
          description="精神 / 神經類失能認定需 MMSE 或其他心理評估報告佐證，請向醫院申請完整評估。"
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
            輸入「現在能動到的最大角度」會自動算 ROM 損失比（影響失能等級認定）
          </Paragraph>
        </Card>
      )}
    </StepShell>
  )
}

/**
 * 即時顯示「失能等級 → 勞減比例」對照（依 DISABILITY_LABOR_LOSS_PCT 公式）
 */
function DisabilityLevelTag() {
  const form = Form.useFormInstance<FormSchema>()
  const level = Form.useWatch(['medical', 'disabilityLevel'], form) as number | undefined
  if (level == null) return <Tag>未選</Tag>
  return <Tag color="default">{level} 級</Tag>
}
