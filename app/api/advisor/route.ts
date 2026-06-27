// =====================================================================
// /api/advisor route handler — v0.6.4
//
// ⚠️  v0.7.0 部署場景警告
// =====================================================================
// 此 route 在 `next.config.ts` 設 `output: "export"` 時不會被打包進
// 靜態站點（Vercel Edge CDN 部署後 POST /api/advisor 會 404）。
//
// 目前 UI（PainEnsembleCard）直接從 build-time 內嵌的 mockLLMAdvisor
// 拿 advisor 結果，沒有 fetch 這個 route，所以這個檔案對現有 UI 是
// dead code — 純粹作為未來切換到「Vercel Functions / 自架 Node / Edge
// Runtime」部署時的 server-side 入口預留。
//
// 若要啟用 live LLM 模式：
//   1. 移除 `output: "export"`（會失去 Vercel Edge CDN 優化）
//   2. 或把 route 改寫為 Edge Function + Vercel Functions 部署
//   3. UI 端把 PainEnsembleCard 從純計算引擎 prop 改成 fetch('/api/advisor')
//
// 詳見 AGENTS.md §13 部署場景矩陣。
// =====================================================================
//
// POST 接收 AdvisorInput，呼叫 callClaudeAdvisor，回傳 AdvisorApiResult
//
// 設計原則（AGENTS.md §2.4 + §6）：
//   - route.ts 在 app/api/advisor/route.ts（Next 16 App Router 慣例）
//   - 永遠回傳 200 + JSON，業務錯誤走 fallback 模式（個資 / token / API 失敗）
//   - 4xx 只用在「客戶端送錯」（空 body / 無效 JSON / 缺欄位 / 型別錯）
//   - cache-control: no-store（個資絕不進任何快取層）
//   - 處理時間可能 5s+（fetchWithTimeout 5s + retry 1 次），呼叫端要有耐心
// =====================================================================

import { NextResponse } from 'next/server'
import { callClaudeAdvisor } from '@/lib/insurance/advisor-api'
import type { AdvisorInput } from '@/lib/insurance/pain-advisor'

// =====================================================================
// 路由設定
// =====================================================================

/** 給定最大 12s（含 5s timeout + 1 retry + 緩衝） */
export const maxDuration = 12

// =====================================================================
// POST handler
// =====================================================================

/**
 * POST /api/advisor
 *
 * Body: AdvisorInput JSON
 * 200: AdvisorApiResult JSON
 * 400: { error } — 客戶端送錯（空 body / 無效 JSON / 缺欄位 / 型別錯）
 * 405: Method Not Allowed（其他 HTTP method）
 *
 * 重要：
 *   - 業務錯誤（個資 / token / API 失敗）一律走 200 + mode=fallback
 *   - 只有客戶端送錯才回 4xx（讓前端能區分是「我送錯」還是「系統 fallback」）
 */
export async function POST(request: Request): Promise<NextResponse> {
  // --- 1. 讀 body ---
  let rawText: string
  try {
    rawText = await request.text()
  } catch (e) {
    return NextResponse.json({ error: '讀取 body 失敗' }, { status: 400 })
  }

  if (!rawText || rawText.trim() === '') {
    return NextResponse.json({ error: 'body 不能為空' }, { status: 400 })
  }

  // --- 2. parse JSON ---
  let input: unknown
  try {
    input = JSON.parse(rawText)
  } catch {
    return NextResponse.json({ error: '無效的 JSON' }, { status: 400 })
  }

  // --- 3. 驗證欄位 ---
  const validation = validateAdvisorInput(input)
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    )
  }

  // --- 4. 呼叫 LLM advisor（永遠不會 throw，內部已 fallback） ---
  const result = await callClaudeAdvisor(validation.input)

  // --- 5. 回傳（cache-control: no-store） ---
  return NextResponse.json(result, {
    status: 200,
    headers: {
      'cache-control': 'no-store',
    },
  })
}

// =====================================================================
// 輸入驗證（不依賴 zod，維持 AGENTS.md §2.2 零套件精神）
// =====================================================================

interface ValidationOk {
  ok: true
  input: AdvisorInput
}

interface ValidationErr {
  ok: false
  error: string
}

