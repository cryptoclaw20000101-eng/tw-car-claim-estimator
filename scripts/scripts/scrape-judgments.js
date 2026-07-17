"use strict";
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
 *
 * v0.18.0 修正：5 年 filter bug
 * - 原 line 530 有 bug: `if (yearInt < 2021) continue` 把民國年 (110=2021, 115=2026)
 *   拿去跟西元 2021 比較 → 永遠為真 → 100% reject 所有記錄
 * - 改用 env SCRAPE_YEAR_MIN 控制（預設 108 民國 = 2019 西元）
 *   鏡 scripts/scrape-cloud.ts:393-398 的修正 pattern
 * - production cron (`pnpm scrape:cron` → `node scripts/scrape-judgments.js`) 跑這檔
 *   修前 scrape 0 hit，修後恢復正常抓取
 */
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const BASE = 'https://judgment.judicial.gov.tw';
const SEARCH_URL = `${BASE}/FJUD/default.aspx`;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const KEYWORDS = {
    mental_distress: [
        '精神慰撫金 車禍',
        '精神慰撫金 交通事故 死亡',
        '慰撫金 過失傷害',
        '非財產上損害 交通事故', // 擴：法律用語版
        // v0.2.20+ 衝量 keyword
        '慰撫金 肇責比例',
        '慰撫金 輕傷',
        '精神慰撫金 等級',
    ],
    labor_loss: [
        '工作損失 車禍',
        '勞動能力減損 交通事故',
        '工作收入損失 過失傷害',
        '減少勞動能力 車禍', // 擴：法條用語
        // v0.2.20+ 衝量 keyword
        '工作損失 住院',
        '薪資 車禍 損害',
        '全勤獎金 車禍',
    ],
    car_damage: [
        '車輛修復費用 車禍',
        '財產損害 交通事故',
        '車損 過失傷害',
        '車輛全損 交通事故', // 擴：全損情境
        // v0.2.20+ 衝量 keyword
        '拖車費 車禍',
        '代步車 車禍 費用',
        '車輛 貶值 車禍',
    ],
    disability: [
        '失能等級 車禍',
        '勞減 交通事故',
        '後遺症 過失傷害',
        '殘廢 車禍 給付', // 擴：舊法用語
        // v0.2.20+ 衝量 keyword
        '失能 等級 給付',
        '後遺症 殘廢 車禍',
        '殘廢 車禍 等級',
    ],
    // v0.2.6+ 新鏈：車禍調解流程（從理賠顧問/調解委員視角）
    mediation: [
        '調解委員會 車禍 和解',
        '鄉鎮市調解 交通事故',
        '法院調解 車禍 成立', // 擴
        // v0.2.20+ 衝量 keyword
        '調解 車禍 撤回',
        '調解委員會 車禍',
    ],
    // v0.2.6+ 新鏈：理賠實務案例（車禍處理經驗）
    practice: [
        '理賠實務 車禍 和解',
        '訴訟實務 交通事故 處理',
        '強制險 車禍 理賠 案例', // 擴
        // v0.2.20+ 衝量 keyword
        '車禍 訴訟 實務',
        '強制險 訴訟 案例',
    ],
    // v0.2.14+ 新增 keyword：3 年擴增專用（每鏈加 2-3 個新角度）
    // 設計原則：繞過飽和既有前 4 個 keyword，從死亡/肇責/醫療/和解 等新視角切入
    mental_distress_v2: [
        // v0.2.14+ 額外 keyword（精神慰撫金新角度）
        '精神慰撫金 車禍 死亡',
        '精神慰撫金 過失致死',
        '慰撫金 車禍 重傷',
        // v0.2.20+ 衝量 keyword
        '慰撫金 重傷 車禍',
        '精神賠償 車禍 金額',
    ],
    labor_loss_v2: [
        '勞動能力 喪失 車禍',
        '工作收入 減少 車禍',
        '勞減率 車禍 鑑定',
        // v0.2.20+ 衝量 keyword
        '減少勞動能力 計算',
        '勞動能力 車禍 比例',
    ],
    car_damage_v2: [
        '車輛修理費 交通事故',
        '車禍 全損 折舊',
        '車輛 殘值 車禍',
        // v0.2.20+ 衝量 keyword
        '車輛 折舊 車禍',
        '車禍 殘值 計算',
    ],
    disability_v2: [
        '勞減 車禍 後遺症',
        '失能 給付 交通事故',
        '後遺症 車禍 等級',
        // v0.2.20+ 衝量 keyword
        '失能給付 標準 車禍',
        '後遺症 車禍 殘等',
    ],
    // v0.2.14+ 額外關鍵字（跨鏈，從「肇責比例」/「和解金」切入）
    settlement_v2: [
        '車禍 和解金 計算',
        '過失比例 車禍 民事',
        '肇責 車禍 比例',
        // v0.2.20+ 衝量 keyword
        '肇責比例 和解金',
        '車禍 民事 過失比例',
    ],
    // v0.2.19+ 新鏈：看護費（民法 §193 + 強保險 §11，最大宗理賠項目之一）
    // 對齊 6 鏈都沒抓的「最大缺口」之一，6 鏈全集中在精神慰撫金/工作損失/車損/失能
    nursing_care: [
        '看護費 車禍',
        '看護費用 交通事故',
        '看護 車禍 日額',
        // v0.2.20+ 衝量 keyword
        '看護 親屬 車禍',
        '居家看護 車禍',
        '看護 醫院 車禍',
    ],
    // v0.2.19+ 新鏈：醫療費用（含醫藥費/住院費/自費醫材）
    medical_expense: [
        '醫療費用 車禍',
        '醫藥費 交通事故',
        '住院費 車禍 賠償',
        // v0.2.20+ 衝量 keyword
        '醫美 車禍',
        '義齒 車禍 費用',
        '復健 車禍 費用',
        '中醫 車禍',
    ],
    // v0.2.20+ 衝量 4 條新鏈 — 填補「死亡 / 交通 / 撫養 / 薪資」4 個大宗缺口
    // 對齊 1000 件目標的關鍵擴增
    death_case: [
        '死亡 車禍 賠償',
        '致死 交通事故 民事',
        '過失致死 車禍 和解',
        // v0.5.7+ 衝量 keyword
        '車禍 死亡 慰撫金',
        '車禍 死亡 撫養費',
        '車禍 死亡 過失比例',
    ],
    transport_fee: [
        '計程車 車禍 費用',
        '就醫 交通 車禍',
        '代步 車禍 費用',
        // v0.5.7+ 衝量 keyword
        '計程車 往返 醫院',
        '就醫 計程車 車禍',
    ],
    support_payment: [
        '扶養費 車禍',
        '扶養 交通事故',
        '遺屬 車禍 撫卹',
        // v0.5.7+ 衝量 keyword
        '撫養費 計算 車禍',
        '扶養 親屬 車禍',
    ],
    overtime_loss: [
        '加班費 車禍 損失',
        '全勤獎金 車禍',
        '年終獎金 車禍 損失',
        // v0.5.7+ 衝量 keyword
        '績效獎金 車禍',
        '車禍 請假 扣薪',
    ],
    // v0.5.7+ 新鏈：訴訟終結與上訴（從律師實務切入補上 2020-2022 缺口）
    appeal_case: ['車禍 上訴 民事', '二審 車禍 和解', '上訴 駁回 車禍', '車禍 撤回上訴'],
    // v0.5.7+ 新鏈：慰撫金計算基準（最高法院 + 地方法院常引）
    pain_suffering_basis: ['慰撫金 計算基準', '精神慰撫金 酌定', '慰撫金 數額', '慰撫金 審酌'],
    // v0.18.x+ 新鏈：5 年內民事車禍（user 2026-07-09 需求擴充資料庫）
    // 5 年內 = 2021-2026 民事 + 車禍相關
    // 排除刑庭（已 isCivilCase 過濾）+ 5 年內日期過濾（v0.18.0 fix：parseDataLinks 用 SCRAPE_YEAR_MIN env 控制）
    // 寫入新檔 traffic-accident-civil-5y.json（避免污染既有 13 鏈）
    // keyword 用「精神慰撫金 車禍」+「車禍 民事」+「交通事故 和解」這 3 個已驗證有結果的
    traffic_accident_civil_5y: ['精神慰撫金 車禍', '車禍 民事', '交通事故 和解'],
    // v0.18.x+ 失能/勞動能力減損 (user 2026-07-10 擴增到 1000 件)
    labor_loss_v3: [
        '失能 勞動能力減損',
        '後遺症 失能等級',
        '殘廢 喪失工作能力',
        '終身勞動能力',
        '失能給付',
        '喪失勞動能力',
    ],
};
// v0.2.8+ — retry config（全域，main() 解析 --retry 旗標後填入）
const retryConfig = {
    maxRetries: 3,
    baseDelayMs: 500,
    quiet: false,
};
// 各鏈「金額關鍵字」正則（用在主文段）
// v0.2.6+ 新鏈 mediation/practice 改抓「和解/撤回」金額或無金額純抓主文
const CHAIN_REGEX = {
    mental_distress: /(?:精神)?慰撫金[^。]*?([\d,]+)\s*元/,
    mental_distress_v2: /(?:精神)?慰撫金[^。]*?([\d,]+)\s*元/, // v0.2.14 借用 mental_distress regex
    labor_loss: /(?:工作)?(?:收入)?損失[^。]*?([\d,]+)\s*元/,
    labor_loss_v2: /(?:工作)?(?:收入)?損失[^。]*?([\d,]+)\s*元/,
    car_damage: /(?:車輛)?(?:修復)?(?:費用|損害)[^。]*?([\d,]+)\s*元/,
    car_damage_v2: /(?:車輛)?(?:修復)?(?:費用|損害)[^。]*?([\d,]+)\s*元/,
    disability: /失能[^。]*?([\d,]+)\s*元/,
    disability_v2: /失能[^。]*?([\d,]+)\s*元/,
    mediation: /(?:調解|和解|撤回起訴|訴訟外和解)[^。]*?([\d,]+)\s*元/, // 放寬：含訴訟外和解
    practice: /(?:理賠|和解|撤回|調解成立)[^。]*?([\d,]+)\s*元/, // 放寬
    settlement_v2: /(?:調解|和解|撤回)[^。]*?([\d,]+)\s*元/, // 跨鏈「肇責/和解」金額
    // v0.2.19+ 看護費：抓「看護費 1,000,000 元」之類的金額
    nursing_care: /看護(?:費|費用|日額)[^。]*?([\d,]+)\s*元/,
    // v0.2.19+ 醫療費用：抓「醫療費/醫藥費/住院費/自費 X 元」
    medical_expense: /(?:醫療|醫藥|住院|自費)(?:費用|費|支出|損害)[^。]*?([\d,]+)\s*元/,
    // v0.2.20+ 4 條衝量新鏈
    // 死亡案件：撫養費/殯葬費/慰撫金都可能，3 keyword 跨多金額
    death_case: /(?:死亡|致死)[^。]*?([\d,]+)\s*元/,
    // 交通費用：抓「計程車/交通/代步 X 元」
    transport_fee: /(?:計程車|交通|代步)(?:費|費用|支出)[^。]*?([\d,]+)\s*元/,
    // 撫養費：抓「扶養費 X 元」/「撫養 X 元」
    support_payment: /(?:扶養|撫養|撫卹)(?:費|費用|金)[^。]*?([\d,]+)\s*元/,
    // 加班費：抓「加班費/全勤/年終 X 元」
    overtime_loss: /(?:加班費|全勤獎金|年終獎金)[^。]*?([\d,]+)\s*元/,
    // v0.5.7+ 訴訟終結：抓「上訴/二審/撤回 X 元」金額
    appeal_case: /(?:上訴|二審|撤回上訴)[^。]*?([\d,]+)\s*元/,
    // v0.5.7+ 慰撫金計算基準：借 mental_distress regex（慰撫金/精神慰撫金 X 元）
    pain_suffering_basis: /(?:精神)?慰撫金[^。]*?([\d,]+)\s*元/,
    // v0.18.x+ 5 年內民事車禍：用「精神慰撫金/損害賠償/和解」regex（金額為主，不限 chain）
    // v0.18.0 fix: 原寫法 `(?:精神)?慰撫金|損害賠償|和解金[^。]*?([\d,]+)\s*元` 讓 `(?:精神)?慰撫金` 第一個
    // alternative 沒 capture group，匹配時 m[1] 變 undefined → .replace() crash。
    // 改用 `(?:(?:精神)?慰撫金|損害賠償|和解金)[^。]*?([\d,]+)\s*元` 把整個 alternation 包起來，
    // 確保任何 alternative 都會接著 capture 金額。
    traffic_accident_civil_5y: /(?:(?:精神)?慰撫金|損害賠償|和解金)[^。]*?([\d,]+)\s*元/,
    // v0.18.x+ 失能/勞動能力減損 (user 2026-07-10 擴增到 1000 件)
    labor_loss_v3: /(?:失能|後遺症|終身|殘廢|喪失)[^。]*?([\d,]+)\s*元/,
};
const CHAIN_FILE = {
    mental_distress: 'taipei-mental-distress.json',
    mental_distress_v2: 'taipei-mental-distress.json', // v0.2.14 寫入同檔
    labor_loss: 'labor-loss.json',
    labor_loss_v2: 'labor-loss.json',
    car_damage: 'car-damage.json',
    car_damage_v2: 'car-damage.json',
    disability: 'disability-merging.json',
    disability_v2: 'disability-merging.json',
    mediation: 'mediation-procedures.json', // 新檔
    practice: 'practice-cases.json', // 擴充既有檔
    settlement_v2: 'practice-cases.json', // v0.2.14 跨鏈寫入 practice
    // v0.2.19+ 新檔：看護費 + 醫療費用
    nursing_care: 'nursing-care.json',
    medical_expense: 'medical-expense.json',
    // v0.2.20+ 衝量 4 新檔
    death_case: 'death-case.json',
    transport_fee: 'transport-fee.json',
    support_payment: 'support-payment.json',
    overtime_loss: 'overtime-loss.json',
    // v0.5.7+ 衝量 2 新檔（訴訟終結 + 慰撫金計算基準）
    appeal_case: 'practice-cases.json', // 訴訟終結併入 practice-cases.json（已有調解/律師實務）
    pain_suffering_basis: 'taipei-mental-distress.json', // 慰撫金計算基準併入精神慰撫金主鏈
    // v0.18.x+ 失能/勞動能力減損 (user 2026-07-10 擴增到 1000 件)
    labor_loss_v3: 'labor-loss-v3.json',
    // v0.18.x+ 5 年內民事車禍：新檔
    traffic_accident_civil_5y: 'traffic-accident-civil-5y.json',
};
const CHAIN_LABEL = {
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
    // v0.2.19+
    nursing_care: '看護費',
    medical_expense: '醫療費用',
    // v0.2.20+
    death_case: '死亡案件',
    transport_fee: '交通費用',
    support_payment: '撫養費',
    overtime_loss: '加班損失',
    // v0.5.7+ 衝量新鏈 label
    appeal_case: '訴訟終結',
    pain_suffering_basis: '慰撫金計算基準',
    // v0.18.x+ 失能/勞動能力減損
    labor_loss_v3: '失能/勞動能力減損',
    // v0.18.x+ 5 年內民事車禍
    traffic_accident_civil_5y: '5 年內民事車禍',
};
const COURT_CODE = {
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
};
function newJar() {
    return { cookies: new Map() };
}
function cookieHeader(jar) {
    return Array.from(jar.cookies.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
}
function absorbCookies(jar, res) {
    var _a, _b;
    const setCookie = ((_b = (_a = res.headers).getSetCookie) === null || _b === void 0 ? void 0 : _b.call(_a)) ||
        (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
    for (const c of setCookie) {
        if (!c)
            continue;
        const [pair] = c.split(';');
        const eq = pair.indexOf('=');
        if (eq < 0)
            continue;
        jar.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
}
async function getHtml(jar, url, referer) {
    return getHtmlWithRetry(jar, url, referer, retryConfig);
}
/**
 * getHtml with retry — 包 fetch 失敗 + 5xx 自動重試
 * 4xx 不重試(代表 query 邏輯錯,retry 也沒用)
 * TypeError(fetch DNS/連線失敗) → 重試
 */
async function getHtmlWithRetry(jar, url, referer, config) {
    const { maxRetries, baseDelayMs, quiet } = config;
    let lastErr = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetch(url, {
                headers: Object.assign({ 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'zh-TW,zh;q=0.9', Cookie: cookieHeader(jar) }, (referer ? { Referer: referer } : {})),
            });
            if (res.status >= 500) {
                // 5xx → 可重試
                const err = new Error(`GET ${url} → ${res.status}`);
                lastErr = err;
                if (attempt < maxRetries) {
                    if (!quiet)
                        console.log(`[scrape]   ⚠ ${res.status} 第 ${attempt + 1}/${maxRetries} 次重試...`);
                    await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
                    continue;
                }
                throw err;
            }
            if (!res.ok) {
                // 4xx → 不可重試(邏輯錯),直接丟
                throw new Error(`GET ${url} → ${res.status}`);
            }
            absorbCookies(jar, res);
            return res.text();
        }
        catch (e) {
            // TypeError (fetch 失敗/DNS/timeout) → 可重試
            const err = e;
            const isTypeError = err instanceof TypeError;
            if (!isTypeError && attempt >= maxRetries)
                throw err;
            lastErr = err;
            if (attempt < maxRetries) {
                if (!quiet)
                    console.log(`[scrape]   ⚠ ${err.message.slice(0, 60)} 第 ${attempt + 1}/${maxRetries} 次重試...`);
                await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
            }
        }
    }
    throw lastErr !== null && lastErr !== void 0 ? lastErr : new Error(`GET ${url} failed after ${maxRetries} retries`);
}
async function postSearch(jar, keyword, viewState, viewStateGen, eventValidation) {
    const body = new URLSearchParams({
        __VIEWSTATE: viewState,
        __VIEWSTATEGENERATOR: viewStateGen,
        __VIEWSTATEENCRYPTED: '',
        __EVENTVALIDATION: eventValidation,
        txtKW: keyword,
        judtype: 'JUDBOOK',
        whosub: '0',
        ctl00$cp_content$btnSimpleQry: '送出查詢',
    });
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
    });
    if (!res.ok)
        throw new Error(`POST ${SEARCH_URL} → ${res.status}`);
    absorbCookies(jar, res);
    return res.text();
}
function extractInputValue(html, name) {
    const re = new RegExp(`name="${name}"[^>]*value="([^"]*)"`, 'i');
    const m = html.match(re);
    return m ? m[1] : '';
}
function extractQryHash(html) {
    const m = html.match(/qryresultlst\.aspx\?ty=JUDBOOK&q=([a-f0-9]+)/);
    return m ? m[1] : null;
}
function parseDataLinks(html) {
    const hits = [];
    // <a href="data.aspx?ty=JD&amp;id=TCDV%2c115%2c訴%2c1628%2c20260605%2c1&amp;ot=in">
    const linkRe = /<a[^>]+href="data\.aspx\?ty=JD&amp;id=([^"&]+)&amp;[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = linkRe.exec(html)) !== null) {
        const id = decodeURIComponent(match[1]);
        const text = match[2]
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        // id 格式：{courtCode},{year},{caseType},{caseNum},{date},{v}
        const parts = id.split(',');
        if (parts.length < 5)
            continue;
        const [code, year, caseType, caseNum, date] = parts;
        // 找不到 COURT_CODE 對照時，加 "(未知代碼)" 標記
        // 原因：v0.2.9+ cityOf() 邏輯靠「臺灣XX地方法院」字串配對，
        //       裸代碼 ('CHDM' / 'ULDV') 會被當成不可解析，cityOf = null，無法觸發同縣市配對
        // 改為加標記後，未來理賠顧問/工程師看 precedents.json 一眼就知道這幾筆需要補 COURT_CODE
        // 同步：在 data/precedents/_pending-courts-to-fill.json 追蹤
        const court = COURT_CODE[code] || `${code}（未知代碼）`;
        const yearInt = parseInt(year, 10);
        if (!Number.isFinite(yearInt))
            continue;
        // v0.18.0 5 年 filter bug 修正：民國年 (110=2021, 115=2026) 用 env SCRAPE_YEAR_MIN 控制
        // 原 `if (yearInt < 2021) continue` 把民國年拿去跟西元 2021 比較 → 永遠為真 → 100% reject
        // 鏡 scripts/scrape-cloud.ts:393-398 的修正 pattern
        // 預設 108 民國 (= 2019 西元, 5 年內 from 2024，符合 user 2026-07-09 需求)
        // user 可用 SCRAPE_YEAR_MIN=110 收緊到 2021 西元起 (= 原意 5 年內 from 2026)
        const yearMin = parseInt(process.env.SCRAPE_YEAR_MIN || '108', 10);
        if (yearInt < yearMin)
            continue;
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
function extractAmounts(html, chain) {
    if (typeof html !== 'string')
        return null;
    // 把 HTML 壓平成純文字
    const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, '');
    const regex = CHAIN_REGEX[chain];
    // 主文段：找該鏈關鍵金額
    const mainMatch = text.match(/主文([\s\S]{0,2000}?)(?:理由|事實|壹|貳)/);
    let amount = 0;
    if (mainMatch) {
        const m = mainMatch[1].match(regex);
        if (m)
            amount = parseInt(m[1].replace(/,/g, ''), 10);
    }
    // 退回全文：找該鏈關鍵字 + 合理金額（1 萬 - 300 萬）
    if (!amount) {
        const candidates = [];
        const re = new RegExp(regex.source, 'g');
        let m;
        while ((m = re.exec(text)) !== null) {
            const v = parseInt(m[1].replace(/,/g, ''), 10);
            if (v >= 10000 && v <= 3000000)
                candidates.push(v);
        }
        if (candidates.length > 0)
            amount = candidates[0];
    }
    if (!amount)
        return null;
    // 總判賠：主文段最大單筆金額
    let total = 0;
    if (mainMatch) {
        const amounts = Array.from(mainMatch[1].matchAll(/([\d,]+)\s*元/g)).map((m) => parseInt(m[1].replace(/,/g, ''), 10));
        if (amounts.length > 0)
            total = Math.max(...amounts);
    }
    // 判決要旨：抓主文後 200 字
    const label = CHAIN_LABEL[chain];
    let gist = `${label} ${amount.toLocaleString()} 元`;
    const mainText = text.match(/主文([\s\S]{0,200})/);
    if (mainText)
        gist = mainText[1].slice(0, 200).trim() || gist;
    return { amount, total, gist };
}
// AGENTS §2.1：_amount 保留以備未來金額加權分類（暫未使用）
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function categorizeByFacts(gist, _amount) {
    if (gist.includes('死亡') || gist.includes('致死'))
        return 'death';
    if (gist.includes('重傷') || gist.includes('重殘'))
        return 'severe_injury';
    if (gist.includes('後遺症') || gist.includes('失能') || gist.includes('殘廢'))
        return 'disability';
    return 'minor_injury';
}
/**
 * 即時 append 寫入（避免最後 session 死了丟資料）
 * 第一次寫覆蓋，之後 append
 * 4 鏈各自寫到對應 JSON
 */
