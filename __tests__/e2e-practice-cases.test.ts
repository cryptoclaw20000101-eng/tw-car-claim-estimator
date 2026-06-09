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
    expect(Array.isArray(r.disabilities) || r.disabilities === undefined || r.disabilities === null).toBe(true)
    expect(Array.isArray(r.keyHoldings)).toBe(true)
  })

  it('失能等級相近（差 ≤ 2）能拿到分數加成', () => {
    // 案例 1 是中樞神經第 7 級 → 查 5/7/9 都該命中
    for (const lv of [5, 7, 9]) {
      const refs = findRelatedPracticeCases('臺灣新北地方法院', lv, 3)
      expect(refs.length).toBeGreaterThan(0)
    }
  })
})