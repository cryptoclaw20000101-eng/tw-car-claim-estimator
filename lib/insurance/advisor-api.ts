// =====================================================================
// LLM 顧問 API — v0.6.4
//
// callClaudeAdvisor(input, config) — async 呼叫 Claude API
//
// 設計原則：
//   - 不裝 SDK（fetch + 手刻 JSON，符合 AGENTS.md §2.2「零套件」精神）
//   - 失敗 / 個資 / token 超限 → fallback mockLLMAdvisor（永遠不讓 LLM 變單點失敗）
//   - 5s timeout + 1 retry（防 API hang）
//   - 回傳 AdvisorApiResult 含 mode + fallbackReason（給 UI debug）
// =====================================================================

import {
  buildAdvisorPrompt,
  parseAdvisorResponse,
  mockLLMAdvisor,
  type AdvisorInput,
  type AdvisorOutput,
} from './pain-advisor'
import {
  loadAdvisorConfig,
  validatePromptForPII,
  estimateTokenCount,
  MAX_PROMPT_TOKENS,
  type AdvisorConfig,
} from './advisor-config'
import { getCachedAdvisor, setCachedAdvisor } from './advisor-cache'

// --- 型別 ---------------------------------------------------------------

export type FallbackReason =
  | 'auth' // 401/403
  | 'server' // 500+
  | 'network' // fetch TypeError / timeout
  | 'token_limit' // prompt > MAX_PROMPT_TOKENS
  | 'privacy' // 偵測到個資
  | 'parse_error' // LLM 回 malformed JSON
  | 'unknown' // 其他

export type ResultMode = 'live' | 'mock' | 'fallback'

export interface AdvisorApiResult {
  /** 結果模式 */
  mode: ResultMode
  /** 結構化 LLM 顧問結果 */
  advisor: AdvisorOutput
  /** fallback 原因（mode=fallback 才有） */
  fallbackReason?: FallbackReason
  /** LLM 使用 token 統計（live mode 才有） */
  usage?: { inputTokens: number; outputTokens: number }
  /** Debug 訊息（給 console.warn） */
  debugMessage?: string
}

// --- 主函式 -------------------------------------------------------------

/**
 * 呼叫 Claude API 取得 LLM 顧問建議
 *
 * 流程（v0.7.7+ 加快取層）：
 *   0. **快取查詢**：mock mode 跳過；其他 mode 查 cacheKey(input)
 *   1. config.mode=mock → 直接 mockLLMAdvisor（不打 fetch）
 *   2. config.mode=live：
 *      a. buildAdvisorPrompt(input) → prompt
 *      b. validatePromptForPII(prompt) → fallback privacy（不送 API、不寫快取）
 *      c. estimateTokenCount(prompt) → 超過 MAX → fallback token_limit
 *      d. fetch API → 失敗分類 fallback reason → retry 1 次
 *      e. 解析 LLM 回應 → parseAdvisorResponse → fallback parse_error
 *   3. **快取寫入**：成功結果（live mode）寫入 cache
 *
 * @returns 永遠回傳 AdvisorApiResult（不會 throw）
 */
