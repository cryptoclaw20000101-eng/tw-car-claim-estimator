// =====================================================================
// pas-table.ts — 15 級精神慰撫金區間表 + Personal Factors multiplier
// (v0.18.x+ 共用模組，pain-ml.ts + civil-damages.ts 都從這 import)
//
// 設計：
//   - 15 等級（v0.6.0 是 8 等級，v0.18.x 擴為 15 細分傷勢）
//   - Personal Factors multiplier 整合 4 維度：
//       1. 年齡 (13/18/30/65 切 4 段)
//       2. 職業 (10 類: professional/manager/employed/service/farmer/student/unemployed/retired/homemaker/other)
//       3. 扶養人 (0/1/2-3/4+ 4 段)
//       4. 勞動力減損 (hasLaborLoss +30%)
//   - 法院依法 (§195 民法) 會斟酌「兩造身分、地位、職業、教育程度、財力、年齡、性別、傷勢程度」
//     → 個人因子反映這些 non-medical 維度
//
// 觸發特徵表：
//   Lv 1-3  擦挫/軟組織：無疤，門診少
//   Lv 4-7  疤/撕裂：縫合或疤痕
//   Lv 8-12 骨折/韌帶/神經/脊椎：住院 + 開刀
//   Lv 13-15 永久失能：失能 11-15 / 7-10 / 1-6 級
//
// 金額依據：民法 §195 精神慰撫金酌定基準 + 司法院真實判決 median (N=153)
// 死亡/截肢多肢/植物人 → 走 death_case / scar-revision chain 特殊 path
// =====================================================================

// --- 15 級區間表 --------------------------------------------------------

export interface PasLevelRow {
  level: number // 1-15
  label: string
  low: number
  mid: number
  high: number
  /** 觸發特徵描述（給 UI 顯示） */
  trigger: string
}

export const PAS_TABLE: PasLevelRow[] = [
  {
    level: 1,
    label: '極輕微擦挫',
    trigger: '門診 1-2 次，無疤，無骨折',
    low: 10_000,
    mid: 20_000,
    high: 30_000,
  },
  {
    level: 2,
    label: '輕微擦挫',
    trigger: '門診 3-5 次，無疤',
    low: 30_000,
    mid: 50_000,
    high: 70_000,
  },
  {
    level: 3,
    label: '中度擦挫',
    trigger: '門診 5+ 次 / 敷藥 1 週+',
    low: 50_000,
    mid: 70_000,
    high: 100_000,
  },
  {
    level: 4,
    label: '軟組織拉傷',
    trigger: '復健 5-10 次，無疤',
    low: 70_000,
    mid: 100_000,
    high: 150_000,
  },
  {
    level: 5,
    label: '撕裂傷+小疤',
    trigger: '縫合 ≤ 3 針，疤 < 3cm',
    low: 100_000,
    mid: 150_000,
    high: 200_000,
  },
  {
    level: 6,
    label: '撕裂傷+明疤',
    trigger: '縫合 4+ 針 / 疤 3-10cm',
    low: 150_000,
    mid: 250_000,
    high: 350_000,
  },
  {
    level: 7,
    label: '顏面疤/長疤',
    trigger: '疤 > 10cm 或顏面位置',
    low: 200_000,
    mid: 300_000,
    high: 500_000,
  },
  {
    level: 8,
    label: '簡單骨折',
    trigger: '單一骨折，住院 ≤ 14 天，開刀 0-1 次',
    low: 300_000,
    mid: 500_000,
    high: 700_000,
  },
  {
    level: 9,
    label: '複雜骨折',
    trigger: '多處/粉碎骨折，住院 15-30 天，開刀 1-2 次',
    low: 500_000,
    mid: 800_000,
    high: 1_200_000,
  },
  {
    level: 10,
    label: '韌帶/關節',
    trigger: '開刀 + 復健 20+ 次，關節活動受限',
    low: 600_000,
    mid: 1_000_000,
    high: 1_500_000,
  },
  {
    level: 11,
    label: '神經/肌腱',
    trigger: '神經/肌腱斷裂，住院 1 月+',
    low: 800_000,
    mid: 1_300_000,
    high: 2_000_000,
  },
  {
    level: 12,
    label: '脊椎/腦傷',
    trigger: '住院 > 30 天，復健 6 月+',
    low: 1_200_000,
    mid: 2_000_000,
    high: 3_000_000,
  },
  {
    level: 13,
    label: '失能輕度',
    trigger: '失能 11-15 級，永久障害',
    low: 1_000_000,
    mid: 1_800_000,
    high: 3_000_000,
  },
  {
    level: 14,
    label: '失能中度',
    trigger: '失能 7-10 級，永久障害',
    low: 2_000_000,
    mid: 3_500_000,
    high: 5_000_000,
  },
  {
    level: 15,
    label: '失能重度/極重',
    trigger: '失能 1-6 級 / 截肢 / 癱瘓',
    low: 3_000_000,
    mid: 5_000_000,
    high: 8_000_000,
  },
]

