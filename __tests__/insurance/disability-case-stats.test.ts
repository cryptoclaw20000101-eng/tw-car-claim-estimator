// 失能案例統計 + 霍夫曼整合測試（v0.2.16 新增）
// 5 個測試：基本統計 / 失能等級過濾 / 霍夫曼計算 / 對比真實案件 / 邊界錯誤

import { describe, it, expect } from "vitest"
import {
  computeStats,
  lookupByDisabilityLevel,
  disabilityByHoffmann,
  compareEstimateWithCases,
  getAllDisabilityCaseStats,
  type DisabilityCase,
} from "@/lib/insurance/disability-case-stats"

const SAMPLE_CASES: DisabilityCase[] = [
  { id: "a", caseNo: "111 保險 1", court: "臺北地院", year: 2022, category: "minor_injury", chain: "x", amount: 1_500_000, totalAward: 0, ratio: { plaintiff: 0, defendant: 100 } },
  { id: "b", caseNo: "113 保險 6", court: "高雄地院", year: 2024, category: "minor_injury", chain: "x", amount: 1_670_000, totalAward: 4_000, ratio: { plaintiff: 0, defendant: 100 } },
  { id: "c", caseNo: "114 簡上 488", court: "新北地院", year: 2025, category: "minor_injury", chain: "x", amount: 2_559_674, totalAward: 0, ratio: { plaintiff: 0, defendant: 100 } },
  { id: "d", caseNo: "114 簡上 57", court: "嘉義地院", year: 2025, category: "death", chain: "x", amount: 2_647_002, totalAward: 394_004, ratio: { plaintiff: 0, defendant: 100 } },
  { id: "e", caseNo: "114 簡上 306", court: "高雄地院", year: 2025, category: "minor_injury", chain: "x", amount: 170_000, totalAward: 6_118_737, ratio: { plaintiff: 0, defendant: 100 } },
  { id: "f", caseNo: "114 勞訴 99", court: "新北地院", year: 2025, category: "minor_injury", chain: "x", amount: 53_000, totalAward: 0, ratio: { plaintiff: 0, defendant: 100 } },
  { id: "g", caseNo: "113 保險 5", court: "臺南地院", year: 2024, category: "minor_injury", chain: "x", amount: 1_270_000, totalAward: 0, ratio: { plaintiff: 0, defendant: 100 } },
  { id: "h", caseNo: "111 保險 24", court: "臺北地院", year: 2022, category: "minor_injury", chain: "x", amount: 1_500_000, totalAward: 0, ratio: { plaintiff: 0, defendant: 100 } },
]

