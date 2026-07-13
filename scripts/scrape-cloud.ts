/**
 * scrape-cloud.ts — 司法院爬蟲 + 5 年 filter 修正版
 *
 * 為什麼這個檔案存在（v0.18.x 補丁）：
 * - 既有 scrape-judgments.ts line ~530 有 5 年 filter bug：
 *   `if (yearInt < 2021) continue` 把民國年 (110-115) 跟西元 2021 比較 → 100% reject
 * - 本檔採同樣的 KEYWORDS/REGEX/FILE/LABEL 4 對齊邏輯 + 修好的 5 年 filter
 * - 加 fetch AbortController timeout 30s 避免司法院 IP-block 卡死 ESTABLISHED TCP
 * - 加 maxPages 參數支援分頁（預設 6）
 * - append-only 寫入 data/precedents/{chain-file}.json（dedup by id）
 *
 * 跟 scrape-judgments.ts 並存，本檔不動原檔邏輯，未來可替換或並用
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const BASE = 'https://judgment.judicial.gov.tw'
const SEARCH_URL = `${BASE}/FJUD/default.aspx`
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

// v0.18.x+ 4-record 對齊 (KEYWORDS / REGEX / FILE / LABEL)
const KEYWORDS = {
  mental_distress: [
    '精神慰撫金 車禍',
    '精神慰撫金 交通事故 死亡',
    '慰撫金 過失傷害',
    '非財產上損害 交通事故',
    '慰撫金 肇責比例',
    '慰撫金 輕傷',
    '精神慰撫金 等級',
  ],
  labor_loss: [
    '工作損失 車禍',
    '勞動能力減損 交通事故',
    '工作收入損失 過失傷害',
    '減少勞動能力 車禍',
    '工作損失 住院',
    '薪資 車禍 損害',
    '全勤獎金 車禍',
  ],
  car_damage: [
    '車輛修復費用 車禍',
    '財產損害 交通事故',
    '車損 過失傷害',
    '車輛全損 交通事故',
    '拖車費 車禍',
    '代步車 車禍 費用',
    '車輛 貶值 車禍',
  ],
  disability: [
    '失能等級 車禍',
    '勞減 交通事故',
    '後遺症 過失傷害',
    '殘廢 車禍 給付',
    '失能 等級 給付',
    '後遺症 殘廢 車禍',
    '殘廢 車禍 等級',
  ],
  mediation: [
    '調解委員會 車禍 和解',
    '鄉鎮市調解 交通事故',
    '法院調解 車禍 成立',
    '調解 車禍 撤回',
    '調解委員會 車禍',
  ],
  practice: [
    '理賠實務 車禍 和解',
    '訴訟實務 交通事故 處理',
    '強制險 車禍 理賠 案例',
    '車禍 訴訟 實務',
    '強制險 訴訟 案例',
  ],
  mental_distress_v2: [
    '精神慰撫金 車禍 死亡',
    '精神慰撫金 過失致死',
    '慰撫金 車禍 重傷',
    '慰撫金 重傷 車禍',
    '精神賠償 車禍 金額',
  ],
  labor_loss_v2: [
    '勞動能力 喪失 車禍',
    '工作收入 減少 車禍',
    '勞減率 車禍 鑑定',
    '減少勞動能力 計算',
    '勞動能力 車禍 比例',
  ],
  car_damage_v2: [
    '車輛修理費 交通事故',
    '車禍 全損 折舊',
    '車輛 殘值 車禍',
    '車輛 折舊 車禍',
    '車禍 殘值 計算',
  ],
  disability_v2: [
    '勞減 車禍 後遺症',
    '失能 給付 交通事故',
    '後遺症 車禍 等級',
    '失能給付 標準 車禍',
    '後遺症 車禍 殘等',
  ],
  settlement_v2: [
    '車禍 和解金 計算',
    '過失比例 車禍 民事',
    '肇責 車禍 比例',
    '肇責比例 和解金',
    '車禍 民事 過失比例',
  ],
  nursing_care: [
    '看護費 車禍',
    '看護費用 交通事故',
    '看護 車禍 日額',
    '看護 親屬 車禍',
    '居家看護 車禍',
    '看護 醫院 車禍',
  ],
  medical_expense: [
    '醫療費用 車禍',
    '醫藥費 交通事故',
    '住院費 車禍 賠償',
    '醫美 車禍',
    '義齒 車禍 費用',
    '復健 車禍 費用',
    '中醫 車禍',
  ],
  death_case: [
    '死亡 車禍 賠償',
    '致死 交通事故 民事',
    '過失致死 車禍 和解',
    '車禍 死亡 慰撫金',
    '車禍 死亡 撫養費',
    '車禍 死亡 過失比例',
    '車禍 死亡 民事',
    '過失致死 民事 車禍',
    '交通事故 死亡 民事',
    '致死 民事 上訴',
  ],
  transport_fee: [
    '計程車 車禍 費用',
    '就醫 交通 車禍',
    '代步 車禍 費用',
    '計程車 往返 醫院',
    '就醫 計程車 車禍',
    '車禍 計程車 醫院',
    '代步 車禍 民事',
    '交通費用 車禍 民事',
    '車禍 計程車 民事',
  ],
  support_payment: [
    '扶養費 車禍',
    '扶養 交通事故',
    '遺屬 車禍 撫卹',
    '撫養費 計算 車禍',
    '扶養 親屬 車禍',
    '車禍 撫養 民事',
    '扶養 民事 車禍',
    '車禍 扶養 賠償',
  ],
  overtime_loss: [
    '加班費 車禍 損失',
    '全勤獎金 車禍',
    '年終獎金 車禍 損失',
    '績效獎金 車禍',
    '車禍 請假 扣薪',
    '加班費 車禍',
    '全勤 車禍 民事',
    '車禍 加班 民事',
  ],
  appeal_case: ['車禍 上訴 民事', '二審 車禍 和解', '上訴 駁回 車禍', '車禍 撤回上訴'],
  pain_suffering_basis: ['慰撫金 計算基準', '精神慰撫金 酌定', '慰撫金 數額', '慰撫金 審酌'],
  traffic_accident_civil_5y: ['精神慰撫金 車禍', '車禍 民事', '交通事故 和解'],
  labor_loss_v3: [
    '失能 勞動能力減損',
    '後遺症 失能等級',
    '殘廢 喪失工作能力',
    '終身勞動能力',
    '失能給付',
    '喪失勞動能力',
  ],
} as const
type ChainKey = keyof typeof KEYWORDS

const CHAIN_REGEX: Record<ChainKey, RegExp> = {
  mental_distress: /(?:精神)?慰撫金[^。]*?([\d,]+)\s*元/,
  mental_distress_v2: /(?:精神)?慰撫金[^。]*?([\d,]+)\s*元/,
  labor_loss: /(?:工作)?(?:收入)?損失[^。]*?([\d,]+)\s*元/,
  labor_loss_v2: /(?:工作)?(?:收入)?損失[^。]*?([\d,]+)\s*元/,
  car_damage: /(?:車輛)?(?:修復)?(?:費用|損害)[^。]*?([\d,]+)\s*元/,
  car_damage_v2: /(?:車輛)?(?:修復)?(?:費用|損害)[^。]*?([\d,]+)\s*元/,
  disability: /失能[^。]*?([\d,]+)\s*元/,
  disability_v2: /失能[^。]*?([\d,]+)\s*元/,
  mediation: /(?:調解|和解|撤回起訴|訴訟外和解)[^。]*?([\d,]+)\s*元/,
  practice: /(?:理賠|和解|撤回|調解成立)[^。]*?([\d,]+)\s*元/,
  settlement_v2: /(?:調解|和解|撤回)[^。]*?([\d,]+)\s*元/,
  nursing_care: /看護(?:費|費用|日額)[^。]*?([\d,]+)\s*元/,
  medical_expense: /(?:醫療|醫藥|住院|自費)(?:費用|費|支出|損害)[^。]*?([\d,]+)\s*元/,
  death_case: /(?:死亡|致死)[^。]*?([\d,]+)\s*元/,
  transport_fee: /(?:計程車|交通|代步)(?:費|費用|支出)[^。]*?([\d,]+)\s*元/,
  support_payment: /(?:扶養|撫養|撫卹)(?:費|費用|金)[^。]*?([\d,]+)\s*元/,
  overtime_loss: /(?:加班費|全勤獎金|年終獎金)[^。]*?([\d,]+)\s*元/,
  appeal_case: /(?:上訴|二審|撤回上訴)[^。]*?([\d,]+)\s*元/,
  pain_suffering_basis: /(?:精神)?慰撫金[^。]*?([\d,]+)\s*元/,
  traffic_accident_civil_5y: /(?:(?:精神)?慰撫金|損害賠償|和解金)[^。]*?([\d,]+)\s*元/,
  labor_loss_v3: /(?:失能|後遺症|終身|殘廢|喪失)[^。]*?([\d,]+)\s*元/,
}
const CHAIN_FILE: Record<ChainKey, string> = {
  mental_distress: 'taipei-mental-distress.json',
  mental_distress_v2: 'taipei-mental-distress.json',
  labor_loss: 'labor-loss.json',
  labor_loss_v2: 'labor-loss.json',
  car_damage: 'car-damage.json',
  car_damage_v2: 'car-damage.json',
  disability: 'disability-merging.json',
  disability_v2: 'disability-merging.json',
  mediation: 'mediation-procedures.json',
  practice: 'practice-cases.json',
  settlement_v2: 'practice-cases.json',
  nursing_care: 'nursing-care.json',
  medical_expense: 'medical-expense.json',
  death_case: 'death-case.json',
  transport_fee: 'transport-fee.json',
  support_payment: 'support-payment.json',
  overtime_loss: 'overtime-loss.json',
  appeal_case: 'practice-cases.json',
  pain_suffering_basis: 'taipei-mental-distress.json',
  traffic_accident_civil_5y: 'traffic-accident-civil-5y.json',
  labor_loss_v3: 'labor-loss-v3.json',
}
const CHAIN_LABEL: Record<ChainKey, string> = {
  mental_distress: '精神慰撫金',
  mental_distress_v2: '精神慰撫金(死亡)',
  labor_loss: '工作損失',
  labor_loss_v2: '工作損失(勞減)',
  car_damage: '車損',
  car_damage_v2: '車損(全損)',
  disability: '失能慰撫金',
  disability_v2: '失能(後遺症)',
  mediation: '車禍調解',
  practice: '理賠實務',
  settlement_v2: '和解金(肇責)',
  nursing_care: '看護費',
  medical_expense: '醫療費用',
  death_case: '死亡案件',
  transport_fee: '交通費用',
  support_payment: '撫養費',
  overtime_loss: '加班損失',
  appeal_case: '訴訟終結',
  pain_suffering_basis: '慰撫金計算基準',
  traffic_accident_civil_5y: '5 年內民事車禍',
  labor_loss_v3: '失能/勞動能力減損',
}

const COURT_CODE: Record<string, string> = {
  TPDV: '臺灣臺北地方法院',
  PCDV: '臺灣新北地方法院',
  SLDV: '臺灣士林地方法院',
  TYDV: '臺灣桃園地方法院',
  KSDV: '臺灣高雄地方法院',
  TCDV: '臺灣臺中地方法院',
  TNDV: '臺灣臺南地方法院',
  CYDV: '臺灣嘉義地方法院',
  CHDV: '臺灣彰化地方法院',
  YLDV: '臺灣宜蘭地方法院',
  HLDV: '臺灣花蓮地方法院',
  TTDV: '臺灣臺東地方法院',
  MLDV: '臺灣苗栗地方法院',
  NTDV: '臺灣南投地方法院',
  YDV: '臺灣雲林地方法院',
  PHDV: '臺灣澎湖地方法院',
  KMOV: '福建金門地方法院',
  LCDV: '臺灣基隆地方法院',
}

interface FinalPrecedent {
  id: string
  caseNo: string
  court: string
  year: number
  category: 'death' | 'severe_injury' | 'minor_injury' | 'disability'
  chain: ChainKey
  facts: string
  amount: number
  totalAward: number
  ratio: { plaintiff: number; defendant: number }
  gist: string
  source: string
  scrapedAt: string
}

interface CookieJar {
  cookies: Map<string, string>
}
const newJar = (): CookieJar => ({ cookies: new Map() })
const cookieHeader = (jar: CookieJar): string =>
  Array.from(jar.cookies.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
const absorbCookies = (jar: CookieJar, res: Response): void => {
  const setCookie =
    res.headers.getSetCookie?.() ||
    (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : [])
  for (const c of setCookie) {
    if (!c) continue
    const [pair] = c.split(';')
    const eq = pair.indexOf('=')
    if (eq < 0) continue
    jar.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
  }
}

// v0.18.x+ 加 AbortController 30s timeout：司法院 IP-block 會讓 fetch 卡在 ESTABLISHED 永不 return
async function fetchPage(jar: CookieJar, url: string, referer?: string): Promise<string> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 30_000)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-TW,zh;q=0.9',
        Cookie: cookieHeader(jar),
        ...(referer ? { Referer: referer } : {}),
      },
      signal: ac.signal,
    })
    if (!res.ok) throw new Error(`GET ${url} → ${res.status}`)
    absorbCookies(jar, res)
    return res.text()
  } finally {
    clearTimeout(timer)
  }
}
async function postSearch(
  jar: CookieJar,
  kw: string,
  vs: string,
  vsg: string,
  ev: string,
): Promise<string> {
  const body = new URLSearchParams({
    __VIEWSTATE: vs,
    __VIEWSTATEGENERATOR: vsg,
    __VIEWSTATEENCRYPTED: '',
    __EVENTVALIDATION: ev,
    txtKW: kw,
    judtype: 'JUDBOOK',
    whosub: '0',
    ctl00$cp_content$btnSimpleQry: '送出查詢',
  })
  const res = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-TW,zh;q=0.9',
      Referer: SEARCH_URL,
      Cookie: cookieHeader(jar),
    },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`POST ${SEARCH_URL} → ${res.status}`)
  absorbCookies(jar, res)
  return res.text()
}
const extractInputValue = (h: string, n: string): string => {
  const m = h.match(new RegExp(`name="${n}"[^>]*value="([^"]*)"`, 'i'))
  return m ? m[1] : ''
}
const extractQryHash = (h: string): string | null => {
  const m = h.match(/qryresultlst\.aspx\?ty=JUDBOOK&q=([a-f0-9]+)/)
  return m ? m[1] : null
}

interface RawHit {
  caseNo: string
  court: string
  caseType: string
  caseNum: string
  date: string
  href: string
}
const parseDataLinks = (html: string): RawHit[] => {
  const hits: RawHit[] = []
  const linkRe = /<a[^>]+href="data\.aspx\?ty=JD&amp;id=([^"&]+)&amp;[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(html)) !== null) {
    const id = decodeURIComponent(m[1])
    const parts = id.split(',')
    if (parts.length < 5) continue
    const [code, year, caseType, caseNum, date] = parts
    const yearInt = parseInt(year, 10)
    if (!Number.isFinite(yearInt)) continue
    // v0.18.x+ 5 年內 filter 修正：民國年 (110=2021, 115=2026) 用 env SCRAPE_YEAR_MIN 控制（預設 108=2019）
    // 原 scrape-judgments.ts:530 的 `yearInt < 2021` bug 是比西元 2021 對民國年，永遠 reject，已修
    const yearMin = parseInt(process.env.SCRAPE_YEAR_MIN || '108', 10)
    if (yearInt < yearMin) continue
    const court = COURT_CODE[code] || `${code}（未知代碼）`
    const caseNo = `${year} 年度 ${caseType} 字第 ${caseNum} 號`
    hits.push({
      caseNo,
      court,
      caseType,
      caseNum,
      date,
      href: `${BASE}/FJUD/data.aspx?ty=JD&id=${m[1]}&ot=in`,
    })
  }
  return hits
}

function extractAmounts(
  html: string,
  chain: ChainKey,
): { amount: number; total: number; gist: string } | null {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, '')
  const regex = CHAIN_REGEX[chain]
  const mainMatch = text.match(/主文([\s\S]{0,2000}?)(?:理由|事實|壹|貳)/)
  let amount = 0
  if (mainMatch) {
    const m = mainMatch[1].match(regex)
    if (m) amount = parseInt(m[1].replace(/,/g, ''), 10)
  }
  if (!amount) {
    const candidates: number[] = []
    const re = new RegExp(regex.source, 'g')
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const v = parseInt(m[1].replace(/,/g, ''), 10)
      if (v >= 10000 && v <= 3000000) candidates.push(v)
    }
    if (candidates.length > 0) amount = candidates[0]
  }
  if (!amount) return null
  let total = 0
  if (mainMatch) {
    const amounts = Array.from(mainMatch[1].matchAll(/([\d,]+)\s*元/g)).map((m) =>
      parseInt(m[1].replace(/,/g, ''), 10),
    )
    if (amounts.length > 0) total = Math.max(...amounts)
  }
  const label = CHAIN_LABEL[chain]
  let gist = `${label} ${amount.toLocaleString()} 元`
  const mainText = text.match(/主文([\s\S]{0,200})/)
  if (mainText) gist = mainText[1].slice(0, 200).trim() || gist
  return { amount, total, gist }
}
function categorizeByFacts(gist: string): FinalPrecedent['category'] {
  if (gist.includes('死亡') || gist.includes('致死')) return 'death'
  if (gist.includes('重傷') || gist.includes('重殘')) return 'severe_injury'
  if (gist.includes('後遺症') || gist.includes('失能') || gist.includes('殘廢')) return 'disability'
  return 'minor_injury'
}
function isCivilCase(caseNo: string): boolean {
  if (!caseNo) return true
  // 刑事庭 (附民 / 刑庭) + 家事法庭 (家親/家聲/家訴/家財/家繼/家調/重家/家婚) 都要排除
  const excludePatterns = [
    '附民',
    '交附民',
    '原附民',
    '簡附民',
    '刑附民',
    '易字',
    '交易',
    '自訴',
    '家聲',
    '家親',
    '家訴',
    '家財',
    '家繼',
    '家調',
    '重家',
    '家婚',
  ]
  for (const pat of excludePatterns) if (caseNo.includes(pat)) return false
  return true
}
function writePrecedent(p: FinalPrecedent): void {
  const outDir = join(process.cwd(), 'data', 'precedents')
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
  const outFile = join(outDir, CHAIN_FILE[p.chain])
  let arr: FinalPrecedent[] = []
  if (existsSync(outFile)) {
    try {
      arr = JSON.parse(readFileSync(outFile, 'utf-8')) as FinalPrecedent[]
    } catch {
      arr = []
    }
  }
  if (arr.some((x) => x.id === p.id)) return
  arr.push(p)
  writeFileSync(outFile, JSON.stringify(arr, null, 2), 'utf-8')
}

async function main(): Promise<void> {
  const chainFilter = process.argv.find((a) => a === '--chain')
    ? (process.argv[process.argv.indexOf('--chain') + 1] as ChainKey)
    : null
  const isQuiet = process.argv.includes('--quiet')
  const log = isQuiet ? () => {} : (...a: unknown[]) => console.log(...a)
  const chains = chainFilter ? [chainFilter] : (Object.keys(KEYWORDS) as ChainKey[])
  const maxKwIdx = process.argv.indexOf('--max-keywords')
  const maxKeywords = maxKwIdx >= 0 ? parseInt(process.argv[maxKwIdx + 1] || '1', 10) : Infinity
  const maxPages = Math.max(1, parseInt(process.env.SCRAPE_MAX_PAGES || '6', 10))
  log(`[cloud] --max-keywords=${maxKeywords}, SCRAPE_MAX_PAGES=${maxPages}`)

  let totalScraped = 0,
    totalSkipped = 0,
    totalErrors = 0
  let kwCount = 0
  outer: for (const chain of chains) {
    log(`[cloud] === ${CHAIN_LABEL[chain]} (${chainFilter ? 'single' : 'all'}) ===`)
    for (const kw of KEYWORDS[chain]) {
      kwCount++
      if (kwCount > maxKeywords) {
        log(`[cloud] hit max-keywords limit, exiting`)
        break outer
      }
      const jar = newJar()
      try {
        const h1 = await fetchPage(jar, SEARCH_URL)
        const vs = extractInputValue(h1, '__VIEWSTATE')
        const vsg = extractInputValue(h1, '__VIEWSTATEGENERATOR')
        const ev = extractInputValue(h1, '__EVENTVALIDATION')
        const h2 = await postSearch(jar, kw, vs, vsg, ev)
        const qHash = extractQryHash(h2)
        if (!qHash) {
          log(`  [${kw}] ⚠ no q hash`)
          totalSkipped++
          continue
        }
        // v0.18.x+ 分頁：每個 q hash 對應一個 query result set，分頁可挖更深
        const allHitsMap = new Map<string, RawHit>()
        let qryReferer = `${BASE}/FJUD/qryresultlst.aspx?ty=JUDBOOK&q=${qHash}`
        for (let page = 1; page <= maxPages; page++) {
          const qryUrl =
            page === 1
              ? `${BASE}/FJUD/qryresultlst.aspx?ty=JUDBOOK&q=${qHash}`
              : `${BASE}/FJUD/qryresultlst.aspx?ty=JUDBOOK&q=${qHash}&a=${page}`
          if (page === 1) qryReferer = qryUrl
          let qryHtml: string
          try {
            qryHtml = await fetchPage(jar, qryUrl, SEARCH_URL)
          } catch (e) {
            log(`    ⚠ page ${page} fail: ${(e as Error).message.slice(0, 60)}`)
            break
          }
          const pageHits = parseDataLinks(qryHtml)
          for (const h of pageHits) allHitsMap.set(h.href, h)
          if (pageHits.length === 0) break
        }
        const pageHits = Array.from(allHitsMap.values())
        log(
          `  [${kw}] q=${qHash.slice(0, 8)}... 跨 ${allHitsMap.size} 件 (${pageHits.length} dedup)`,
        )
        if (pageHits.length === 0) {
          totalSkipped++
          continue
        }
        for (const hit of pageHits) {
          await new Promise((r) => setTimeout(r, 200))
          const detail = await fetchPage(jar, hit.href, qryReferer)
          const amts = extractAmounts(detail, chain)
          if (!amts) {
            log(`    ⏭ ${hit.caseNo} no amount`)
            totalSkipped++
            continue
          }
          if (!isCivilCase(hit.caseNo)) {
            log(`    ⏭ ${hit.caseNo} non-civil`)
            totalSkipped++
            continue
          }
          const yearInt = parseInt(hit.caseNo.match(/(\d+)/)?.[0] || '0', 10)
          const precedent: FinalPrecedent = {
            id: `tw-${chain}-${yearInt}-${hit.caseNo.replace(/\D/g, '').slice(-6)}`,
            caseNo: hit.caseNo,
            court: hit.court,
            year: yearInt + 1911,
            category: categorizeByFacts(amts.gist),
            chain,
            facts: amts.gist.slice(0, 120),
            amount: amts.amount,
            totalAward: amts.total,
            ratio: { plaintiff: 0, defendant: 100 },
            gist: `${CHAIN_LABEL[chain]} ${amts.amount.toLocaleString()} 元`,
            source: `${hit.court} ${hit.caseNo}`,
            scrapedAt: new Date().toISOString(),
          }
          writePrecedent(precedent)
          totalScraped++
          log(`    ✅ ${hit.caseNo} ${chain} ${amts.amount.toLocaleString()} 元`)
        }
        await new Promise((r) => setTimeout(r, 1500))
      } catch (e) {
        log(`  [${kw}] ⚠ ${(e as Error).message.slice(0, 80)}`)
        totalErrors++
      }
    }
  }
  console.log(`\n[cloud] 📊 抓取成功 ${totalScraped} / 跳過 ${totalSkipped} / 失敗 ${totalErrors}`)
}

if (process.argv[1]?.endsWith('scrape-cloud.ts') || process.argv[1]?.endsWith('scrape-cloud.js')) {
  main().catch((e) => {
    console.error('FATAL:', e)
    process.exit(1)
  })
}