/**
 * 手刻欄位驗證
 *
 * 必要欄位（來自 AdvisorInput）：
 *   - courtName: string（非空）
 *   - rulesMid: number
 *   - rulesLevel: string
 *   - mlP50: number
 *   - mlConfidence: 'high' | 'medium' | 'low'
 *   - knnAmount: number | null
 *   - knnCases: Array<{ caseNo: string; amount: number }>
 *   - ensembleConsensus: 'strong' | 'partial' | 'weak' | 'insufficient'
 *   - ensembleAmount: number | null
 *   - outlier: 'rules' | 'ml' | 'knn' | null
 *   - isDivergent: boolean
 *   - hasWarnings: boolean
 *
 * @returns ValidationOk | ValidationErr
 */
function validateAdvisorInput(input: unknown): ValidationOk | ValidationErr {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'input 必須是物件' }
  }

  const obj = input as Record<string, unknown>

  // courtName — 字串且非空
  if (typeof obj.courtName !== 'string' || obj.courtName.trim() === '') {
    return { ok: false, error: 'courtName 必須是非空字串' }
  }

  // rulesMid — 數字
  if (typeof obj.rulesMid !== 'number' || !Number.isFinite(obj.rulesMid)) {
    return { ok: false, error: 'rulesMid 必須是數字' }
  }

  // rulesLevel — 字串
  if (typeof obj.rulesLevel !== 'string') {
    return { ok: false, error: 'rulesLevel 必須是字串' }
  }

  // mlP50 — 數字
  if (typeof obj.mlP50 !== 'number' || !Number.isFinite(obj.mlP50)) {
    return { ok: false, error: 'mlP50 必須是數字' }
  }

  // mlConfidence — 列舉
  if (
    obj.mlConfidence !== 'high' &&
    obj.mlConfidence !== 'medium' &&
    obj.mlConfidence !== 'low'
  ) {
    return { ok: false, error: "mlConfidence 必須是 'high' | 'medium' | 'low'" }
  }

  // knnAmount — 數字或 null
  if (obj.knnAmount !== null && typeof obj.knnAmount !== 'number') {
    return { ok: false, error: 'knnAmount 必須是 number 或 null' }
  }
  if (typeof obj.knnAmount === 'number' && !Number.isFinite(obj.knnAmount)) {
    return { ok: false, error: 'knnAmount 必須是有限數字' }
  }

  // knnCases — 陣列，元素 { caseNo: string, amount: number }
  if (!Array.isArray(obj.knnCases)) {
    return { ok: false, error: 'knnCases 必須是陣列' }
  }
  for (let i = 0; i < obj.knnCases.length; i++) {
    const c = obj.knnCases[i] as Record<string, unknown>
    if (!c || typeof c !== 'object') {
      return { ok: false, error: `knnCases[${i}] 必須是物件` }
    }
    if (typeof c.caseNo !== 'string') {
      return { ok: false, error: `knnCases[${i}].caseNo 必須是字串` }
    }
    if (typeof c.amount !== 'number' || !Number.isFinite(c.amount)) {
      return { ok: false, error: `knnCases[${i}].amount 必須是數字` }
    }
  }

  // ensembleConsensus — 列舉
  if (
    obj.ensembleConsensus !== 'strong' &&
    obj.ensembleConsensus !== 'partial' &&
    obj.ensembleConsensus !== 'weak' &&
    obj.ensembleConsensus !== 'insufficient'
  ) {
    return {
      ok: false,
      error: "ensembleConsensus 必須是 'strong' | 'partial' | 'weak' | 'insufficient'",
    }
  }

  // ensembleAmount — 數字或 null
  if (obj.ensembleAmount !== null && typeof obj.ensembleAmount !== 'number') {
    return { ok: false, error: 'ensembleAmount 必須是 number 或 null' }
  }
  if (typeof obj.ensembleAmount === 'number' && !Number.isFinite(obj.ensembleAmount)) {
    return { ok: false, error: 'ensembleAmount 必須是有限數字' }
  }

  // outlier — 字串或 null
  if (
    obj.outlier !== null &&
    obj.outlier !== 'rules' &&
    obj.outlier !== 'ml' &&
    obj.outlier !== 'knn'
  ) {
    return { ok: false, error: "outlier 必須是 'rules' | 'ml' | 'knn' | null" }
  }

  // isDivergent — boolean
  if (typeof obj.isDivergent !== 'boolean') {
    return { ok: false, error: 'isDivergent 必須是 boolean' }
  }

  // hasWarnings — boolean
  if (typeof obj.hasWarnings !== 'boolean') {
    return { ok: false, error: 'hasWarnings 必須是 boolean' }
  }

  // 全通過
  return {
    ok: true,
    input: obj as unknown as AdvisorInput,
  }
}
