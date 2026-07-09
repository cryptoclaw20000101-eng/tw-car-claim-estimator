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
import { Step3Person } from './_steps/Step3Person'
import { Step4Medical } from './_steps/Step4Medical'
import { Step5Receipts } from './_steps/Step5Receipts'
import { Step6Property } from './_steps/Step6Property'
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
    } as Record<string, unknown>)
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
      form.setFieldsValue(next as unknown as Record<string, unknown>)
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
          {current === 2 && <Step3Person form={form} employmentOptions={EMPLOYMENT_OPTIONS} />}
          {/* ====== Step 4：診斷書 ====== */}
          {current === 3 && (
            <Step4Medical form={form} accidentLocationForKnn={data.basics.accidentLocation} />
          )}
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

// ============== Step 4：診斷書 ==============

// ============== Step 5：醫療收據 ==============

// ============== Step 6：車損 / 財損 ==============
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
