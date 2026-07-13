/**
 * 真實司法院判決引註 — 從 scripts/scrape-judgments.ts 產出的
 * data/precedents/taipei-mental-distress.json 載入
 *
 * 用途：
 *   - estimateClaim 計算精神慰撫金時，給結果頁附「真實判例引註」
 *   - 結果頁 UI 在每個金額底下顯示「依據：臺灣臺北地方法院 110 年度訴字第 XXX 號」
 *   - Hover 看判決要旨
 *
 * 為何不用 lib/data-sources/judicial.ts 的 mock CASE_REFERENCES？
 *   → 那是示意資料，使用者要求「真實判決」，我們用爬蟲抓的真實 16+ 件
 *
 * 設計：
 *   - SSR 安全：動態 import + try/catch，檔案不存在回空陣列
 *   - 去識別化：只存 金額/案情/法院/案號，不存個資
 *   - 篩選：依 法院 + 嚴重度區間（金額區間）找最相關 1-3 件
 */

import type { CourtCaseReference } from '@/lib/data-sources/types'
import { courtToCity } from '@/lib/insurance/region-court-map'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  precedentDistance,
  computeDimensionDistances,
  type KnnDimensionBreakdown,
  type PrecedentFeatures,
} from './precedent-knn'

interface ScrapedPrecedent {
  id: string
  caseNo: string
  court: string
  year: number
  category: 'death' | 'severe_injury' | 'minor_injury' | 'disability'
  /** 4 鏈欄位（v0.2.3+ 新增；舊資料沒有） */
  chain?: 'mental_distress' | 'labor_loss' | 'car_damage' | 'disability_payout'
  /** 該鏈關鍵金額（v0.2.3+ 用 amount 取代 mentalDistressAmount） */
  amount?: number
  facts: string
  /** 舊 schema 欄位（向後相容） */
  mentalDistressAmount?: number
  totalAward: number
  ratio: { plaintiff: number; defendant: number }
  gist: string
  source: string
  scrapedAt: string
}

let _cache: ScrapedPrecedent[] | null = null

/**
 * 載入真實判決（惰性 + 快取）
 * 失敗回空陣列（檔案不存在 → 視同無資料，不影響主流程）
 *
 * 同步版：因為「client component 不能 await server-side fs.readFile」
 * 改用 require 在第一次呼叫時同步讀取
 */
function loadPrecedentsSync(): ScrapedPrecedent[] {
  if (_cache !== null) return _cache
  try {
    // 嘗試多個路徑（cwd 在不同 context 不一樣）
    const candidates = [
      join(process.cwd(), 'data/precedents/taipei-mental-distress.json'),
      join(process.cwd(), '..', 'data/precedents/taipei-mental-distress.json'),
    ]
    for (const p of candidates) {
      if (existsSync(p)) {
        const raw = readFileSync(p, 'utf-8')
        _cache = JSON.parse(raw) as ScrapedPrecedent[]
        // v0.12.0+ 移除 dev console.log（生產環境不應輸出 debug）
        return _cache
      }
    }
    _cache = []
    return _cache
  } catch (e) {
    console.warn(`[precedents] 載入失敗：${(e as Error).message}`)
    _cache = []
    return _cache
  }
}

/**
 * 把 ScrapedPrecedent 轉成 CourtCaseReference（給 UI 既有 component 用）
 */
function toCourtCaseReference(p: ScrapedPrecedent): CourtCaseReference {
  // 案號整理成 "111年度訴字第4523號" 格式（UI 既有顯示用）
  const caseId = p.caseNo.replace(/\s+/g, '')
  // 兼容 2 種 schema：新鏈用 amount，舊鏈用 mentalDistressAmount
  const amt = p.amount ?? p.mentalDistressAmount ?? 0
  const label = p.chain === 'mental_distress' || !p.chain ? '精神慰撫金' : '判賠金額'
  return {
    caseId,
    courtName: p.court,
    caseYear: p.year,
    category: 'pain_and_suffering',
    amount: amt,
    amountLow: Math.round(amt * 0.6),
    amountHigh: Math.round(amt * 1.5),
    summary: p.facts,
    keyReasoning: p.gist + `（真實司法院判決 · ${p.scrapedAt.slice(0, 10)} 抓取）`,
    referenceNote: `依據：${p.court} ${p.caseNo}（${label} ${amt.toLocaleString()} 元）`,
  }
}

/**
 * 找與「估算金額」最相關的 1-3 件真實判決
 * - 優先同法院 → 再優先金額接近 → 最後 caseNo 字母序
 * - amount = 估算精神慰撫金 mid（中位數）
 */