function writePrecedent(p) {
    const outDir = (0, node_path_1.join)(process.cwd(), 'data', 'precedents');
    if (!(0, node_fs_1.existsSync)(outDir))
        (0, node_fs_1.mkdirSync)(outDir, { recursive: true });
    const outFile = (0, node_path_1.join)(outDir, CHAIN_FILE[p.chain]);
    let arr = [];
    if ((0, node_fs_1.existsSync)(outFile)) {
        try {
            arr = JSON.parse((0, node_fs_1.readFileSync)(outFile, 'utf-8'));
        }
        catch (_a) {
            arr = [];
        }
    }
    // 去重 by id
    if (arr.some((x) => x.id === p.id))
        return;
    arr.push(p);
    (0, node_fs_1.writeFileSync)(outFile, JSON.stringify(arr, null, 2), 'utf-8');
}
/**
 * isCivilCase — 案號是否為民事案件
 * 排除：刑事庭(易/交易/附民/刑附民/重訴附民)、家事法庭(家親/家聲)
 * 保留：純民事(訴/簡/上/重訴/簡上)、民事附帶民事(已含附民=刑庭附帶民事故排除)
 *
 * 司法院案號結構：
 *   訴/簡/上/重訴/簡上/原簡/智/重/小 → 民事
 *   附民/交附民/原附民/簡附民/刑附民 → 刑事庭附帶民事（排除）
 *   易/交易/自 → 刑事（排除）
 *   家親/家聲/家訴/家事 → 家事法庭（非車禍案件）（排除）
 */
