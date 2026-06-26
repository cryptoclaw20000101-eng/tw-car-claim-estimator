// =====================================================================
// Prompt 長度不變量測試 — v0.6.4
//
// 守護 advisor prompt 在不同 KNN 件數下仍合理：
//   - 0 件 → 無 "KNN 票" 案號展開
//   - 100 件 → 全部展開，prompt 不爆量
//   - 200 件 → 超過上限自動摘要（不出現第 100 件之後的案號）
//
// 對應 pain-advisor.ts buildAdvisorPrompt 邏輯
// =====================================================================

import { describe, it, expect } from 'vitest'
import { buildAdvisorPrompt, type AdvisorInput } from '@/lib/insurance/pain-advisor'

function makeInput(knnCount: number): AdvisorInput {
  return {
    courtName: '臺灣臺北地方法院',
    rulesMid: 100000,
    rulesLevel: '中度',
    mlP50: 80000,
    mlConfidence: 'medium',
    knnAmount: 90000,
    knnCases: Array.from({ length: knnCount }, (_, i) => ({
      caseNo: `113 年度 北簡字 第 ${i} 號 — 臺灣臺北地方法院民事判決 — 車禍精神慰撫金`,
      amount: 100000,
    })),
    ensembleConsensus: 'strong',
    ensembleAmount: 90000,
    outlier: null,
    isDivergent: false,
    hasWarnings: false,
  }
}

describe('buildAdvisorPrompt — KNN 件數不變量', () => {
  it('KNN 0 件 → prompt 不含任何案號', () => {
    const prompt = buildAdvisorPrompt(makeInput(0))
    expect(prompt).not.toContain('案號')
  })

  it('KNN 100 件 → prompt 展開全部 100 件（每件都有「案號」前綴）', () => {
    const prompt = buildAdvisorPrompt(makeInput(100))
    // 出現次數應 = 100 件（每件一行「案號 xxx」）
    const matchCount = (prompt.match(/案號 /g) ?? []).length
    expect(matchCount).toBe(100)
  })

  it('KNN 200 件 → 超過 100 上限自動摘要（不展開第 100 件之後的案號）', () => {
    const prompt = buildAdvisorPrompt(makeInput(200))
    // 設計：100 件以下展開、100+ 摘要為「200 件」單行
    // 所以 prompt 內的「案號 xxx」出現次數應 ≤ 100
    const matchCount = (prompt.match(/案號 /g) ?? []).length
    expect(matchCount).toBeLessThanOrEqual(100)
    // 但 KNN 行應標示「200 件」摘要
    const knnLine = prompt.split('\n').find((l) => l.includes('KNN'))
    expect(knnLine).toContain('200 件')
  })

  it('prompt 長度隨 KNN 件數成長有上界（200 件 prompt < 10000 字元）', () => {
    const prompt = buildAdvisorPrompt(makeInput(200))
    // 啟發式上限：摘要後不該爆量
    // 中文 1 字 ≈ 3 bytes UTF-8，這裡只看 char length 簡單驗證
    expect(prompt.length).toBeLessThan(10000)
  })
})
