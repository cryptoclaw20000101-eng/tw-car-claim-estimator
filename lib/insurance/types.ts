// =====================================================================
// 台灣車禍理賠金額估算器 — 型別定義
// 此檔為整個計算引擎的 single source of truth
// 規範來源：強制汽車責任保險法 + 強制汽車責任保險給付標準 + 民法 §184-196
// =====================================================================

// --- 強制險傷殘等級系統 ---------------------------------------------
// 來源：強制汽車責任保險給付標準 §4 + 附表「失能等級」
// 事故日期 2026-07-01 後適用新制金額（更高）
// 事故日期 2026-07-01 前適用舊制金額（spec §七 預留）

export type DisabilityLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15

// 關節名稱（規則引擎用）
export type JointName =
  | 'shoulder' // 肩
  | 'elbow' // 肘
  | 'wrist' // 腕
  | 'hip' // 髖
  | 'knee' // 膝
  | 'ankle' // 踝
  | 'finger' // 指
  | 'toe' // 趾
  | 'cervical' // 頸椎
  | 'lumbar' // 腰椎

// 失能初篩分級（spec §四 4 級）
export type DisabilityScreening =
  | 'A' // 無明顯失能線索
  | 'B' // 有失能線索，但資料不足
  | 'C' // 高度可能需要申請失能診斷
  | 'D' // 已具失能申請基礎

// 車禍類型
export type AccidentType =
  | 'car_to_car'
  | 'car_to_motorcycle'
  | 'car_to_pedestrian'
  | 'motorcycle_to_motorcycle'
  | 'motorcycle_to_pedestrian'
  | 'single_vehicle'
  | 'other'

// 受害人身分
export type InjuredRole =
  | 'driver_car'
  | 'driver_motorcycle'
  | 'passenger_car'
  | 'passenger_motorcycle'
  | 'pedestrian'
  | 'cyclist'
  | 'passenger_bus'
  | 'other'

// 肇責來源
export type FaultSource =
  | 'police_preliminary' // 警方初步研判表
  | 'accident_appraisal' // 車輛行車事故鑑定
  | 'court_judgment' // 法院判決
  | 'both_sides_agreed' // 雙方和解
  | 'unclear' // 不明

// 受僱類型
export type EmploymentType =
  | 'full_time_salary'
  | 'part_time_salary'
  | 'self_employed'
  | 'daily_wage'
  | 'unemployed'
  | 'retired'
  | 'student'
  | 'homemaker'

/** 對方任意第三人責任險的確認狀態；未知時不得把民事責任當成保險可賠。 */
export type ThirdPartyCoverageStatus = 'unknown' | 'insured' | 'uninsured'

// --- 輸入資料：Step 1-6 表單彙整 -------------------------------------

export interface AccidentBasics {
  accidentDate: string // ISO yyyy-mm-dd
  accidentLocation: string
  accidentType: AccidentType
  injuredRole: InjuredRole
  /**
   * v0.26.0e+：是否有人受傷（鐵律 ④：無受傷 → 精神慰撫金 0，靠 cascade 自然處理，不在 UI 顯示）
   * - true：有受傷（預設）→ 走原有 6 大引擎
   * - false：未受傷 → 醫療相關欄位強制 0，painAndSuffering 因依賴醫療嚴重度自然 = 0
   * - 表單必填（Step 1 Radio.Group）
   */
  isInjured: boolean
  isAutomobileAccident: boolean

  hasPolicePreliminaryReport: boolean
  hasAccidentAppraisal: boolean
  /** 對方任意第三人責任險狀態；未取得保單時保留 unknown。 */
  thirdPartyCoverageStatus?: ThirdPartyCoverageStatus
  /** 第三人責任險每一受害人之體傷保額；unknown 時不應推定。 */
  thirdPartyBodilyLimit?: number | null
  /** 第三人責任險財損保額。 */
  thirdPartyPropertyLimit?: number | null
  /** 已確認的超額責任險可用額度。 */
  excessLiabilityLimit?: number | null

  hasCompulsoryInsurance: boolean

