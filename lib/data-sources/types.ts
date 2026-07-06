// =====================================================================
// 資料來源層 — 型別定義
// 規範來源：spec §三 引用資料來源 + §九 評議/判決案例規則
// MVP：全部 mock，**不**打真 API（保留升級介面）
// =====================================================================

// --- 金融評議中心（FinTech 金融消費評議中心，foi.tw）-------------------
// 用途：因果關係認定、必要醫療費爭議、失能認定爭議
// spec §三：金融評議案例只能作爭議參考，不能保證結果

export type FoiDisputeCategory =
  | 'causation' // 因果關係認定
  | 'necessary_medical' // 必要醫療費爭議
  | 'disability' // 失能認定
  | 'nursing_fee' // 看護費爭議
  | 'work_loss' // 工作損失認定
  | 'overlap_compulsory' // 強制險重複請領

export type FoiOutcome =
  | 'consumer_favor' // 消費者（受害者）有利
  | 'insurer_favor' // 保險公司有利
  | 'partial' // 部分有利
  | 'settled' // 和解撤回
  | 'withdrawn' // 撤回

export interface FoiDisputeCase {
  caseId: string // 案號 e.g. "112-評字第1234號"
  category: FoiDisputeCategory
  caseYear: number // 西元年
  caseDate: string // ISO yyyy-mm-dd
  courtName: string | null // 若有後續訴訟，附法院名
  summary: string // 案件摘要（1-2 句）
  keyReasoning: string // 評議關鍵理由
  outcome: FoiOutcome
  compensationAmount: number | null // 評議金額（元），null = 無具體金額
  referenceNote: string // 引用注意事項
}

// --- 司法院法學資料（judicial.gov.tw）--------------------------------
// 用途：法院慰撫金/看護費/工作損失 區間參考
// spec §三：法院判決案例只能作區間參考，不能保證法院會相同認定

export type CourtCaseCategory =
  | 'pain_and_suffering' // 精神慰撫金
  | 'nursing_fee' // 看護費
  | 'work_loss' // 工作損失
  | 'vehicle_damage' // 車損
  | 'disability_comp' // 失能補償
  | 'causation' // 因果關係

export interface CourtCaseReference {
  caseId: string // 案號 e.g. "111年度訴字第1234號"
  courtName: string // 法院
  caseYear: number // 西元年
  category: CourtCaseCategory
  amount: number | null // 判決金額（單一案件），null = 駁回/和解
  amountLow: number // 該案情形的區間低標
  amountHigh: number // 該案情形的區間高標
  summary: string // 案情摘要
  keyReasoning: string // 判決理由
  referenceNote: string
}

export interface CourtCompensationCase {
  courtName: string // e.g. "臺灣臺中地方法院"
  category: CourtCaseCategory
  sampleSize: number // 統計案件數
  amountLow: number // 區間低標
  amountMid: number // 區間中位
  amountHigh: number // 區間高標
  notes: string // 統計區間注意事項
}

// --- 法律條文常數（spec §六 強制險 + §七 失能 + §八 第三人）----------

export type LegalDocumentKey =
  | 'compulsory_insurance_act' // 強制汽車責任保險法
  | 'compulsory_payment_standard' // 強制汽車責任保險給付標準
  | 'civil_code_184_196' // 民法 §184-196 侵權行為
  | 'disability_level_table' // 失能等級表
  | 'pain_and_suffering_guideline' // 慰撫金估算規則
  | 'foi_evaluation_principles' // 金融消費評議中心評議原則

export interface LegalReference {
  key: LegalDocumentKey
  title: string // 法條名稱
  effectiveDate: string // 生效日 ISO
  sourceUrl: string // 來源 URL（mock 用 placeholder）
  sourceNote?: string // v0.6.6 新增：URL 補充說明（如 pcode 待驗證）
  summary: string // 重點摘要
  relevantArticles: string[] // 重要條號 e.g. ["§27", "附表"]
  lastReviewed: string // 最後檢視日 ISO
}
