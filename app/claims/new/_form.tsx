'use client'

/**
 * 7 步驟估算表單（v0.14.x — 1518 lines）
 *
 * ⚠️ 此檔案過大，建議 v0.15.x 拆 Step 元件到 _steps/ 子目錄：
 *   - _steps/Step1Basics.tsx
 *   - _steps/Step2Fault.tsx
 *   - _steps/Step3Person.tsx
 *   - _steps/Step4Medical.tsx
 *   - _steps/Step5Receipts.tsx
 *   - _steps/Step6Property.tsx
 *   - _steps/Step7Region.tsx
 *
 * 拆解風險：每 Step 都用 useForm / useState / useEffect 等 hook，
 * 需要把 FormSchema type 抽到 _schema.ts 才不會有循環依賴。
 *
 * 為什麼現在不拆：
 * - 760+ tests + 16 E2E 守護，跑得好好的
 * - Step 內部互相引用（data state, setFieldValue, Form.useWatch）
 * - 重構風險高於短期收益
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  Card,
  Divider,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Steps,
  // v0.12.0+ Phase B2：自製進度條（取代 AntD Steps）
  Switch,
  message,
  Alert,
  Typography,
  DatePicker,
  Row,
  Col,
  Tag,
} from 'antd'
import { InfoAlert } from '@/components/InfoAlert'
import { StepShell } from '@/components/StepShell'
import { Step4KnnPreview } from '@/components/Step4KnnPreview'
import { MobileStickyCTA } from '@/components/MobileStickyCTA'
// v0.12.0+ Phase B2：自製進度條
import { FormProgress } from '@/components/FormProgress'
// v0.15.x Phase 4：Step 元件抽出
import { Step1Basics } from './_steps/Step1Basics'
import { Step2Fault } from './_steps/Step2Fault'
import { Step7Region } from './_steps/Step7Region'
import {
  LeftOutlined,
  RightOutlined,
  CheckCircleOutlined,
  CarOutlined,
  UserOutlined,
  MedicineBoxOutlined,
  ToolOutlined,
  EnvironmentOutlined,
  FileAddOutlined,
  AuditOutlined,
  FileTextOutlined,
  ReadOutlined,
  // v0.12.0+ Phase A3：表單欄位 tooltip icon
  InfoCircleOutlined,
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import type {
  AccidentBasics,
  AccidentType,
  ClaimInput,
  CompulsoryMedicalInputs,
  EmploymentType,
  FaultInfo,
  FaultSource,
  InjuredRole,
  JointName,
  MedicalRecord,
  PersonalIncome,
  PropertyDamageInputs,
} from '@/lib/insurance/types'
import { regionCourtMap } from '@/lib/insurance/region-court-map'
import { estimateClaim } from '@/lib/insurance'
// v0.14.x：載入舊案件
import { consumeForLoad } from '@/lib/estimate-loader'
import {
  DISABILITY_CATEGORIES,
  DISABILITY_LEVELS,
  getDefaultLevel,
  isCompulsoryExclusion,
  needsMMSE,
  type DisabilityCategory,
  type DisabilityLevelValue,
} from '@/lib/insurance/disability-categories'
import { DISABILITY_LABOR_LOSS_PCT } from '@/lib/insurance/hoffmann'

// 表單頁必須在 client runtime render（AntD Form useWatch / validateFields 依賴 client context）

const { Title, Paragraph, Text } = Typography

// ============== 預設值 ==============

const today = () => dayjs().format('YYYY-MM-DD')

const DEFAULT_BASICS: AccidentBasics = {
  accidentDate: today(),
  accidentLocation: '',
  accidentType: 'car_to_car',
  injuredRole: 'driver_car',
  isAutomobileAccident: true,
  hasPolicePreliminaryReport: true,
  hasAccidentAppraisal: false,
  hasCompulsoryInsurance: true,
  // v0.5.2: 拿掉 isSettled / hasThirdPartyInsurance / 3 個保額欄位（永遠有第三人險、無保額上限）
  accidentCity: '臺中市',
  accidentDistrict: '',
  claimantResidenceCity: '臺中市',
  claimantResidenceDistrict: '',
  defendantResidenceCity: '臺中市',
  defendantResidenceDistrict: '',
  courtJurisdiction: '臺灣臺中地方法院',
  insuranceCompanyBranchRegion: '中部',
}

const DEFAULT_FAULT: FaultInfo = {
  selfFaultRatio: 0,
  otherFaultRatio: 100,
  faultSource: 'police_preliminary',
  isFaultDisputed: false,
}

const DEFAULT_PERSON: PersonalIncome = {
  birthDate: '1990-01-01',
  age: 36,
  occupation: '',
  employmentType: 'full_time_salary',
  sixMonthAverageSalary: 0,
  monthlySalary: 0,
  dailyWage: 0,
  lastYearTaxableIncome: 0,
  hasPropertyList: false,
  hasSalaryTransferRecord: false,
  hasLeaveCertificate: false,
  hasSalaryDeductionProof: false,
  actualLeaveDays: 0,
  doctorOrderedRestDays: 0,
}

const DEFAULT_MEDICAL: MedicalRecord = {
  diagnosisText: '',
  hospitalName: '',
  emergencyDate: '',
  outpatientVisitCount: 0,
  hospitalizationDays: 0,
  hasSurgery: false,
  hasRehabilitation: false,
  rehabilitationCount: 0,
  requiresNursingCare: false,
  nursingDays: 0,
  isSymptomFixed: false,
  hasDisabilityCertificate: false,
  hasClassADiagnosisCertificate: false,
  // disabilityCategory / disabilityLevel 為 optional（不預設）
  hasFracture: false,
  hasDislocation: false,
  hasLigamentInjury: false,
  hasNerveDamage: false,
  hasAmputation: false,
  hasOrganDamage: false,
  hasScar: false,
  scarLengthCm: 0,
  scarLocation: '',
  jointName: null,
  hasRangeOfMotionLimitation: false,
  romLossDegree: 0,
  romNormalDegree: 0,
  hasMuscleWeakness: false,
  hasSensoryLoss: false,
  hasPermanentImpairment: false,
}

const DEFAULT_RECEIPTS: CompulsoryMedicalInputs = {
  emergencyFee: 0,
  ambulanceFee: 0,
  nhiCopayment: 0,
  registrationFee: 0,
  diagnosisCertificateFee: 0,
  nonNhiNecessaryMedicalFee: 0,
  wardFeeDifference: 0,
  wardFeeDays: 0,
  mealFee: 0,
  mealDays: 0,
  prosthesisFee: 0,
  dentureFee: 0,
  missingTeethCount: 0,
  artificialEyeFee: 0,
  specialMaterialFee: 0, // v0.2.5+：特殊材料費（骨材/鋼板/特材），與輔具共套 2 萬上限
  medicalMaterialFee: 0, // v0.2.5+：一般醫材（紗布/縫線），不再套 2 萬上限（向後相容）
  assistiveDeviceFee: 0,
  transportationFee: 0,
  nursingFee: 0,
  nursingDays: 0,
  otherNecessaryMedicalFee: 0,
}

const DEFAULT_PROPERTY: PropertyDamageInputs = {
  vehicleRepairEstimate: 0,
  vehicleRepairInvoice: 0,
  vehicleMarketValueBeforeAccident: 0,
  salvageValue: 0,
  towingFee: 0,
  rentalCarFee: 0,
  phoneDamage: 0,
  helmetDamage: 0,
  clothingDamage: 0,
  glassesDamage: 0,
  otherPropertyDamage: 0,
}

// ============== 選項常數 ==============

const CITY_OPTIONS = [
  '臺北市',
  '新北市',
  '桃園市',
  '臺中市',
  '臺南市',
  '高雄市',
  '基隆市',
  '新竹市',
  '新竹縣',
  '苗栗縣',
  '彰化縣',
  '南投縣',
  '雲林縣',
  '嘉義市',
  '嘉義縣',
  '屏東縣',
  '宜蘭縣',
  '花蓮縣',
  '臺東縣',
  '澎湖縣',
  '金門縣',
  '連江縣',
]

const ACCIDENT_TYPE_OPTIONS: { value: AccidentType; label: string }[] = [
  { value: 'car_to_car', label: '車對車' },
  { value: 'car_to_motorcycle', label: '車對機車' },
  { value: 'car_to_pedestrian', label: '車對行人' },
  { value: 'motorcycle_to_motorcycle', label: '機車對機車' },
  { value: 'motorcycle_to_pedestrian', label: '機車對行人' },
  { value: 'single_vehicle', label: '單一車輛自撞' },
  { value: 'other', label: '其他' },
]

const INJURED_ROLE_OPTIONS: { value: InjuredRole; label: string }[] = [
  { value: 'driver_car', label: '汽車駕駛' },
  { value: 'driver_motorcycle', label: '機車駕駛' },
  { value: 'passenger_car', label: '汽車乘客' },
  { value: 'passenger_motorcycle', label: '機車乘客' },
  { value: 'pedestrian', label: '行人' },
  { value: 'cyclist', label: '自行車騎士' },
  { value: 'passenger_bus', label: '大客車乘客' },
  { value: 'other', label: '其他' },
]

const FAULT_SOURCE_OPTIONS: { value: FaultSource; label: string }[] = [
  { value: 'police_preliminary', label: '警方初步研判表' },
  { value: 'accident_appraisal', label: '車輛行車事故鑑定' },
  { value: 'court_judgment', label: '法院判決' },
  { value: 'both_sides_agreed', label: '雙方和解' },
  { value: 'unclear', label: '不明' },
]

const EMPLOYMENT_OPTIONS: { value: EmploymentType; label: string }[] = [
  { value: 'full_time_salary', label: '正職月薪' },
  { value: 'part_time_salary', label: '兼職月薪' },
  { value: 'self_employed', label: '自營作業' },
  { value: 'daily_wage', label: '日領 / 按件計酬' },
  { value: 'unemployed', label: '待業中' },
  { value: 'retired', label: '退休' },
  { value: 'student', label: '學生' },
  { value: 'homemaker', label: '家管' },
]

const JOINT_OPTIONS: { value: JointName; label: string }[] = [
  { value: 'shoulder', label: '肩' },
  { value: 'elbow', label: '肘' },
  { value: 'wrist', label: '腕' },
  { value: 'hip', label: '髖' },
  { value: 'knee', label: '膝' },
  { value: 'ankle', label: '踝' },
  { value: 'finger', label: '指' },
  { value: 'toe', label: '趾' },
  { value: 'cervical', label: '頸椎' },
  { value: 'lumbar', label: '腰椎' },
]

const ROM_NORMAL: Record<JointName, number> = {
  shoulder: 180,
  elbow: 150,
  wrist: 150,
  hip: 130,
  knee: 135,
  ankle: 70,
  finger: 90,
  toe: 50,
  cervical: 60,
  lumbar: 60,
}

const SCAR_SEVERITY_OPTIONS: { value: 'mild' | 'moderate' | 'severe' | 'keloid'; label: string }[] =
  [
    { value: 'mild', label: '輕度（淺疤、不影響外觀）' },
    { value: 'moderate', label: '中度（明顯疤痕，可能需 1 次雷射）' },
    { value: 'severe', label: '嚴重（肥厚性 / 大面積 / 攣縮）' },
    { value: 'keloid', label: '蟹足腫（會持續長大）' },
  ]

const SCAR_PROCEDURE_OPTIONS: {
  value: 'laser' | 'revision_surgery' | 'facelift' | 'injection'
  label: string
  hint: string
}[] = [
  {
    value: 'laser',
    label: '雷射（染料 / CO2 / 飛梭）',
    hint: '紅寶石雷射 3-5 次療程；基本費 + 每 cm²',
  },
  {
    value: 'revision_surgery',
    label: '修疤手術（Z 形整形 / W 形整形）',
    hint: '外科切除，每公分 3,000-10,000 元',
  },
  {
    value: 'facelift',
    label: '拉皮手術（全臉 / 腹部）',
    hint: '大面積疤痕或合併臉部鬆弛；20-40 萬',
  },
  {
    value: 'injection',
    label: '注射治療（蟹足腫 / PRP）',
    hint: '蟹足腫注射 + 血小板生長因子（中地院 110 簡 202 判例 80 萬）',
  },
]

// ============== 表單 Schema ==============

// v0.15.x Phase 4：export FormSchema 給 _steps/ 子目錄用
export interface FormSchema {
  basics: AccidentBasics
  fault: FaultInfo
  person: PersonalIncome
  medical: MedicalRecord
  receipts: CompulsoryMedicalInputs
  property: PropertyDamageInputs
}

const STEPS = [
  { title: '事故基本' },
  { title: '肇責' },
  { title: '人身 / 工作' },
  { title: '診斷書' },
  { title: '醫療收據' },
  { title: '車損 / 財損' },
  { title: '地區 / 法院' },
]

// ============== 主元件 ==============

export default function NewClaimForm() {
  const router = useRouter()
  const [current, setCurrent] = useState(0)
  const [form] = Form.useForm<FormSchema>()
  const [data, setData] = useState<FormSchema>({
    basics: { ...DEFAULT_BASICS, accidentDate: '' as unknown as string }, // v0.5.1 bugfix: 初始不塞字串，DatePicker 用 dayjs 物件才不會炸
    fault: DEFAULT_FAULT,
    person: DEFAULT_PERSON,
    medical: DEFAULT_MEDICAL,
    receipts: DEFAULT_RECEIPTS,
    property: DEFAULT_PROPERTY,
  })

  // v0.6.4 bugfix: DatePicker 在 Form.Item 控制下，validateFields() 會跑所有 Step 的欄位
  // 即便當前 Step 沒 mount（conditional render），Form store 仍存字串/空字串 → rc-picker
  // 內部 getUDayjs('1990-01-01').isValid() 炸（v0.5.1/v0.5.3 只在子 Step useEffect 補救，跨 Step 不夠）
  // 解法：父層 mount 時一次把所有日期欄位注入 dayjs()，不受 conditional render 影響
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form.setFieldsValue({
      basics: { accidentDate: dayjs() },
      person: { birthDate: dayjs('1990-01-01') },
      medical: { emergencyDate: dayjs() },
    } as any)
  }, [form])

  // 監聽 basics.accidentCity 自動帶入 courtJurisdiction
  const accidentCity = Form.useWatch('basics.accidentCity', form)
  const handleCityChange = (v: string) => {
    const court = regionCourtMap[v]
    if (court) {
      form.setFieldValue(['basics', 'courtJurisdiction'], court)
      setData((d) => ({ ...d, basics: { ...d.basics, accidentCity: v, courtJurisdiction: court } }))
    } else {
      setData((d) => ({ ...d, basics: { ...d.basics, accidentCity: v } }))
    }
  }

  // v0.14.x：從雲端歷史載入舊案件（?load=true → 讀 sessionStorage）
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.location.search.includes('load=true')) return
    void (async () => {
      const loaded = await consumeForLoad()
      if (!loaded) return
      // 把 ClaimInput 拆到 form data
      const next = {
        basics: { ...DEFAULT_BASICS, ...loaded.basics },
        fault: { ...DEFAULT_FAULT, ...loaded.fault },
        person: { ...DEFAULT_PERSON, ...loaded.person },
        medical: { ...DEFAULT_MEDICAL, ...loaded.medical },
        receipts: { ...DEFAULT_RECEIPTS, ...(loaded.medicalReceipts ?? {}) },
        property: { ...DEFAULT_PROPERTY, ...(loaded.property ?? {}) },
      }
      setData(next as FormSchema)
      // AntD Form 也填入
      form.setFieldsValue(next as any)
      // 顯示成功提示
      message.success('已從歷史載入，請確認或修改後送出')
      // 移除 ?load=true 避免重複載入
      window.history.replaceState({}, '', '/claims/new')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  const next = async () => {
    try {
      const values = await form.validateFields()
      // 淺合併當下 step 對應區段
      const merged = mergeStep(data, current, values)
      setData(merged)
      setCurrent((c) => c + 1)
    } catch {
      message.error('請填寫必填欄位')
    }
  }

  const prev = () => setCurrent((c) => c - 1)

  const submit = async () => {
    try {
      const values = await form.validateFields()
      const merged = mergeStep(data, current, values)
      setData(merged)
      // 計算結果
      const input: ClaimInput = {
        basics: merged.basics,
        fault: merged.fault,
        person: merged.person,
        medical: merged.medical,
        medicalReceipts: merged.receipts,
        property: merged.property,
      }
      const result = estimateClaim(input)
      // 存進 sessionStorage 給結果頁讀
      sessionStorage.setItem('claim-input', JSON.stringify(input))
      sessionStorage.setItem('claim-result', JSON.stringify(result))
      router.push('/claims/result')
    } catch (e) {
      message.error('請填寫完整資料')
    }
  }

  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col items-center px-6 py-8 bg-surface-subtle"
    >
      <div className="w-full max-w-3xl">
        <Title level={2} className="!mb-2">
          <FileAddOutlined className="mr-2" />
          新增理賠估算
        </Title>
        <Paragraph type="secondary" className="!mb-6">
          請逐步填寫，<Text strong>必填欄位</Text>以 <Text type="danger">*</Text> 標示；
          資料不足會在結果頁自動列出補件清單。
        </Paragraph>

        <FormProgress current={current} steps={STEPS} className="!mb-8" />

        <Form
          form={form}
          layout="vertical"
          initialValues={data}
          onValuesChange={(_, all) => setData((d) => ({ ...d, ...all }))}
        >
          {/* ====== Step 1：事故基本 ====== */}
          {current === 0 && (
            <Step1Basics
              form={form}
              onCityChange={handleCityChange}
              cityOptions={CITY_OPTIONS.map((v) => ({ value: v, label: v }))}
              accidentTypeOptions={ACCIDENT_TYPE_OPTIONS}
              injuredRoleOptions={INJURED_ROLE_OPTIONS}
            />
          )}
          {/* ====== Step 2：肇責 ====== */}
          {current === 1 && <Step2Fault form={form} faultSourceOptions={FAULT_SOURCE_OPTIONS} />}
          {/* ====== Step 3：人身 / 工作 ====== */}
          {current === 2 && <Step3Person form={form} />}
          {/* ====== Step 4：診斷書 ====== */}
          {current === 3 && <Step4Medical form={form} />}
          {/* ====== Step 5：醫療收據 ====== */}
          {current === 4 && <Step5Receipts form={form} />}
          {/* ====== Step 6：車損 / 財損 ====== */}
          {current === 5 && <Step6Property form={form} />}
          {/* ====== Step 7：地區 / 法院 ====== */}
          {current === 6 && (
            <Step7Region form={form} courtJurisdiction={data.basics.courtJurisdiction} />
          )}
        </Form>

        {/* v0.8.1+：手機 sticky CTA（桌機保留原本 flex 排版） */}
        <MobileStickyCTA
          left={
            <Button block disabled={current === 0} onClick={prev} icon={<LeftOutlined />}>
              上一步
            </Button>
          }
          right={
            current < STEPS.length - 1 ? (
              <Button
                block
                type="primary"
                onClick={next}
                icon={<RightOutlined />}
                iconPlacement="end"
              >
                下一步
              </Button>
            ) : (
              <Button block type="primary" onClick={submit} icon={<CheckCircleOutlined />}>
                送出並估算
              </Button>
            )
          }
        />
      </div>
    </main>
  )
}

