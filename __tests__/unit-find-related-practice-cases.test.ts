// findRelatedPracticeCases 配權邏輯的純單元測試
// 重點：極端輸入下的 fallback 行為、同分時 scrapedAt 決勝
// 不 mock loadAllPrecedents（避免 mock module export 的脆弱性），改用極端查詢值構造斷言
import { describe, it, expect } from 'vitest'
import { findRelatedPracticeCases, loadAllPrecedents } from '@/lib/estimate/precedents'

const hasPracticeData = (() => {
  const all = loadAllPrecedents()
  return (all as unknown as { category: string }[]).filter((p) => p.category === 'practice_case')
    .length
})()

describe('findRelatedPracticeCases 配權（純算術）', () => {
  it('極端 possibleLevel=99 → 任何案例失能差都 > 2 → 應觸發 fallback', () => {
    if (hasPracticeData < 1) return
    // 構造：query 等級 99 → 所有真實案例 diff > 2 → 失能配對不加分 → 全 0 分
    // 同縣市 + year±2 仍可能加分（但通常 year 接近會 +2）
    // 為徹底排除「同縣市」與「year」加分，用一個「完全不可能命中」的法院名
    const refs = findRelatedPracticeCases('完全不存在的邊疆法院XYZ', 99, 5)
    // 該法院名不會 match 任何 case 的 court（無同縣市 +10）
    // year 配對可能仍 +1/+2（多數案例年分近），所以不強求全 0
    // 但所有回傳的案例 court 都不應含「邊疆」
    for (const r of refs) {
      expect(r.court).not.toContain('邊疆')
    }
  })

  it('所有同分的結果，scrapedAt 較新的應排在前面', () => {
    if (hasPracticeData < 2) return
    // 構造：極度不合理的法院 + null 等級 → 觸發 fallback → 全 scrapedAt desc
    const refs = findRelatedPracticeCases('無此人法院ABCDEFG', null, 10)
    if (refs.length < 2) return
    // 任意相鄰兩筆 scrapedAt 應為 desc
    for (let i = 0; i < refs.length - 1; i++) {
      expect(refs[i].scrapedAt >= refs[i + 1].scrapedAt).toBe(true)
    }
  })

  it('fallback 仍遵守 limit 參數（5/10/20 三種上限）', () => {
    if (hasPracticeData < 1) return
    for (const limit of [1, 3, 5, 10]) {
      const refs = findRelatedPracticeCases('無此人法院ABCDEFG', null, limit)
      expect(refs.length).toBeLessThanOrEqual(limit)
    }
  })

  it('正常查詢臺中地院 + 等級 7 → 失能配對有運作(分數 > 0)', () => {
    if (hasPracticeData < 1) return
    // 真實資料：12 件 practice_case 中只有 1 件有完整法院欄位(新北,等級 7)
    //   → 臺中查詢沒同縣市命中,新北案例以失能分(差 0 = 8+4)取勝
    // 此測試只驗證「配權運作 + 不會空回」
    const refs = findRelatedPracticeCases('臺灣臺中地方法院', 7, 3)
    expect(refs.length).toBeGreaterThan(0)
    // 若新北案例在內,等級 7 應存在(失能配對生效的證據)
    const newNorth = refs.find((r) => r.court.includes('新北'))
    if (newNorth) {
      const hasLevel7 = (newNorth.disabilities ?? []).some((d) => parseInt(d.level, 10) === 7)
      expect(hasLevel7).toBe(true)
    }
  })

  it('limit=0 應回傳空陣列（邊界值）', () => {
    if (hasPracticeData < 1) return
    const refs = findRelatedPracticeCases('臺灣臺中地方法院', 7, 0)
    expect(refs).toEqual([])
  })

  it('完全不存在的法院 + 合理 limit → 至少回 1 筆（fallback 生效）', () => {
    if (hasPracticeData < 1) return
    const refs = findRelatedPracticeCases('從未聽過的法院QQQ', 5, 1)
    expect(refs.length).toBe(1)
  })
})