/** 從 1-based level 取 0-based index */
export function pasLevelIndex(level: number): number {
  if (level < 1) return 0
  if (level > 15) return 14
  return level - 1
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
  /** 總 multiplier（預期 0.7-1.6） */
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

const DEFAULT_OCCUPATION_FACTORS: Record<OccupationCategory, number> = {
  professional: 1.3,
  manager: 1.2,
  employed: 1.0,
  service: 1.0,
  farmer: 0.9,
  student: 0.9,
  unemployed: 0.85,
  retired: 0.9,
  homemaker: 0.9,
  other: 1.0,
}

const OCCUPATION_LABELS: Record<OccupationCategory, string> = {
  professional: '專業人士（律師/醫師/教授）',
  manager: '高階主管',
  employed: '一般受僱',
  service: '服務業',
  farmer: '農業',
  student: '學生',
  unemployed: '待業',
  retired: '退休',
  homemaker: '家管',
  other: '其他',
}

/**
 * 計算 Personal Factors multiplier
 *
 * 設計原則：
 * - 各維度 0.85-1.3 之間，不會極端放大或縮小
 * - 4 維度相乘（不是相加）以避免單一極端值
 * - 全部維度都中位 → multiplier = 1.0（不調整）
 */
export function personalFactorMultiplier(factors: PersonalFactors): PersonalFactorResult {
  // 年齡
  let ageFactor = 1.0
  let ageNote: string | null = null
  if (factors.age < 13) {
    ageFactor = 1.3
    ageNote = `未滿 13 歲 ×1.3（人格法益保護加強）`
  } else if (factors.age < 18) {
    ageFactor = 1.2
    ageNote = `13-17 歲少年 ×1.2`
  } else if (factors.age < 30) {
    ageFactor = 1.1
    ageNote = `18-29 歲青年 ×1.1`
  } else if (factors.age > 65) {
    ageFactor = 0.9
    ageNote = `65 歲以上高齡 ×0.9（壽命預期酌減）`
  }

  // 職業
  const occupationFactor = DEFAULT_OCCUPATION_FACTORS[factors.occupation] ?? 1.0
  const occupationNote =
    occupationFactor !== 1.0
      ? `${OCCUPATION_LABELS[factors.occupation]} ×${occupationFactor}`
      : null

  // 扶養人
  let dependentFactor = 1.0
  let dependentNote: string | null = null
  if (factors.dependentCount >= 4) {
    dependentFactor = 1.25
    dependentNote = `扶養 4+ 人 ×1.25`
  } else if (factors.dependentCount >= 2) {
    dependentFactor = 1.15
    dependentNote = `扶養 2-3 人 ×1.15`
  } else if (factors.dependentCount >= 1) {
    dependentFactor = 1.05
    dependentNote = `扶養 1 人 ×1.05`
  }

  // 勞減
  const laborLossFactor = factors.hasLaborLoss ? 1.3 : 1.0
  const laborLossNote = factors.hasLaborLoss ? '有勞動力減損（失能/永久障害）×1.3' : null

  const multiplier = ageFactor * occupationFactor * dependentFactor * laborLossFactor

  return {
    multiplier,
    ageFactor,
    ageNote,
    occupationFactor,
    occupationNote,
    dependentFactor,
    dependentNote,
    laborLossFactor,
    laborLossNote,
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
