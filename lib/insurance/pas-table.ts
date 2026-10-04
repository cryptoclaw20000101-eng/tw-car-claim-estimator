// =====================================================================
// pas-table.ts — 50 級精神慰撫金傷勢區間表 + Personal Factors multiplier
// (v0.18.x+ 共用模組，pain-ml.ts + civil-damages.ts 都從這 import)
//
// 設計：
//   - 50 等級：從 10,000 至 2,000,000 元，依傷勢嚴重度的不均等門檻與金額錨點分級。
//   - 年齡、職業、扶養人與勞動能力減損屬法院個案審酌事項，不使用固定係數自動加減額。
//     僅保留欄位以維持輸入相容性，並在有完整證據時交由人工複核。
//
// 傷勢群組：
//   Lv 1-8   擦挫、短期門診、無持續功能影響
//   Lv 9-16  軟組織、疤痕、復健與短期住院
//   Lv 17-28 骨折、手術、韌帶與較長療程
//   Lv 29-40 神經、脊椎、臟器或永久功能影響
//   Lv 41-50 失能、截肢及重度生活功能障害
//
// 金額依據：民法 §195 精神慰撫金酌定基準 + 司法院真實判決 median (N=153)
// 死亡/截肢多肢/植物人 → 走 death_case / scar-revision chain 特殊 path
// =====================================================================

// --- 15 級區間表 --------------------------------------------------------

export interface PasLevelRow {
  level: number // 1-50
  label: string
  low: number
  mid: number
  high: number
  /** 觸發特徵描述（給 UI 顯示） */
  trigger: string
}

export const PAIN_AMOUNT_MIN = 10_000
export const PAIN_AMOUNT_MAX = 2_000_000

/**
 * 各級中位錨點。級距刻意不採等差或等比：輕傷緩升、結構性傷害加速、
 * 已確認永久功能影響與重度失能再拉開差距。
 */
const PAS_MIDPOINTS = [
  10_000, 15_000, 20_000, 25_000, 30_000, 35_000, 40_000, 45_000, 50_000, 60_000, 70_000, 80_000,
  90_000, 100_000, 115_000, 130_000, 145_000, 160_000, 180_000, 200_000, 225_000, 250_000, 280_000,
  310_000, 340_000, 380_000, 420_000, 460_000, 500_000, 550_000, 600_000, 650_000, 700_000, 760_000,
  820_000, 880_000, 950_000, 1_020_000, 1_100_000, 1_180_000, 1_270_000, 1_360_000, 1_460_000,
  1_570_000, 1_680_000, 1_800_000, 1_900_000, 1_960_000, 1_990_000, 2_000_000,
] as const

/** 0-200 嚴重度分數對應 50 級的不均等門檻。 */
const PAS_SCORE_CEILINGS = [
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  8,
  10,
  12,
  14,
  16,
  18,
  20,
  23,
  26,
  29,
  32,
  35,
  38,
  42,
  46,
  50,
  54,
  58,
  63,
  68,
  73,
  78,
  83,
  89,
  95,
  101,
  108,
  115,
  122,
  130,
  138,
  146,
  154,
  162,
  170,
  178,
  185,
  191,
  195,
  198,
  199,
  200,
  Number.POSITIVE_INFINITY,
] as const

function injuryMeta(level: number): Pick<PasLevelRow, 'label' | 'trigger'> {
  if (level <= 8)
    return {
      label: `第 ${level} 級：擦挫與短期門診`,
      trigger: '擦挫、挫傷或短期門診，無結構性傷害與持續功能影響',
    }
  if (level <= 16)
    return {
      label: `第 ${level} 級：軟組織與疤痕治療`,
      trigger: '拉傷、撕裂、疤痕、復健或短期住院，依療程與客觀傷勢分級',
    }
  if (level <= 28)
    return {
      label: `第 ${level} 級：骨折、手術與長療程`,
      trigger: '骨折、手術、韌帶或關節傷害，依治療強度、住院與復健影響分級',
    }
  if (level <= 40)
    return {
      label: `第 ${level} 級：神經、脊椎或永久影響`,
      trigger: '神經、脊椎、臟器或永久功能影響，須以專科診斷與客觀資料佐證',
    }
  return {
    label: `第 ${level} 級：重度失能與生活功能障害`,
    trigger: '已確認失能、截肢或重度生活功能障害，須依失能診斷、生活影響與個案證據審酌',
  }
}

export const PAS_TABLE: PasLevelRow[] = PAS_MIDPOINTS.map((mid, index) => {
  const level = index + 1
  const meta = injuryMeta(level)
  return {
    level,
    ...meta,
    low: index === 0 ? PAIN_AMOUNT_MIN : PAS_MIDPOINTS[index - 1],
    mid,
    high: index === PAS_MIDPOINTS.length - 1 ? PAIN_AMOUNT_MAX : PAS_MIDPOINTS[index + 1],
  }
})

/** 從 1-based level 取 0-based index */
export function pasLevelIndex(level: number): number {
  if (level < 1) return 0
  if (level > PAS_TABLE.length) return PAS_TABLE.length - 1
  return level - 1
}

export function pasLevelIndexFromScore(score: number): number {
  const normalized = Math.max(0, Math.min(200, score))
  return PAS_SCORE_CEILINGS.findIndex((ceiling) => normalized <= ceiling)
}

// --- Personal Factors (4 維度，民法 §195 酌定因子) -----------------------

export type OccupationCategory =
  | 'professional' // 律師/醫師/會計師/教授
  | 'manager' // 高階主管
  | 'employed' // 一般受僱
  | 'service' // 服務業
  | 'farmer' // 農
  | 'student' // 學生
  | 'unemployed' // 待業
  | 'retired' // 退休
  | 'homemaker' // 家管
  | 'other' // 其他

export interface PersonalFactors {
  /** 年齡（歲） */
  age: number
  /** 職業類別 */
  occupation: OccupationCategory
  /** 扶養人數（被撫養的家人/小孩/父母） */
  dependentCount: number
  /** 是否有勞動力減損（失能/永久障害） */
  hasLaborLoss: boolean
}

export interface PersonalFactorResult {
  /** 固定為 1。個人條件不得以預設倍率自動調整慰撫金。 */
  multiplier: number
  /** 各維度細項（給 UI 顯示「為什麼會加成」） */
  ageFactor: number
  ageNote: string | null
  occupationFactor: number
  occupationNote: string | null
  dependentFactor: number
  dependentNote: string | null
  laborLossFactor: number
  laborLossNote: string | null
}

/**
 * 個人條件的人工複核占位。
 *
 * 民法第 195 條的慰撫金屬相當金額，實務上須綜合兩造身分、資力、過失、
 * 傷勢與證據判斷。年齡、職業或扶養人數沒有法定換算倍率，因此不自動調整。
 */
export function personalFactorMultiplier(factors: PersonalFactors): PersonalFactorResult {
  // 保留輸入以維持呼叫端相容性；不得以其自動換算金額。
  void factors
  return {
    multiplier: 1,
    ageFactor: 1,
    ageNote: null,
    occupationFactor: 1,
    occupationNote: null,
    dependentFactor: 1,
    dependentNote: null,
    laborLossFactor: 1,
    laborLossNote: null,
  }
}

// --- 預設（不指定時的中位數） ---------------------------------------------

/** 不提供 Personal Factors 時的合理默認（避免破壞既有呼叫端） */
export const DEFAULT_PERSONAL_FACTORS: PersonalFactors = {
  age: 35,
  occupation: 'employed',
  dependentCount: 0,
  hasLaborLoss: false,
}
