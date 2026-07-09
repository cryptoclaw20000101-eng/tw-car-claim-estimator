'use strict'
/**
 * apply-courts.ts
 * v0.8.5 — 套用 _court-resolution.json 的法院全名到 precedents
 *
 * 設計：
 *   - 直接讀 _court-resolution.json 套用全部 8 條（v0.2.21 之前只套 5 條）
 *   - AGENTS §5 鐵律「不擅自填法院代碼」指的是 scrape 端不要猜；
 *     _court-resolution.json 是律師/工程師查證後的結果，套用是合規的
 *   - 同步替換 source 欄位（v0.8.5 新增）：把 source 內的裸代碼也替換成法院全名
 *     例：source="SCDV 115 年度 竹簡 字第 105 號" → "臺灣新竹地方法院 115 年度 竹簡 字第 105 號"
 *
 * 用法：
 *   pnpm tsx scripts/apply-courts.ts       # 直接跑
 *   pnpm apply:court-resolution            # package.json script
 *
 * 預期輸出（2026-07-01 v0.8.5 baseline）：
 *   - 165 件 `(未知代碼)` → 96+ 件套用 _court-resolution.json 解掉（ILDV 23 / ULDV 53 / CTDV 20）
 *   - 剩餘未知代碼 ~70 件（22 個代碼 - 8 個已查證 = 14 個代碼待補）
 */
Object.defineProperty(exports, '__esModule', { value: true })
const node_fs_1 = require('node:fs')
const node_path_1 = require('node:path')
const DATA = (0, node_path_1.join)(process.cwd(), 'data/precedents')
// 載入 _court-resolution.json 全部條目（v0.2.21 之前只硬編 5 條 VERIFIED_COURT_MAP）
const resFile = (0, node_path_1.join)(DATA, '_court-resolution.json')
const COURT_MAP = JSON.parse((0, node_fs_1.readFileSync)(resFile, 'utf8'))
console.log(`[apply-courts] 載入 ${Object.keys(COURT_MAP).length} 條法院對照:`)
for (const [code, name] of Object.entries(COURT_MAP)) {
  console.log(`  ${code} → ${name}`)
}
console.log('')
const files = (0, node_fs_1.readdirSync)(DATA).filter(
  (f) => f.endsWith('.json') && !f.startsWith('_') && f !== 'precedents-report.html',
)
let totalUpdated = 0
let totalSourceUpdated = 0
const updateCounts = {}
for (const f of files) {
  const path = (0, node_path_1.join)(DATA, f)
  const data = JSON.parse((0, node_fs_1.readFileSync)(path, 'utf8'))
  let updatedInFile = 0
  let sourceUpdatedInFile = 0
  for (const p of data) {
    const court = p.court || ''
    const m = court.match(/^([A-Z]{4})（未知代碼）$/)
    const code = m === null || m === void 0 ? void 0 : m[1]
    if (code && COURT_MAP[code]) {
      p.court = COURT_MAP[code]
      updatedInFile++
      updateCounts[code] = (updateCounts[code] || 0) + 1
      // v0.8.5 新增：同步替換 source 欄位
      // scrape 寫的 source 格式："${hit.court} ${hit.caseNo}"，hit.court 含「（未知代碼）」
      // 例：source="ULDV（未知代碼） 113 年度 訴字第 1234 號" → "臺灣雲林地方法院 113 年度 訴字第 1234 號"
      const source = p.source || ''
      const sourceM = source.match(/^([A-Z]{4})（未知代碼）\s+(.+)$/)
      if (sourceM) {
        p.source = `${COURT_MAP[code]} ${sourceM[2]}`
        sourceUpdatedInFile++
      }
    }
  }
  if (updatedInFile > 0) {
    ;(0, node_fs_1.writeFileSync)(path, JSON.stringify(data, null, 2) + '\n')
    totalUpdated += updatedInFile
    totalSourceUpdated += sourceUpdatedInFile
    console.log(
      `[apply-courts] ${f}: 更新 court ${updatedInFile} 件${sourceUpdatedInFile > 0 ? `，source ${sourceUpdatedInFile} 件` : ''}`,
    )
  }
}
console.log('\n[apply-courts] === 套用統計 ===')
for (const [code, count] of Object.entries(updateCounts)) {
  console.log(`  ${code} → ${COURT_MAP[code]}: ${count} 件`)
}
console.log(`[apply-courts] 合計 court 更新: ${totalUpdated} 件`)
console.log(`[apply-courts] 合計 source 更新: ${totalSourceUpdated} 件`)
const remaining = {}
for (const f of files) {
  const data = JSON.parse((0, node_fs_1.readFileSync)((0, node_path_1.join)(DATA, f), 'utf8'))
  for (const p of data) {
    const court = p.court || ''
    const m = court.match(/^([A-Z]{4})（未知代碼）$/)
    if (m) {
      remaining[m[1]] = (remaining[m[1]] || 0) + 1
    }
  }
}
console.log('\n[apply-courts] === 剩餘未知代碼 (待查證後補進 _court-resolution.json) ===')
for (const [code, count] of Object.entries(remaining)) {
  console.log(`  ${code}: ${count} 件`)
}
