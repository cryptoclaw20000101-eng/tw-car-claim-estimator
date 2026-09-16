// =====================================================================
// 精神慰撫金 Ensemble 共識引擎
//
// legal-audit 修正：KNN 票只能使用「明確標註為精神慰撫金」的 target。
// 民事總和解金、保險總賠款包含醫療／工作損失／勞減／車損等，不得當作
// pain-and-suffering 的 label，否則會造成 target contamination。
// =====================================================================

export type PainKnnTargetKind = 'pain_and_suffering'

export interface EnsembleKnCase {
  caseNo: string
  amount: number
  /**
   * KNN 金額的語意標籤。只有 pain_and_suffering 才能進精神慰撫金 Ensemble。
   * 舊資料沒帶 targetKind 時會被排除，而不是猜測它代表慰撫金。
   */
  targetKind?: PainKnnTargetKind
}

export interface EnsembleInput {
  rulesMid: number
  mlP50: number
  knnCases: EnsembleKnCase[]
  knnAvailable: boolean
  mlConfidence: 'high' | 'medium' | 'low'
}

export interface EnsembleOutput {
  consensus: 'strong' | 'partial' | 'weak' | 'insufficient'
  consensusAmount: number | null
  suggestedRange: { low: number; high: number } | null
  outlier?: 'rules' | 'ml' | 'knn'
  rulesAmount: number
  mlAmount: number
  knnAmount: number | null
  rulesWeight: number
  mlWeight: number
  knnWeight: number
  warning?: string
}

const STRONG_THRESHOLD = 0.2

function verifiedPainCases(cases: EnsembleKnCase[]): EnsembleKnCase[] {
  return cases.filter(
    (c) =>
      c.targetKind === 'pain_and_suffering' &&
      Number.isFinite(c.amount) &&
      c.amount > 0,
  )
}

export function computeConsensus(
  rulesMid: number,
  mlP50: number,
  knnAmounts: number[],
): { consensus: 'strong' | 'partial' | 'weak'; outlier?: 'rules' | 'ml' | 'knn' } {
  const knnAvg =
    knnAmounts.length > 0 ? knnAmounts.reduce((s, a) => s + a, 0) / knnAmounts.length : 0

  const hasRules = rulesMid > 0
  const hasMl = mlP50 > 0
  const hasKnn = knnAvg > 0
  const availableCount = (hasRules ? 1 : 0) + (hasMl ? 1 : 0) + (hasKnn ? 1 : 0)

  if (availableCount < 2) return { consensus: 'weak' }

  const pairs: Array<{
    a: number
    b: number
    srcA: 'rules' | 'ml' | 'knn'
    srcB: 'rules' | 'ml' | 'knn'
  }> = []
  if (hasRules && hasMl) pairs.push({ a: rulesMid, b: mlP50, srcA: 'rules', srcB: 'ml' })
  if (hasRules && hasKnn) pairs.push({ a: rulesMid, b: knnAvg, srcA: 'rules', srcB: 'knn' })
  if (hasMl && hasKnn) pairs.push({ a: mlP50, b: knnAvg, srcA: 'ml', srcB: 'knn' })

  const avgDivergence =
    pairs.reduce((s, p) => s + Math.abs(p.a - p.b) / Math.max(p.a, p.b, 1), 0) /
    pairs.length

  if (avgDivergence <= STRONG_THRESHOLD) return { consensus: 'strong' }

  if (availableCount === 3) {
    const tickets: Array<{ src: 'rules' | 'ml' | 'knn'; val: number }> = []
    if (hasRules) tickets.push({ src: 'rules', val: rulesMid })
    if (hasMl) tickets.push({ src: 'ml', val: mlP50 })
    if (hasKnn) tickets.push({ src: 'knn', val: knnAvg })

    for (let i = 0; i < tickets.length; i++) {
      for (let j = i + 1; j < tickets.length; j++) {
        const a = tickets[i]
        const b = tickets[j]
        if (!a || !b) continue
        const diff = Math.abs(a.val - b.val) / Math.max(a.val, b.val, 1)
        if (diff <= STRONG_THRESHOLD) {
          const outlier = tickets.find((t) => t.src !== a.src && t.src !== b.src)
          if (outlier) return { consensus: 'partial', outlier: outlier.src }
        }
      }
    }
  }

  return { consensus: 'weak' }
}

export function ensembleEstimate(input: EnsembleInput): EnsembleOutput {
  const { rulesMid, mlP50, knnCases, knnAvailable, mlConfidence } = input

  const verified = knnAvailable ? verifiedPainCases(knnCases) : []
  const knnAmount =
    verified.length > 0
      ? Math.round(verified.reduce((s, c) => s + c.amount, 0) / verified.length)
      : 0

  const hasRules = rulesMid > 0
  const hasMl = mlP50 > 0
  const hasKnn = knnAmount > 0

  const rulesWeight = hasRules ? 1 : 0
  const mlWeight = hasMl
    ? mlConfidence === 'high'
      ? 1
      : mlConfidence === 'medium'
        ? 0.7
        : 0.4
    : 0
  const knnWeight = hasKnn ? 1 : 0

  const { consensus, outlier } = computeConsensus(
    rulesMid,
    mlP50,
    hasKnn ? [knnAmount] : [],
  )

  const availableCount = (hasRules ? 1 : 0) + (hasMl ? 1 : 0) + (hasKnn ? 1 : 0)
  const targetWarning =
    knnAvailable && knnCases.length > 0 && verified.length === 0
      ? 'KNN 案例未提供可驗證的精神慰撫金欄位，已排除民事總和解金／保險總賠款，避免標籤污染。'
      : undefined

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
      warning: targetWarning ?? '資料不足，建議補齊醫療／失能資料後重新估算',
    }
  }

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

    let warning = targetWarning
    if (consensus === 'partial') {
      const outlierLabel =
        outlier === 'rules' ? '規則引擎' : outlier === 'ml' ? '歷史中位數' : '相似案件'
      warning = `三票共識中「${outlierLabel}」與其他兩票差距過大，已排除；建議複核資料來源。`
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
    warning: targetWarning ?? '三票分散，建議人工複核（可能為非典型案件）',
  }
}
