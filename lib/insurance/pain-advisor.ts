// =====================================================================
// LLM 理賠顧問複核 — 純函式骨架（v0.6.3）
//
// 設計：v0.6.3 = 純函式 + mock LLM（不接 API）
//   - buildAdvisorPrompt：純函式，吃 AdvisorInput 吐 prompt string
//   - parseAdvisorResponse：純函式，吃 LLM 回應 string 吐結構化輸出
//   - mockLLMAdvisor：mock LLM（v0.6.4 換成真的 Claude API）
//
// 個資保護（v0.6.3 已守護 / v0.6.4 強化）：
//   ❌ 絕不傳：姓名、身分證字號、車牌號碼、精確事故日期
//   ✅ 可傳：法院名、傷勢等級、金額、年份、縣市、共識度
//
// 免責聲明：永遠存在於輸出，無論 LLM 回什麼
//
// 責任歸屬：
//   - 規則引擎 + ML + KNN 三票共識才是「真實估算」
//   - LLM 顧問只是「風險標示 + 建議補充資料」
//   - 實際理賠仍須依保險公司審核 / 律師複核為準
// =====================================================================

// --- 型別 ---------------------------------------------------------------

export interface AdvisorInput {
  /** 法院名稱 */
  courtName: string
  /** 規則票中點 */
  rulesMid: number
  /** 規則票傷勢等級 label */
  rulesLevel: string
  /** ML P50 */
  mlP50: number
  /** ML 信心度 */
  mlConfidence: 'high' | 'medium' | 'low'
  /** KNN 平均金額（null = 不可用） */
  knnAmount: number | null
  /** KNN 相似案件 */
  knnCases: Array<{ caseNo: string; amount: number }>
  /** Ensemble 共識度 */
  ensembleConsensus: 'strong' | 'partial' | 'weak' | 'insufficient'
  /** Ensemble 共識金額（null = 不給單一數字） */
  ensembleAmount: number | null
  /** 三票中 outlier 票別（null = 無 outlier） */
  outlier: 'rules' | 'ml' | 'knn' | null
  /** 規則 vs ML 是否分歧 >30% */
  isDivergent: boolean
  /** 是否有任何警告訊息 */
  hasWarnings: boolean
}

export type RiskLevel = 'low' | 'medium' | 'high'

export interface AdvisorOutput {
  /** 風險等級：低 / 中 / 高 */
  riskLevel: RiskLevel
  /** 風險因子清單（給 UI 顯示） */
  riskFactors: string[]
  /** 建議事項清單（給 UI 顯示） */
  recommendations: string[]
  /** 共識解讀（給 UI 顯示） */
  consensusInterpretation: string
  /** 是否需要人工複核 */
  requiresHumanReview: boolean
  /** LLM 原始回應（給 UI debug） */
  rawLLMResponse?: string
  /** Token 統計（mock 階段固定 0） */
  promptTokens: number
  completionTokens: number
  /** 免責聲明（永遠存在） */
  disclaimer: string
}

// --- 常數 ---------------------------------------------------------------

const ADVISOR_DISCLAIMER =
  '本建議為 LLM 自動產生之風險標示，不構成法律意見。實際理賠仍須依保險公司審核、醫療資料、肇事責任、保單條款、金融評議或法院認定為準。'

const RISK_LEVELS: RiskLevel[] = ['low', 'medium', 'high']

// --- 純函式 1：buildAdvisorPrompt ---------------------------------------

/**
 * 建構 LLM prompt（純函式）
 *
 * 格式：Markdown 結構化便於 LLM 理解
 * 包含：
 *   1. 角色設定 + 免責聲明
 *   2. 三票金額 + 共識度
 *   3. 風險因子（程式預判）
 *   4. 輸出格式要求（JSON）
 *
 * @returns Markdown string
 */
