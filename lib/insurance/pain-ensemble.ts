// =====================================================================
// 精神慰撫金 Ensemble 三票共識引擎（v0.6.2）
//
// 設計：三種推理路徑共識
//   🎯 規則票：computePainAndSuffering.regionalMid（公式推導）
//   📊 ML 票：predictPainRange.p50（歷史中位數，13 件 minor_injury anchor）
//   🔍 KNN 票：findRelatedPracticeCases 平均金額（相似案件）
//
// 為什麼這是「真 Ensemble」？
//   - iPAS 第 2 課：Ensemble = 多模型投票/加權（不只是同一模型多次訓練）
//   - 我們這裡是「三種不同推理路徑」共識：
//     * 規則 = 領域知識（Hoffmann + 8 級區間 + 地區係數）
//     * ML = 統計推論（13 件真實判決的 P50）
//     * KNN = 案例相似度（4 件律師實務案例的平均金額）
//   - 三種錯誤模式互補：
//     * 規則公式過時 → KNN 抓到新趨勢
//     * ML 樣本偏差（只 minor_injury）→ KNN 含較廣案件
//     * KNN 樣本稀疏（4 件）→ 規則 + ML 互補
//
// 共識度判定：
//   - strong：三票差距 ≤ 20% → 用加權平均
//   - partial：兩票接近（≤20%），一票 outlier >50% → 用兩票平均 + 標 outlier
//   - weak：三票分散 → 顯示區間 + 警示人工複核
//   - insufficient：票數不足 → 回 null + 補件提示
//
// 權重策略：
//   - rules weight = 1.0（永遠完整）
//   - ml weight = 1.0 (high) / 0.7 (medium) / 0.4 (low)
//   - knn weight = 1.0（可用時）/ 0（不可用）
// =====================================================================

// --- 型別 ---------------------------------------------------------------

export interface EnsembleKnCase {
  caseNo: string
  /** 該案件和解金額（civilSettlement 或 totalInsurerPayout） */
  amount: number
}

export interface EnsembleInput {
  /** 規則引擎中點 */
  rulesMid: number
  /** ML P50（13 件 anchor 中位數） */
  mlP50: number
  /** KNN 找到的相似案件（取平均） */
  knnCases: EnsembleKnCase[]
  /** KNN 是否可用（有相似案件才 true） */
  knnAvailable: boolean
  /** ML 信心度 */
  mlConfidence: 'high' | 'medium' | 'low'
}

export interface EnsembleOutput {
  consensus: 'strong' | 'partial' | 'weak' | 'insufficient'
  /** 共識金額（strong/partial 時有值，weak/insufficient 為 null） */
  consensusAmount: number | null
  /** 弱共識時的建議區間 */
  suggestedRange: { low: number; high: number } | null
  /** outlier 是哪一票（partial 時才有） */
  outlier?: 'rules' | 'ml' | 'knn'
  /** 三票金額獨立回傳（給 UI 顯示） */
  rulesAmount: number
  mlAmount: number
  knnAmount: number | null
  /** 各票權重（給 UI debug） */
  rulesWeight: number
  mlWeight: number
  knnWeight: number
  /** 警告訊息（partial/weak/insufficient 時） */
  warning?: string
}

// --- 共識度判定（純函式） -----------------------------------------------

const STRONG_THRESHOLD = 0.2 // 20% 內視為「接近」

/**
 * 判斷三票共識度 + 找出 outlier
 *
 * @param rulesMid 規則中點（0 表示不可用）
 * @param mlP50 ML P50（0 表示不可用）
 * @param knnAmounts KNN 平均金額（[] 表示不可用）
 * @returns 共識度 + outlier 票別
 */
export function computeConsensus(
  rulesMid: number,
  mlP50: number,
  knnAmounts: number[],
): { consensus: 'strong' | 'partial' | 'weak'; outlier?: 'rules' | 'ml' | 'knn' } {
  // 計算 KNN 平均
  const knnAvg =
    knnAmounts.length > 0 ? knnAmounts.reduce((s, a) => s + a, 0) / knnAmounts.length : 0

  // 票可用性
  const hasRules = rulesMid > 0
  const hasMl = mlP50 > 0
  const hasKnn = knnAvg > 0

  const availableCount = (hasRules ? 1 : 0) + (hasMl ? 1 : 0) + (hasKnn ? 1 : 0)

  // 票數 < 2 → 不可能判共識
  if (availableCount < 2) {
    return { consensus: 'weak' } // 由 ensembleEstimate 進一步判 insufficient
  }

  // 計算每對票的差距
  const pairs: Array<{
    a: number
    b: number
    srcA: 'rules' | 'ml' | 'knn'
    srcB: 'rules' | 'ml' | 'knn'
  }> = []
  if (hasRules && hasMl) pairs.push({ a: rulesMid, b: mlP50, srcA: 'rules', srcB: 'ml' })
  if (hasRules && hasKnn) pairs.push({ a: rulesMid, b: knnAvg, srcA: 'rules', srcB: 'knn' })
  if (hasMl && hasKnn) pairs.push({ a: mlP50, b: knnAvg, srcA: 'ml', srcB: 'knn' })

  // 計算整體平均差距
  const avgDivergence =
    pairs.reduce((s, p) => {
      return s + Math.abs(p.a - p.b) / Math.max(p.a, p.b, 1)
    }, 0) / pairs.length

  if (avgDivergence <= STRONG_THRESHOLD) {
    return { consensus: 'strong' }
  }

  // 三票場景：找「大多數票聚集的群」（差距 ≤ 20% 視為聚集）
  if (availableCount === 3) {
    const allTickets: Array<{ src: 'rules' | 'ml' | 'knn'; val: number }> = []
    if (hasRules) allTickets.push({ src: 'rules', val: rulesMid })
    if (hasMl) allTickets.push({ src: 'ml', val: mlP50 })
    if (hasKnn) allTickets.push({ src: 'knn', val: knnAvg })

    // 暴力找：2 票聚集 + 1 票 outlier
    for (let i = 0; i < allTickets.length; i++) {
      for (let j = i + 1; j < allTickets.length; j++) {
        const a = allTickets[i]
        const b = allTickets[j]
        if (!a || !b) continue
        const diff = Math.abs(a.val - b.val) / Math.max(a.val, b.val, 1)
        if (diff <= STRONG_THRESHOLD) {
          // 找到兩票聚集 → 第三票就是 outlier
          const outlierTicket = allTickets.find((t) => t.src !== a.src && t.src !== b.src)
          if (outlierTicket) {
            return { consensus: 'partial', outlier: outlierTicket.src }
          }
        }
      }
    }
  }

  // 三票分散（沒有聚集）
  return { consensus: 'weak' }
}

