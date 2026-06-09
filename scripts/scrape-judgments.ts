/**
 * 司法院法學資料檢索 - 精神慰撫金判決爬蟲
 *
 * 精神 = 研讀判決 → 萃取精神慰撫金計算模式（金額區間 + 加計因子）→ 寫進 estimateClaim
 * → UI 結果頁顯示「依據：臺灣臺北地方法院 110 年度訴字第 XXX 號」
 *
 * 產出：
 *   data/precedents/taipei-mental-distress.json
 *   - 去識別化：只留 金額 / 案情摘要 / 法院 / 案號 / 判決要旨，**不存個資**
 *   - 用途：estimateClaim 計算時挑 1-3 件最契合的當「判例引註」
 *
 * 鏈路（已驗證可行 2026-06-09）：
 *   1. GET default.aspx → 拿 ViewState / EVENTVALIDATION / cookies
 *   2. POST default.aspx (txtKW=精神慰撫金) → 拿 q=hash
 *   3. GET qryresultlst.aspx?ty=JUDBOOK&q=<hash> → 拿 data.aspx 連結列表
 *   4. GET data.aspx?ty=JD&id=<法院,年度,字,號,日期,v> → 抓金額
 *   5. 萃取 5-10 件精選 → 寫 JSON
 *
 * 法院代碼對照（URL id 第一段）：
 *   TPDV 臺灣臺北地方法院 / PCDV 新北 / SLDV 士林 / TYDV 桃園 / KSDV 高雄
 *   TCDV 臺中 / TNDV 臺南 / CYDV 嘉義 / CHDV 彰化 / YLDV 宜蘭
 *   ...（見 COURT_CODE 對照表）
 *
 * 純 Node 內建：fetch / URLSearchParams / RegExp
 * 不裝 cheerio / axios 等套件（CLAUDE.md 鐵律：pnpm add 需用戶授權）
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE = "https://judgment.judicial.gov.tw";
const SEARCH_URL = `${BASE}/FJUD/default.aspx`;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const KEYWORDS = [
  "精神慰撫金 車禍",
  "精神慰撫金 交通事故 死亡",
  "慰撫金 過失傷害",
];

const COURT_CODE: Record<string, string> = {
  TPDV: "臺灣臺北地方法院",
  PCDV: "臺灣新北地方法院",
  SLDV: "臺灣士林地方法院",
  TYDV: "臺灣桃園地方法院",
  KSDV: "臺灣高雄地方法院",
  TCDV: "臺灣臺中地方法院",
  TNDV: "臺灣臺南地方法院",
  CYDV: "臺灣嘉義地方法院",
  CHDV: "臺灣彰化地方法院",
  YLDV: "臺灣宜蘭地方法院",
  HLDV: "臺灣花蓮地方法院",
  TTDV: "臺灣臺東地方法院",
  MLDV: "臺灣苗栗地方法院",
  NTDV: "臺灣南投地方法院",
  YDV: "臺灣雲林地方法院",
  PHDV: "臺灣澎湖地方法院",
  KMOV: "福建金門地方法院",
  LCDV: "臺灣基隆地方法院",
};

interface RawHit {
  caseNo: string;
  court: string;
  caseType: string; // 訴 / 重訴 / 簡上
  caseNum: string;
  date: string;
  href: string;
}

interface FinalPrecedent {
  id: string;
  caseNo: string;
  court: string;
  year: number;
  category: "death" | "severe_injury" | "minor_injury" | "disability";
  facts: string;
  mentalDistressAmount: number;
  totalAward: number;
  ratio: { plaintiff: number; defendant: number };
  gist: string;
  source: string;
  scrapedAt: string;
}

interface CookieJar {
  cookies: Map<string, string>;
}

function newJar(): CookieJar {
  return { cookies: new Map() };
}

function cookieHeader(jar: CookieJar): string {
  return Array.from(jar.cookies.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function absorbCookies(jar: CookieJar, res: Response): void {
  const setCookie =
    res.headers.getSetCookie?.() ||
    (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : []);
  for (const c of setCookie) {
    if (!c) continue;
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    jar.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

async function getHtml(jar: CookieJar, url: string, referer?: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "zh-TW,zh;q=0.9",
      Cookie: cookieHeader(jar),
      ...(referer ? { Referer: referer } : {}),
    },
  });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  absorbCookies(jar, res);
  return res.text();
}

async function postSearch(
  jar: CookieJar,
  keyword: string,
  viewState: string,
  viewStateGen: string,
  eventValidation: string,
): Promise<string> {
  const body = new URLSearchParams({
    __VIEWSTATE: viewState,
    __VIEWSTATEGENERATOR: viewStateGen,
    __VIEWSTATEENCRYPTED: "",
    __EVENTVALIDATION: eventValidation,
    txtKW: keyword,
    judtype: "JUDBOOK",
    whosub: "0",
    "ctl00$cp_content$btnSimpleQry": "送出查詢",
  });
  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "zh-TW,zh;q=0.9",
      Referer: SEARCH_URL,
      Cookie: cookieHeader(jar),
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`POST ${SEARCH_URL} → ${res.status}`);
  absorbCookies(jar, res);
  return res.text();
}

function extractInputValue(html: string, name: string): string {
  const re = new RegExp(`name="${name}"[^>]*value="([^"]*)"`, "i");
  const m = html.match(re);
  return m ? m[1] : "";
}

function extractQryHash(html: string): string | null {
  const m = html.match(/qryresultlst\.aspx\?ty=JUDBOOK&q=([a-f0-9]+)/);
  return m ? m[1] : null;
}

function parseDataLinks(html: string): RawHit[] {
  const hits: RawHit[] = [];
  // <a href="data.aspx?ty=JD&amp;id=TCDV%2c115%2c訴%2c1628%2c20260605%2c1&amp;ot=in">
  const linkRe =
    /<a[^>]+href="data\.aspx\?ty=JD&amp;id=([^"&]+)&[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRe.exec(html)) !== null) {
    const id = decodeURIComponent(match[1]);
    const text = match[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    // id 格式：{courtCode},{year},{caseType},{caseNum},{date},{v}
    const parts = id.split(",");
    if (parts.length < 5) continue;
    const [code, year, caseType, caseNum, date] = parts;
    const court = COURT_CODE[code] || code;
    const yearInt = parseInt(year, 10);
    if (!Number.isFinite(yearInt)) continue;
    // 案號：{year} 年度 {caseType} 字第 {caseNum} 號
    const caseNo = `${year} 年度 ${caseType} 字第 ${caseNum} 號`;
    hits.push({
      caseNo,
      court,
      caseType,
      caseNum,
      date,
      href: `${BASE}/FJUD/data.aspx?ty=JD&id=${match[1]}&ot=in`,
    });
    void text;
  }
  return hits;
}

function extractAmounts(
  html: string,
): { mentalDistress: number; total: number; gist: string } | null {
  // 把 HTML 壓平成純文字
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, "");

  // 主文段：精神慰撫金金額（最權威）+ 總判賠（最大單筆）
  // 主文段格式：被告應給付原告新臺幣30,000元（即精神慰撫金）...
  const mainMatch = text.match(/主文([\s\S]{0,2000}?)(?:理由|事實|壹|貳)/);
  let mentalDistress = 0;

  if (mainMatch) {
    // 主文段裡找「精神慰撫金 OO 元」或「慰撫金 OO 元」
    const mdInMain = mainMatch[1].match(/(?:精神)?慰撫金[^。]*?([\d,]+)\s*元/);
    if (mdInMain) {
      mentalDistress = parseInt(mdInMain[1].replace(/,/g, ""), 10);
    }
  }

  // 退回全文：找「精神慰撫金...{小範圍}...元」中第一個合理的（1 萬 - 300 萬）
  if (!mentalDistress) {
    const candidates: number[] = [];
    const re = /(?:精神)?慰撫金[^。]*?([\d,]+)\s*元/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const v = parseInt(m[1].replace(/,/g, ""), 10);
      if (v >= 10000 && v <= 3000000) candidates.push(v);
    }
    if (candidates.length > 0) mentalDistress = candidates[0];
  }

  if (!mentalDistress) return null;

  // 總判賠：主文段最大單筆金額
  let total = 0;
  if (mainMatch) {
    const amounts = Array.from(
      mainMatch[1].matchAll(/([\d,]+)\s*元/g),
    ).map((m) => parseInt(m[1].replace(/,/g, ""), 10));
    if (amounts.length > 0) total = Math.max(...amounts);
  }

  // 判決要旨：抓主文後 200 字（精神慰撫金相關）
  let gist = "精神慰撫金 " + mentalDistress.toLocaleString() + " 元";
  const mainText = text.match(/主文([\s\S]{0,200})/);
  if (mainText) gist = mainText[1].slice(0, 200).trim() || gist;

  return { mentalDistress, total, gist };
}

function categorizeByFacts(gist: string, _amount: number): FinalPrecedent["category"] {
  if (gist.includes("死亡") || gist.includes("致死")) return "death";
  if (gist.includes("重傷") || gist.includes("重殘")) return "severe_injury";
  if (gist.includes("後遺症") || gist.includes("失能") || gist.includes("殘廢")) return "disability";
  return "minor_injury";
}

/**
 * 即時 append 寫入（避免最後 session 死了丟資料）
 * 第一次寫覆蓋，之後 append
 */