// ============== 淺合併工具 ==============
function mergeStep(prev: FormSchema, step: number, values: Partial<FormSchema>): FormSchema {
  const STEP_KEYS = ['basics', 'fault', 'person', 'medical', 'receipts', 'property'] as const
  const stepKey = STEP_KEYS[step] ?? 'basics'
  const prevSection = prev[stepKey]
  const newSection = values[stepKey]
  return {
    ...prev,
    [stepKey]: {
      ...(prevSection as object),
      ...(newSection as object),
    },
  } as FormSchema
}

// ============== Step 1：事故基本 ==============
// ============== Step 2：肇責 ==============
// ============== Step 3：人身 / 工作 ==============
function Step3Person({ form }: { form: ReturnType<typeof Form.useForm<FormSchema>>[0] }) {
  // v0.5.3 bugfix: birthDate DatePicker 也會踩 rc-picker getUDayjs('') isValid 炸
  // 跟 Step1 一樣：mount 時若不是 dayjs 物件就塞 dayjs()（空字串轉 dayjs()，user 選完 onChange 會再轉回字串）
  useEffect(() => {
    const cur = form.getFieldValue(['person', 'birthDate'])
    if (!cur || typeof cur === 'string') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      form.setFieldsValue({ person: { birthDate: dayjs() } } as any)
    }
  }, [form])
  return (
    <Card
      title={
        <>
          <UserOutlined className="mr-2" />
          受害人身分與工作
        </>
      }
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
            <Input placeholder="例：工程師" autoComplete="organization-title" enterKeyHint="next" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item
        label="受僱類型 *"
        name={['person', 'employmentType']}
        rules={[{ required: true }]}
      >
        <Select options={EMPLOYMENT_OPTIONS} />
      </Form.Item>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            label="事故前 6 月平均月薪（元）"
            name={['person', 'sixMonthAverageSalary']}
            // v0.12.0+ Phase A3：月薪證明影響工作損失計算
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
          <Form.Item label="財產清單" name={['person', 'hasPropertyList']} valuePropName="checked">
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
  )
}

