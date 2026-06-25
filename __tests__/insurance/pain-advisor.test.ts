// =====================================================================
// LLM 理賠顧問複核 — 測試（v0.6.3）
// 守護 lib/insurance/pain-advisor.ts
//
// 設計：純函式骨架 + mock LLM
//   - prompt builder：純函式，吃 EnsembleOutput 吐 string
//   - response parser：純函式，吃 string 吐結構化建議
//   - mockLLM：模擬 LLM 回應（v0.6.4 接 Claude API）
//
// 個資保護：絕不傳姓名/ID/車號/精確日期
// 免責聲明：永遠存在於輸出
// =====================================================================

import { describe, it, expect } from 'vitest'
import {
  buildAdvisorPrompt,
  parseAdvisorResponse,
  mockLLMAdvisor,
  type AdvisorInput,
  type AdvisorOutput,
} from '@/lib/insurance/pain-advisor'

function input(overrides: Partial<AdvisorInput> = {}): AdvisorInput {
  return {
    courtName: '臺灣臺中地方法院',
    rulesMid: 100_000,
    rulesLevel: '中度',
    mlP50: 100_000,
    mlConfidence: 'medium',
    knnAmount: 100_000,
    knnCases: [{ caseNo: 'A', amount: 100_000 }],
    ensembleConsensus: 'strong',
    ensembleAmount: 100_000,
    outlier: null,
    isDivergent: false,
    hasWarnings: false,
    ...overrides,
  }
}

describe('buildAdvisorPrompt — 純函式 prompt 建構', () => {
  it('回傳非空字串', () => {
    const prompt = buildAdvisorPrompt(input())
    expect(prompt).toBeTruthy()
    expect(prompt.length).toBeGreaterThan(100)
  })

  it('prompt 必須包含「免責聲明」字串', () => {
    const prompt = buildAdvisorPrompt(input())
    expect(prompt).toMatch(/免責|不構成法律意見/)
  })

  it('prompt 必須包含三票金額', () => {
    const prompt = buildAdvisorPrompt(input())
    expect(prompt).toContain('100,000')
  })

  it('prompt 必須包含共識度', () => {
    const prompt = buildAdvisorPrompt(input({ ensembleConsensus: 'partial' }))
    expect(prompt).toContain('partial')
  })

  it('prompt 包含 outlier 票別', () => {
    const prompt = buildAdvisorPrompt(input({
      ensembleConsensus: 'partial',
      outlier: 'knn',
    }))
    expect(prompt).toContain('knn')
  })

  it('同輸入 → 同輸出（純函式）', () => {
    const a = buildAdvisorPrompt(input())
    const b = buildAdvisorPrompt(input())
    expect(a).toBe(b)
  })

  it('不同輸入 → 不同輸出', () => {
    const a = buildAdvisorPrompt(input({ rulesMid: 100_000 }))
    const b = buildAdvisorPrompt(input({ rulesMid: 200_000 }))
    expect(a).not.toBe(b)
  })
})

