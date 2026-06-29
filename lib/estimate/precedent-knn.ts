// =====================================================================
// Precedent KNN 引擎（v0.6.1）
//
// 設計：5 維特徵向量 + 純函式距離
//   1. city（county）：二元（match 0 / mismatch 1 / null-vs-null 0 / null-vs-value 0.5）
//   2. disability_level：|diff| / 15（正規化，0-1）
//   3. year：|diff| / 26（正規化到 2000-2026 範圍，0-1）
//   4. injury_severity：ordinal 距離（死亡=4 / 重傷=3 / 中=2 / 輕傷=1 / 失能=3）
//   5. has_disability_record：二元（0=兩者一致，1=不一致）
//
// 為什麼 v0.6.1 用 KNN？
//   - 既有 score() 硬編配權（+10 / +8 / +4 / +2 / +1）無正規化
//   - 維度權重無法調整，city 永遠 +10 比 year +2 大 5 倍，但實務可能反過來
//   - KNN 距離自動正規化（每維 0-1），加總可控
//   - 純函式 → 易測試、易理解、可解釋（顯示「為什麼這個案例被推薦」）
//
// 不取代 score()：findRelatedPracticeCases 同時計算 KNN distance 當排序依據
// 但保留 scrapedAt 當同分決勝（避免完全打散既有測試的預期）
// =====================================================================

/** 傷勢嚴重度（ordinal 編碼） */
export type InjurySeverity = 'death' | 'severe' | 'moderate' | 'minor' | 'disability'

/** 前例特徵向量 */
export interface PrecedentFeatures {
  /** 縣市（從 court 推導，null = 未知/和解） */
  city: string | null
  /** 失能等級（1-15，null = 案例無失能紀錄） */
  disabilityLevel: number | null
  /** 判決年份 */
  year: number
  /** 傷勢嚴重度（null = 案例未標記） */
  injurySeverity: InjurySeverity | null
  /** 是否有失能紀錄（二元） */
  hasDisabilityRecord: boolean
}

/** 嚴重度 → 數值映射 */
const SEVERITY_VALUE: Record<InjurySeverity, number> = {
  death: 4,
  severe: 3,
  moderate: 2,
  minor: 1,
  disability: 3,
}

const SEVERITY_MAX = 4  // death

/**
 * 計算兩個特徵向量的 KNN 距離（純函式）
 *
 * 設計：
 *   - 每維距離正規化到 [0, 1]
 *   - city null vs null → 0（不懲罰未知）
 *   - city null vs value → 0.5（中性，不當 mismatch 也不當 match）
 *   - city match → 0，mismatch → 1
 *   - 加總即為距離，越小越相似
 *
 * 不變量（測試守護）：
 *   - distance(a, a) === 0
 *   - distance(a, b) === distance(b, a)（對稱）
 *   - distance(a, b) >= 0
 *   - 5 維全極端 → distance <= 5
 */
export function computePrecedentDistance(a: PrecedentFeatures, b: PrecedentFeatures): number {
  // 1. city 維度
  let cityDist = 0
  if (a.city !== null && b.city !== null) {
    cityDist = a.city === b.city ? 0 : 1
  } else if (a.city !== null && b.city === null) {
    cityDist = 0.5  // 一邊有、一邊 null → 中性（不懲罰未知）
  } else if (a.city === null && b.city !== null) {
    cityDist = 0.5  // 同上（對稱）
  }
  // 兩邊 null → 0（不懲罰未知）

  // 2. disability_level 維度（正規化到 0-1，max diff = 15）
  let levelDist = 0
  if (a.disabilityLevel !== null && b.disabilityLevel !== null) {
    levelDist = Math.abs(a.disabilityLevel - b.disabilityLevel) / 15
  } else if (
    (a.disabilityLevel !== null && b.disabilityLevel === null) ||
    (a.disabilityLevel === null && b.disabilityLevel !== null)
  ) {
    levelDist = 0.5  // 一邊有、一邊無 → 中性
  }
  // 兩邊 null → 0

  // 3. year 維度（正規化到 26 年範圍 2000-2026）
  const yearDist = Math.abs(a.year - b.year) / 26

  // 4. injury_severity 維度
  let severityDist = 0
  if (a.injurySeverity !== null && b.injurySeverity !== null) {
    severityDist = Math.abs(SEVERITY_VALUE[a.injurySeverity] - SEVERITY_VALUE[b.injurySeverity]) / SEVERITY_MAX
  } else if (
    (a.injurySeverity !== null && b.injurySeverity === null) ||
    (a.injurySeverity === null && b.injurySeverity !== null)
  ) {
    severityDist = 0.5  // 一邊 null → 中性
  }
  // 兩邊 null → 0

  // 5. has_disability_record 維度（二元）
  const disabilityRecordDist = a.hasDisabilityRecord === b.hasDisabilityRecord ? 0 : 1

  return cityDist + levelDist + yearDist + severityDist + disabilityRecordDist
}

