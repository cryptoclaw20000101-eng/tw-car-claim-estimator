// =====================================================================
// LLM 顧問設定 — v0.6.4
//
// 3 個純函式：
//   - loadAdvisorConfig() 讀 process.env.ANTHROPIC_*
//   - validatePromptForPII(prompt) 偵測個資
//   - estimateTokenCount(prompt) 估算 token
//
// 不裝任何 SDK — 維持 AGENTS.md §2.2 「零套件優先」精神
// 與 Claude API 通訊改用原生 fetch（見 advisor-api.ts）
// =====================================================================

import type { AdvisorCacheConfig } from './advisor-cache'

// --- 型別 ---------------------------------------------------------------

export type AdvisorMode = 'live' | 'mock'

export interface AdvisorConfig {
  /** 模式：有 API key → live；沒有 → mock（用 mockLLMAdvisor） */
  mode: AdvisorMode
  /** Anthropic API key（live 模式才有，mock 為 undefined） */
  apiKey?: string
  /** API base URL（預設 Anthropic 官方，Hermes proxy 覆寫） */
  baseUrl: string
  /** 模型 ID（預設 claude-sonnet-4-5，可覆寫） */
  model: string
  /** fetch timeout（毫秒） */
  timeoutMs: number
  /** 失敗重試次數 */
  maxRetries: number
  /** v0.7.7+：快取設定（不傳 = 預設啟用） */
  cache?: AdvisorCacheConfig
}

export interface PIIDetection {
  type: 'taiwan-id' | 'license-plate' | 'phone' | 'name-pattern'
  match: string
  position: number
}

export interface PIIValidationResult {
  clean: boolean
  detections: PIIDetection[]
}

// --- 常數 ---------------------------------------------------------------

const DEFAULT_BASE_URL = 'https://api.anthropic.com'
const DEFAULT_MODEL = 'claude-sonnet-4-5'
const DEFAULT_TIMEOUT_MS = 5000
const DEFAULT_MAX_RETRIES = 1
const MAX_PROMPT_TOKENS = 4000

// --- 個資黑名單 regex ---------------------------------------------------
//
// 來源：
//   - 身分證字號：1 英文字母 + 1 數字(1/2) + 8 數字
//   - 車牌：2-3 英文字母 + 4 數字（允許 - 分隔）
//   - 電話：09 開頭 + 8 數字

const TAIWAN_ID_RE = /\b[A-Z][12]\d{8}\b/g
const LICENSE_PLATE_RE = /\b[A-Z]{2,3}[-]?\d{4}\b/g
const PHONE_RE = /\b09\d{8}\b/g

// --- 純函式 1：loadAdvisorConfig ----------------------------------------

/**
 * 讀 process.env 載入設定
 *
 * 環境變數：
 *   - ANTHROPIC_API_KEY（必）— 設了就走 live mode，沒設走 mock mode
 *   - ANTHROPIC_BASE_URL（選）— 預設 Anthropic 官方，Hermes proxy 可覆寫
 *   - ANTHROPIC_MODEL（選）— 預設 claude-sonnet-4-5
 *
 * 注意：
 *   - 空字串 API key 視為未設（mock mode）
 *   - 不會 throw，永遠回傳 config
 */
export function loadAdvisorConfig(): AdvisorConfig {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  const baseUrl = process.env.ANTHROPIC_BASE_URL?.trim() || DEFAULT_BASE_URL
  const model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL

  if (!apiKey) {
    return {
      mode: 'mock',
      baseUrl,
      model,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      maxRetries: DEFAULT_MAX_RETRIES,
    }
  }

  return {
    mode: 'live',
    apiKey,
    baseUrl,
    model,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxRetries: DEFAULT_MAX_RETRIES,
  }
}

// --- 純函式 2：validatePromptForPII -------------------------------------

/**
 * 偵測 prompt 是否含個資
 *
 * 三類個資：
 *   - 身分證字號（A123456789）
 *   - 車牌（ABC-1234 / AB1234）
 *   - 手機（0912345678）
 *
 * @returns { clean, detections } — clean=true 表示安全
 */
export function validatePromptForPII(prompt: string): PIIValidationResult {
  const detections: PIIDetection[] = []

  // 身分證字號
  for (const m of prompt.matchAll(TAIWAN_ID_RE)) {
    detections.push({
      type: 'taiwan-id',
      match: m[0],
      position: m.index ?? 0,
    })
  }

  // 車牌
  for (const m of prompt.matchAll(LICENSE_PLATE_RE)) {
    detections.push({
      type: 'license-plate',
      match: m[0],
      position: m.index ?? 0,
    })
  }

  // 手機
  for (const m of prompt.matchAll(PHONE_RE)) {
    detections.push({
      type: 'phone',
      match: m[0],
      position: m.index ?? 0,
    })
  }

  return {
    clean: detections.length === 0,
    detections,
  }
}

// --- 純函式 3：estimateTokenCount ---------------------------------------

/**
 * 約略估算 prompt 的 token 數
 *
 * 啟發式：
 *   - 中文：每字 ≈ 1.5 token（BPE 常見比例）
 *   - 英文：每 4 字 ≈ 1 token（cl100k_base 平均）
 *
 * @returns token 數（整數）
 *
 * 注意：實際 LLM token 數依 tokenizer 不同，這只是上限檢查用
 *       超過 MAX_PROMPT_TOKENS (4000) 會被拒絕送出
 */
export function estimateTokenCount(prompt: string): number {
  if (!prompt) return 0

  let tokens = 0
  for (const ch of prompt) {
    // CJK 統一漢字範圍
    if (/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/.test(ch)) {
      tokens += 1.5
    } else {
      tokens += 0.25 // 4 chars = 1 token → 1 char = 0.25 token
    }
  }

  // 短字串下限保護（避免 1.5 被 Math.ceil 成 2）
  if (tokens <= 2) return 1
  return Math.ceil(tokens)
}

// --- 匯出常數 -----------------------------------------------------------

export { MAX_PROMPT_TOKENS }
