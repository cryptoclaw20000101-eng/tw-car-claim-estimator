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
  | 'shoulder'   // 肩
  | 'elbow'      // 肘
  | 'wrist'      // 腕
  | 'hip'        // 髖
  | 'knee'       // 膝
  | 'ankle'      // 踝
  | 'finger'     // 指
  | 'toe'        // 趾
  | 'cervical'   // 頸椎
  | 'lumbar'     // 腰椎

// 失能初篩分級（spec §四 4 級）
export type DisabilityScreening =
  | 'A'  // 無明顯失能線索
  | 'B'  // 有失能線索，但資料不足
  | 'C'  // 高度可能需要申請失能診斷
  | 'D'  // 已具失能申請基礎

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
  | 'police_preliminary'   // 警方初步研判表
  | 'accident_appraisal'   // 車輛行車事故鑑定
  | 'court_judgment'       // 法院判決
  | 'both_sides_agreed'    // 雙方和解
  | 'unclear'              // 不明

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

// --- 輸入資料：Step 1-6 表單彙整 -------------------------------------

export interface AccidentBasics {
  accidentDate: string  // ISO yyyy-mm-dd
  accidentLocation: string
  accidentType: AccidentType
  injuredRole: InjuredRole
  isAutomobileAccident: boolean

  hasPolicePreliminaryReport: boolean
  hasAccidentAppraisal: boolean
  // v0.5.2: 拿掉 isSettled / hasThirdPartyInsurance / thirdPartyBodilyLimit /
  // thirdPartyPropertyLimit / excessLiabilityLimit — 表單永遠當有第三人險、無保額上限

  hasCompulsoryInsurance: boolean

  // === v2 新增：地區欄位 ===
  accidentCity: string
  accidentDistrict: string
  claimantResidenceCity: string
  claimantResidenceDistrict: string
  defendantResidenceCity: string
  defendantResidenceDistrict: string
  courtJurisdiction: string       // 自動帶入，可手改
  insuranceCompanyBranchRegion: string
}

export interface FaultInfo {
  selfFaultRatio: number      // 0-100
  otherFaultRatio: number     // 0-100
  faultSource: FaultSource
  isFaultDisputed: boolean
}

export interface PersonalIncome {
  birthDate: string
  age: number
  occupation: string
  employmentType: EmploymentType

  sixMonthAverageSalary: number  // 事故前 6 個月平均月薪
  monthlySalary: number          // 現職月薪
  dailyWage: number              // 日薪（按件/日領者）
  lastYearTaxableIncome: number  // 去年報稅所得

  hasPropertyList: boolean       // 財產清單
  hasSalaryTransferRecord: boolean // 薪轉證明
  hasLeaveCertificate: boolean   // 請假證明
  hasSalaryDeductionProof: boolean // 扣薪證明

  actualLeaveDays: number        // 實際請假日數
  doctorOrderedRestDays: number  // 醫囑休養日數
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
  hasClassADiagnosisCertificate: boolean  // 甲種診斷書
  /** 12 大類失能種類（失能保典 + 強制險失能給付標準附表） */
  disabilityCategory?: string  // e.g. '01_mental' | '07_thoracic_organ' | '11_upper_limb' ...
  /** 失能等級 1-15（使用者自選；選大類時自動帶出該類常見等級，可手改） */
  disabilityLevel?: number     // 1-15

  // 傷勢細節（失能規則引擎用）
  hasFracture: boolean
  hasDislocation: boolean
  hasLigamentInjury: boolean
  hasNerveDamage: boolean
  hasAmputation: boolean
  hasOrganDamage: boolean

