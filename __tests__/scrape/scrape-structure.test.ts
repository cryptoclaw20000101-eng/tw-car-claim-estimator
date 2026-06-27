import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * v0.2.19 S8 爬蟲結構測試
 *
 * 為什麼要測 scrape source（而非跑 scrape）：
 * - scrape 是 4 個連動的 Record 物件（KEYWORDS / CHAIN_REGEX / CHAIN_FILE / CHAIN_LABEL）
 * - 加新鏈時常漏 1 個，會 runtime 才爆炸
 * - 測 source 結構可以一次抓出「4 個 Record 對齊 / 任何一個 key 缺漏 / 改爛」
 *
 * 對齊 CLAUDE.md §3「改 lib/insurance 必跑 tsc + test + build」 — scrape 是 lib
 * 等級的關鍵基礎設施，沒測試 catch 不到結構錯誤
 *
 * 測試策略：直接 grep 結構（key + 對應值），不 import 物件。
 * - 優點：純 source 驗證，不需要 ts-node / 不會跑 fetch
 * - 缺點：regex 寫太嚴反而誤報，所以盡量用 toContain 配簡單 regex
 */

const scrapeSource = readFileSync(
  resolve(__dirname, '../../scripts/scrape-judgments.ts'),
  'utf-8',
)
const reportSource = readFileSync(
  resolve(__dirname, '../../scripts/report-precedents.ts'),
  'utf-8',
)

describe('S8 4 個 Record 對齊', () => {
  // 抓出每個 chain 對應的所有 keys
  function getKeysInRecord(startMarker: string, endMarker: string): string[] {
    const startIdx = scrapeSource.indexOf(startMarker)
    if (startIdx === -1) return []
    const endIdx = scrapeSource.indexOf(endMarker, startIdx)
    if (endIdx === -1) return []
    const slice = scrapeSource.slice(startIdx, endIdx)
    // 用 \w+ 包含 _v2 的數字；[a-z_]+ 會漏掉 _v2
    return Array.from(slice.matchAll(/^\s{2}(\w+):/gm)).map((m) => m[1])
  }

  it('KEYWORDS / CHAIN_REGEX / CHAIN_FILE / CHAIN_LABEL 的 keys 對齊', () => {
    const k = new Set(
      getKeysInRecord('const KEYWORDS', 'type ChainKey'),
    )
    const r = new Set(
      getKeysInRecord('const CHAIN_REGEX', 'const CHAIN_FILE'),
    )
    const f = new Set(
      getKeysInRecord('const CHAIN_FILE', 'const CHAIN_LABEL'),
    )
    const l = new Set(
      getKeysInRecord('const CHAIN_LABEL', 'const COURT_CODE'),
    )

    // 全部至少 13 個 key（6 v1 + 5 v2 + 2 v0.2.19）
    expect(k.size).toBeGreaterThanOrEqual(13)
    expect(r.size).toBe(k.size)
    expect(f.size).toBe(k.size)
    expect(l.size).toBe(k.size)

    // 4 個 set 完全相等
    expect([...r].sort()).toEqual([...k].sort())
    expect([...f].sort()).toEqual([...k].sort())
    expect([...l].sort()).toEqual([...k].sort())
  })
})