// --- 主入口：ensembleEstimate -------------------------------------------

/**
 * 三票共識估算（精神慰撫金）
 *
 * 權重計算：
 *   - rules: 永遠 1.0
 *   - ml: 依信心度（high=1.0 / medium=0.7 / low=0.4）
 *   - knn: 可用時 1.0
 *
 * 共識金額 = (rules × rulesW + ml × mlW + knn × knnW) / (rulesW + mlW + knnW)
 */
export function ensembleEstimate(input: EnsembleInput): EnsembleOutput {
  const { rulesMid, mlP50, knnCases, knnAvailable, mlConfidence } = input

  // 票可用性
  const hasRules = rulesMid > 0
  const hasMl = mlP50 > 0
  const knnAmount =
    knnAvailable && knnCases.length > 0
      ? Math.round(knnCases.reduce((s, c) => s + c.amount, 0) / knnCases.length)
      : 0
  const hasKnn = knnAmount > 0

  // 權重
  const rulesWeight = hasRules ? 1.0 : 0
  const mlWeight = hasMl
    ? mlConfidence === 'high'
      ? 1.0
      : mlConfidence === 'medium'
        ? 0.7
        : 0.4
    : 0
  const knnWeight = hasKnn ? 1.0 : 0

  // 共識度判定
  const knnAmountsForConsensus = hasKnn ? [knnAmount] : []
  const { consensus, outlier } = computeConsensus(rulesMid, mlP50, knnAmountsForConsensus)

  // 票數 < 2 → insufficient
  const availableCount = (hasRules ? 1 : 0) + (hasMl ? 1 : 0) + (hasKnn ? 1 : 0)
  if (availableCount < 2) {
    return {
      consensus: 'insufficient',
      consensusAmount: null,
      suggestedRange: null,
      rulesAmount: rulesMid,
      mlAmount: mlP50,
      knnAmount: hasKnn ? knnAmount : null,
      rulesWeight,
      mlWeight,
      knnWeight,
      warning: '資料不足，建議補齊醫療/失能資料後重新估算',
    }
  }

  // strong 或 partial：算加權平均
  if (consensus === 'strong' || consensus === 'partial') {
    let numerator = 0
    let denominator = 0
    if (hasRules && outlier !== 'rules') {
      numerator += rulesMid * rulesWeight
      denominator += rulesWeight
    }
    if (hasMl && outlier !== 'ml') {
      numerator += mlP50 * mlWeight
      denominator += mlWeight
    }
    if (hasKnn && outlier !== 'knn') {
      numerator += knnAmount * knnWeight
      denominator += knnWeight
    }
    const consensusAmount = denominator > 0 ? Math.round(numerator / denominator) : 0

    let warning: string | undefined
    if (consensus === 'partial') {
      const outlierLabel =
        outlier === 'rules' ? '規則引擎' : outlier === 'ml' ? '歷史中位數' : '相似案件'
      warning = `三票共識中「${outlierLabel}」與其他兩票差距 >50%，已排除；建議複核 outlier 數據來源`
    }

    return {
      consensus,
      consensusAmount,
      suggestedRange: null,
      outlier,
      rulesAmount: rulesMid,
      mlAmount: mlP50,
      knnAmount: hasKnn ? knnAmount : null,
      rulesWeight,
      mlWeight,
      knnWeight,
      warning,
    }
  }

  // weak：顯示區間
  const allAmounts = [rulesMid, mlP50, knnAmount].filter((a) => a > 0)
  const suggestedRange =
    allAmounts.length > 0 ? { low: Math.min(...allAmounts), high: Math.max(...allAmounts) } : null

  return {
    consensus: 'weak',
    consensusAmount: null,
    suggestedRange,
    rulesAmount: rulesMid,
    mlAmount: mlP50,
    knnAmount: hasKnn ? knnAmount : null,
    rulesWeight,
    mlWeight,
    knnWeight,
    warning: '三票分散，建議人工複核（可能為非典型案件）',
  }
}