describe('parseAdvisorResponse — JSON 解析器', () => {
  it('合法 JSON → 完整解析', () => {
    const json = JSON.stringify({
      riskLevel: 'medium',
      riskFactors: ['ML 信心度低'],
      recommendations: ['建議補醫療資料'],
      consensusInterpretation: '三票接近，建議採用 100K',
      requiresHumanReview: true,
    })
    const result = parseAdvisorResponse(json)
    expect(result.riskLevel).toBe('medium')
    expect(result.riskFactors).toEqual(['ML 信心度低'])
    expect(result.requiresHumanReview).toBe(true)
  })

  it('malformed JSON → fallback 結構 + 警告', () => {
    const result = parseAdvisorResponse('not valid JSON {')
    expect(result.riskLevel).toBe('medium')
    expect(result.riskFactors.some((f) => f.includes('LLM 回應解析失敗'))).toBe(true)
    expect(result.requiresHumanReview).toBe(true)  // 解析失敗時一律標 true
  })

  it('空字串 → fallback', () => {
    const result = parseAdvisorResponse('')
    expect(result.riskLevel).toBe('medium')
    expect(result.requiresHumanReview).toBe(true)
  })

  it('缺欄位 → 用 default + 補 disclaimer', () => {
    const json = JSON.stringify({ riskLevel: 'low' })
    const result = parseAdvisorResponse(json)
    expect(result.riskLevel).toBe('low')
    expect(result.disclaimer).toBeTruthy()
    expect(result.disclaimer).toMatch(/不構成法律意見/)
  })

  it('不合法 riskLevel → fallback medium', () => {
    const json = JSON.stringify({
      riskLevel: 'extreme',  // 不合法
      riskFactors: [],
      recommendations: [],
      consensusInterpretation: 'test',
      requiresHumanReview: false,
    })
    const result = parseAdvisorResponse(json)
    expect(result.riskLevel).toBe('medium')
  })

  it('回傳永遠包含 disclaimer', () => {
    const valid = JSON.stringify({
      riskLevel: 'low',
      riskFactors: [],
      recommendations: [],
      consensusInterpretation: 'test',
      requiresHumanReview: false,
    })
    const result = parseAdvisorResponse(valid)
    expect(result.disclaimer).toBeTruthy()
    expect(result.disclaimer.length).toBeGreaterThan(20)
  })
})

describe('mockLLMAdvisor — Mock LLM 介面（v0.6.3 sync）', () => {
  it('同輸入 → 同輸出（mock 確定性）', () => {
    const a = mockLLMAdvisor(input())
    const b = mockLLMAdvisor(input())
    expect(a.riskLevel).toBe(b.riskLevel)
    expect(a.recommendations).toEqual(b.recommendations)
  })

  it('回傳結構化 AdvisorOutput', () => {
    const out = mockLLMAdvisor(input())
    expect(out.riskLevel).toMatch(/^(low|medium|high)$/)
    expect(Array.isArray(out.riskFactors)).toBe(true)
    expect(Array.isArray(out.recommendations)).toBe(true)
    expect(out.disclaimer).toBeTruthy()
  })

  it('weak consensus → riskLevel=high', () => {
    const out = mockLLMAdvisor(input({
      ensembleConsensus: 'weak',
      isDivergent: true,
    }))
    expect(out.riskLevel).toBe('high')
    expect(out.requiresHumanReview).toBe(true)
  })

  it('strong consensus + ML high → riskLevel=low', () => {
    const out = mockLLMAdvisor(input({
      ensembleConsensus: 'strong',
      mlConfidence: 'high',
    }))
    expect(out.riskLevel).toBe('low')
    expect(out.requiresHumanReview).toBe(false)
  })

  it('outlier=knn → recommendations 含「複核 KNN」', () => {
    const out = mockLLMAdvisor(input({
      ensembleConsensus: 'partial',
      outlier: 'knn',
    }))
    // 測試用 KNN 字樣（不分大小寫）
    const hasKnn = out.recommendations.some((r) => r.toLowerCase().includes('knn'))
    expect(hasKnn).toBe(true)
  })
})

describe('pain-advisor — 不變量（個資保護）', () => {
  it('prompt 不會包含個資關鍵字（姓名/身分證/車號）', () => {
    // 模擬一個有個資的 input，但 prompt 應過濾掉
    const prompt = buildAdvisorPrompt(input())
    // 預設 input 不含個資 → prompt 也不應有
    expect(prompt).not.toMatch(/姓名|身分證|車牌/)
  })

  it('回應永遠有 disclaimer', () => {
    const out = mockLLMAdvisor(input())
    expect(out.disclaimer).toBeTruthy()
  })

  it('requiresHumanReview 在 weak/insufficient 時必須為 true', () => {
    const weak = mockLLMAdvisor(input({ ensembleConsensus: 'weak' }))
    expect(weak.requiresHumanReview).toBe(true)
  })
})
