'use client'

/**
 * 5 步驟估算表單（v0.14.x — 1518 lines）
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

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { trackJourney } from '@/lib/journey-client'
import { Button, Form, message, Typography } from 'antd'
import { MobileStickyCTA } from '@/components/MobileStickyCTA'
// v0.12.0+ Phase B2：自製進度條
import { FormProgress } from '@/components/FormProgress'
// v0.15.x Phase 4 + v0.19.0：Step 元件抽出（7 → 4 步）
import { Step1Basics } from './_steps/Step1Basics'
import { Step2Fault } from './_steps/Step2Fault'
import { Step3PersonalWork } from './_steps/Step3PersonalWork'
// v0.20.0+：4 → 5 步重構；原 Step4Medical 拆成 Step4Diagnosis + Step5FeesAndProperty
import { Step4Diagnosis } from './_steps/Step4Diagnosis'
import { Step5FeesAndProperty } from './_steps/Step5FeesAndProperty'
import { ReviewSummary } from './_steps/ReviewSummary'
import { getClaimSteps, type ClaimStep } from './_flow'
import {
  LeftOutlined,
  RightOutlined,
  CheckCircleOutlined,
  FileAddOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type {
  AccidentBasics,
  AccidentType,
  ClaimInput,
  CompulsoryMedicalInputs,
  EmploymentType,
  FaultInfo,
  FaultSource,
  InjuredRole,
  MedicalRecord,
  PersonalIncome,
  PropertyDamageInputs,
} from '@/lib/insurance/types'
import { regionCourtMap } from '@/lib/insurance/region-court-map'
import { estimateClaim } from '@/lib/insurance'
// v0.14.x：載入舊案件
import { consumeForLoad } from '@/lib/estimate-loader'
import {} from '@/lib/insurance/disability-categories'

// 表單頁必須在 client runtime render（AntD Form useWatch / validateFields 依賴 client context）

const { Title, Paragraph } = Typography

// ============== 預設值 ==============

const today = () => dayjs().format('YYYY-MM-DD')

const DEFAULT_BASICS: AccidentBasics = {
  accidentDate: today(),
  accidentLocation: '',
  accidentType: 'car_to_car',
  injuredRole: 'driver_car',
  isInjured: true, // v0.26.0e+：預設有受傷（沿用既有行為），form 必填
  isAutomobileAccident: true,
  hasPolicePreliminaryReport: false,
  hasAccidentAppraisal: false,
  hasCompulsoryInsurance: true,
  thirdPartyCoverageStatus: 'unknown',
  thirdPartyBodilyLimit: null,
  thirdPartyPropertyLimit: null,
  excessLiabilityLimit: null,
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
  faultSource: 'unclear',
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
  additionalDisabilityLevels: [],
  disabilityTableItemIds: [],
  preExistingDisabilityLevel: undefined,
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
  medicalRecordSummaryFee: 0,
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
  // v0.24.0+：折舊計算欄位（optional）
  vehicleManufactureYear: null,
  vehicleDepreciationYears: null,
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
  { value: 'unclear', label: '尚未確認（先用假設比例試算）' },
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

// v0.20.0+：表單 7 步 → 5 步重構（user 反饋「最後一步負擔過大」）
// - Step 1：事故基本（日期/地點/類型）
// - Step 2：肇責（己方/對方 + 來源）
// - Step 3：人身 / 工作（合併原 Step3 人身 + Step7 聲請人/對方居住地 + 法院）
// - Step 4：傷勢與診斷（原 Step4 失能保典 12 大類 + 傷勢細節）
// - Step 5：費用與財損（原 Step5 醫療收據 + Step6 車損；可展開區塊）
const STEPS = {
  0: { title: '事故與肇責' },
  2: { title: '工作與收入' },
  3: { title: '傷勢與治療' },
  4: { title: '費用與核對' },
}
const STEP_NAMES = ['basics', 'fault', 'person', 'diagnosis', 'expenses'] as const

// ============== 主元件 ==============

/** v0.18.x+ 預設 FormSchema（用於 draft 還原失敗時 fallback） */
function getDefaultFormSchema(): FormSchema {
  return {
    basics: { ...DEFAULT_BASICS, accidentDate: '' as unknown as string },
    fault: structuredClone(DEFAULT_FAULT),
    person: structuredClone(DEFAULT_PERSON),
    medical: structuredClone(DEFAULT_MEDICAL),
    receipts: structuredClone(DEFAULT_RECEIPTS),
    property: structuredClone(DEFAULT_PROPERTY),
  }
}