  // === v2 新增：地區欄位 ===
  accidentCity: string
  accidentDistrict: string
  claimantResidenceCity: string
  claimantResidenceDistrict: string
  defendantResidenceCity: string
  defendantResidenceDistrict: string
  courtJurisdiction: string // 自動帶入，可手改
  insuranceCompanyBranchRegion: string
}

export interface FaultInfo {
  selfFaultRatio: number // 0-100
  otherFaultRatio: number // 0-100
  faultSource: FaultSource
  isFaultDisputed: boolean
}

export interface PersonalIncome {
  birthDate: string
  age: number
  occupation: string
  employmentType: EmploymentType

  sixMonthAverageSalary: number // 事故前 6 個月平均月薪
  monthlySalary: number // 現職月薪
  dailyWage: number // 日薪（按件/日領者）
  lastYearTaxableIncome: number // 去年報稅所得

  hasPropertyList: boolean // 財產清單
  hasSalaryTransferRecord: boolean // 薪轉證明
  hasLeaveCertificate: boolean // 請假證明
  hasSalaryDeductionProof: boolean // 扣薪證明

  actualLeaveDays: number // 實際請假日數
  doctorOrderedRestDays: number // 醫囑休養日數
}

// --- 診斷書 + 醫療資料 -----------------------------------------------

export interface MedicalRecord {
  diagnosisText: string
  hospitalName: string
  emergencyDate: string
  outpatientVisitCount: number
  hospitalizationDays: number

  hasSurgery: boolean
  hasRehabilitation: boolean
  rehabilitationCount: number

  requiresNursingCare: boolean
  nursingDays: number

  isSymptomFixed: boolean
  hasDisabilityCertificate: boolean
  /** 12 大類失能種類（失能保典 + 強制險失能給付標準附表） */
  disabilityCategory?: string // e.g. '01_mental' | '07_thoracic_organ' | '11_upper_limb' ...
  /** 失能等級 1-15（使用者自選；選大類時自動帶出該類常見等級，可手改） */
  disabilityLevel?: number // 1-15
  /** 現行附表的正式項次（例如 12-29）；選定後由系統核對對應法定等級。 */
  disabilityTableItemIds?: string[]
  /** 同一事故、同時符合附表二項目以上時的其他診斷書載明等級（強制險給付標準第 4 條） */
  additionalDisabilityLevels?: number[]
  /** 同一障害部位於事故前已存在的失能等級（強制險給付標準第 5 條） */
  preExistingDisabilityLevel?: number
  /** 醫療鑑定或職務分析所載的民事勞動能力減損率（0–100）；未填時僅能使用等級參考值。 */
  laborCapacityLossPercent?: number

  // 傷勢細節（失能規則引擎用）
  hasFracture: boolean
  hasDislocation: boolean
  hasLigamentInjury: boolean
  hasNerveDamage: boolean
  hasAmputation: boolean
  hasOrganDamage: boolean

  hasScar?: boolean
  scarLengthCm?: number
  scarAreaCm2?: number // 疤痕面積（雷射除疤用）
  scarLocation?: string
  scarSeverity?: 'mild' | 'moderate' | 'severe' | 'keloid' // 蟹足腫
  isKeloid?: boolean // 是否為肥厚性疤痕 / 蟹足腫
  /** 採用的除疤術式（laser / revision_surgery / facelift / injection）— UI 選擇器 */
  scarProcedure?: 'laser' | 'revision_surgery' | 'facelift' | 'injection'
  /** 醫囑建議的療程次數（覆寫預設）— 雷射/注射常用 */
  prescribedSessions?: number

  // 關節（規則引擎用）
  jointName: JointName | null
  hasRangeOfMotionLimitation: boolean
  romLossDegree: number // 角度喪失（度）
  romNormalDegree: number // 該關節正常活動度（度）
  hasMuscleWeakness: boolean
  hasSensoryLoss: boolean
  hasPermanentImpairment: boolean
}

// --- 強制險醫療細項（Step 5） ---------------------------------------

export interface CompulsoryMedicalInputs {
  emergencyFee: number
  ambulanceFee: number