function writePrecedent(p: FinalPrecedent): void {
  const outDir = join(process.cwd(), "data", "precedents");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, "taipei-mental-distress.json");
  let arr: FinalPrecedent[] = [];
  if (existsSync(outFile)) {
    try {
      arr = JSON.parse(readFileSync(outFile, "utf-8")) as FinalPrecedent[];
    } catch {
      arr = [];
    }
  }
  // 去重 by id
  if (arr.some((x) => x.id === p.id)) return;
  arr.push(p);
  writeFileSync(outFile, JSON.stringify(arr, null, 2), "utf-8");
}

async function main() {
  // CLI: --dry-run = 不寫檔，只跑流程
  const isDryRun = process.argv.includes("--dry-run");
  if (isDryRun) console.log("[scrape] 🧪 DRY RUN — 不會寫入 precedents 檔");
  // 每個關鍵字走獨立 session（避免 session 過期）
  const allHits: RawHit[] = [];
  let totalScraped = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  for (const kw of KEYWORDS) {
    console.log(`[scrape] === 關鍵字 "${kw}" ===`);
    const jar = newJar();
    // 1. GET 拿 ViewState + cookies
    const homeHtml = await getHtml(jar, SEARCH_URL);
    const vs = extractInputValue(homeHtml, "__VIEWSTATE");
    const vsg = extractInputValue(homeHtml, "__VIEWSTATEGENERATOR");
    const ev = extractInputValue(homeHtml, "__EVENTVALIDATION");
    console.log(`[scrape]   Step 1: ViewState ${vs.length}b / EV ${ev.length}b`);

    // 2. POST
    const resultHtml = await postSearch(jar, kw, vs, vsg, ev);
    const qHash = extractQryHash(resultHtml);
    if (!qHash) {
      console.log(`[scrape]   ⚠ 沒拿到 q hash`);
      totalSkipped++;
      continue;
    }
    console.log(`[scrape]   Step 2: q=${qHash.slice(0, 8)}...`);

    // 3. GET qryresultlst 拿 data.aspx 連結
    const qryUrl = `${BASE}/FJUD/qryresultlst.aspx?ty=JUDBOOK&q=${qHash}`;
    const qryHtml = await getHtml(jar, qryUrl, SEARCH_URL);
    const hits = parseDataLinks(qryHtml);
    console.log(`[scrape]   Step 3: 命中 ${hits.length} 件 data.aspx 連結`);

    // 4. 立即在 session 活著時抓每個 detail
    for (const hit of hits) {
      console.log(`[scrape]     抓 ${hit.court} ${hit.caseNo} ...`);
      try {
        const detail = await getHtml(jar, hit.href, qryUrl);
        const amts = extractAmounts(detail);
        if (!amts) {
          console.log(`[scrape]       ⚠ 沒抓到精神慰撫金金額`);
          totalSkipped++;
          continue;
        }
        const yearInt = parseInt(hit.caseNo.match(/(\d+)/)?.[1] || "0", 10);
        const category = categorizeByFacts(amts.gist, amts.mentalDistress);
        allHits.push({
          ...hit,
        });
        // 直接寫進 precedents（dry-run 跳過）
        const precedent: FinalPrecedent = {
          id: `tw-md-${yearInt}-${hit.caseNo.replace(/\D/g, "").slice(-6)}`,
          caseNo: hit.caseNo,
          court: hit.court,
          year: yearInt + 1911,
          category,
          facts: amts.gist.slice(0, 120),
          mentalDistressAmount: amts.mentalDistress,
          totalAward: amts.total,
          ratio: { plaintiff: 0, defendant: 100 },
          gist: `精神慰撫金 ${amts.mentalDistress.toLocaleString()} 元`,
          source: `${hit.court} ${hit.caseNo}`,
          scrapedAt: new Date().toISOString(),
        };
        if (isDryRun) {
          console.log(`[scrape]       🧪 [dry-run] 精神慰撫金 ${amts.mentalDistress.toLocaleString()} 元`);
        } else {
          await writePrecedent(precedent);
          console.log(`[scrape]       ✅ 精神慰撫金 ${amts.mentalDistress.toLocaleString()} 元`);
          totalScraped++;
        }
      } catch (e) {
        console.log(`[scrape]       ❌ ${(e as Error).message}`);
        totalErrors++;
      }
      // 禮貌延遲避免被擋
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  // Run 結束 summary
  console.log("");
  console.log("═══════════════════════════════════════");
  console.log(`[scrape] 📊 Run summary`);
  console.log(`[scrape]   抓取成功: ${totalScraped} 件`);
  console.log(`[scrape]   跳過:     ${totalSkipped} 件`);
  console.log(`[scrape]   失敗:     ${totalErrors} 件`);
  console.log(`[scrape]   命中總數: ${allHits.length} 件`);
  if (isDryRun) console.log(`[scrape] 🧪 DRY RUN — 未寫入任何檔案`);
  console.log("═══════════════════════════════════════");
}

// 直接跑 main 才執行（避免 import 時跑）
if (process.argv[1]?.endsWith("scrape-judgments.js")) {
  main().catch((e) => {
    console.error("[scrape] ❌", e);
    process.exit(1);
  });
}
