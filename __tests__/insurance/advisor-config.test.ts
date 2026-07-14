// =====================================================================
// advisor-config 測試 — 環境設定 + 個資黑名單 + token 上限
//
// v0.6.4 新增：
//   - loadAdvisorConfig() 讀 process.env.ANTHROPIC_API_KEY + ANTHROPIC_BASE_URL + ANTHROPIC_MODEL
//   - validatePromptForPII(prompt) — regex 黑名單拒絕個資
//   - estimateTokenCount(prompt) — 約略估算 token（4 chars ≈ 1 token 啟發式）
// =====================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  loadAdvisorConfig,
  validatePromptForPII,
  estimateTokenCount,
} from '@/lib/insurance/advisor-config'

// =====================================================================
// loadAdvisorConfig
// =====================================================================

describe('loadAdvisorConfig', () => {
  // 隔離環境變數（不污染其他測試）
  const originalEnv = { ...process.env }

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_BASE_URL
    delete process.env.ANTHROPIC_MODEL
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('沒有 ANTHROPIC_API_KEY 時回傳 mock mode', () => {
    delete process.env.ANTHROPIC_API_KEY
    const config = loadAdvisorConfig()
    expect(config.mode).toBe('mock')
    expect(config.apiKey).toBeUndefined()
  })

  it('有 ANTHROPIC_API_KEY 但無 BASE_URL 時用預設 Anthropic 官方', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key'
    delete process.env.ANTHROPIC_BASE_URL
    const config = loadAdvisorConfig()
    expect(config.mode).toBe('live')
    expect(config.apiKey).toBe('sk-test-key')
    expect(config.baseUrl).toBe('https://api.anthropic.com')
    expect(config.model).toBe('claude-sonnet-4-5')
  })

  it('有 ANTHROPIC_BASE_URL 覆寫預設（給 Hermes proxy 用）', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key'
    process.env.ANTHROPIC_BASE_URL = 'https://api.minimax.io/anthropic'
    process.env.ANTHROPIC_MODEL = 'MiniMax-M3'
    const config = loadAdvisorConfig()
    expect(config.baseUrl).toBe('https://api.minimax.io/anthropic')
    expect(config.model).toBe('MiniMax-M3')
  })

  it('有 ANTHROPIC_MODEL 覆寫預設模型', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key'
    process.env.ANTHROPIC_MODEL = 'claude-fable-5'
    const config = loadAdvisorConfig()
    expect(config.model).toBe('claude-fable-5')
  })

  it('空字串 API_KEY 視為未設（mock mode）', () => {
    process.env.ANTHROPIC_API_KEY = ''
    const config = loadAdvisorConfig()
    expect(config.mode).toBe('mock')
  })

  it('回傳的 config 物件必包含 timeoutMs + maxRetries 預設值', () => {
    delete process.env.ANTHROPIC_API_KEY
    const config = loadAdvisorConfig()
    expect(config.timeoutMs).toBe(5000)
    expect(config.maxRetries).toBe(1)
  })
})

// =====================================================================
// validatePromptForPII — 個資黑名單
// =====================================================================

describe('validatePromptForPII', () => {
  const cleanPrompt = `
# 角色
你是臺灣車禍理賠複核顧問
# 案件資訊
- 法院：臺灣臺北地方法院
- 規則票：100,000 元（中度）
- 傷勢等級：level 6
`

  it('乾淨 prompt 通過（無個資）', () => {
    const result = validatePromptForPII(cleanPrompt)
    expect(result.clean).toBe(true)
    expect(result.detections).toEqual([])
  })

  it('偵測身分證字號（A123456789）', () => {
    const dirty = cleanPrompt + '\n保戶 ID: A123456789'
    const result = validatePromptForPII(dirty)
    expect(result.clean).toBe(false)
    expect(result.detections).toContainEqual(expect.objectContaining({ type: 'taiwan-id' }))
  })

  it('偵測身分證字號（F234567890 第二碼英文字母）', () => {
    const dirty = cleanPrompt + '\nF234567890 出險'
    const result = validatePromptForPII(dirty)
    expect(result.clean).toBe(false)
    expect(result.detections.some((d: { type: string }) => d.type === 'taiwan-id')).toBe(true)
  })

  it('偵測車牌號碼（ABC-1234）', () => {
    const dirty = cleanPrompt + '\n車牌 ABC-1234 撞'
    const result = validatePromptForPII(dirty)
    expect(result.clean).toBe(false)
    expect(result.detections.some((d: { type: string }) => d.type === 'license-plate')).toBe(true)
  })

  it('偵測車牌號碼（AB-5678）', () => {
    const dirty = cleanPrompt + '\nAB-5678 車損'
    const result = validatePromptForPII(dirty)
    expect(result.clean).toBe(false)
    expect(result.detections.some((d: { type: string }) => d.type === 'license-plate')).toBe(true)
  })

  it('偵測電話號碼（09 開頭 10 碼）', () => {
    const dirty = cleanPrompt + '\n聯絡：0912345678'
    const result = validatePromptForPII(dirty)
    expect(result.clean).toBe(false)
    expect(result.detections.some((d: { type: string }) => d.type === 'phone')).toBe(true)
  })

  it('多個個資一次回傳所有 detection', () => {
    const dirty = cleanPrompt + '\nA123456789 / 0912345678 / ABC-1234'
    const result = validatePromptForPII(dirty)
    expect(result.detections.length).toBeGreaterThanOrEqual(3)
  })

  it('純數字短字串不誤判為個資', () => {
    const dirty = cleanPrompt + '\n肇責比例：70% / 賠償 50000 元'
    const result = validatePromptForPII(dirty)
    expect(result.clean).toBe(true)
  })
})

// =====================================================================
// estimateTokenCount
// =====================================================================

describe('estimateTokenCount', () => {
  it('空字串回 0', () => {
    expect(estimateTokenCount('')).toBe(0)
  })

  it('短字串（小於 4 char）回 1', () => {
    expect(estimateTokenCount('abc')).toBe(1)
    expect(estimateTokenCount('臺')).toBe(1)
  })

  it('中文字符（每字 ≈ 1.5 token）— 32 中文字 ≈ 48 token', () => {
    const chinese = '臺灣車禍理賠複核顧問'.repeat(4) // 32 字
    const tokens = estimateTokenCount(chinese)
    expect(tokens).toBeGreaterThanOrEqual(40)
    expect(tokens).toBeLessThanOrEqual(60)
  })

  it('英文 token 估算（4 chars ≈ 1 token）', () => {
    const english = 'a'.repeat(400) // 400 chars
    expect(estimateTokenCount(english)).toBe(100)
  })

  it('混合中文 + 英文 token 估算合理', () => {
    const mixed = 'You are a helpful advisor. 你好'.repeat(10)
    const tokens = estimateTokenCount(mixed)
    expect(tokens).toBeGreaterThan(0)
  })

  it('超長 prompt (>4000 token) 回傳超過上限值 — 觸發拒絕', () => {
    const huge = 'a'.repeat(20000) // 5000 tokens
    const tokens = estimateTokenCount(huge)
    expect(tokens).toBeGreaterThan(4000)
  })
})