function isCivilCase(caseNo) {
    if (!caseNo)
        return true; // 沒案號=保留
    // 排除清單
    const penalPatterns = [
        '附民',
        '交附民',
        '原附民',
        '簡附民',
        '刑附民', // 刑事附帶民事
        '易字',
        '易',
        '交易',
        '自訴',
        '自', // 刑事
    ];
    for (const pat of penalPatterns) {
        if (caseNo.includes(pat))
            return false;
    }
    const familyPatterns = ['家親', '家聲', '家事']; // 家事法庭（非車禍民事）
    for (const pat of familyPatterns) {
        if (caseNo.includes(pat))
            return false;
    }
    return true;
}
/**
 * isCarAccidentCase — v0.27.7+ — 案號是否為車禍相關民事案件
 * 排除（user 2026-07-17 要求「只抓車禍類別」）：
 * - 勞訴/竹勞簡專調/勞（勞工法案件，例：資遣費、加班費）
 * - 婚（離婚案件）
 * - 家繼（繼承案件）
 * - 國（涉外案件，例外要手動加白名單）
 * - 消/消簡上（消費者保護案件，多半非車禍）
 * 保留：
 * - 訴/簡/重訴/簡上/小上（純民事，常見車禍）
 * - 車/交通（明確車禍）
 */