export async function callClaudeAdvisor(
  input: AdvisorInput,
  config?: AdvisorConfig,
): Promise<AdvisorApiResult> {
  const cfg = config ?? loadAdvisorConfig()

  // v0.7.7+：快取查詢（mock mode 跳過 — mock 是即時計算無成本）
  const cacheConfig = cfg.cache
  if (cfg.mode !== 'mock' && cacheConfig?.enabled !== false) {
    const cached = getCachedAdvisor(input, cacheConfig)
    if (cached) {
      return cached
    }
  }

  // Mock 模式直接走 mockLLMAdvisor
  if (cfg.mode === 'mock') {
    return {
      mode: 'mock',
      advisor: mockLLMAdvisor(input),
    }
  }

  // Live 模式：先建構 prompt
  const prompt = buildAdvisorPrompt(input)

  // PII 驗證（v0.6.4 新增）
  const piiCheck = validatePromptForPII(prompt)
  if (!piiCheck.clean) {
    console.warn(
      `[advisor-api] Prompt 偵測到 ${piiCheck.detections.length} 個個資，已拒絕送出：` +
        piiCheck.detections.map((d) => `${d.type}=${d.match}`).join(', '),
    )
    return {
      mode: 'fallback',
      advisor: mockLLMAdvisor(input),
      fallbackReason: 'privacy',
      debugMessage: `偵測到 ${piiCheck.detections.length} 個個資`,
    }
  }

  // Token 上限檢查
  const tokens = estimateTokenCount(prompt)
  if (tokens > MAX_PROMPT_TOKENS) {
    console.warn(`[advisor-api] Prompt token 超限：${tokens} > ${MAX_PROMPT_TOKENS}`)
    return {
      mode: 'fallback',
      advisor: mockLLMAdvisor(input),
      fallbackReason: 'token_limit',
      debugMessage: `token 數 ${tokens} 超過上限 ${MAX_PROMPT_TOKENS}`,
    }
  }

  // 嘗試 fetch（含 retry）
  let lastError: string = 'unknown'
  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(`${cfg.baseUrl}/v1/messages`, cfg, prompt)

      if (response.ok) {
        const data = (await response.json()) as ClaudeMessagesResponse
        const textContent = data.content.find((c) => c.type === 'text')
        if (!textContent || !textContent.text) {
          return {
            mode: 'fallback',
            advisor: mockLLMAdvisor(input),
            fallbackReason: 'parse_error',
            debugMessage: 'LLM 回應無 text content',
          }
        }
        const advisor = parseAdvisorResponseSafe(textContent.text)
        const result: AdvisorApiResult = {
          mode: 'live',
          advisor,
          usage: {
            inputTokens: data.usage.input_tokens,
            outputTokens: data.usage.output_tokens,
          },
        }
        // v0.7.7+：live 成功結果寫入快取
        if (cacheConfig?.enabled !== false) {
          setCachedAdvisor(input, result, cacheConfig)
        }
        return result
      }

      // 非 2xx — 分類錯誤
      if (response.status === 401 || response.status === 403) {
        lastError = 'auth'
        // 不重試 auth（重試也沒用）
        break
      }
      if (response.status >= 500) {
        lastError = 'server'
        // 5xx 才重試
        continue
      }
      // 4xx 其他（400/404/429）— 不重試
      lastError = `http_${response.status}`
      break
    } catch (e) {
      const err = e as Error
      if (err.name === 'AbortError' || err instanceof TypeError) {
        lastError = 'network'
        continue
      }
      // 其他錯誤不重試
      lastError = 'unknown'
      break
    }
  }

  console.warn(`[advisor-api] API 失敗 (${lastError})，fallback 到 mock`)
  return {
    mode: 'fallback',
    advisor: mockLLMAdvisor(input),
    fallbackReason: classifyReason(lastError),
    debugMessage: `API 呼叫失敗：${lastError}`,
  }
}

// --- 內部輔助 -----------------------------------------------------------

/**
 * fetch 加 timeout
 */
async function fetchWithTimeout(
  url: string,
  cfg: AdvisorConfig,
  prompt: string,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs)
  try {
    return await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': cfg.apiKey!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 解析 LLM 回應 — 包裝 pain-advisor 的 parseAdvisorResponse
 *
 * 不在這裡 throw，parseAdvisorResponse 已 fallback medium
 */
function parseAdvisorResponseSafe(raw: string): AdvisorOutput {
  return parseAdvisorResponse(raw)
}

function classifyReason(reason: string): FallbackReason {
  if (reason === 'auth') return 'auth'
  if (reason === 'server') return 'server'
  if (reason === 'network') return 'network'
  if (reason.startsWith('http_')) return 'unknown'
  return 'unknown'
}

// --- Claude API 回應型別（手刻，不用 SDK） -----------------------------

interface ClaudeMessagesResponse {
  content: Array<{ type: string; text?: string }>
  usage: { input_tokens: number; output_tokens: number }
  model: string
  stop_reason: string
}