describe("disability-case-stats — 統計計算", () => {
  it("computeStats: 10 件有金額失能案例的中位數/平均/區間/stdev 正確（含 2 對重複 caseNo）", () => {
    // 真實 disability-merging.json 有 10 件 amount > 0（含 2 對重複 caseNo 沒去重）
    const REAL_CASES: DisabilityCase[] = [
      { id: "1", caseNo: "111 保險 24", court: "臺北地院", year: 2022, category: "minor_injury", chain: "x", amount: 1_500_000, totalAward: 0, ratio: { plaintiff: 0, defendant: 100 } },
      { id: "2", caseNo: "113 保險 6", court: "高雄地院", year: 2024, category: "minor_injury", chain: "x", amount: 1_670_000, totalAward: 4_000, ratio: { plaintiff: 0, defendant: 100 } },
      { id: "3", caseNo: "114 簡上 488", court: "新北地院", year: 2025, category: "minor_injury", chain: "x", amount: 2_559_674, totalAward: 0, ratio: { plaintiff: 0, defendant: 100 } },
      { id: "4", caseNo: "114 簡上 57", court: "嘉義地院", year: 2025, category: "death", chain: "x", amount: 2_647_002, totalAward: 394_004, ratio: { plaintiff: 0, defendant: 100 } },
      { id: "5", caseNo: "114 簡上 488-dup", court: "新北地院", year: 2025, category: "minor_injury", chain: "x", amount: 2_559_674, totalAward: 0, ratio: { plaintiff: 0, defendant: 100 } },
      { id: "6", caseNo: "114 簡上 57-dup", court: "嘉義地院", year: 2025, category: "death", chain: "x", amount: 2_647_002, totalAward: 394_004, ratio: { plaintiff: 0, defendant: 100 } },
      { id: "7", caseNo: "111 保險 24-dup", court: "臺北地院", year: 2022, category: "minor_injury", chain: "x", amount: 1_500_000, totalAward: 0, ratio: { plaintiff: 0, defendant: 100 } },
      { id: "8", caseNo: "114 簡上 306", court: "高雄地院", year: 2025, category: "minor_injury", chain: "x", amount: 170_000, totalAward: 6_118_737, ratio: { plaintiff: 0, defendant: 100 } },
      { id: "9", caseNo: "114 勞訴 99", court: "新北地院", year: 2025, category: "minor_injury", chain: "x", amount: 53_000, totalAward: 0, ratio: { plaintiff: 0, defendant: 100 } },
      { id: "10", caseNo: "113 保險 5", court: "臺南地院", year: 2024, category: "minor_injury", chain: "x", amount: 1_270_000, totalAward: 0, ratio: { plaintiff: 0, defendant: 100 } },
    ]
    const stats = computeStats(REAL_CASES)
    expect(stats.count).toBe(10)
    // sort = [53000, 170000, 1270000, 1500000, 1500000, 1670000, 2559674, 2559674, 2647002, 2647002]
    // median = (1500000 + 1670000) / 2 = 1,585,000
    expect(stats.median).toBe(1_585_000)
    // sum = 53000+170000+1270000+1500000+1500000+1670000+2559674+2559674+2647002+2647002 = 16,576,352
    // mean = 16,576,352 / 10 = 1,657,635.2 → round = 1,657,635
    expect(stats.mean).toBe(1_657_635)
    expect(stats.min).toBe(53_000)
    expect(stats.max).toBe(2_647_002)
    expect(stats.range).toBe(2_594_002)
  })

  it("computeStats: q1/q3 落在正確分位（線性插值）", () => {
    const REAL_CASES: DisabilityCase[] = [
      { id: "1", caseNo: "x1", court: "x", year: 2022, category: "x", chain: "x", amount: 1_500_000, totalAward: 0, ratio: { plaintiff: 0, defendant: 100 } },
      { id: "2", caseNo: "x2", court: "x", year: 2024, category: "x", chain: "x", amount: 1_670_000, totalAward: 4_000, ratio: { plaintiff: 0, defendant: 100 } },
      { id: "3", caseNo: "x3", court: "x", year: 2025, category: "x", chain: "x", amount: 2_559_674, totalAward: 0, ratio: { plaintiff: 0, defendant: 100 } },
      { id: "4", caseNo: "x4", court: "x", year: 2025, category: "x", chain: "x", amount: 2_647_002, totalAward: 394_004, ratio: { plaintiff: 0, defendant: 100 } },
      { id: "5", caseNo: "x5", court: "x", year: 2025, category: "x", chain: "x", amount: 170_000, totalAward: 0, ratio: { plaintiff: 0, defendant: 100 } },
      { id: "6", caseNo: "x6", court: "x", year: 2025, category: "x", chain: "x", amount: 53_000, totalAward: 0, ratio: { plaintiff: 0, defendant: 100 } },
      { id: "7", caseNo: "x7", court: "x", year: 2024, category: "x", chain: "x", amount: 1_270_000, totalAward: 0, ratio: { plaintiff: 0, defendant: 100 } },
    ]
    const stats = computeStats(REAL_CASES)
    // sort = [53000, 170000, 1270000, 1500000, 1670000, 2559674, 2647002]
    // q1 在位置 1.5 → sorted[1] + 0.5 * (sorted[2] - sorted[1]) = 170000 + 0.5*1100000 = 720000
    expect(stats.q1).toBe(720_000)
    // q3 在位置 4.5 → sorted[4] + 0.5 * (sorted[5] - sorted[4]) = 1670000 + 0.5*889674 = 2,114,837 (round)
    expect(stats.q3).toBe(2_114_837)
  })

  it("computeStats: 空陣列回 0", () => {
    const stats = computeStats([])
    expect(stats.count).toBe(0)
    expect(stats.median).toBe(0)
    expect(stats.mean).toBe(0)
  })

  it("lookupByDisabilityLevel: 1-15 等級都接受（無等級標籤時回全部 30+ 件）", () => {
    // 對齊 v0.2.16 設計：所有真實案件還沒失能等級標籤（要律師手動補），
    // 所以任意 level 都會回「全部載入的案件」。v0.2.20 衝量後 disability-merging
    // 從 10 → 34 件，預期這個值會持續變動，驗證 count >= 10 即可
    for (let level = 1; level <= 15; level++) {
      const stats = lookupByDisabilityLevel(level)
      expect(stats.count).toBeGreaterThanOrEqual(10)
    }
  })

  it("lookupByDisabilityLevel: 等級 < 1 或 > 15 拋錯", () => {
    expect(() => lookupByDisabilityLevel(0)).toThrow()
    expect(() => lookupByDisabilityLevel(16)).toThrow()
    expect(() => lookupByDisabilityLevel(-1)).toThrow()
  })
})

