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

import type { CourtCaseReference } from "@/lib/data-sources/types";

interface ScrapedPrecedent {
  id: string;
  caseNo: string;
  court: string;
  year: number;
  category: "death" | "severe_injury" | "minor_injury" | "disability";
  /** 4 鏈欄位（v0.2.3+ 新增；舊資料沒有） */
  chain?: "mental_distress" | "labor_loss" | "car_damage" | "disability_payout";
  /** 該鏈關鍵金額（v0.2.3+ 用 amount 取代 mentalDistressAmount） */
  amount?: number;
  facts: string;
  /** 舊 schema 欄位（向後相容） */
  mentalDistressAmount?: number;
  totalAward: number;
  ratio: { plaintiff: number; defendant: number };
  gist: string;
  source: string;
  scrapedAt: string;
}

let _cache: ScrapedPrecedent[] | null = null;

/**
 * 載入真實判決（惰性 + 快取）
 * 失敗回空陣列（檔案不存在 → 視同無資料，不影響主流程）
 *
 * 同步版：因為「client component 不能 await server-side fs.readFile」
 * 改用 require 在第一次呼叫時同步讀取
 */
function loadPrecedentsSync(): ScrapedPrecedent[] {
  if (_cache !== null) return _cache;
  try {
    const { readdirSync, readFileSync, existsSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");
    // 嘗試多個路徑（cwd 在不同 context 不一樣）
    const candidates = [
      join(process.cwd(), "data/precedents/taipei-mental-distress.json"),
      join(process.cwd(), "..", "data/precedents/taipei-mental-distress.json"),
    ];
    for (const p of candidates) {
      if (existsSync(p)) {
        const raw = readFileSync(p, "utf-8");
        _cache = JSON.parse(raw) as ScrapedPrecedent[];
        console.log(
          `[precedents] 載入 ${_cache.length} 件真實判決 from ${p}`,
        );
        return _cache;
      }
    }
    _cache = [];
    return _cache;
  } catch (e) {
    console.warn(`[precedents] 載入失敗：${(e as Error).message}`);
    _cache = [];
    return _cache;
  }
}

/**
 * 把 ScrapedPrecedent 轉成 CourtCaseReference（給 UI 既有 component 用）
 */
function toCourtCaseReference(
  p: ScrapedPrecedent,
): CourtCaseReference {
  // 案號整理成 "111年度訴字第4523號" 格式（UI 既有顯示用）
  const caseId = p.caseNo.replace(/\s+/g, "");
  // 兼容 2 種 schema：新鏈用 amount，舊鏈用 mentalDistressAmount
  const amt = p.amount ?? p.mentalDistressAmount ?? 0;
  const label = p.chain === "mental_distress" || !p.chain ? "精神慰撫金" : "判賠金額";
  return {
    caseId,
    courtName: p.court,
    caseYear: p.year,
    category: "pain_and_suffering",
    amount: amt,
    amountLow: Math.round(amt * 0.6),
    amountHigh: Math.round(amt * 1.5),
    summary: p.facts,
    keyReasoning: p.gist + `（真實司法院判決 · ${p.scrapedAt.slice(0, 10)} 抓取）`,
    referenceNote: `依據：${p.court} ${p.caseNo}（${label} ${amt.toLocaleString()} 元）`,
  };
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
  const all = loadPrecedentsSync();
  if (all.length === 0) return [];

  // 算分：同法院 + 0 分（最優先），每差 1 倍 → +10 分，金額差 → +1/萬元
  const scored = all.map((p) => {
    const courtMatch =
      courtName && p.court.includes(courtName.slice(0, 2)) ? 0 : 100;
    const amt = p.amount ?? p.mentalDistressAmount ?? 0;
    const amountDiff = Math.abs(amt - estimatedAmount) / 10_000;
    return { p, score: courtMatch + amountDiff };
  });

  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((s) => toCourtCaseReference(s.p));
}

/**
 * 取得所有真實判決的 CourtCaseReference list（給結果頁「司法院同類判決中位數」section 用）
 */
export function listAllPrecedents(): CourtCaseReference[] {
  const all = loadPrecedentsSync();
  return all.map(toCourtCaseReference);
}

/**
 * 取得真實判決數量
 */
export function getPrecedentCount(): number {
  return loadPrecedentsSync().length;
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
    const { readdirSync, readFileSync, existsSync } = require("node:fs") as typeof import("node:fs")
    const { join } = require("node:path") as typeof import("node:path")
    const dirs = [
      join(process.cwd(), "data", "precedents"),
      join(process.cwd(), "..", "data", "precedents"),
    ]
    for (const dir of dirs) {
      if (!existsSync(dir)) continue
      const files = readdirSync(dir).filter(
        (f: string) => f.endsWith(".json") && f !== "taipei-mental-distress.json",
      )
      const all: GeneralPrecedent[] = []
      for (const f of files) {
        const raw = readFileSync(join(dir, f), "utf-8")
        const arr = JSON.parse(raw) as GeneralPrecedent[]
        if (Array.isArray(arr)) {
          all.push(...arr)
        }
      }
      _generalCache = all
      console.log(
        `[precedents-general] 載入 ${all.length} 件通用判例 from ${dir}（${files.length} 檔）`,
      )
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
export function findDisabilityMergingPrecedents(
  limit = 2,
): GeneralPrecedent[] {
  return loadAllPrecedents()
    .filter((p) => p.category === "disability_merging_rule")
    .slice(0, limit)
}

/**
 * 找「治療觀察期」相關判例（給勞動能力減損 / 強制險失能 section 用）
 */
export function findTreatmentPeriodPrecedents(
  limit = 1,
): GeneralPrecedent[] {
  return loadAllPrecedents()
    .filter((p) => p.category === "disability_treatment_period")
    .slice(0, limit)
}

/**
 * 找「強制險不給付」相關判例（給強制險失能 section 用）
 */
export function findCompulsoryExclusionPrecedents(
  limit = 1,
): GeneralPrecedent[] {
  return loadAllPrecedents()
    .filter((p) => p.category === "compulsory_exclusion")
    .slice(0, limit)
}

/**
 * 取得所有 12 大類失能種類的分類資訊（給 UI「失能部位」下拉選單用）
 */
export function getDisabilityTaxonomy(): GeneralPrecedent | null {
  return (
    loadAllPrecedents().find((p) => p.category === "disability_taxonomy") ??
    null
  )
}

/** 取得所有通用判例總數 */
export function getGeneralPrecedentCount(): number {
  return loadAllPrecedents().length
}

/**
 * 找「相關理賠實務案例」（律師律師案例集）
 * category='practice_case'，給「結果頁」用。
 *
 * 配對邏輯（簡化版）：
 *   1. 同縣市 / 同 year ±2
 *   2. 失能等級相近（possibleLevel 差 ≤ 2）
 *   3. 最終 fallback = 全部前 N 筆
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

export function findRelatedPracticeCases(
  courtName: string,
  possibleLevel: number | null,
  limit = 3,
): PracticeCase[] {
  const all = loadAllPrecedents() as unknown as PracticeCase[]
  if (all.length === 0) return []
  const practiceCases = all.filter((p) => p.category === 'practice_case')
  if (practiceCases.length === 0) return []

  // 算 city match 分
  const score = (p: PracticeCase): number => {
    let s = 0
    // 縣市 match：抓 "臺中" / "新北" / "台北" / "高雄" 開頭
    const cityOf = (c: string): string | null => {
      for (const k of ['臺中', '新北', '台北', '高雄', '桃園', '臺南', '新竹']) {
        if (c.includes(k)) return k
      }
      return null
    }
    const courtCity = cityOf(courtName)
    const caseCity = cityOf(p.court)
    if (courtCity && caseCity && courtCity === caseCity) s += 10

    // year 接近（±2 年 +5）
    const thisYear = new Date().getFullYear()
    if (Math.abs(p.year - thisYear) <= 2) s += 5

    // 失能等級相近（差 ≤ 2 +3）
    if (possibleLevel !== null) {
      const dis = p.disabilities ?? []
      for (const d of dis) {
        const lv = parseInt(d.level, 10)
        if (!isNaN(lv) && Math.abs(lv - possibleLevel) <= 2) {
          s += 3
          break
        }
      }
    }
    return s
  }

  return practiceCases
    .map((p) => ({ p, s: score(p) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ p }) => p)
}
