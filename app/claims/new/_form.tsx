'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation';
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
  specialMaterialFee: 0,        // v0.2.5+：特殊材料費（骨材/鋼板/特材），與輔具共套 2 萬上限
  medicalMaterialFee: 0,        // v0.2.5+：一般醫材（紗布/縫線），不再套 2 萬上限（向後相容）
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
  '臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市',
  '基隆市', '新竹市', '新竹縣', '苗栗縣', '彰化縣', '南投縣',
  '雲林縣', '嘉義市', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣',
  '臺東縣', '澎湖縣', '金門縣', '連江縣',
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
  shoulder: 180, elbow: 150, wrist: 150, hip: 130,
  knee: 135, ankle: 70, finger: 90, toe: 50,
  cervical: 60, lumbar: 60,
}

const SCAR_SEVERITY_OPTIONS: { value: 'mild' | 'moderate' | 'severe' | 'keloid'; label: string }[] = [
  { value: 'mild', label: '輕度（淺疤、不影響外觀）' },
  { value: 'moderate', label: '中度（明顯疤痕，可能需 1 次雷射）' },
  { value: 'severe', label: '嚴重（肥厚性 / 大面積 / 攣縮）' },
  { value: 'keloid', label: '蟹足腫（會持續長大）' },
]

const SCAR_PROCEDURE_OPTIONS: { value: 'laser' | 'revision_surgery' | 'facelift' | 'injection'; label: string; hint: string }[] = [
  { value: 'laser', label: '雷射（染料 / CO2 / 飛梭）', hint: '紅寶石雷射 3-5 次療程；基本費 + 每 cm²' },
  { value: 'revision_surgery', label: '修疤手術（Z 形整形 / W 形整形）', hint: '外科切除，每公分 3,000-10,000 元' },
  { value: 'facelift', label: '拉皮手術（全臉 / 腹部）', hint: '大面積疤痕或合併臉部鬆弛；20-40 萬' },
  { value: 'injection', label: '注射治療（蟹足腫 / PRP）', hint: '蟹足腫注射 + 血小板生長因子（中地院 110 簡 202 判例 80 萬）' },
]

// ============== 表單 Schema ==============

interface FormSchema {
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