export function buildAdvisorPrompt(input: AdvisorInput): string {
  const {
    courtName,
    rulesMid,
    rulesLevel,
    mlP50,
    mlConfidence,
    knnAmount,
    knnCases,
    ensembleConsensus,
    ensembleAmount,
    outlier,
    isDivergent,
  } = input

  // 預判風險因子（純函式，不依賴 LLM）
  const predictedFactors: string[] = []
  if (isDivergent) predictedFactors.push('規則引擎與 ML 落差 >30%')
  if (mlConfidence === 'low') predictedFactors.push('ML 信心度低（樣本 <10）')
  if (ensembleConsensus === 'weak') predictedFactors.push('三票分散')
  if (ensembleConsensus === 'partial' && outlier) predictedFactors.push(`${outlier} 票為 outlier`)
  if (knnAmount === null || knnCases.length === 0) predictedFactors.push('KNN 票不可用')

  return `# 角色

你是臺灣車禍理賠複核顧問。給保險經紀人參考用，**不構成法律意見**。

# 免責聲明

${ADVISOR_DISCLAIMER}

# 案件資訊（不含個資）

- 法院：${courtName}
- 規則票（公式推導）：${rulesMid.toLocaleString()} 元（${rulesLevel}）
- ML 票（歷史中位數）：${mlP50.toLocaleString()} 元（信心度：${mlConfidence}）
- KNN 票（相似案件平均）：${
    knnAmount === null ? '不可用' : `${knnAmount.toLocaleString()} 元（${knnCases.length} 件）`
  }
- Ensemble 共識：${ensembleConsensus}${
    ensembleAmount !== null ? `（金額 ${ensembleAmount.toLocaleString()} 元）` : '（無單一金額）'
  }
- Outlier 票別：${outlier ?? '無'}
- 規則 vs ML 落差 >30%：${isDivergent ? '是' : '否'}

# 預判風險因子

${predictedFactors.length > 0 ? predictedFactors.map((f) => `- ${f}`).join('\n') : '- 無'}

# 任務

根據以上資訊，給出結構化建議：

\`\`\`json
{
  "riskLevel": "low" | "medium" | "high",
  "riskFactors": ["..."],
  "recommendations": ["..."],
  "consensusInterpretation": "一句話總結三票共識結果",
  "requiresHumanReview": true | false
}
\`\`\`

注意：
- 風險因子 + 建議事項 用繁體中文
- consensusInterpretation 用「繁體中文一句話」給保經參考
- requiresHumanReview 預設 true（LLM 顧問不取代人工複核）
`
}

// --- 純函式 2：parseAdvisorResponse -------------------------------------

/**
 * 解析 LLM 回應（純函式）
 *
 * 安全處理：
 *   - malformed JSON → fallback 結構 + riskLevel=medium
 *   - 缺欄位 → 用 default
 *   - 不合法 riskLevel → fallback medium
 *   - 永遠補上 disclaimer
 *
 * @param raw LLM 原始回應字串
 */
export function parseAdvisorResponse(raw: string): AdvisorOutput {
  const fallback: AdvisorOutput = {
    riskLevel: 'medium',
    riskFactors: ['LLM 回應解析失敗，建議人工複核'],
    recommendations: ['請保經自行判斷風險因子'],
    consensusInterpretation: 'LLM 顧問回應無法解析，請依 Ensemble 三票結果自行決定',
    requiresHumanReview: true,
    rawLLMResponse: raw,
    promptTokens: 0,
    completionTokens: 0,
    disclaimer: ADVISOR_DISCLAIMER,
  }

  if (!raw || raw.trim().length === 0) return fallback

  // 嘗試從 markdown code block 抽出 JSON
  let jsonStr = raw
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim()
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    return fallback
  }

  if (typeof parsed !== 'object' || parsed === null) return fallback

  const obj = parsed as Record<string, unknown>

  // 驗證 riskLevel
  const rawRiskLevel = obj.riskLevel
  const riskLevel: RiskLevel =
    typeof rawRiskLevel === 'string' && (RISK_LEVELS as string[]).includes(rawRiskLevel)
      ? (rawRiskLevel as RiskLevel)
      : 'medium'

  // 驗證 riskFactors
  const riskFactors = Array.isArray(obj.riskFactors)
    ? obj.riskFactors.filter((x): x is string => typeof x === 'string')
    : fallback.riskFactors

  // 驗證 recommendations
  const recommendations = Array.isArray(obj.recommendations)
    ? obj.recommendations.filter((x): x is string => typeof x === 'string')
    : fallback.recommendations

  // 驗證 consensusInterpretation
  const consensusInterpretation =
    typeof obj.consensusInterpretation === 'string' && obj.consensusInterpretation.length > 0
      ? obj.consensusInterpretation
      : fallback.consensusInterpretation

  // 驗證 requiresHumanReview
  const requiresHumanReview =
    typeof obj.requiresHumanReview === 'boolean'
      ? obj.requiresHumanReview
      : true  // 預設 true（保守）

  return {
    riskLevel,
    riskFactors,
    recommendations,
    consensusInterpretation,
    requiresHumanReview,
    rawLLMResponse: raw,
    promptTokens: 0,
    completionTokens: 0,
    disclaimer: ADVISOR_DISCLAIMER,
  }
}