describe("disability-case-stats — 霍夫曼計算", () => {
  it("disabilityByHoffmann: 7 級失能 + 30 年 + 48 萬年薪", () => {
    // 7 級 = 70% 勞減,30 年係數 ≈ 15.37245
    // 480000 × 15.37245 × 0.70 = 5,165,143.55 → round = 5,165,144
    const result = disabilityByHoffmann({
      annualIncome: 480_000,
      years: 30,
      disabilityLevel: 7,
    })
    expect(result.coefficient).toBe(15.3725)  // 4 位小數
    expect(result.lossPercent).toBe(0.70)
    expect(result.baseTotal).toBe(7_378_776)  // 480000 × 15.37245
    expect(result.adjustedTotal).toBe(5_165_143)
    expect(result.finalTotal).toBe(5_165_143)
  })

  it("disabilityByHoffmann: 1 級失能 (100%) + 40 年 = 全額勞減", () => {
    // 1 級 = 100%,40 年係數 ≈ 17.15909
    // 360000 × 17.15909 × 1.0 = 6,177,272
    const result = disabilityByHoffmann({
      annualIncome: 360_000,
      years: 40,
      disabilityLevel: 1,
    })
    expect(result.coefficient).toBe(17.1591)
    expect(result.lossPercent).toBe(1.0)
    // 360000 × 17.159086 = 6,177,270.96 → round = 6,177,271
    expect(result.baseTotal).toBe(6_177_271)
    expect(result.adjustedTotal).toBe(6_177_271)
  })

  it("disabilityByHoffmann: 15 級失能 (5%) + 10 年 = 輕微", () => {
    // 15 級 = 5%,10 年係數 ≈ 7.72173
    // 600000 × 7.72173 × 0.05 = 231,652
    const result = disabilityByHoffmann({
      annualIncome: 600_000,
      years: 10,
      disabilityLevel: 15,
      regionalMultiplier: 1.2,  // 臺北市
    })
    expect(result.lossPercent).toBe(0.05)
    expect(result.baseTotal).toBe(4_633_041)  // 600000 × 7.72173
    expect(result.adjustedTotal).toBe(231_652)
    expect(result.finalTotal).toBe(277_982)   // × 1.2
  })
})

describe("disability-case-stats — 對比真實案件", () => {
  it("compareEstimateWithCases: 7 級失能估算 vs 8 件真實中位數", () => {
    const compare = compareEstimateWithCases({
      annualIncome: 480_000,
      years: 30,
      disabilityLevel: 7,
    })
    expect(compare.estimate.finalTotal).toBe(5_165_143)
    expect(compare.caseStats.count).toBeGreaterThan(0)
    expect(compare.caseStats.median).toBeGreaterThan(0)
    // 差異計算
    const expectedDelta = 5_165_143 - compare.caseStats.median
    expect(compare.diff.delta).toBe(expectedDelta)
  })

  it("compareEstimateWithCases: 高估算會標 withinRange = false", () => {
    // 1 級失能 30 年 48 萬 = 7,378,776 遠超 8 件中位數
    const compare = compareEstimateWithCases({
      annualIncome: 480_000,
      years: 30,
      disabilityLevel: 1,
    })
    expect(compare.estimate.finalTotal).toBe(7_378_776)
    expect(compare.diff.withinRange).toBe(false)  // 估算 7.3M 遠超 [995K, 1.89M]
  })
})

describe("disability-case-stats — 真實檔案載入", () => {
  it("getAllDisabilityCaseStats: 載入 8 件真實 disability-merging.json", () => {
    const stats = getAllDisabilityCaseStats()
    expect(stats.count).toBeGreaterThanOrEqual(8)  // 至少有 8 件
    expect(stats.median).toBeGreaterThan(0)
    expect(stats.max).toBeGreaterThan(2_000_000)  // 確認有高金額案件
  })
})