// ============== Step 4：診斷書 ==============
function Step4Medical({ form }: { form: ReturnType<typeof Form.useForm<FormSchema>>[0] }) {
  const jointName = Form.useWatch(['medical', 'jointName'], form) as JointName | null
  // v0.7.6+：KNN 即時預視 — 監聽失能等級 + 事故地點
  const disabilityLevelForKnn = Form.useWatch(['medical', 'disabilityLevel'], form) as
    number | undefined
  const accidentLocationForKnn = Form.useWatch(['basics', 'accidentLocation'], form) as
    string | undefined
  // v0.5.3 bugfix: emergencyDate DatePicker 跟 birthDate 同症狀 — 收到空字串炸
  useEffect(() => {
    const cur = form.getFieldValue(['medical', 'emergencyDate'])
    if (!cur || typeof cur === 'string') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      form.setFieldsValue({ medical: { emergencyDate: dayjs() } } as any)
    }
  }, [form])
  return (
    <Card
      title={
        <>
          <MedicineBoxOutlined className="mr-2" />
          診斷書 / 傷勢資料
        </>
      }
    >
      <Row gutter={16}>
        <Col xs={24}>
          <Form.Item label="診斷說明（自由填）" name={['medical', 'diagnosisText']}>
            <Input.TextArea rows={3} placeholder="例：右側脛骨骨折、右膝挫傷" />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="醫院名稱" name={['medical', 'hospitalName']}>
            <Input placeholder="例：中國醫藥大學附設醫院" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
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
      </Row>
      <Row gutter={16}>
        <Col xs={12} md={6}>
          <Form.Item label="門診次數" name={['medical', 'outpatientVisitCount']}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item label="住院天數" name={['medical', 'hospitalizationDays']}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item label="手術" name={['medical', 'hasSurgery']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item label="症狀固定" name={['medical', 'isSymptomFixed']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={12} md={6}>
          <Form.Item label="復健" name={['medical', 'hasRehabilitation']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item label="復健次數" name={['medical', 'rehabilitationCount']}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item
            label="需看護"
            name={['medical', 'requiresNursingCare']}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          {/* v0.12.0+ Phase B1：看護日數加 30 日硬上限驗證（強制險 §2.4） */}
          <Form.Item
            label="看護日數"
            name={['medical', 'nursingDays']}
            rules={[
              {
                type: 'number',
                max: 30,
                message: '強制險看護每日 1,200 元 × 上限 30 日 = 36,000 元',
              },
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={0} max={30} />
          </Form.Item>
        </Col>
      </Row>
      <Title level={5} className="!mt-2">
        傷勢細節（失能規則引擎用）
      </Title>
      <Row gutter={16}>
        <Col xs={8} md={4}>
          <Form.Item label="骨折" name={['medical', 'hasFracture']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={8} md={4}>
          <Form.Item label="脫臼" name={['medical', 'hasDislocation']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={8} md={4}>
          <Form.Item label="韌帶傷" name={['medical', 'hasLigamentInjury']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={8} md={4}>
          <Form.Item label="神經傷" name={['medical', 'hasNerveDamage']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={8} md={4}>
          <Form.Item label="截肢" name={['medical', 'hasAmputation']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={8} md={4}>
          <Form.Item label="器官損傷" name={['medical', 'hasOrganDamage']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={12} md={6}>
          <Form.Item
            label="失能鑑定"
            name={['medical', 'hasDisabilityCertificate']}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item
            label="甲種診斷書"
            name={['medical', 'hasClassADiagnosisCertificate']}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item
            label="永久性障害"
            name={['medical', 'hasPermanentImpairment']}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item label="疤痕" name={['medical', 'hasScar']} valuePropName="checked">
            <Switch />
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
              placeholder="未選 / 無失能"
              options={DISABILITY_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
              onChange={(v: DisabilityCategory | null) => {
                if (v) {
                  const defaultLvl = getDefaultLevel(v)
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
            label="失能等級（1=最重 / 15=最輕）"
            name={['medical', 'disabilityLevel']}
            // v0.12.0+ Phase A3：失能等級是初篩，真實等級由醫院失能診斷書認定
            tooltip={{
              title:
                '失能等級須由醫院開立「失能診斷書」並經保險公司 / 評議 / 法院認定，本欄為初步篩選用途。',
              icon: <InfoCircleOutlined />,
            }}
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
      <DisabilityCategoryHint />
      <Title level={5} className="!mt-2">
        疤痕 / 除疤術式
      </Title>
      <Row gutter={16}>
        <Col xs={12} md={6}>
          <Form.Item label="疤痕長度 (cm)" name={['medical', 'scarLengthCm']}>
            <InputNumber style={{ width: '100%' }} min={0} step={0.5} />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item label="疤痕面積 (cm²)" name={['medical', 'scarAreaCm2']}>
            <InputNumber style={{ width: '100%' }} min={0} step={1} placeholder="雷射用" />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item label="疤痕位置" name={['medical', 'scarLocation']}>
            <Input placeholder="例：右前額" />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item label="嚴重度" name={['medical', 'scarSeverity']}>
            <Select allowClear placeholder="未評估" options={SCAR_SEVERITY_OPTIONS} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            label="採用術式（4 選 1）"
            name={['medical', 'scarProcedure']}
            extra={(() => {
              const proc = form.getFieldValue(['medical', 'scarProcedure']) as string | undefined
              if (!proc)
                return (
                  <span style={{ color: '#999' }}>未選 → 預設雷射。蟹足腫自動改走注射治療</span>
                )
              const opt = SCAR_PROCEDURE_OPTIONS.find((o) => o.value === proc)
              return <span style={{ color: 'var(--data-info, #1677ff)' }}>{opt?.hint}</span>
            })()}
          >
            <Select
              allowClear
              placeholder="未選 / 預設雷射"
              options={SCAR_PROCEDURE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item label="醫囑療程次數" name={['medical', 'prescribedSessions']}>
            <InputNumber style={{ width: '100%' }} min={0} step={1} placeholder="未填用預設" />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item label="是否蟹足腫" name={['medical', 'isKeloid']} valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        </Col>
      </Row>

      <Title level={5} className="!mt-2">
        關節活動度（關節角度喪失只進失能初篩，不直判失能）
      </Title>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item label="受影響關節" name={['medical', 'jointName']}>
            <Select
              allowClear
              placeholder="無 / 未填"
              options={JOINT_OPTIONS}
              onChange={(v: JointName | null) => {
                if (v) {
                  form.setFieldValue(['medical', 'romNormalDegree'], ROM_NORMAL[v])
                } else {
                  form.setFieldValue(['medical', 'romNormalDegree'], 0)
                }
              }}
            />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item
            label="有受限"
            name={['medical', 'hasRangeOfMotionLimitation']}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item
            label="角度喪失 (度)"
            name={['medical', 'romLossDegree']}
            // v0.12.0+ Phase A3：ROM 角度喪失量測方式
            tooltip={{
              title:
                '關節活動度（ROM）由醫院量測或自行估計。填「正常活動度 − 現在能動到的最大角度」。0° 表示完全沒受限；填越大表示受限越嚴重。',
              icon: <InfoCircleOutlined />,
            }}
          >
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item label="正常活動度 (度)" name={['medical', 'romNormalDegree']}>
            <InputNumber style={{ width: '100%' }} min={0} disabled />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={12} md={8}>
          <Form.Item
            label="肌力減退"
            name={['medical', 'hasMuscleWeakness']}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={12} md={8}>
          <Form.Item label="感覺喪失" name={['medical', 'hasSensoryLoss']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
      </Row>
      {jointName && (
        <InfoAlert
          type="info"
          showIcon
          className="!mt-2"
          title={`已選關節：${JOINT_OPTIONS.find((o) => o.value === jointName)?.label ?? jointName}（正常活動度 ${ROM_NORMAL[jointName]} 度）`}
        />
      )}
      {/* v0.7.6+：KNN 即時預視 — 填失能等級時邊看相似判例 */}
      <Step4KnnPreview
        disabilityLevel={disabilityLevelForKnn}
        accidentLocation={accidentLocationForKnn}
      />
    </Card>
  )
}

// ============== Step 5：醫療收據 ==============
function Step5Receipts({ form }: { form: ReturnType<typeof Form.useForm<FormSchema>>[0] }) {
  // v0.2.5+：22 欄位塞一張 Card 但分 4 Section — 救人/住院/義肢/特殊材料
  // 對應強制汽車責任保險給付標準 §2 第 1-3 項（醫療給付 15 細項）
  // 不在強制險範圍：精神慰撫金 / 工作損失 / 車損（這 3 項走第三人責任險）
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

// ============== Step 6：車損 / 財損 ==============
function Step6Property({ form }: { form: ReturnType<typeof Form.useForm<FormSchema>>[0] }) {
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

// ============== Step 7：地區 / 法院 ==============

// ============== 失能保典 12 大類 sub-component ==============

/** 即時顯示「失能等級 → 勞減比例」對照（依 DISABILITY_LABOR_LOSS_PCT 公式） */
function DisabilityLevelTag() {
  const form = Form.useFormInstance<FormSchema>()
  const level = Form.useWatch(['medical', 'disabilityLevel'], form) as
    DisabilityLevelValue | undefined
  if (!level) return <Tag>未選</Tag>
  const pct = DISABILITY_LABOR_LOSS_PCT[level] ?? 0
  const color = level <= 3 ? 'red' : level <= 7 ? 'orange' : level <= 11 ? 'gold' : 'default'
  return (
    <Tag color={color}>
      {level} 等 / 勞減 {pct}%
    </Tag>
  )
}

/** 即時顯示「12 大類」相關警示（黃底強制險排除 / 心理衡鑑） */
function DisabilityCategoryHint() {
  const form = Form.useFormInstance<FormSchema>()
  const cat = Form.useWatch(['medical', 'disabilityCategory'], form) as
    DisabilityCategory | undefined
  if (!cat) return null
  if (isCompulsoryExclusion(cat)) {
    return (
      <InfoAlert
        type="error"
        showIcon
        className="!mt-2"
        title="此類別部分項目強制險不給付（失能保典黃底）"
        body="如胸腹部臟器之器官移植（7-10 等）。強制險不給付的失能，建議改走第三人責任險 + 民事慰撫金。"
      />
    )
  }
  if (needsMMSE(cat)) {
    return (
      <InfoAlert
        type="info"
        showIcon
        className="!mt-2"
        title="精神/神經類失能須附心理衡鑑報告"
        body="失能保典 p.16-17：精神失能須 1-2 年治療期 + MMSE / WAIS / CDR 等最近 3 個月評估；憂鬱症須三線以上抗憂鬱藥物治療證明。"
      />
    )
  }
  return null
}