/** Old drafts may lack sections introduced later. Never hydrate from untrusted storage. */
export function restoreClaimDraft(raw: string | null, now = Date.now()): FormSchema {
  const defaults = getDefaultFormSchema()
  try {
    const draft = raw ? JSON.parse(raw) : null
    if (
      !draft ||
      !Number.isFinite(draft.ts) ||
      draft.ts > now ||
      now - draft.ts >= 7 * 86400000 ||
      !draft.data ||
      typeof draft.data !== 'object' ||
      Array.isArray(draft.data)
    )
      return defaults
    for (const key of Object.keys(defaults) as (keyof FormSchema)[]) {
      const section = draft.data[key]
      if (section && typeof section === 'object' && !Array.isArray(section)) {
        Object.assign(defaults[key], section)
      }
    }
    defaults.medical.nursingDays =
      defaults.medical.nursingDays || defaults.receipts.nursingDays || 0
    defaults.receipts.nursingDays = defaults.medical.nursingDays
    return defaults
  } catch {
    return defaults
  }
}

export default function NewClaimForm() {
  const router = useRouter()
  const [current, setCurrent] = useState<ClaimStep>(0)
  const [form] = Form.useForm<FormSchema & { _reviewConfirmed?: boolean }>()
  // v0.27.2+：Form.useWatch 必須在 component 頂層呼叫（React Rules of Hooks）
  // 用於 Step5FeesAndProperty 即時讀 isInjured 來切換 registrationFee 必填
  // Step 1 會卸載；仍需保留此欄位，才能正確維持三步流程與費用欄位。
  const isInjured = Form.useWatch(['basics', 'isInjured'], { form, preserve: true })
  const activeSteps = getClaimSteps(isInjured)
  useEffect(() => {
    trackJourney('form_started')
    trackJourney('step_viewed', STEP_NAMES[current])
  }, [current])
  const DRAFT_KEY = 'tw-claim-form-draft'
  const [data, setData] = useState<FormSchema>(getDefaultFormSchema)
  const [draftReady, setDraftReady] = useState(false)
  useEffect(() => {
    // Restore after hydration, and before autosaving, so defaults never overwrite a draft.
    const loadingHistory = new URLSearchParams(window.location.search).get('load') === 'true'
    const timer = setTimeout(() => {
      const loaded = loadingHistory ? consumeForLoad() : null
      let raw: string | null = null
      try {
        raw = localStorage.getItem(DRAFT_KEY)
      } catch {
        /* optional storage */
      }
      const restored = loaded
        ? restoreClaimDraft(
            JSON.stringify({
              ts: Date.now(),
              data: { ...loaded, receipts: loaded.medicalReceipts },
            }),
          )
        : restoreClaimDraft(raw)
      setData(restored)
      form.setFieldsValue({
        ...restored,
        basics: { ...restored.basics, accidentDate: restored.basics.accidentDate || dayjs() },
        medical: { ...restored.medical, emergencyDate: restored.medical.emergencyDate || dayjs() },
      } as unknown as Record<string, unknown>)
      setDraftReady(true)
      if (loaded) message.success('已載入本次案件，請核對後重新試算')
      if (loadingHistory) window.history.replaceState(window.history.state, '', '/claims/new')
    }, 0)
    return () => clearTimeout(timer)
  }, [form])

  // 儲存小型草稿不延遲，避免輸入後立即重載／離開時遺失最後一次修改。
  useEffect(() => {
    if (!draftReady) return
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ts: Date.now(), data }))
    } catch {
      // localStorage quota 超限 / 隱私模式 → 靜默 fail
    }
  }, [data, draftReady])

  // v0.6.4 bugfix: DatePicker 在 Form.Item 控制下，validateFields() 會跑所有 Step 的欄位
  // 即便當前 Step 沒 mount（conditional render），Form store 仍存字串/空字串 → rc-picker
  // 內部 getUDayjs('1990-01-01').isValid() 炸（v0.5.1/v0.5.3 只在子 Step useEffect 補救，跨 Step 不夠）
  // 解法：父層 mount 時一次把所有日期欄位注入 dayjs()，不受 conditional render 影響
  // v0.20.0+：只在欄位為空時注入 dayjs()，避免覆蓋 draft 還原的舊值
  useEffect(() => {
    const current = form.getFieldsValue() as Partial<FormSchema>
    const patch: Record<string, unknown> = {}
    if (!current.basics?.accidentDate) {
      patch.basics = { ...current.basics, accidentDate: dayjs() }
    }
    if (!current.medical?.emergencyDate) {
      patch.medical = { ...current.medical, emergencyDate: dayjs() }
    }
    if (Object.keys(patch).length > 0) {
      form.setFieldsValue(patch as Record<string, unknown>)
    }
  }, [form])

  // 監聽 basics.accidentCity 自動帶入 courtJurisdiction
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
      await form.validateFields()
      const values = form.getFieldsValue(true) as FormSchema
      // 淺合併當下 step 對應區段
      const merged =
        current === 0
          ? mergeStep(mergeStep(data, 0, values), 1, values)
          : mergeStep(data, current, values)
      setData(merged)
      trackJourney('step_completed', STEP_NAMES[current])
      const steps = getClaimSteps(merged.basics.isInjured)
      setCurrent(steps[steps.indexOf(current) + 1] ?? 4)
    } catch {
      trackJourney('validation_failed', STEP_NAMES[current])
      message.error('請填寫必填欄位')
    }
  }

  const prev = () => setCurrent(activeSteps[Math.max(0, activeSteps.indexOf(current) - 1)])

  const submit = async () => {
    try {
      await form.validateFields()
      const values = form.getFieldsValue(true) as FormSchema
      const merged =
        current === 0
          ? mergeStep(mergeStep(data, 0, values), 1, values)
          : mergeStep(data, current, values)
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
      // 估算編號：在 submit 時一次性產生，存進 sessionStorage 給結果頁讀
      // 不在 render 時算（避免切精簡模式 / 狀態變更導致 ID 變動）
      const estimateIdS = JSON.stringify(input) + Date.now()
      let estimateH = 5381
      for (let i = 0; i < estimateIdS.length; i++)
        estimateH = ((estimateH << 5) + estimateH + estimateIdS.charCodeAt(i)) | 0
      const estimateTs = new Date()
      const estimateStamp = `${estimateTs.getFullYear()}${String(estimateTs.getMonth() + 1).padStart(2, '0')}${String(estimateTs.getDate()).padStart(2, '0')}`
      const estimateId = `TCE-${estimateStamp}-${(estimateH >>> 0).toString(16).padStart(8, '0').slice(0, 8).toUpperCase()}`
      // 存進 sessionStorage 給結果頁讀
      sessionStorage.setItem('claim-input', JSON.stringify(input))
      sessionStorage.setItem('claim-result', JSON.stringify(result))
      sessionStorage.setItem('estimate-id', estimateId)
      sessionStorage.setItem('claim-storage-version', 'v2') // v0.18.x+ 防舊版殘留
      sessionStorage.setItem('claim-storage-ts', String(Date.now())) // 過期檢查用
      trackJourney('step_completed', 'expenses')
      trackJourney('estimate_completed')
      router.push('/claims/result')
    } catch {
      trackJourney('validation_failed', STEP_NAMES[current])
      message.error('請填寫完整資料')
    }
  }

  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col items-center bg-surface-subtle px-4 py-6 sm:px-6 sm:py-8"
    >
      <div className="w-full max-w-5xl">
        <Title level={2} className="!mb-2">
          <FileAddOutlined className="mr-2" />
          新增理賠估算
        </Title>
        <Paragraph type="secondary" className="!mb-6">
          填寫必填欄位即可開始試算；其他資料可稍後補。草稿會在本機保留 7 天。
        </Paragraph>

        <FormProgress
          current={activeSteps.indexOf(current)}
          steps={activeSteps.map((step) => STEPS[step])}
          className="!mb-8"
        />
        {isInjured === false && (
          <div className="mb-5 rounded-lg border border-border bg-surface p-4">
            <p className="mb-2 text-sm">
              未受傷會略過收入、醫療與失能資料。只想知道修車費折舊多少？
            </p>
            <Link href="/claims/vehicle-damage" className="font-semibold text-accent underline">
              直接試算維修費折舊
            </Link>
          </div>
        )}

        <Form
          form={form}
          disabled={!draftReady}
          layout="vertical"
          initialValues={data}
          // v0.18.x+ 即時驗證：onBlur 觸發 field-level validate，紅框提示不用等下一步
          // （DatePicker 用 onChange 已經會觸發）
          validateTrigger={['onBlur', 'onChange']}
          onValuesChange={(changed, all) => {
            if (!Object.hasOwn(changed, '_reviewConfirmed')) {
              form.setFieldValue('_reviewConfirmed', false)
            }
            setData((d) =>
              [0, 1, 2, 3, 4].reduce((merged, step) => mergeStep(merged, step, all), d),
            )
          }}
        >
          {/* ====== Step 1：事故基本 ====== */}
          {current === 0 && (
            <>
              <Step1Basics
                form={form}
                onCityChange={handleCityChange}
                cityOptions={CITY_OPTIONS.map((v) => ({ value: v, label: v }))}
                accidentTypeOptions={ACCIDENT_TYPE_OPTIONS}
                injuredRoleOptions={INJURED_ROLE_OPTIONS}
              />
              <div className="mt-4">
                <Step2Fault form={form} faultSourceOptions={FAULT_SOURCE_OPTIONS} />
              </div>
            </>
          )}
          {/* ====== Step 2：肇責 ====== */}
          {/* ====== Step 3：人身 / 工作（v0.19.0+：合併原 Step3 + Step7 居住地） ====== */}
          {current === 2 && (
            <Step3PersonalWork form={form} employmentOptions={EMPLOYMENT_OPTIONS} />
          )}
          {/* ====== Step 4：傷勢與診斷（v0.20.0+：從原 Step4Medical 上半段拆出） ====== */}
          {current === 3 && (
            <Step4Diagnosis form={form} accidentLocationForKnn={data.basics.accidentLocation} />
          )}
          {/* ====== Step 5：費用與財損（v0.20.0+：從原 Step4Medical 下半段拆出） ====== */}
          {current === 4 && (
            <Step5FeesAndProperty
              form={form}
              // v0.26.0e+：從 form 即時讀 isInjured，受傷=true 時掛號費必填
              // v0.27.2+：Form.useWatch 已上移到 component 頂層（React Rules of Hooks）
              isInjured={isInjured ?? true}
            />
          )}
          {current === 4 && (
            <ReviewSummary
              data={data}
              onEdit={(step) => {
                form.setFieldValue('_reviewConfirmed', false)
                setCurrent((step === 1 ? 0 : step) as ClaimStep)
              }}
              roleOptions={INJURED_ROLE_OPTIONS}
              faultSourceOptions={FAULT_SOURCE_OPTIONS}
            />
          )}
        </Form>

        {/* v0.8.1+：手機 sticky CTA（桌機保留原本 flex 排版） */}
        <MobileStickyCTA
          left={
            <Button
              block
              disabled={!draftReady || current === 0}
              onClick={prev}
              icon={<LeftOutlined />}
            >
              上一步
            </Button>
          }
          right={
            current < 4 ? (
              <Button
                block
                type="primary"
                disabled={!draftReady}
                onClick={next}
                icon={<RightOutlined />}
                iconPlacement="end"
              >
                下一步
              </Button>
            ) : (
              <Button
                block
                type="primary"
                disabled={!draftReady}
                onClick={submit}
                icon={<CheckCircleOutlined />}
              >
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
// 4 步 → 5 步重構配套：
// - step 0/1/2/3 各合併對應 section
// - step 4 = 「費用與財損」panel，同時合併 receipts + property 兩個 section
// - export 給 __tests__/form/mergeStep-five-steps.test.ts 用
export function mergeStep(prev: FormSchema, step: number, values: Partial<FormSchema>): FormSchema {
  // Step 5（費用與財損）：同時合併 receipts + property
  if (step === 4) {
    return {
      ...prev,
      receipts: {
        ...prev.receipts,
        ...(values.receipts ?? {}),
        nursingDays: prev.medical.nursingDays,
      },
      property: { ...prev.property, ...(values.property ?? {}) },
    }
  }
  const STEP_KEYS = ['basics', 'fault', 'person', 'medical'] as const
  const stepKey = STEP_KEYS[step] ?? 'basics'
  const prevSection = prev[stepKey]
  const newSection = values[stepKey]
  const normalizedSection = { ...(newSection as object) } as Record<string, unknown>
  if (step === 3 && Object.hasOwn(normalizedSection, 'nursingDays')) {
    normalizedSection.nursingDays = Math.max(0, Number(normalizedSection.nursingDays) || 0)
  }
  for (const key of ['accidentDate', 'emergencyDate', 'birthDate']) {
    const value = normalizedSection[key]
    if (value && dayjs.isDayjs(value)) normalizedSection[key] = value.format('YYYY-MM-DD')
  }
  return {
    ...prev,
    ...(step === 3
      ? {
          receipts: {
            ...prev.receipts,
            nursingDays: normalizedSection.nursingDays ?? prev.medical.nursingDays,
          },
        }
      : {}),
    [stepKey]: {
      ...(prevSection as object),
      ...normalizedSection,
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

/** 即時顯示「12 大類」相關警示（黃底強制險排除 / 心理衡鑑） */
