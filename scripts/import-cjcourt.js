'use strict'
/**
 * 司法院法學資料檢索 — 增量爬蟲 (v0.19.x+)
 *
 * 問題: scrape-judgments.ts 的 4 步流程 (q hash → qryresultlst → data.aspx) 觸發
 * 司法院 QPS rate limit + 同 q hash 永久 cache. session 9.5+ 小時跑不出新案件.
 *
 * 解法: 跳過 q hash 步驟, 從現有 precedents/{chain}/*.json 的 id 直接 fetch data.aspx,
 * 拿金額/案情 regex 抽出. 適用場景: 已知案件 id 重抓更深 metadata (不改 595 件總數)
 *
 * 真正擴增: 需要 1+ 小時後 q hash cache 過期 + 改用不同 keyword 組合 (下個 session 修).
 *
 * 用法:
 *   pnpm tsx scripts/import-cjcourt.ts --chain=mental_distress --year=2024
 *   pnpm tsx scripts/import-cjcourt.ts --chain=disability --dry-run
 *
 * 選項:
 *   --chain=<name>  指定鏈 (mental_distress / disability / labor_loss / ...)
 *   --year=<YYYY>  只處理特定年份
 *   --limit=<N>    限制筆數 (預設 100, 防 rate limit)
 *   --dry-run      只統計不寫入
 *
 * 業務友善: 1 鏈 / 1 年 / 1-5 筆 → 預期 < 1 分鐘完成, 不觸發 QPS rate limit
 */
Object.defineProperty(exports, '__esModule', { value: true })
const node_fs_1 = require('node:fs')
const node_path_1 = require('node:path')
const BASE = 'https://judgment.judicial.gov.tw'
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
/**
 * 解析 URL id {courtCode,year,caseType,caseNum,date,v} → fetch data.aspx 拿詳情
 * 跳過 q hash 步驟 (無 QPS rate limit, 因為 1 個 request = 1 個詳情 page)
 */
async function fetchDetail(id) {
  const url = `${BASE}/FJUD/data.aspx?ty=JD&id=${encodeURIComponent(id)}&ot=in`
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-TW,zh;q=0.9',
      },
    })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const html = await res.text()
    // 抽取金額 (中文 1,234,567 元)
    const amtMatch = html.match(/(\d{1,3}(?:,\d{3})+|\d{4,})\s*元/)
    const amount = amtMatch ? parseInt(amtMatch[1].replace(/,/g, ''), 10) : undefined
    // 案情摘要 (取 <p>...</p> 段)
    const pMatch = html.match(/<p[^>]*>([^<]{20,200})<\/p>/)
    const gist = pMatch ? pMatch[1].trim() : undefined
    return { ok: true, amount, gist, raw: html.slice(0, 500) }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}
/**
 * 解析 CLI 參數
 */
function parseArgs(argv) {
  const args = {}
  for (const arg of argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.+)$/)
    if (m) args[m[1]] = m[2]
    else if (arg.startsWith('--')) args[arg.slice(2)] = true
  }
  return args
}
async function main() {
  var _a, _b
  const args = parseArgs(process.argv)
  const chain = args.chain || 'mental_distress'
  const year = args.year ? parseInt(args.year, 10) : undefined
  const limit = args.limit ? parseInt(args.limit, 10) : 100
  const dryRun = !!args['dry-run']
  console.log(
    `[import-cjcourt] chain=${chain}${year ? ` year=${year}` : ''} limit=${limit}${dryRun ? ' (dry-run)' : ''}`,
  )
  // 載入 precedents/{chain}.json (chain name → file name mapping)
  const CHAIN_FILE_MAP = {
    mental_distress: 'taipei-mental-distress.json',
    labor_loss: 'labor-loss.json',
    car_damage: 'car-damage.json',
    disability: 'disability-merging.json',
    mediation: 'mediation-procedures.json',
    practice: 'practice-cases.json',
    nursing_care: 'nursing-care.json',
    medical_expense: 'medical-expense.json',
    death_case: 'death-case.json',
    transport_fee: 'transport-fee.json',
    support_payment: 'support-payment.json',
    overtime_loss: 'overtime-loss.json',
  }
  const fileName = CHAIN_FILE_MAP[chain] || `${chain.replace(/_v[0-9]+$/, '')}.json`
  const dataPath = (0, node_path_1.join)(process.cwd(), 'data', 'precedents', fileName)
  if (!(0, node_fs_1.existsSync)(dataPath)) {
    console.error(`[import-cjcourt] 找不到 ${dataPath}`)
    process.exit(1)
  }
  const rows = JSON.parse((0, node_fs_1.readFileSync)(dataPath, 'utf-8'))
  console.log(`[import-cjcourt] 載入 ${rows.length} 件`)
  // 篩選
  let filtered = rows
  if (year) filtered = filtered.filter((r) => r.year === year)
  filtered = filtered.slice(0, limit)
  console.log(
    `[import-cjcourt] 處理 ${filtered.length} 件 (1 個 fetch ≈ 1-2 秒, 預期 ${filtered.length * 2}s 完成)`,
  )
  // 逐個 fetch
  let success = 0
  let fail = 0
  for (let i = 0; i < filtered.length; i++) {
    const row = filtered[i]
    if (!row.id) continue
    const r = await fetchDetail(row.id)
    if (r.ok && r.amount) {
      success++
      if (!dryRun) row.mentalDistressAmount = r.amount
      console.log(
        `  [${i + 1}/${filtered.length}] ✓ ${(_a = row.caseNo) === null || _a === void 0 ? void 0 : _a.slice(0, 20)}... ${r.amount} 元`,
      )
    } else {
      fail++
      console.log(
        `  [${i + 1}/${filtered.length}] ✗ ${(_b = row.caseNo) === null || _b === void 0 ? void 0 : _b.slice(0, 20)}... ${r.error || 'no amount'}`,
      )
    }
  }
  if (!dryRun) {
    ;(0, node_fs_1.writeFileSync)(dataPath, JSON.stringify(rows, null, 2), 'utf-8')
    console.log(`[import-cjcourt] ✓ 寫入 ${dataPath}`)
  }
  console.log(`[import-cjcourt] 完成: ${success} 成功 / ${fail} 失敗`)
}
main().catch((e) => {
  console.error('[import-cjcourt] fatal:', e)
  process.exit(1)
})