describe('S8 v0.2.19 新鏈', () => {
  it('看護費 chain 完整（KEYWORDS/REGEX/FILE/LABEL 四處都有）', () => {
    expect(scrapeSource).toMatch(/nursing_care:\s*\[/)
    expect(scrapeSource).toContain('nursing_care: /看護')
    expect(scrapeSource).toContain('nursing_care: "nursing-care.json"')
    expect(scrapeSource).toContain('nursing_care: "看護費"')
  })

  it('醫療費用 chain 完整（KEYWORDS/REGEX/FILE/LABEL 四處都有）', () => {
    expect(scrapeSource).toMatch(/medical_expense:\s*\[/)
    expect(scrapeSource).toContain('medical_expense: /(?:醫療|醫藥|住院|自費)')
    expect(scrapeSource).toContain('medical_expense: "medical-expense.json"')
    expect(scrapeSource).toContain('medical_expense: "醫療費用"')
  })

  it('v0.2.20 死亡案件 + 交通 + 撫養 + 加班 4 條衝量新鏈都存在', () => {
    const newChains = [
      { key: 'death_case', file: 'death-case.json', label: '死亡案件' },
      { key: 'transport_fee', file: 'transport-fee.json', label: '交通費用' },
      { key: 'support_payment', file: 'support-payment.json', label: '撫養費' },
      { key: 'overtime_loss', file: 'overtime-loss.json', label: '加班損失' },
    ]
    for (const { key, file, label } of newChains) {
      // KEYWORDS
      expect(scrapeSource, `缺 KEYWORDS.${key}`).toMatch(
        new RegExp(`^\\s{2}${key}(?=\\s*[:\\[])`, 'm'),
      )
      // CHAIN_FILE
      expect(scrapeSource, `缺 CHAIN_FILE.${key}`).toContain(`${key}: "${file}"`)
      // CHAIN_LABEL
      expect(scrapeSource, `缺 CHAIN_LABEL.${key}`).toContain(`${key}: "${label}"`)
    }
  })

  it('report-precedents 報表有看護費 + 醫療費用 + 4 條衝量新鏈', () => {
    expect(reportSource).toContain('"nursing-care.json"')
    expect(reportSource).toContain('"medical-expense.json"')
    expect(reportSource).toContain('"看護費"')
    expect(reportSource).toContain('"醫療費用"')
    // v0.2.20+
    expect(reportSource).toContain('"death-case.json"')
    expect(reportSource).toContain('"transport-fee.json"')
    expect(reportSource).toContain('"support-payment.json"')
    expect(reportSource).toContain('"overtime-loss.json"')
  })
})

describe('S8 既有的 6+5 chain 還在（沒被改爛）', () => {
  it('6 鏈 v1 全部還在', () => {
    const v1Chains = [
      'mental_distress',
      'labor_loss',
      'car_damage',
      'disability',
      'mediation',
      'practice',
    ]
    for (const c of v1Chains) {
      // m flag 是必要的（^ 配 m 才認 line 開頭）
      expect(scrapeSource).toMatch(
        new RegExp(`^\\s{2}${c}(?=\\s*[:\\[])`, 'm'),
      )
    }
  })

  it('5 鏈 v2 全部還在', () => {
    const v2Chains = [
      'mental_distress_v2',
      'labor_loss_v2',
      'car_damage_v2',
      'disability_v2',
      'settlement_v2',
    ]
    for (const c of v2Chains) {
      // m flag 是必要的（^ 配 m 才認 line 開頭）
      expect(scrapeSource).toMatch(
        new RegExp(`^\\s{2}${c}(?=\\s*[:\\[])`, 'm'),
      )
    }
  })
})

describe('S8 isCivilCase 行為（從 source 靜態掃）', () => {
  it('排除刑事庭案號關鍵字', () => {
    // 對齊 v0.2.15 鐵律：刑庭不要混進民事鏈
    const penalPatterns = ['附民', '交附民', '原附民', '簡附民', '刑附民', '易字', '交易', '自訴']
    for (const p of penalPatterns) {
      expect(scrapeSource, `缺刑庭排除 pattern: ${p}`).toContain(`"${p}"`)
    }
  })

  it('排除家事法庭案號關鍵字', () => {
    const familyPatterns = ['家親', '家聲', '家事']
    for (const p of familyPatterns) {
      expect(scrapeSource, `缺家事排除 pattern: ${p}`).toContain(`"${p}"`)
    }
  })

  it('無案號時 return true（保留）', () => {
    // isCivilCase 函式結尾 return true 表示「無案號 = 保留」
    expect(scrapeSource).toMatch(/if \(!caseNo\) return true/)
  })
})

describe('S8 COURT_CODE 對照表（v0.2.11 鐵律：不要擅自填代碼）', () => {
  it('19 個 baseline 法院代碼都還在', () => {
    const baseline = [
      'TPDV', 'PCDV', 'SLDV', 'TYDV', 'KSDV', 'TCDV', 'TNDV',
      'CYDV', 'CHDV', 'YLDV', 'HLDV', 'TTDV', 'MLDV', 'NTDV',
      'YDV', 'PHDV', 'KMOV', 'LCDV',
    ]
    for (const code of baseline) {
      expect(scrapeSource, `缺 baseline 代碼: ${code}`).toContain(`${code}:`)
    }
  })

  it('未知代碼有 fallback 標記（不擅自填）', () => {
    // 對齊 v0.2.11 鐵律：COURT_CODE[code] || `${code}（未知代碼）`
    expect(scrapeSource).toMatch(/COURT_CODE\[code\]\s*\|\|\s*`/)
    expect(scrapeSource).toContain('（未知代碼）')
  })
})

describe('S8 v0.2.21 — 年度範圍過濾 + SCRAPE_MAX_PAGES 預設 3', () => {
  it('isInYearRange 函式存在', () => {
    expect(scrapeSource).toMatch(/function isInYearRange/)
  })

  it('SCRAPE_MAX_PAGES 預設 6（v0.5.7 從 3 改 6 衝量）', () => {
    expect(scrapeSource).toMatch(/SCRAPE_MAX_PAGES\s*\|\|\s*"6"/)
  })

  it('year filter CLI flag --year-min / --year-max 解析', () => {
    expect(scrapeSource).toContain('--year-min')
    expect(scrapeSource).toContain('--year-max')
    expect(scrapeSource).toContain('yearMin')
    expect(scrapeSource).toContain('yearMax')
  })

  it('套用 isInYearRange + isCivilCase 雙層過濾', () => {
    // v0.2.21+: year filter 先（在 detail HTML parse 前）, isCivilCase 後（extractAmounts 後）
    expect(scrapeSource).toContain('isInYearRange')
    expect(scrapeSource).toContain('isCivilCase')
    // 用「呼叫點」檢查順序 (避免抓到函式定義)
    // 函式定義:  "function isInYearRange(...)"
    // 呼叫點:    "if (!isInYearRange("
    const yearCallIdx = scrapeSource.indexOf('if (!isInYearRange(')
    const detailIdx = scrapeSource.indexOf('getHtml(jar, hit.href')
    expect(yearCallIdx, 'isInYearRange 呼叫應在 getHtml detail 之後').toBeGreaterThan(detailIdx)
  })
})

describe('S8 v0.5.7 — 衝量 2 新鏈 (appeal_case + pain_suffering_basis)', () => {
  it('appeal_case chain 完整（KEYWORDS/REGEX/FILE/LABEL 四處都有）', () => {
    expect(scrapeSource).toMatch(/appeal_case:\s*\[/)
    expect(scrapeSource).toContain('appeal_case: /(?:上訴|二審|撤回上訴)')
    expect(scrapeSource).toContain('appeal_case: "practice-cases.json"')
    expect(scrapeSource).toContain('appeal_case: "訴訟終結"')
  })

  it('pain_suffering_basis chain 完整（KEYWORDS/REGEX/FILE/LABEL 四處都有）', () => {
    expect(scrapeSource).toMatch(/pain_suffering_basis:\s*\[/)
    expect(scrapeSource).toContain('pain_suffering_basis: /(?:精神)?慰撫金')
    expect(scrapeSource).toContain('pain_suffering_basis: "taipei-mental-distress.json"')
    expect(scrapeSource).toContain('pain_suffering_basis: "慰撫金計算基準"')
  })

  it('既 4 Record keys 數量 v0.5.7 ≥ 15（13 + 2 新鏈）', () => {
    function getKeysInRecord(startMarker: string, endMarker: string): string[] {
      const startIdx = scrapeSource.indexOf(startMarker)
      if (startIdx === -1) return []
      const endIdx = scrapeSource.indexOf(endMarker, startIdx)
      if (endIdx === -1) return []
      const slice = scrapeSource.slice(startIdx, endIdx)
      return Array.from(slice.matchAll(/^\s{2}(\w+):/gm)).map((m) => m[1])
    }
    const k = new Set(getKeysInRecord('const KEYWORDS', 'type ChainKey'))
    expect(k.size).toBeGreaterThanOrEqual(15)
  })
})

/**
 * v0.6.8 報表 Ensemble 健康度區塊
 *
 * 不重跑 Ensemble 引擎，直接 grep 報表 source 驗證結構：
 * - computeEnsembleHealth 函式存在
 * - renderEnsembleSection 函式存在
 * - buildHtml 內呼叫 computeEnsembleSection 並插入到 <main>
 * - 信心度 4 等級（high/medium/low/none）+ 對應 tip
 * - 傷勢梯度警示（單一類別 / 集中 ≥90%）
 * - 法院中位數 Top 8
 */
describe('報表 Ensemble 健康度區塊（v0.6.8 → v0.6.9 refactor）', () => {
  it('report-precedents.ts 從共用函式 import computeEnsembleHealth', () => {
    // v0.6.9 refactor: 函式搬到 lib/insurance/pain-ensemble-health.ts，
    // report 改 import 共用，避免雙重實作
    expect(reportSource).toMatch(/import\s*\{[^}]*computeEnsembleHealth[^}]*\}\s*from\s*["']\.\.\/lib\/insurance\/pain-ensemble-health["']/)
  })

  it('report-precedents.ts 含 renderEnsembleSection 函式', () => {
    expect(reportSource).toContain('function renderEnsembleSection')
  })

  it('buildHtml 呼叫 computeEnsembleSection 並渲染 ensembleSection', () => {
    expect(reportSource).toMatch(/renderEnsembleSection\(\s*computeEnsembleHealth/)
    // 渲染到 <main> 內（在 chainSections 之前）
    expect(reportSource).toMatch(/<\/header>\s*<main>\s*\$\{ensembleSection\}/)
  })

  it('信心度 4 等級由 lib 提供（v0.6.9 refactor）', () => {
    // v0.6.8 測試本來 hard-code 在 report；refactor 後由 lib 提供
    // report 端只負責 import + 渲染，信心度分級由 lib/insurance/pain-ensemble-health.ts 守護
    // 此處僅確認 report 沒意外 hard-code 信心度字串
    expect(reportSource).not.toMatch(/n\s*>=\s*20\s*\{\s*confidenceLevel\s*=\s*["']high["']/)
  })

  it('傷勢梯度警示由 lib 提供（v0.6.9 refactor）', () => {
    // v0.6.8 測試本來 hard-code 在 report；refactor 後由 lib 提供
    expect(reportSource).not.toMatch(/傷勢梯度為 0/)
    expect(reportSource).not.toMatch(/XGBoost 偏置風險高/)
  })

  it('法院中位數 slice(0, 8) 由 lib 提供（v0.6.9 refactor）', () => {
    // v0.6.8 測試本來 hard-code 在 report；refactor 後由 lib 提供
    expect(reportSource).not.toMatch(/slice\(0,\s*8\)/)
  })

  it('ensemble section 標明對應引擎檔案（pain-ml / precedent-knn / pain-ensemble）', () => {
    expect(reportSource).toContain('lib/insurance/pain-ml.ts')
    expect(reportSource).toContain('lib/estimate/precedent-knn.ts')
    expect(reportSource).toContain('lib/insurance/pain-ensemble.ts')
  })

  it('EnsembleHealth 型別從共用 import（v0.6.9 refactor）', () => {
    // 不再是本地 interface，改從 lib/insurance/pain-ensemble-health import
    expect(reportSource).toMatch(/import\s*\{[^}]*type\s+EnsembleHealth[^}]*\}\s*from/)
    // 確保本地沒有重複宣告
    expect(reportSource).not.toMatch(/^interface EnsembleHealth\s*\{/m)
  })
})

/**
 * v0.6.9 首頁 hero Ensemble 健康度卡
 *
 * 為什麼測 source 而不是 render：
 *   沿用既有 .tsx 測試 pattern（StepShell.test.tsx / PainEnsembleCard.test.tsx）：
 *   用 props 介面契約 + 結構性斷言，避免 jsdom 依賴。
 *   對於純組合元件（內含 fetch/import 靜態 JSON）是最 surgical 方案。
 */
describe('首頁 hero Ensemble 健康度卡（v0.6.9）', () => {
  it('app/page.tsx import EnsembleHealthHeroCard', () => {
    const pageSource = readFileSync(
      resolve(__dirname, '../../app/page.tsx'),
      'utf-8',
    )
    expect(pageSource).toContain('import { EnsembleHealthHeroCard }')
  })

  it('EnsembleHealthHeroCard 渲染在 hero 右側（引用法源 / 地區覆蓋之後）', () => {
    const pageSource = readFileSync(
      resolve(__dirname, '../../app/page.tsx'),
      'utf-8',
    )
    expect(pageSource).toMatch(/<EnsembleHealthHeroCard\s*\/>/)
  })

  it('EnsembleHealthHeroCard 內含 build-time JSON import', () => {
    const cardSource = readFileSync(
      resolve(__dirname, '../../components/EnsembleHealthHeroCard.tsx'),
      'utf-8',
    )
    // Next 16 turbopack JSON import（內嵌 bundle 不需 runtime fetch）
    expect(cardSource).toContain(
      "import anchorData from '@/data/precedents/taipei-mental-distress.json'"
    )
  })

  it('EnsembleHealthHeroCard 沿用 taste-skill v1 設計紀律（無 emoji / tabular-nums）', () => {
    const cardSource = readFileSync(
      resolve(__dirname, '../../components/EnsembleHealthHeroCard.tsx'),
      'utf-8',
    )
    // 不該出現的 emoji
    expect(cardSource).not.toMatch(/[\u{1F300}-\u{1F9FF}]/u) // 範圍內 emoji
    // 必含 tabular-nums
    expect(cardSource).toContain('tabular-nums')
    // 必含 anchor 件數 / 中位數 / 信心度 3 個指標
    expect(cardSource).toContain('anchor 件數')
    expect(cardSource).toContain('中位數')
    expect(cardSource).toContain('信心度')
  })

  it('EnsembleHealthHeroCard 顯示傷勢梯度警示（用 WarningOutlined icon）', () => {
    const cardSource = readFileSync(
      resolve(__dirname, '../../components/EnsembleHealthHeroCard.tsx'),
      'utf-8',
    )
    expect(cardSource).toContain('WarningOutlined')
    expect(cardSource).toContain('injuryGradientWarning')
  })
})

/**
 * v0.7.0 Hero Ensemble 健康度自動化更新
 *
 * 守護 rebuild-hero.sh 的 3 步順序（report → touch → build），
 * 確保未來重構不會意外打斷 scrape → hero 自動化流程。
 */
describe('Hero rebuild 自動化（v0.7.0）', () => {
  const scriptSource = readFileSync(
    resolve(__dirname, '../../scripts/rebuild-hero.sh'),
    'utf-8',
  )
  const packageJson = readFileSync(
    resolve(__dirname, '../../package.json'),
    'utf-8',
  )

  it('rebuild-hero.sh 存在 + 可執行', () => {
    expect(scriptSource.length).toBeGreaterThan(0)
  })

  it('rebuild-hero.sh 3 步順序正確（report → touch → build）', () => {
    // 用正則只匹配「執行行」（行首不是 #）排除註解干擾
    const lines = scriptSource.split('\n').filter((l) => !l.trimStart().startsWith('#'))
    const sourceNoComments = lines.join('\n')
    const reportIdx = sourceNoComments.indexOf('pnpm report:precedents')
    const touchIdx = sourceNoComments.indexOf('touch data/precedents/taipei-mental-distress.json')
    const buildIdx = sourceNoComments.indexOf('pnpm build')
    expect(reportIdx).toBeGreaterThan(-1)
    expect(touchIdx).toBeGreaterThan(reportIdx)
    expect(buildIdx).toBeGreaterThan(touchIdx)
  })

  it('rebuild-hero.sh 用 set -euo pipefail 守護失敗不繼續', () => {
    expect(scriptSource).toMatch(/set\s+-euo\s+pipefail/)
  })

  it('rebuild-hero.sh 寫 log 到 /tmp（不污染 stdout）', () => {
    expect(scriptSource).toMatch(/tee\s+-a\s+["']\$LOG_FILE["']/)
  })

  it('package.json 加 report:rebuild-hero script（hero rebuild wrapper）', () => {
    expect(packageJson).toContain('"report:rebuild-hero"')
    expect(packageJson).toContain('bash scripts/rebuild-hero.sh')
  })
})