export function findRelatedPrecedents(
  courtName: string | null,
  estimatedAmount: number,
  limit = 3,
): CourtCaseReference[] {
  const all = loadPrecedentsSync()
  if (all.length === 0) return []

  // 算分：同法院 + 0 分（最優先），每差 1 倍 → +10 分，金額差 → +1/萬元
  const scored = all.map((p) => {
    const courtMatch = courtName && p.court.includes(courtName.slice(0, 2)) ? 0 : 100
    const amt = p.amount ?? p.mentalDistressAmount ?? 0
    const amountDiff = Math.abs(amt - estimatedAmount) / 10_000
    return { p, score: courtMatch + amountDiff }
  })

  scored.sort((a, b) => a.score - b.score)
  return scored.slice(0, limit).map((s) => toCourtCaseReference(s.p))
}

/**
 * 取得所有真實判決的 CourtCaseReference list（給結果頁「司法院同類判決中位數」section 用）
 */
export function listAllPrecedents(): CourtCaseReference[] {
  const all = loadPrecedentsSync()
  return all.map(toCourtCaseReference)
}

/**
 * 取得真實判決數量
 */
export function getPrecedentCount(): number {
  return loadPrecedentsSync().length
}

// =================================================================
// 通用型判例載入器（不限 taipei-mental-distress.json）
// 載入 data/precedents/*.json 全部檔案
// 給勞動能力減損、車損、除疤、特殊案型使用
// =================================================================

/** 通用判例結構（涵蓋勞減/除疤/車損/特殊案型/失能保典） */
export interface GeneralPrecedent {
  id: string
  caseNo: string
  court: string
  year: number
  category: string
  facts: string
  gist: string
  /** 部分判例有金額（精神慰撫金/勞減金額/除疤金額/車損金額）*/
  amount?: number
  /** 任何額外欄位（rule, ratio, source, scrapedAt, appliesTo, notes 等）*/
  [key: string]: unknown
}

let _generalCache: GeneralPrecedent[] | null = null

/**
 * 載入 data/precedents/ 全部 JSON 檔
 * 排除 taipei-mental-distress.json（既有專用 loader 處理）
 */
export function loadAllPrecedents(): GeneralPrecedent[] {
  if (_generalCache !== null) return _generalCache
  try {
    const dirs = [
      join(process.cwd(), 'data', 'precedents'),
      join(process.cwd(), '..', 'data', 'precedents'),
    ]
    for (const dir of dirs) {
      if (!existsSync(dir)) continue
      const files = readdirSync(dir).filter(
        (f: string) => f.endsWith('.json') && f !== 'taipei-mental-distress.json',
      )
      const all: GeneralPrecedent[] = []
      for (const f of files) {
        const raw = readFileSync(join(dir, f), 'utf-8')
        const arr = JSON.parse(raw) as GeneralPrecedent[]
        if (Array.isArray(arr)) {
          all.push(...arr)
        }
      }
      _generalCache = all
      // v0.12.0+ 移除 dev console.log（生產環境不應輸出 debug）
      return _generalCache
    }
    _generalCache = []
    return _generalCache
  } catch (e) {
    console.warn(`[precedents-general] 載入失敗：${(e as Error).message}`)
    _generalCache = []
    return _generalCache
  }
}

/**
 * 找「失能合併」相關判例（給勞動能力減損 section 用）
 * 從 disability-merging.json 撈出合併升等規則
 */
export function findDisabilityMergingPrecedents(limit = 2): GeneralPrecedent[] {
  return loadAllPrecedents()
    .filter((p) => p.category === 'disability_merging_rule')
    .slice(0, limit)
}

/**
 * 找「治療觀察期」相關判例（給勞動能力減損 / 強制險失能 section 用）
 */
export function findTreatmentPeriodPrecedents(limit = 1): GeneralPrecedent[] {
  return loadAllPrecedents()
    .filter((p) => p.category === 'disability_treatment_period')
    .slice(0, limit)
}

/**
 * 找「強制險不給付」相關判例（給強制險失能 section 用）
 */
export function findCompulsoryExclusionPrecedents(limit = 1): GeneralPrecedent[] {
  return loadAllPrecedents()
    .filter((p) => p.category === 'compulsory_exclusion')
    .slice(0, limit)
}

/**
 * 取得所有 12 大類失能種類的分類資訊（給 UI「失能部位」下拉選單用）
 */
export function getDisabilityTaxonomy(): GeneralPrecedent | null {
  return loadAllPrecedents().find((p) => p.category === 'disability_taxonomy') ?? null
}

/** 取得所有通用判例總數 */
export function getGeneralPrecedentCount(): number {
  return loadAllPrecedents().length
}

/**
 * v0.7.3+: 擴充 PracticeCase 加 KNN debug 欄位（向後相容 — 都是 optional）
 * 既有呼叫端不傳 debug 也照常運作
 */
export interface PracticeCaseWithKnn extends PracticeCase {
  /** KNN 加總距離（越小越相似） */
  knnDistance?: number
  /** 5 維各項距離拆解（給 debug panel 用） */
  knnBreakdown?: KnnDimensionBreakdown
  /** query 端用的特徵向量（給 debug panel 對比用） */
  knnQuery?: PrecedentFeatures
}