// --- mock LLM 介面（v0.6.4 換成真的 Claude API）-------------------------

/**
 * Mock LLM 顧問回應（**同步**，v0.6.3 設計）
 *
 * v0.6.3 階段：純函式確定性 mock（不吃 async）→ 保持 estimateClaim API 向後相容
 * v0.6.4 階段：拆出 `callClaudeAdvisor(input)` async API，estimateClaim 改 async
 *
 * 設計理由：mock 不依賴外部，方便測試 + 開發環境可用
 *          若 mock 也用 async 會污染 134 處 estimateClaim 呼叫端
 */
export function mockLLMAdvisor(input: AdvisorInput): AdvisorOutput {
  // 預判風險等級（純規則）
  let riskLevel: RiskLevel = 'low'
  if (input.ensembleConsensus === 'weak' || input.ensembleConsensus === 'insufficient') {
    riskLevel = 'high'
  } else if (
    input.ensembleConsensus === 'partial' ||
    input.mlConfidence === 'low' ||
    input.isDivergent
  ) {
    riskLevel = 'medium'
  }

  // 預判風險因子
  const riskFactors: string[] = []
  if (input.isDivergent) riskFactors.push('規則引擎與 ML 落差 >30%')
  if (input.mlConfidence === 'low') riskFactors.push('ML 信心度低（歷史樣本 <10）')
  if (input.mlConfidence === 'medium') riskFactors.push('ML 信心度中等')
  if (input.ensembleConsensus === 'weak') riskFactors.push('三票分散，無明顯共識')
  if (input.ensembleConsensus === 'partial' && input.outlier) {
    riskFactors.push(`${input.outlier} 票與其他兩票差距 >50%`)
  }
  if (input.knnAmount === null || input.knnCases.length === 0) {
    riskFactors.push('KNN 票不可用（無相似案件）')
  }
  if (riskFactors.length === 0) riskFactors.push('三票接近，無明顯風險')

  // 預判建議
  const recommendations: string[] = []
  if (input.ensembleConsensus === 'partial' && input.outlier) {
    recommendations.push(`複核 ${input.outlier} 票的數據來源是否合理`)
  }
  if (input.ensembleConsensus === 'weak') {
    recommendations.push('此案件建議人工複核（可能為非典型案件）')
    recommendations.push('補齊醫療/失能/肇責資料後重新估算')
  }
  if (input.mlConfidence === 'low') {
    recommendations.push('歷史樣本不足，建議聯絡律師取得近 3 年同類案件')
  }
  if (input.knnAmount === null || input.knnCases.length === 0) {
    recommendations.push('補齊失能等級後可獲得更精準的 KNN 票')
  }
  if (recommendations.length === 0) {
    recommendations.push('可直接採用 Ensemble 共識金額')
    recommendations.push('建議同步記錄到案件追蹤表')
  }

  // 共識解讀
  let consensusInterpretation = ''
  if (input.ensembleConsensus === 'strong' && input.ensembleAmount !== null) {
    consensusInterpretation = `三票共識（金額 ${input.ensembleAmount.toLocaleString()} 元），建議直接採用`
  } else if (input.ensembleConsensus === 'partial' && input.ensembleAmount !== null) {
    consensusInterpretation = `兩票共識，已排除 ${input.outlier ?? 'outlier'} 票，建議金額 ${input.ensembleAmount.toLocaleString()} 元並標註 outlier 來源`
  } else if (input.ensembleConsensus === 'weak') {
    consensusInterpretation = `三票分散，無單一金額；建議區間 ${input.rulesMid.toLocaleString()} ~ ${input.knnAmount?.toLocaleString() ?? input.mlP50.toLocaleString()} 元 + 人工複核`
  } else {
    consensusInterpretation = '資料不足，無法給建議；請補齊必要欄位後重新估算'
  }

  // 需要人工複核的判定
  const requiresHumanReview =
    input.ensembleConsensus === 'weak' ||
    input.ensembleConsensus === 'insufficient' ||
    input.isDivergent ||
    input.mlConfidence === 'low'

  return {
    riskLevel,
    riskFactors,
    recommendations,
    consensusInterpretation,
    requiresHumanReview,
    promptTokens: 0,
    completionTokens: 0,
    disclaimer: ADVISOR_DISCLAIMER,
  }
}
