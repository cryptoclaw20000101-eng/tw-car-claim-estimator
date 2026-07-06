// =====================================================================
// LLM 顧問快取 — v0.7.7+
//
// 設計目標：
//   - 重複相同 input → 直接回快取，省 Claude API 費（$0.015/次）
//   - 實務場景：同一案件反覆查看「理賠顧問建議」按鈕，每次重打太貴
//   - LRU + TTL 雙重驅逐：容量上限 + 時間到期
//
// 設計原則：
//   - 0 套件（AGENTS §2.2）— 原生 Map + 手刻 LRU 驅逐
//   - 純函式 + 全域 Map（process 級 singleton）
//   - PII 不快取（mode=fallback privacy）— 避免重複掃 PII 浪費時間
//   - mock mode 不查快取 — mock 是即時計算，無 API 費
//   - 統計：hits/misses 給 console 觀察命中率
//
// 不變量（測試守護）：
//   - getCachedAdvisor(set 過的 input) 回傳相同 result
//   - getCachedAdvisor(未 set 的 input) 回傳 null
//   - LRU 超過 maxEntries → 驅逐最舊
//   - TTL 過期 → 視同 miss
//   - mode=fallback (privacy) → 不寫快取
//   - mode=mock → getCachedAdvisor 不查（callClaudeAdvisor 自己處理）
// =====================================================================

import type { AdvisorInput } from './pain-advisor'
import type { AdvisorApiResult } from './advisor-api'

// --- 型別 ---------------------------------------------------------------

export interface AdvisorCacheEntry {
  result: AdvisorApiResult
  cachedAt: number
  hits: number
}

export interface AdvisorCacheConfig {
  /** 最大條目數（LRU 驅逐）— 預設 100 */
  maxEntries?: number
  /** 存活時間（ms）— 預設 1 小時 */
  ttlMs?: number
  /** 啟用 — mock 模式預設關 */
  enabled?: boolean
}

export interface AdvisorCacheStats {
  size: number
  hits: number
  misses: number
  evictions: number
  expirations: number
}

// --- 常數 ---------------------------------------------------------------

const DEFAULT_MAX_ENTRIES = 100
const DEFAULT_TTL_MS = 60 * 60 * 1000 // 1 小時

// --- 全域狀態 ------------------------------------------------------------

/**
 * Process-level singleton — Next.js dev/prod 都共享同一 process
 * 測試時用 clearAdvisorCache() 重置
 */
const cache = new Map<string, AdvisorCacheEntry>()
const stats: AdvisorCacheStats = {
  size: 0,
  hits: 0,
  misses: 0,
  evictions: 0,
  expirations: 0,
}

// --- 純函式：快取鍵 ------------------------------------------------------

/**
 * 從 AdvisorInput 產生快取鍵
 *
 * 用 JSON.stringify 序列化 → 內容相同就同鍵
 * 不裝 crypto（AGENTS §2.2）— 字串 hash 不需要 cryptographic 安全
 */
export function cacheKey(input: AdvisorInput): string {
  // 排序 keys 確保 {a:1, b:2} === {b:2, a:1}
  const sorted = sortKeysDeep(input)
  return JSON.stringify(sorted)
}

function sortKeysDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep) as unknown as T
  }
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(value as object).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key])
    }
    return sorted as unknown as T
  }
  return value
}

// --- 純函式：get/set/clear/stats -----------------------------------------

/**
 * 取得快取結果（過期或 disabled → null）
 */
export function getCachedAdvisor(
  input: AdvisorInput,
  config?: AdvisorCacheConfig,
): AdvisorApiResult | null {
  if (config?.enabled === false) {
    stats.misses++
    return null
  }
  const key = cacheKey(input)
  const entry = cache.get(key)
  if (!entry) {
    stats.misses++
    return null
  }

  // TTL 檢查
  const ttl = config?.ttlMs ?? DEFAULT_TTL_MS
  if (Date.now() - entry.cachedAt > ttl) {
    cache.delete(key)
    stats.expirations++
    stats.misses++
    return null
  }

  // LRU touch：刪除重插讓 Map 維持 LRU 順序（Map 迭代順序 = insertion order）
  cache.delete(key)
  entry.hits++
  cache.set(key, entry)

  stats.hits++
  return entry.result
}

/**
 * 寫入快取（LRU 驅逐）
 *
 * 不寫入隱私 fallback（mode=fallback, fallbackReason=privacy）— 重複 PII 掃描浪費時間
 */
export function setCachedAdvisor(
  input: AdvisorInput,
  result: AdvisorApiResult,
  config?: AdvisorCacheConfig,
): void {
  if (config?.enabled === false) return

  // 隱私 fallback 不快取
  if (result.mode === 'fallback' && result.fallbackReason === 'privacy') {
    return
  }

  const key = cacheKey(input)
  const max = config?.maxEntries ?? DEFAULT_MAX_ENTRIES

  // 已存在 → 刪除重插（更新 LRU 順序）
  if (cache.has(key)) {
    cache.delete(key)
  }

  // LRU 驅逐：超過容量 → 刪除最舊（Map 開頭）
  while (cache.size >= max) {
    const firstKey = cache.keys().next().value
    if (firstKey === undefined) break
    cache.delete(firstKey)
    stats.evictions++
  }

  cache.set(key, {
    result,
    cachedAt: Date.now(),
    hits: 0,
  })
  stats.size = cache.size
}

/**
 * 清空快取（測試用 / 管理員手動清）
 */
export function clearAdvisorCache(): void {
  cache.clear()
  stats.size = 0
  stats.hits = 0
  stats.misses = 0
  stats.evictions = 0
  stats.expirations = 0
}

/**
 * 取得統計（debug / metrics）
 */
export function getAdvisorCacheStats(): AdvisorCacheStats {
  return { ...stats, size: cache.size }
}

/**
 * 命中率（0-1，0 = 0% / 1 = 100%）
 * 沒任何請求 → null
 */
export function getAdvisorCacheHitRate(): number | null {
  const total = stats.hits + stats.misses
  if (total === 0) return null
  return stats.hits / total
}