  // v0.5.1 bugfix: DatePicker 收到字串會觸發 rc-picker 的 getUDayjs(value).isValid()
  // 但 dayjs.js 對字串直接 return value，導致 '2026-06-18'.isValid() 炸
  // 解法: mount 後用 dayjs() 物件 setFieldsValue 注入，不要用 initialValues 字串
  useEffect(() => {
    // dayjs 物件強轉: Form schema 的 accidentDate 是 string，但 DatePicker 需要 dayjs
    // v0.5.1: 這裡先塞 dayjs，user 選完日期 onChange 會再轉回字串
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form.setFieldsValue({ basics: { accidentDate: dayjs() } } as any)
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
    <main className="flex flex-1 flex-col items-center px-6 py-8 bg-surface-subtle">
      <div className="w-full max-w-3xl">
        <Title level={2} className="!mb-2">
          <FileAddOutlined className="mr-2" />
          新增理賠估算
        </Title>
        <Paragraph type="secondary" className="!mb-6">
          請逐步填寫，<Text strong>必填欄位</Text>以 <Text type="danger">*</Text> 標示；
          資料不足會在結果頁自動列出補件清單。
        </Paragraph>

        <Steps current={current} items={STEPS} className="!mb-8" responsive={false} />

        <Form
          form={form}
          layout="vertical"
          initialValues={data}
          onValuesChange={(_, all) => setData((d) => ({ ...d, ...all }))}
        >
          {/* ====== Step 1：事故基本 ====== */}
          {current === 0 && <Step1Basics form={form} onCityChange={handleCityChange} />}
          {/* ====== Step 2：肇責 ====== */}
          {current === 1 && <Step2Fault form={form} />}
          {/* ====== Step 3：人身 / 工作 ====== */}
          {current === 2 && <Step3Person form={form} />}
          {/* ====== Step 4：診斷書 ====== */}
          {current === 3 && <Step4Medical form={form} />}
          {/* ====== Step 5：醫療收據 ====== */}
          {current === 4 && <Step5Receipts form={form} />}
          {/* ====== Step 6：車損 / 財損 ====== */}
          {current === 5 && <Step6Property form={form} />}
          {/* ====== Step 7：地區 / 法院 ====== */}
          {current === 6 && <Step7Region form={form} />}
        </Form>

        <div className="!mt-6 flex justify-between">
          <Button disabled={current === 0} onClick={prev} icon={<LeftOutlined />}>
            上一步
          </Button>
          {current < STEPS.length - 1 ? (
            <Button type="primary" onClick={next} icon={<RightOutlined />} iconPlacement="end">
              下一步
            </Button>
          ) : (
            <Button type="primary" onClick={submit} icon={<CheckCircleOutlined />}>
              送出並估算
            </Button>
          )}
        </div>
      </div>
    </main>
  )
}

// ============== 淺合併工具 ==============
function mergeStep(prev: FormSchema, step: number, values: Partial<FormSchema>): FormSchema {
  const stepKey = (['basics','fault','person','medical','receipts','property'] as const)[step]
  return { ...prev, [stepKey]: { ...prev[stepKey], ...(values[stepKey] as object) } }
}

// ============== Step 1：事故基本 ==============
function Step1Basics({ form, onCityChange }: { form: ReturnType<typeof Form.useForm<FormSchema>>[0]; onCityChange: (v: string) => void }) {
  // v0.5.1 bugfix: DatePicker 在 Form.Item 控制下不能同時用 defaultValue（會跳 .isValid）
  // 改用 setFieldsValue 在 client 端注入 dayjs() 物件，避免 SSR 字串傳遞炸 picker
  // （父層 useEffect 已處理，這裡保留當 fallback: 若父層 setFieldsValue 沒生效就補上）
  useEffect(() => {
    const cur = form.getFieldValue(['basics', 'accidentDate'])
    if (!cur) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      form.setFieldsValue({ basics: { accidentDate: dayjs() } } as any)
    }
  }, [form])
  return (
    <Card title={<><CarOutlined className="mr-2" />事故基本資料</>}>
      <InfoAlert
        type="info"
        showIcon
        className="!mb-4"
        title="強制險採無過失主義，肇責比例只會影響第三人責任險的估算。"
      />
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="事故日期 *" name={['basics', 'accidentDate']} rules={[{ required: true }]}>
            <DatePicker
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              onChange={(d: Dayjs | null) => {
                form.setFieldValue(['basics', 'accidentDate'], d?.format('YYYY-MM-DD') ?? '')
              }}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="事故地點 *" name={['basics', 'accidentLocation']} rules={[{ required: true }]}>
            <Input placeholder="例：臺中市西區美村路與五權路口" />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="事故類型 *" name={['basics', 'accidentType']} rules={[{ required: true }]}>
            <Select options={ACCIDENT_TYPE_OPTIONS} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="受害人身分 *" name={['basics', 'injuredRole']} rules={[{ required: true }]}>
            <Select options={INJURED_ROLE_OPTIONS} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item label="是否為汽車交通事故 *" name={['basics', 'isAutomobileAccident']} valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item label="警方初步研判表" name={['basics', 'hasPolicePreliminaryReport']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item label="車輛事故鑑定" name={['basics', 'hasAccidentAppraisal']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item label="有強制險 *" name={['basics', 'hasCompulsoryInsurance']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
      </Row>

      {/* v0.5.2: 拿掉「有第三人責任險」「已和解」+ 3 個保額欄位（永遠當有第三人險、無保額上限） */}

      <Title level={5} className="!mt-4">地區（自動帶入法院，可手改）</Title>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item label="事故縣市" name={['basics', 'accidentCity']}>
            <Select
              options={CITY_OPTIONS.map((v) => ({ value: v, label: v }))}
              onChange={onCityChange}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item label="事故鄉鎮市區" name={['basics', 'accidentDistrict']}>
            <Input placeholder="例：西區" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item label="管轄法院" name={['basics', 'courtJurisdiction']}>
            <Input />
          </Form.Item>
        </Col>
      </Row>
    </Card>
  )
}

// ============== Step 2：肇責 ==============
function Step2Fault({ form }: { form: ReturnType<typeof Form.useForm<FormSchema>>[0] }) {
  const selfRatio = Form.useWatch(['fault', 'selfFaultRatio'], form) as number | undefined
  return (
    <Card title={<><AuditOutlined className="mr-2" />肇責比例</>}>
      <InfoAlert
        type="warning"
        showIcon
        className="!mb-4"
        title="強制險不乘肇責；第三人責任險的『有責金額』才會乘此比例。"
      />
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="己方肇責 (%) *" name={['fault', 'selfFaultRatio']} rules={[{ required: true }]}>
            <InputNumber
              style={{ width: '100%' }}
              min={0} max={100} step={5}
              onChange={(v) => {
                const n = Number(v) || 0
                form.setFieldValue(['fault', 'otherFaultRatio'], 100 - n)
              }}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="對方肇責 (%)" name={['fault', 'otherFaultRatio']}>
            <InputNumber style={{ width: '100%' }} min={0} max={100} disabled />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item label="肇責來源" name={['fault', 'faultSource']}>
        <Select options={FAULT_SOURCE_OPTIONS} />
      </Form.Item>
      <Form.Item label="肇責仍有爭議" name={['fault', 'isFaultDisputed']} valuePropName="checked">
        <Switch checkedChildren="是" unCheckedChildren="否" />
      </Form.Item>
      <Paragraph type="secondary" className="!text-sm">
        己方 {selfRatio ?? 0}% / 對方 {100 - (selfRatio ?? 0)}%
      </Paragraph>
    </Card>
  )
}

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
    <Card title={<><UserOutlined className="mr-2" />受害人身分與工作</>}>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item label="出生年月日" name={['person', 'birthDate']}>
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
            <Input placeholder="例：工程師" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item label="受僱類型 *" name={['person', 'employmentType']} rules={[{ required: true }]}>
        <Select options={EMPLOYMENT_OPTIONS} />
      </Form.Item>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="事故前 6 月平均月薪（元）" name={['person', 'sixMonthAverageSalary']}>
            <InputNumber style={{ width: '100%' }} min={0} step={1000} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="現職月薪（元）" name={['person', 'monthlySalary']}>
            <InputNumber style={{ width: '100%' }} min={0} step={1000} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item label="日薪（按件/日領者）" name={['person', 'dailyWage']}>
            <InputNumber style={{ width: '100%' }} min={0} step={500} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="去年報稅所得（元）" name={['person', 'lastYearTaxableIncome']}>
            <InputNumber style={{ width: '100%' }} min={0} step={10_000} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
          </Form.Item>
        </Col>
      </Row>
      <Title level={5} className="!mt-4">工作損失佐證</Title>
      <Row gutter={16}>
        <Col xs={12} md={6}><Form.Item label="財產清單" name={['person', 'hasPropertyList']} valuePropName="checked"><Switch /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item label="薪轉證明" name={['person', 'hasSalaryTransferRecord']} valuePropName="checked"><Switch /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item label="請假證明" name={['person', 'hasLeaveCertificate']} valuePropName="checked"><Switch /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item label="扣薪證明" name={['person', 'hasSalaryDeductionProof']} valuePropName="checked"><Switch /></Form.Item></Col>
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
  // v0.5.3 bugfix: emergencyDate DatePicker 跟 birthDate 同症狀 — 收到空字串炸
  useEffect(() => {
    const cur = form.getFieldValue(['medical', 'emergencyDate'])
    if (!cur || typeof cur === 'string') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      form.setFieldsValue({ medical: { emergencyDate: dayjs() } } as any)
    }
  }, [form])
  return (
    <Card title={<><MedicineBoxOutlined className="mr-2" />診斷書 / 傷勢資料</>}>
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
          <Form.Item label="急診日期" name={['medical', 'emergencyDate']}>
            <DatePicker
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              onChange={(d: Dayjs | null) => form.setFieldValue(['medical', 'emergencyDate'], d?.format('YYYY-MM-DD') ?? '')}
            />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={12} md={6}><Form.Item label="門診次數" name={['medical', 'outpatientVisitCount']}><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item label="住院天數" name={['medical', 'hospitalizationDays']}><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item label="手術" name={['medical', 'hasSurgery']} valuePropName="checked"><Switch /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item label="症狀固定" name={['medical', 'isSymptomFixed']} valuePropName="checked"><Switch /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col xs={12} md={6}><Form.Item label="復健" name={['medical', 'hasRehabilitation']} valuePropName="checked"><Switch /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item label="復健次數" name={['medical', 'rehabilitationCount']}><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item label="需看護" name={['medical', 'requiresNursingCare']} valuePropName="checked"><Switch /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item label="看護日數" name={['medical', 'nursingDays']}><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
      </Row>
      <Title level={5} className="!mt-2">傷勢細節（失能規則引擎用）</Title>
      <Row gutter={16}>
        <Col xs={8} md={4}><Form.Item label="骨折" name={['medical', 'hasFracture']} valuePropName="checked"><Switch /></Form.Item></Col>
        <Col xs={8} md={4}><Form.Item label="脫臼" name={['medical', 'hasDislocation']} valuePropName="checked"><Switch /></Form.Item></Col>
        <Col xs={8} md={4}><Form.Item label="韌帶傷" name={['medical', 'hasLigamentInjury']} valuePropName="checked"><Switch /></Form.Item></Col>
        <Col xs={8} md={4}><Form.Item label="神經傷" name={['medical', 'hasNerveDamage']} valuePropName="checked"><Switch /></Form.Item></Col>
        <Col xs={8} md={4}><Form.Item label="截肢" name={['medical', 'hasAmputation']} valuePropName="checked"><Switch /></Form.Item></Col>
        <Col xs={8} md={4}><Form.Item label="器官損傷" name={['medical', 'hasOrganDamage']} valuePropName="checked"><Switch /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col xs={12} md={6}><Form.Item label="失能鑑定" name={['medical', 'hasDisabilityCertificate']} valuePropName="checked"><Switch /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item label="甲種診斷書" name={['medical', 'hasClassADiagnosisCertificate']} valuePropName="checked"><Switch /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item label="永久性障害" name={['medical', 'hasPermanentImpairment']} valuePropName="checked"><Switch /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item label="疤痕" name={['medical', 'hasScar']} valuePropName="checked"><Switch /></Form.Item></Col>
      </Row>
      <Title level={5} className="!mt-4">失能部位與等級（失能保典 12 大類）</Title>
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
          <Form.Item label="失能等級（1=最重 / 15=最輕）" name={['medical', 'disabilityLevel']}>
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
      <Title level={5} className="!mt-2">疤痕 / 除疤術式</Title>
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
              if (!proc) return <span style={{ color: '#999' }}>未選 → 預設雷射。蟹足腫自動改走注射治療</span>
              const opt = SCAR_PROCEDURE_OPTIONS.find((o) => o.value === proc)
              return <span style={{ color: '#1677ff' }}>{opt?.hint}</span>
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

      <Title level={5} className="!mt-2">關節活動度（關節角度喪失只進失能初篩，不直判失能）</Title>
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
        <Col xs={12} md={4}><Form.Item label="有受限" name={['medical', 'hasRangeOfMotionLimitation']} valuePropName="checked"><Switch /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item label="角度喪失 (度)" name={['medical', 'romLossDegree']}><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item label="正常活動度 (度)" name={['medical', 'romNormalDegree']}><InputNumber style={{ width: '100%' }} min={0} disabled /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col xs={12} md={8}><Form.Item label="肌力減退" name={['medical', 'hasMuscleWeakness']} valuePropName="checked"><Switch /></Form.Item></Col>
        <Col xs={12} md={8}><Form.Item label="感覺喪失" name={['medical', 'hasSensoryLoss']} valuePropName="checked"><Switch /></Form.Item></Col>
      </Row>
      {jointName && (
        <InfoAlert
          type="info"
          showIcon
          className="!mt-2"
          title={`已選關節：${JOINT_OPTIONS.find((o) => o.value === jointName)?.label ?? jointName}（正常活動度 ${ROM_NORMAL[jointName]} 度）`}
        />
      )}
    </Card>
  )
}

// ============== Step 5：醫療收據 ==============
function Step5Receipts({ form }: { form: ReturnType<typeof Form.useForm<FormSchema>>[0] }) {
  // v0.2.5+：22 欄位塞一張 Card 但分 4 Section — 救人/住院/義肢/特殊材料
  // 對應強制汽車責任保險給付標準 §2 第 1-3 項（醫療給付 15 細項）
  // 不在強制險範圍：精神慰撫金 / 工作損失 / 車損（這 3 項走第三人責任險）
  return (
    <Card title={<><FileTextOutlined className="mr-2" />醫療收據（強制險 15 細項）</>}>
      <InfoAlert
        type="info"
        showIcon
        className="!mb-4"
        title="依強制汽車責任保險給付標準 §2 細項填寫；看護費有 1,200 元/日、30 日硬上限（會自動套用）。"
        body="本表單只收醫療相關；精神慰撫金 / 工作損失 / 車損請勿填入此處（法律強制不併入強制險，會在 Step 3 工作、Step 6 車損分開算）。"
      />
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
    </Card>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="!mb-4">
      <Title level={5} className="!mb-2">{title}</Title>
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
    <Card title={<><ToolOutlined className="mr-2" />車損 / 財損</>}>
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
      <Title level={5} className="!mt-4">其他財損</Title>
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
function Step7Region({ form }: { form: ReturnType<typeof Form.useForm<FormSchema>>[0] }) {
  // Step 1 已填過「事故縣市 → 自動帶入管轄法院」三件組
  // Step 7 只留「聲請人/對方居住地」（必要 → 影響法院管轄 + 強制險理賠窗口）
  // 並提供查看「管轄法院最終結果」唯讀確認區塊
  const courtJurisdiction = Form.useWatch(['basics', 'courtJurisdiction'], form) as string | undefined
  return (
    <Card title={<><EnvironmentOutlined className="mr-2" />居住地與管轄法院確認</>}>
      <InfoAlert
        type="info"
        showIcon
        className="!mb-4"
        title="Step 1 已帶入「事故地 → 管轄法院」，本步只補當事人居住地。"
        body="聲請人 / 對方居住地會送進第三人責任險估算（保險公司窗口歸屬）以及民事訴訟管轄參考。"
      />

      <Title level={5} className="!mt-2">當事人居住地（強制險/第三人責任險理賠窗口）</Title>
      <Row gutter={16}>
        <Col xs={24} md={12}><Form.Item label="聲請人居住縣市" name={['basics', 'claimantResidenceCity']}><Select options={CITY_OPTIONS.map((v) => ({ value: v, label: v }))} /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item label="聲請人居住鄉鎮" name={['basics', 'claimantResidenceDistrict']}><Input /></Form.Item></Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={12}><Form.Item label="對方居住縣市" name={['basics', 'defendantResidenceCity']}><Select options={CITY_OPTIONS.map((v) => ({ value: v, label: v }))} /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item label="對方居住鄉鎮" name={['basics', 'defendantResidenceDistrict']}><Input /></Form.Item></Col>
      </Row>

      <Divider className="!my-3" />
      <Title level={5}>管轄法院（依 Step 1 自動帶入，唯讀確認）</Title>
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
      <InfoAlert
        type="info"
        showIcon
        className="!mt-4"
        title="地區係數只影響第三人責任險／民事損害賠償估算；強制險本身是全國法定標準，不受地區影響。"
        body="若想更換管轄法院，請回 Step 1 改「事故縣市」自動重帶，或在「管轄法院」欄位上方取消唯讀（Step 1 路徑）。"
      />
    </Card>
  )
}

// ============== 失能保典 12 大類 sub-component ==============

/** 即時顯示「失能等級 → 勞減比例」對照（依 DISABILITY_LABOR_LOSS_PCT 公式） */
function DisabilityLevelTag() {
  const form = Form.useFormInstance<FormSchema>()
  const level = Form.useWatch(['medical', 'disabilityLevel'], form) as DisabilityLevelValue | undefined
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
  const cat = Form.useWatch(['medical', 'disabilityCategory'], form) as DisabilityCategory | undefined
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