/**
 * 找「相關理賠實務案例」（理賠案例集）
 * category='practice_case'，給「結果頁」用。
 *
 * v0.2.7 配權調整（依 12 件實際分布）：
 *   - 同縣市 +10（保留，珍貴信號；12 件多數 source 是「理賠實務案例彙編」無縣市，但有法院時對齊）
 *   - 失能等級差 ≤2 +8（強化 — 8/12 件在 ±2 內為關鍵信號）
 *   - 失能等級差 ≤1 +4（額外精準 — 比 ≤2 細）
 *   - 該案例有失能紀錄 +1（弱信號，鼓勵有完整失能資料的入選）
 *   - year ±2 +2（弱化，原 +5 過重；多數案例年分都符合 → 區別力低）
 *   - year ±1 +1（極接近加成）
 *   - fallback：總分 = 0 → 回最近 3 筆（scrapedAt desc），不再永遠 0 案件
 */
export interface PracticeCase {
  id: string
  caseNo: string
  court: string
  year: number
  category: string
  facts: string
  injuries: string
  disabilities: Array<{ type: string; level: string; source: string }>
  laborLoss?: {
    lossPercent?: number
    annualIncome?: number
    age?: number
    hoffmannCalculation?: string
    tool?: string
  }
  settlement?: {
    totalInsurerPayout?: number
    civilSettlement?: number
    settlementReason?: string
  }
  keyHoldings: string[]
  source: string
  scrapedAt: string
}

/**
 * v0.7.3+ 新增 debug 參數：傳 true 就附 KNN 距離拆解
 * - 預設 false：回 PracticeCase[]（向後相容既有測試 + ensemble 整合層）
 * - 傳 true：回 PracticeCaseWithKnn[]（給 UI debug panel）
 */
export function findRelatedPracticeCases<T extends boolean = false>(
  courtName: string,
  possibleLevel: number | null,
  limit = 3,
  withKnnDebug?: T,
): T extends true ? PracticeCaseWithKnn[] : PracticeCase[] {
  const all = loadAllPrecedents() as unknown as PracticeCaseWithKnn[]
  if (all.length === 0)
    return [] as unknown as T extends true ? PracticeCaseWithKnn[] : PracticeCase[]
  const practiceCases = all.filter((p) => p.category === 'practice_case')
  if (practiceCases.length === 0)
    return [] as unknown as T extends true ? PracticeCaseWithKnn[] : PracticeCase[]

  // v0.6.1+ — 改用 KNN 距離取代硬編配權
  // 每維正規化到 [0, 1]，加總即距離，越小越相似
  // 保留 scrapedAt 當同分決勝（避免完全打散既有測試的預期）
  // 詳見 lib/estimate/precedent-knn.ts
  const queryYear = new Date().getFullYear()
  const queryCity = courtToCity(courtName)
  const queryHasDisability = possibleLevel !== null

  const queryFeatures: PrecedentFeatures = {
    city: queryCity,
    disabilityLevel: possibleLevel,
    year: queryYear,
    injurySeverity: null,
    hasDisabilityRecord: queryHasDisability,
  }

  const score = (
    p: PracticeCaseWithKnn,
  ): { distance: number; scrapedAt: string; breakdown: KnnDimensionBreakdown } => {
    // 從案例 disabilityLevel 萃取（取第一筆有效值）
    let caseDisabilityLevel: number | null = null
    for (const d of p.disabilities ?? []) {
      const lv = parseInt(d.level, 10)
      if (!isNaN(lv)) {
        caseDisabilityLevel = lv
        break
      }
    }
    const caseHasDisability = (p.disabilities ?? []).length > 0

    const caseFeatures: PrecedentFeatures = {
      city: courtToCity(p.court),
      disabilityLevel: caseDisabilityLevel,
      year: p.year,
      injurySeverity: null,
      hasDisabilityRecord: caseHasDisability,
    }

    return {
      distance: precedentDistance(
        courtName,
        possibleLevel,
        queryYear,
        queryHasDisability,
        p.court,
        caseDisabilityLevel,
        p.year,
        caseHasDisability,
        courtToCity,
      ),
      scrapedAt: p.scrapedAt,
      breakdown: computeDimensionDistances(queryFeatures, caseFeatures),
    }
  }

  const scored = practiceCases
    .map((p) => ({ p, ...score(p) }))
    .sort((a, b) => {
      // KNN 排序：距離小 = 相似 = 排前面
      if (a.distance !== b.distance) return a.distance - b.distance
      // 同距離以 scrapedAt 較新優先
      return b.scrapedAt > a.scrapedAt ? 1 : -1
    })

  // 取前 K 筆（不篩選 0 距離 — KNN 總會有距離，無需 fallback）
  const top = scored.slice(0, limit)

  return top.map((x) => {
    if (!withKnnDebug) return x.p as PracticeCase
    return {
      ...x.p,
      knnDistance: x.distance,
      knnBreakdown: x.breakdown,
      knnQuery: queryFeatures,
    }
  }) as T extends true ? PracticeCaseWithKnn[] : PracticeCase[]
}