  nhiCopayment: number // 健保自付額
  registrationFee: number
  diagnosisCertificateFee: number
  /** 每次事故申請以一份為限；未填視為 0。 */
  medicalRecordSummaryFee?: number
  /** @deprecated 不屬強制險醫療費列舉項目，保留僅供讀取舊估算，不列入任何試算。 */
  nonNhiNecessaryMedicalFee?: number

  wardFeeDifference: number
  wardFeeDays: number

  mealFee: number
  mealDays: number

  prosthesisFee: number // 義肢費

  dentureFee: number
  missingTeethCount: number

  artificialEyeFee: number

  medicalMaterialFee?: number // 一般醫材費（紗布、縫線、注射耗材等）不另作「非健保必要醫療」給付；保留為向後相容舊資料
  specialMaterialFee?: number // 特殊材料費（骨材、鋼板、人工關節等特材；v0.2.5+ 新增，與輔具共套 2 萬上限）
  assistiveDeviceFee: number // 輔具費（拐杖、輪椅、支架等，與特殊材料共套 2 萬上限）
  transportationFee: number // 接送費

  nursingFee: number // 看護費
  nursingDays: number
}

// --- 車損財損（Step 6） -----------------------------------------------

export interface PropertyDamageInputs {
  vehicleRepairEstimate: number // 估價單
  vehicleRepairInvoice: number // 發票
  vehicleMarketValueBeforeAccident: number // 事故前車價
  salvageValue: number // 殘值

  // v0.24.0+：折舊計算（保險通用線性累進）
  // 第一年：汽車 10% / 機車 18%
  // 之後每年 +10%（cap 70%）
  // 為 optional — 未填寫就不折舊（直接用 vehicleMarketValueBeforeAccident）
  vehicleManufactureYear?: number | null // 出廠年份（西元）
  // v0.24.2+：改為折舊年限（平均法 / 直線折舊）
  vehicleDepreciationYears?: number | null // 完整折舊年限（汽車預設 5、機車 3；範圍 3 ~ 10）

  towingFee: number
  rentalCarFee: number

  phoneDamage: number
  helmetDamage: number
  clothingDamage: number
  glassesDamage: number
  otherPropertyDamage: number
}

// --- 完整輸入（前端表單最終彙整） -----------------------------------

export interface ClaimInput {
  basics: AccidentBasics
  fault: FaultInfo
  person: PersonalIncome
  medical: MedicalRecord
  medicalReceipts: CompulsoryMedicalInputs
  property: PropertyDamageInputs
}

// --- 輸出：估算結果 ------------------------------------------------

// 強制險單一細項（含刪減原因 + 補件建議）
export interface CompulsoryItemResult {
  key: string // 'emergencyFee' | 'wardFee' | ...
  label: string
  applied: number // 申請金額
  approved: number // 預估可認金額
  legalCap: number | null // 法定上限
  reductionReason: string | null // 刪減原因
  supplementHint: string | null // 補件建議
  /** v0.2.5+：當一項內含多個子項時列出（例如醫材拆「一般/特殊/輔具」三項共套一個 2 萬上限） */
  subItems?: Array<{
    key: string
    label: string
    applied: number
    approved: number
    note?: string
  }>
}

// 失能初篩輸出
export interface DisabilityScreeningResult {
  screening: DisabilityScreening
  signals: string[] // 觸發的關鍵字
  possibleLevel: DisabilityLevel | null // 規則引擎推估等級
  possibleAmount: number // 依等級推估金額
  /** 是否已滿足症狀固定、失能診斷書與附表等級三項給付前提 */
  isPayable: boolean
  /** 可列入強制險給付試算的合併後等級；未滿足前提時為 null */
  recognizedLevel: DisabilityLevel | null
  confidenceScore: number // 0-1
  romLossPercent: number | null // 關節活動度喪失比例
  jointName: JointName | null
  notes: string[] // 缺資料 / 提示
  needsSupplement: string[] // 需補件
}