/**
 * KNN 5 維距離拆解（v0.7.3+ debug panel 用）
 *
 * 為什麼要拆？
 *   - 既有 computePrecedentDistance 只回加總距離，看不出「為什麼這個案例被推薦」
 *   - debug 模式要讓 UI 顯示每維貢獻（哪個維度最相似/最不同）
 *   - 純函式 → 易測試；總和必須等於 computePrecedentDistance(a, b)
 *
 * 不變量（測試守護）：
 *   - sum(breakdown) === computePrecedentDistance(a, b)
 *   - 每維值 ∈ [0, 1]
 *   - city null vs null → 0
 *   - city null vs value → 0.5
 */
export interface KnnDimensionBreakdown {
  /** 縣市維度距離（0=同縣市, 1=不同縣市, 0.5=一邊 null） */
  city: number
  /** 失能等級維度距離（|差|/15） */
  disabilityLevel: number
  /** 年份維度距離（|年差|/26） */
  year: number
  /** 傷勢嚴重度維度距離（ordinal 差/4） */
  injurySeverity: number
  /** 失能紀錄二元維度距離（0=一致, 1=不一致） */
  hasDisabilityRecord: number
}

export function computeDimensionDistances(a: PrecedentFeatures, b: PrecedentFeatures): KnnDimensionBreakdown {
  // 1. city 維度（重用 computePrecedentDistance 的邏輯）
  let city = 0
  if (a.city !== null && b.city !== null) {
    city = a.city === b.city ? 0 : 1
  } else if (
    (a.city !== null && b.city === null) ||
    (a.city === null && b.city !== null)
  ) {
    city = 0.5
  }

  // 2. disability_level 維度
  let disabilityLevel = 0
  if (a.disabilityLevel !== null && b.disabilityLevel !== null) {
    disabilityLevel = Math.abs(a.disabilityLevel - b.disabilityLevel) / 15
  } else if (
    (a.disabilityLevel !== null && b.disabilityLevel === null) ||
    (a.disabilityLevel === null && b.disabilityLevel !== null)
  ) {
    disabilityLevel = 0.5
  }

  // 3. year 維度
  const year = Math.abs(a.year - b.year) / 26

  // 4. injury_severity 維度
  let injurySeverity = 0
  if (a.injurySeverity !== null && b.injurySeverity !== null) {
    injurySeverity = Math.abs(SEVERITY_VALUE[a.injurySeverity] - SEVERITY_VALUE[b.injurySeverity]) / SEVERITY_MAX
  } else if (
    (a.injurySeverity !== null && b.injurySeverity === null) ||
    (a.injurySeverity === null && b.injurySeverity !== null)
  ) {
    injurySeverity = 0.5
  }

  // 5. has_disability_record 維度
  const hasDisabilityRecord = a.hasDisabilityRecord === b.hasDisabilityRecord ? 0 : 1

  return { city, disabilityLevel, year, injurySeverity, hasDisabilityRecord }
}

/**
 * 從原始 court + disabilityLevel + year 萃取特徵向量
 *
 * @param court 法院名稱（含「和解」「新北地方法院（和解）」等格式）
 * @param disabilityLevel 失能等級（null = 未知）
 * @param year 判決年份
 * @param hasDisabilityRecord 是否有失能紀錄（從 disabilities[] 推）
 * @param injurySeverity 傷勢嚴重度（null = 未知）
 */
export function extractFeatures(
  court: string,
  disabilityLevel: number | null,
  year: number,
  hasDisabilityRecord: boolean,
  injurySeverity: InjurySeverity | null = null,
): PrecedentFeatures {
  // city 萃取：透過 region-court-map.ts 的 courtToCity
  // 用動態 import 避免循環依賴（precedents.ts 已 import region-court-map）
  // 這裡延遲到 caller 處理（避免 SSR/client 雙環境 require）
  return {
    city: null,  // 由 caller 從 courtToCity 注入
    disabilityLevel,
    year,
    injurySeverity,
    hasDisabilityRecord,
  }
}

/**
 * 計算兩條前例的距離（給 findRelatedPracticeCases 用）
 *
 * 包裝層：負責 city 萃取（避免在純函式裡動態 require）
 */
export function precedentDistance(
  aCourt: string,
  aDisabilityLevel: number | null,
  aYear: number,
  aHasDisability: boolean,
  bCourt: string,
  bDisabilityLevel: number | null,
  bYear: number,
  bHasDisability: boolean,
  courtToCityFn: (court: string) => string | null,
): number {
  const aFeatures: PrecedentFeatures = {
    city: courtToCityFn(aCourt),
    disabilityLevel: aDisabilityLevel,
    year: aYear,
    injurySeverity: null,
    hasDisabilityRecord: aHasDisability,
  }
  const bFeatures: PrecedentFeatures = {
    city: courtToCityFn(bCourt),
    disabilityLevel: bDisabilityLevel,
    year: bYear,
    injurySeverity: null,
    hasDisabilityRecord: bHasDisability,
  }
  return computePrecedentDistance(aFeatures, bFeatures)
}