function isCarAccidentCase(caseNo) {
    if (!caseNo)
        return true;
    // 排除清單（按 user 2026-07-17 需求）
    const nonTrafficPatterns = [
        '勞訴', // 勞動訴訟
        '勞簡', // 勞動簡式訴訟
        '竹勞簡專調', // 新竹勞工專庭調解
        '婚', // 離婚
        '家繼', // 繼承
        '家事', // 家事法庭
        '國', // 涉外
        '消', // 消費者保護
    ];
    for (const pat of nonTrafficPatterns) {
        if (caseNo.includes(pat))
            return false;
    }
    return true;
}
/**
 * isInYearRange — v0.2.21+ — 案號是否在指定民國年範圍內
 * 用例: SCRAPE_MIN_YEAR=109 SCRAPE_MAX_YEAR=111 → 只抓 109~111 年案件
 * 案號格式: "{year} 年度 {caseType} 字第 {caseNum} 號"
 */
function isInYearRange(caseNo, yearMin, yearMax) {
    if (yearMin === null || yearMax === null)
        return true; // 沒設範圍=不過濾
    if (!caseNo)
        return true;
    const m = caseNo.match(/^(\d+)\s*年度/);
    if (!m)
        return true;
    const year = parseInt(m[1], 10);
    if (!Number.isFinite(year))
        return true;
    return year >= yearMin && year <= yearMax;
}
async function main() {
    var _a, _b, _c, _d, _e;
    // CLI: --dry-run = 不寫檔，只跑流程; --chain <name> = 只跑單鏈; --quiet = 精簡輸出（給 cron 用）
    //       --retry <N> = fetch 重試次數（預設 3，設 0 關閉）; --retry-delay <ms> = 起始退避毫秒（預設 500，指數倍增）
    const isDryRun = process.argv.includes('--dry-run');
    const isQuiet = process.argv.includes('--quiet');
    retryConfig.quiet = isQuiet;
    const chainArgIdx = process.argv.indexOf('--chain');
    const chainFilter = chainArgIdx >= 0 ? process.argv[chainArgIdx + 1] : null;
    const retryArgIdx = process.argv.indexOf('--retry');
    if (retryArgIdx >= 0) {
        const n = parseInt((_a = process.argv[retryArgIdx + 1]) !== null && _a !== void 0 ? _a : '3', 10);
        retryConfig.maxRetries = isNaN(n) ? 3 : Math.max(0, n);
    }
    const retryDelayArgIdx = process.argv.indexOf('--retry-delay');
    if (retryDelayArgIdx >= 0) {
        const ms = parseInt((_b = process.argv[retryDelayArgIdx + 1]) !== null && _b !== void 0 ? _b : '500', 10);
        retryConfig.baseDelayMs = isNaN(ms) ? 500 : Math.max(100, ms);
    }
    // v0.2.21+ — 年度範圍過濾（民國年），預設不限。例: --year-min 109 --year-max 111
    const yearMinArgIdx = process.argv.indexOf('--year-min');
    const yearMaxArgIdx = process.argv.indexOf('--year-max');
    const yearMin = yearMinArgIdx >= 0 ? parseInt((_c = process.argv[yearMinArgIdx + 1]) !== null && _c !== void 0 ? _c : '0', 10) : null;
    const yearMax = yearMaxArgIdx >= 0 ? parseInt((_d = process.argv[yearMaxArgIdx + 1]) !== null && _d !== void 0 ? _d : '0', 10) : null;
    const hasYearFilter = yearMin !== null && !isNaN(yearMin) && yearMax !== null && !isNaN(yearMax);
    if (!isQuiet) {
        if (isDryRun)
            console.log('[scrape] 🧪 DRY RUN — 不會寫入 precedents 檔');
        if (chainFilter)
            console.log(`[scrape] 🔗 只跑 ${chainFilter} 鏈`);
        if (hasYearFilter)
            console.log(`[scrape] 📅 年度範圍: 民國 ${yearMin} ~ ${yearMax} 年`);
        console.log(`[scrape] 🔁 retry 設定：maxRetries=${retryConfig.maxRetries}, baseDelayMs=${retryConfig.baseDelayMs}`);
    }
    const jobs = Object.keys(KEYWORDS)
        .filter((c) => !chainFilter || c === chainFilter)
        .flatMap((chain) => KEYWORDS[chain].map((keyword) => ({ chain, keyword })));
    const allHits = [];
    let totalScraped = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    for (const { chain, keyword: kw } of jobs) {
        console.log(`[scrape] === ${CHAIN_LABEL[chain]} / "${kw}" ===`);
        const jar = newJar();
        // 1. GET 拿 ViewState + cookies
        const homeHtml = await getHtml(jar, SEARCH_URL);
        const vs = extractInputValue(homeHtml, '__VIEWSTATE');
        const vsg = extractInputValue(homeHtml, '__VIEWSTATEGENERATOR');
        const ev = extractInputValue(homeHtml, '__EVENTVALIDATION');
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
        // 3. GET qryresultlst 拿 data.aspx 連結（v0.2.14+ 支援分頁: a=1..maxPages）
        const maxPages = Math.max(1, parseInt(process.env.SCRAPE_MAX_PAGES || '6', 10)); // v0.5.7+ 預設 6 (從 3 改 6, 衝量)
        const allHitsMap = new Map(); // v0.2.14 用 href 去重(避免 page 1+2+3 重複抓同一件)
        let actualPages = 0;
        const qryReferer = `${BASE}/FJUD/qryresultlst.aspx?ty=JUDBOOK&q=${qHash}`; // 給 detail 抓取當 referer
        for (let page = 1; page <= maxPages; page++) {
            const qryUrl = page === 1
                ? `${BASE}/FJUD/qryresultlst.aspx?ty=JUDBOOK&q=${qHash}`
                : `${BASE}/FJUD/qryresultlst.aspx?ty=JUDBOOK&q=${qHash}&a=${page}`;
            let qryHtml;
            try {
                qryHtml = await getHtml(jar, qryUrl, SEARCH_URL);
            }
            catch (e) {
                console.log(`[scrape]   ⚠ page ${page} 抓取失敗: ${e.message}`);
                break;
            }
            const pageHits = parseDataLinks(qryHtml);
            console.log(`[scrape]   Step 3.${page}: page ${page} 命中 ${pageHits.length} 件`);
            if (pageHits.length === 0)
                break; // 沒結果就停(避免無窮)
            for (const h of pageHits)
                allHitsMap.set(h.href, h);
            actualPages = page;
        }
        const hits = Array.from(allHitsMap.values());
        console.log(`[scrape]   Step 3 總計: ${hits.length} 件 (跨 ${actualPages} pages, 去重後)`);
        // 4. 立即在 session 活著時抓每個 detail
        for (const hit of hits) {
            console.log(`[scrape]     抓 ${hit.court} ${hit.caseNo} ...`);
            try {
                const detail = await getHtml(jar, hit.href, qryReferer);
                // v0.2.21+ — 年度範圍過濾（在抓 detail 後立刻套用，省 token 流量）
                if (!isInYearRange(hit.caseNo, hasYearFilter ? yearMin : null, hasYearFilter ? yearMax : null)) {
                    console.log(`[scrape]       📅 [年度過濾] 排除 ${hit.caseNo}`);
                    totalSkipped++;
                    continue;
                }
                const amts = extractAmounts(detail, chain);
                if (!amts) {
                    console.log(`[scrape]       ⚠ 沒抓到 ${CHAIN_LABEL[chain]}金額`);
                    totalSkipped++;
                    continue;
                }
                const yearInt = parseInt(((_e = hit.caseNo.match(/(\d+)/)) === null || _e === void 0 ? void 0 : _e[1]) || '0', 10);
                const category = categorizeByFacts(amts.gist, amts.amount);
                allHits.push(Object.assign({}, hit));
                // 直接寫進 precedents（dry-run 跳過）
                const precedent = {
                    id: `tw-${chain}-${yearInt}-${hit.caseNo.replace(/\D/g, '').slice(-6)}`,
                    caseNo: hit.caseNo,
                    court: hit.court,
                    year: yearInt + 1911,
                    category,
                    chain,
                    facts: amts.gist.slice(0, 120),
                    amount: amts.amount,
                    totalAward: amts.total,
                    ratio: { plaintiff: 0, defendant: 100 },
                    gist: `${CHAIN_LABEL[chain]} ${amts.amount.toLocaleString()} 元`,
                    source: `${hit.court} ${hit.caseNo}`,
                    scrapedAt: new Date().toISOString(),
                };
                if (isDryRun) {
                    console.log(`[scrape]       🧪 [dry-run] ${CHAIN_LABEL[chain]} ${amts.amount.toLocaleString()} 元`);
                }
                else {
                    // 過濾刑事/家事案件（純民事車禍估算器用不到）
                    if (!isCivilCase(hit.caseNo)) {
                        console.log(`[scrape]       ⏭️  [刑庭/家事] 排除 ${hit.caseNo}`);
                        totalSkipped++;
                        continue;
                    }
                    // v0.27.7+：過濾非車禍案件（勞訴/婚/家繼/國/消等）
                    if (!isCarAccidentCase(hit.caseNo)) {
                        console.log(`[scrape]       ⏭️  [非車禍] 排除 ${hit.caseNo}`);
                        totalSkipped++;
                        continue;
                    }
                    await writePrecedent(precedent);
                    console.log(`[scrape]       ✅ ${CHAIN_LABEL[chain]} ${amts.amount.toLocaleString()} 元`);
                    totalScraped++;
                }
            }
            catch (e) {
                console.log(`[scrape]       ❌ ${e.message}`);
                totalErrors++;
            }
            // 禮貌延遲避免被擋
            await new Promise((r) => setTimeout(r, 200));
        }
    }
    // Run 結束 summary
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log(`[scrape] 📊 Run summary`);
    console.log(`[scrape]   抓取成功: ${totalScraped} 件`);
    console.log(`[scrape]   跳過:     ${totalSkipped} 件`);
    console.log(`[scrape]   失敗:     ${totalErrors} 件`);
    console.log(`[scrape]   命中總數: ${allHits.length} 件`);
    if (chainFilter)
        console.log(`[scrape] 🔗 限定鏈: ${chainFilter}`);
    if (isDryRun)
        console.log(`[scrape] 🧪 DRY RUN — 未寫入任何檔案`);
    console.log('═══════════════════════════════════════');
}
// 直接跑 main 才執行（避免 import 時跑）
if ((_a = process.argv[1]) === null || _a === void 0 ? void 0 : _a.endsWith('scrape-judgments.js')) {
    main().catch((e) => {
        console.error('[scrape] ❌', e);
        process.exit(1);
    });
}