// 精神慰撫金多級評分
export interface PainAndSufferingResult {
  baseLow: number
  baseMid: number
  baseHigh: number
  regionalMultiplier: number
  regionalLow: number
  regionalMid: number
  regionalHigh: number
  /** 為維持 API 相容保留，與 regional 金額相同，不以個人資料自動調整。 */
  adjustedLow?: number
  adjustedMid?: number
  adjustedHigh?: number
  /** 個人條件不使用固定倍率，固定為 1。 */
  personalFactorMultiplier?: number
  personalFactorNotes?: string[]
  severityLevel: string // 'minor' | 'moderate' | 'serious' | ...
  severityScore: number // 0-200 (v0.18.x+ 從 0-100 擴為 0-200)
  severityLevelIndex?: number // 0-49（50 級傷勢分層）
  breakdown: {
    hospitalizationDays: number
    rehabilitationCount: number
    scarLengthCm: number
    hasPermanentImpairment: boolean
    hasDisability: boolean
  }
}

// 第三人責任險估算
export interface ThirdPartyEstimate {
  civilDamageTotalLow: number
  civilDamageTotalMid: number
  civilDamageTotalHigh: number

  liableAmountLow: number
  liableAmountMid: number
  liableAmountHigh: number

  thirdPartyEstimateLow: number
  thirdPartyEstimateMid: number
  thirdPartyEstimateHigh: number

  /** 對方保單狀態。unknown 時 only 顯示民事責任，不能宣稱保險會支付。 */
  insuranceCoverageStatus: ThirdPartyCoverageStatus
  /** 已確認保單下的保險預估給付；保額未知時為 null。 */
  insurerPayableLow: number | null
  insurerPayableMid: number | null
  insurerPayableHigh: number | null
  /** 有保單且保額不足時，仍可能由加害人負擔的民事差額。 */
  uninsuredGapLow: number | null
  uninsuredGapMid: number | null
  uninsuredGapHigh: number | null
  /** 肇責尚未由警方初判、鑑定、判決或雙方協議確認時，金額僅為情境試算。 */
  isFaultProvisional: boolean

  notes: string[]
}

// 完整估算結果
export interface EstimationResult {
  // 強制險
  compulsoryItems: CompulsoryItemResult[]
  compulsoryMedicalSubtotal: number
  compulsoryMedicalApproved: number
  compulsoryDisabilityAmount: number
  compulsoryDeathAmount: number
  compulsoryTotalEstimated: number

  // 失能初篩
  disability: DisabilityScreeningResult

  // 民事損害
  civilMedicalExpense: number
  civilNursingFeeLow: number
  civilNursingFeeMid: number
  civilNursingFeeHigh: number
  civilNursingRequiresMedicalProof: boolean
  civilNursingNotes: string[]
  civilTransportationFee: number
  workLoss: number
  workLossEvidenceStrength: 'low' | 'medium' | 'high'
  /**
   * 工作損失（擴充版）：短期 ≤6 月 vs 長期 >6 月 vs 退休分流。
   * 提供完整版明細供 UI 展開；前端可用 `type` 判斷走「日薪」/「霍夫曼」/「慰撫金」分支。
   */
  workLossExtended: {
    amount: number
    calculationType: 'short_term' | 'long_term' | 'none'
    isRetired: boolean
    hoffmannYears: number
    hoffmannFactor: number
    restMonths: number
    restYears: number
    annualIncome: number
    regionalMultiplier: number
    breakdown: {
      dailyIncome: number
      reasonableRestDays: number
      coefficient: number
    }
    evidenceStrength: 'low' | 'medium' | 'high'
    notes: string[]
    hint: string | null
  }
  laborCapacityLossEstimate: number
  laborCapacityLossHint: string | null
  /** true 表示尚無鑑定／職務分析勞減率，金額僅供參考，不能視為已認定請求額。 */
  laborCapacityLossIsReference: boolean
  /**
   * 勞動能力減損計算終點年齡（預設 65；農業/自營/專業人士可調到 70-75）。
   * 雲林地院 110 簡 23 號判例支持。
   */
  laborCapacityRetirementAge: number
  /** 勞動能力減損計算過程的所有提示（年齡/霍夫曼/失能等級/地區） */
  laborCapacityLossNotes: string[]

  painAndSuffering: PainAndSufferingResult