  hasScar?: boolean
  scarLengthCm?: number
  scarAreaCm2?: number           // 疤痕面積（雷射除疤用）
  scarLocation?: string
  scarSeverity?: 'mild' | 'moderate' | 'severe' | 'keloid'  // 蟹足腫
  isKeloid?: boolean             // 是否為肥厚性疤痕 / 蟹足腫
  /** 採用的除疤術式（laser / revision_surgery / facelift / injection）— UI 選擇器 */
  scarProcedure?: 'laser' | 'revision_surgery' | 'facelift' | 'injection'
  /** 醫囑建議的療程次數（覆寫預設）— 雷射/注射常用 */
  prescribedSessions?: number

  // 關節（規則引擎用）
  jointName: JointName | null
  hasRangeOfMotionLimitation: boolean
  romLossDegree: number        // 角度喪失（度）
  romNormalDegree: number      // 該關節正常活動度（度）
  hasMuscleWeakness: boolean
  hasSensoryLoss: boolean
  hasPermanentImpairment: boolean
}

// --- 強制險醫療細項（Step 5） ---------------------------------------

export interface CompulsoryMedicalInputs {
  emergencyFee: number
  ambulanceFee: number

  nhiCopayment: number           // 健保自付額
  registrationFee: number
  diagnosisCertificateFee: number
  nonNhiNecessaryMedicalFee: number

  wardFeeDifference: number
  wardFeeDays: number

  mealFee: number
  mealDays: number

  prosthesisFee: number          // 義肢費

  dentureFee: number
  missingTeethCount: number

  artificialEyeFee: number

  medicalMaterialFee?: number    // 一般醫材費（紗布、縫線、注射耗材等）— v0.2.5 起不再套 2 萬上限，改歸入「健保自付額」/「非健保必要醫療」；保留為向後相容舊資料
  specialMaterialFee?: number    // 特殊材料費（骨材、鋼板、人工關節等特材；v0.2.5+ 新增，與輔具共套 2 萬上限）
  assistiveDeviceFee: number     // 輔具費（拐杖、輪椅、支架等，與特殊材料共套 2 萬上限）
  transportationFee: number      // 接送費

  nursingFee: number             // 看護費
  nursingDays: number

  otherNecessaryMedicalFee: number
}

// --- 車損財損（Step 6） -----------------------------------------------

export interface PropertyDamageInputs {
  vehicleRepairEstimate: number   // 估價單
  vehicleRepairInvoice: number    // 發票
  vehicleMarketValueBeforeAccident: number  // 事故前車價
  salvageValue: number            // 殘值

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
  key: string               // 'emergencyFee' | 'wardFee' | ...
  label: string
  applied: number           // 申請金額
  approved: number          // 預估可認金額
  legalCap: number | null   // 法定上限
  reductionReason: string | null  // 刪減原因
  supplementHint: string | null   // 補件建議
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
  signals: string[]                              // 觸發的關鍵字
  possibleLevel: DisabilityLevel | null          // 規則引擎推估等級
  possibleAmount: number                         // 依等級推估金額
  confidenceScore: number                        // 0-1
  romLossPercent: number | null                  // 關節活動度喪失比例
  jointName: JointName | null
  notes: string[]                                // 缺資料 / 提示
  needsSupplement: string[]                      // 需補件
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
  severityLevel: string    // 'minor' | 'moderate' | 'serious' | ...
  severityScore: number    // 0-100
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

  // v0.5.2: 拿掉 bodilyCap / propertyCap / usedBodilyCap / usedPropertyCap
  // 無保額上限，永遠是 1：1 對方肇責比例

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
    method: 'ml_v1_ensemble' | 'heuristic_only' | 'fallback'
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
   * 精神慰撫金 Ensemble 三票共識（v0.6.2+）
   * 三票：規則引擎 + ML 區間 + KNN 相似案件
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
    procedure: 'surgical' | 'laser' | 'facelift' | 'dermabrasion' | 'injection' | 'unknown' | 'revision_surgery'
    primaryProcedure: 'surgical' | 'laser' | 'facelift' | 'dermabrasion' | 'injection' | 'unknown' | 'revision_surgery'
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

  vehicleDamage: number
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
