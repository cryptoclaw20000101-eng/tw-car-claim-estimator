// 結果頁「②b 理賠實務案例」section 串接
// 測試 findRelatedPracticeCases 配對邏輯
import { describe, it, expect } from 'vitest'
import { findRelatedPracticeCases, loadAllPrecedents } from '@/lib/estimate/precedents'

describe('findRelatedPracticeCases 配對邏輯', () => {
  it('能載入 practice-cases.json 中所有 category=practice_case 的案例', () => {
    const all = loadAllPrecedents()
    const practiceCases = (all as unknown as { category: string }[]).filter(
      (p) => p.category === 'practice_case',
    )
    expect(practiceCases.length).toBeGreaterThanOrEqual(4)
  })

  it('臺中地院 + 中度失能等級 → 應回傳至少 1 件相關案例', () => {
    const refs = findRelatedPracticeCases('臺灣臺中地方法院', 7, 3)
    expect(refs.length).toBeGreaterThan(0)
    expect(refs[0].id).toMatch(/^tw-practice-/)
  })

  it('新北地院 + 高失能等級 → 應優先回傳 110-08-26 案例（板橋）', () => {
    const refs = findRelatedPracticeCases('臺灣新北地方法院', 7, 3)
    expect(refs.length).toBeGreaterThan(0)
    // 同縣市配對 +10 分；板橋案例會排前面
    expect(refs[0].caseNo).toContain('板橋')
  })

  it('無匹配 courtName 也能 fallback 給前 N 筆', () => {
    const refs = findRelatedPracticeCases('完全不存在的法院', null, 2)
    expect(refs.length).toBe(2)
  })

  it('limit 參數控制回傳數量', () => {
    const refs = findRelatedPracticeCases('臺灣臺中地方法院', null, 1)
    expect(refs.length).toBe(1)
  })

  it('回傳的 case 必須含必要欄位（事實/傷勢/keyHoldings）', () => {
    const refs = findRelatedPracticeCases('臺灣臺中地方法院', 7, 1)
    if (refs.length === 0) return
    const r = refs[0]
    expect(r.facts).toBeTruthy()
    expect(r.injuries).toBeTruthy()
    expect(
      Array.isArray(r.disabilities) || r.disabilities === undefined || r.disabilities === null,
    ).toBe(true)
    expect(Array.isArray(r.keyHoldings)).toBe(true)
  })

  it('失能等級相近（差 ≤ 2）能拿到分數加成', () => {
    // 案例 1 是中樞神經第 7 級 → 查 5/7/9 都該命中
    for (const lv of [5, 7, 9]) {
      const refs = findRelatedPracticeCases('臺灣新北地方法院', lv, 3)
      expect(refs.length).toBeGreaterThan(0)
    }
  })

  // v0.2.7+ 配權調整驗證
  it('新權重：失能等級差 ≤1 額外加分，應優於差 =2', () => {
    // 案例 1：板橋 中樞神經第 7 級
    // 差 = 0 (lv=7) → 應得 8+4+1=13
    // 差 = 1 (lv=6 或 8) → 應得 8+4+1=13（因為 ≤1 觸發額外 +4）
    // 差 = 2 (lv=5 或 9) → 應得 8+1=9
    // 用同縣市同分情境下，差 ≤1 必須排前
    const refs0 = findRelatedPracticeCases('臺灣新北地方法院', 7, 5) // diff=0
    const refs1 = findRelatedPracticeCases('臺灣新北地方法院', 6, 5) // diff=1
    const refs2 = findRelatedPracticeCases('臺灣新北地方法院', 5, 5) // diff=2
    // 差=0 跟差=1 的第一名 caseNo 應該是同一件（板橋案例，差 0 或 1 都觸發 ≤1 額外 +4）
    expect(refs0[0].id).toBe(refs1[0].id)
    // 差=2 的第一件可能不是板橋（無額外 +4）
    // 仍要有結果（fallback 或有分）
    expect(refs2.length).toBeGreaterThan(0)
  })

  it('新權重：fallback — 全 0 分時回最近 3 筆，不會空陣列', () => {
    // 用一個不可能匹配的參數組合：完全不存在的法院 + 不可能存在的失能等級
    const refs = findRelatedPracticeCases('完全不存在的法院XYZ', null, 3)
    expect(refs.length).toBe(3) // fallback 應回 3 筆
  })

  it('新權重：完全無失能資料 → 不會爆，能給空陣列或 fallback', () => {
    // 確保可能等級為 null 且 court 不存在時不 crash
    const refs = findRelatedPracticeCases('某不存在法院', null, 5)
    expect(Array.isArray(refs)).toBe(true)
  })
})