  /**
   * 精神慰撫金 ML 校驗層（v0.6.0+）
   * 三層區間引擎：啟發式 baseline + 歷史 anchor + fallback
   * 提供 P10/P50/P90 + 信心度 + 規則 vs ML 落差警告
   * 設計詳見 lib/insurance/pain-ml.ts
   */
  painML: {
    lower: number
    mid: number
    upper: number
    p10: number
    p50: number
    p90: number
    confidence: 'high' | 'medium' | 'low'
    method: 'ml_v2_severity_region' | 'ml_v2_severity_national' | 'heuristic_only' | 'fallback'
    severityLevel: number
    severityLabel: string
    anchorCases: Array<{
      caseNo: string
      court: string
      amount: number
      year: number
      category: string
    }>
    reconcile: {
      status: 'agree' | 'minor_diverge' | 'diverge'
      divergence: number
      warning?: string
    }
  }

  /**
   * 精神慰撫金交叉檢核。
   * KNN 僅可使用有「單獨慰撫金」欄位的案例，總賠償額不可混入。
   * 設計詳見 lib/insurance/pain-ensemble.ts
   */
  painEnsemble: {
    consensus: 'strong' | 'partial' | 'weak' | 'insufficient'
    consensusAmount: number | null
    suggestedRange: { low: number; high: number } | null
    outlier?: 'rules' | 'ml' | 'knn'
    rulesAmount: number
    mlAmount: number
    knnAmount: number | null
    rulesWeight: number
    mlWeight: number
    knnWeight: number
    warning?: string
  }

  /**
   * 精神慰撫金 LLM 理賠顧問複核（v0.6.3+）
   * 純函式骨架 + mock LLM（v0.6.4 接 Claude API）
   * 個資保護：絕不傳姓名/ID/車號/精確日期
   * 免責聲明：永遠在 disclaimer
   * 設計詳見 lib/insurance/pain-advisor.ts
   */
  painAdvisor: {
    riskLevel: 'low' | 'medium' | 'high'
    riskFactors: string[]
    recommendations: string[]
    consensusInterpretation: string
    requiresHumanReview: boolean
    promptTokens: number
    completionTokens: number
    disclaimer: string
  }

  /**
   * 除疤 / 修疤費用（4 術式 × 北中南 × 疤痕長度）。
   * 依據：臺中市美容醫學醫療機構收費標準表 111.03.30 + 中地院 110 簡 202 判決。
   * 預設 estimate=0（未填疤痕時）；UI 可顯示 notes 提示去補資料。
   */
  scarRevision: {
    amount: number
    estimate: number
    estimateLow: number
    estimateHigh: number
    range: { low: number; mid: number; high: number }
    procedure:
      | 'surgical'
      | 'laser'
      | 'facelift'
      | 'dermabrasion'
      | 'injection'
      | 'unknown'
      | 'revision_surgery'
    primaryProcedure:
      | 'surgical'
      | 'laser'
      | 'facelift'
      | 'dermabrasion'
      | 'injection'
      | 'unknown'
      | 'revision_surgery'
    totalSessions: number
    regionalMultiplier: number
    breakdown: {
      perUnitCost: number
      units: number
      sessions: number
      baseFee: number
    }
    precedents: string[]
    notes: string[]
    hint: string | null
  }

  /** null 表示有維修金額，但缺少事故前車價，尚未列入總額。 */
  vehicleDamage: number | null
  propertyDamage: number

  // 第三人責任險
  thirdParty: ThirdPartyEstimate

  // 補件與風險
  missingDocuments: string[]
  riskNotes: string[]

  // 地區實務
  region: {
    courtName: string
    accidentCity: string
    courtJurisdiction: string
    painAndSufferingMultiplier: number
    nursingDailyRateLow: number
    nursingDailyRateMid: number
    nursingDailyRateHigh: number
    workLossEvidenceStrictness: 'low' | 'medium' | 'high'
    vehicleDepreciationStrictness: 'low' | 'medium' | 'high'
    regionNotes: string
    confidenceLevel: 'low' | 'medium' | 'high'
  }
}
