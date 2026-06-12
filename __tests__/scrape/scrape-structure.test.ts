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

  it('report-precedents 報表有看護費 + 醫療費用', () => {
    expect(reportSource).toContain('"nursing-care.json"')
    expect(reportSource).toContain('"medical-expense.json"')
    expect(reportSource).toContain('"看護費"')
    expect(reportSource).toContain('"醫療費用"')
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
