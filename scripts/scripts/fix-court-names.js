"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * fix-court-names.ts
 * v0.2.21 — 把 precedents 內「未知代碼」標記的 court 改為正確法院全名
 * 對每個未知 code 抓 1 個 sample detail HTML 找法院全名
 * 寫進 _court-resolution.json, 然後可用 apply-courts.ts 批次替換 precedents
 *
 * 實作: 自帶 cookie jar (拷貝 scrape-judgments 工具) — 不污染主檔
 */
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const BASE = 'https://judgment.judicial.gov.tw';
const SEARCH_URL = `${BASE}/FJUD/default.aspx`;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const newJar = () => ({});
function cookieHeader(jar) {
    return Object.entries(jar)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
}
function absorbCookies(jar, res) {
    var _a, _b;
    const sc = ((_b = (_a = res.headers).getSetCookie) === null || _b === void 0 ? void 0 : _b.call(_a)) || [];
    for (const c of sc) {
        const m = c.match(/^([^=]+)=([^;]*)/);
        if (m && m[1] !== undefined)
            jar[m[1]] = m[2];
    }
}
function extractInputValue(html, name) {
    const m = html.match(new RegExp(`name="${name}"[^>]*value="([^"]*)"`, 'i'));
    return (m === null || m === void 0 ? void 0 : m[1]) || '';
}
function extractQryHash(html) {
    const m = html.match(/qryresultlst\.aspx\?ty=JUDBOOK&q=([a-f0-9]+)/);
    return m ? m[1] : null;
}
async function getHtml(jar, url, referer) {
    let lastErr = null;
    for (let i = 0; i < 3; i++) {
        try {
            const res = await fetch(url, {
                headers: Object.assign({ 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'zh-TW,zh;q=0.9', Cookie: cookieHeader(jar) }, (referer ? { Referer: referer } : {})),
            });
            absorbCookies(jar, res);
            if (res.status >= 500 && i < 2) {
                await sleep(500 * 2 ** i);
                continue;
            }
            if (!res.ok)
                throw new Error(`GET ${url} → ${res.status}`);
            return await res.text();
        }
        catch (e) {
            lastErr = e instanceof Error ? e : new Error(String(e));
            if (i === 2)
                throw lastErr;
            await sleep(500 * 2 ** i);
        }
    }
    throw lastErr !== null && lastErr !== void 0 ? lastErr : new Error('unreachable');
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function resolveCourtName(sample, kw = '車禍 侵權行為') {
    const jar = newJar();
    const homeHtml = await getHtml(jar, SEARCH_URL);
    const vs = extractInputValue(homeHtml, '__VIEWSTATE');
    const vsg = extractInputValue(homeHtml, '__VIEWSTATEGENERATOR');
    const ev = extractInputValue(homeHtml, '__EVENTVALIDATION');
    const body = new URLSearchParams({
        __VIEWSTATE: vs,
        __VIEWSTATEGENERATOR: vsg,
        __VIEWSTATEENCRYPTED: '',
        __EVENTVALIDATION: ev,
        txtKW: kw,
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
        throw new Error(`POST → ${res.status}`);
    absorbCookies(jar, res);
    const postText = await res.text();
    const qHash = extractQryHash(postText);
    if (!qHash)
        throw new Error('no qHash');
    const qryHtml = await getHtml(jar, `${BASE}/FJUD/qryresultlst.aspx?ty=JUDBOOK&q=${qHash}`);
    const linkRe = /<a[^>]+href="data\.aspx\?ty=JD&amp;id=([^"&]+)&[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    const links = [];
    let m;
    while ((m = linkRe.exec(qryHtml)) !== null) {
        links.push({ id: decodeURIComponent(m[1]) });
    }
    let target = null;
    for (const l of links) {
        const parts = l.id.split(',');
        if (parts[0] === sample.code &&
            parts[1] === sample.year &&
            parts[2] === sample.caseType &&
            parts[3] === sample.caseNum) {
            target = l.id;
            break;
        }
    }
    if (!target) {
        for (const l of links) {
            if (l.id.split(',')[0] === sample.code) {
                target = l.id;
                break;
            }
        }
    }
    if (!target)
        return null;
    const detail = await getHtml(jar, `${BASE}/FJUD/data.aspx?ty=JD&id=${encodeURIComponent(target)}&ot=in`, `${BASE}/FJUD/qryresultlst.aspx?ty=JUDBOOK&q=${qHash}`);
    const courts = [...detail.matchAll(/臺灣[\u4e00-\u9fff]{2,8}(?:地方法院|分院)/g)].map((mm) => mm[0]);
    return courts[0] || null;
}
;
(async () => {
    var _a;
    const DATA = '/Users/openclaw/projects/tw-car-claim-estimator/data/precedents';
    const files = (0, node_fs_1.readdirSync)(DATA).filter((f) => f.endsWith('.json') && !f.startsWith('_') && f !== 'precedents-report.html');
    // chain → 對應 keyword (從 scrape-judgments 抄, 命中率較高的 keyword)
    const CHAIN_KEYWORDS = {
        'car-damage': ['車輛修復 交通事故', '車禍 車損 折舊'],
        'labor-loss': ['工作損失 交通事故', '減少勞動能力 車禍'],
        'mental-distress': ['精神慰撫金 車禍', '非財產上損害 交通事故'],
        disability: ['失能 車禍', '殘廢 給付'],
        'nursing-care': ['看護費 車禍', '看護 交通事故'],
        'medical-expense': ['醫療費用 車禍', '自費 醫療'],
        'death-case': ['死亡 車禍 慰撫金', '肇事致人於死'],
        'transport-fee': ['計程車 車禍', '交通費用'],
        'support-payment': ['扶養 車禍', '撫養費'],
        'overtime-loss': ['加班 損失 車禍'],
        mediation: ['調解 車禍 和解', '訴訟外和解'],
        practice: ['理賠 案例', '強制險 給付'],
        other: ['車禍 民事', '侵權行為'],
    };
    const unknownMap = new Map();
    for (const f of files) {
        const data = JSON.parse((0, node_fs_1.readFileSync)((0, node_path_1.join)(DATA, f), 'utf8'));
        const chainName = f.replace('.json', '');
        for (const p of data) {
            const m = (p.court || '').match(/^([A-Z]{4})（未知代碼）$/);
            const code = m === null || m === void 0 ? void 0 : m[1];
            if (code) {
                const yearMatch = (_a = p.caseNo) === null || _a === void 0 ? void 0 : _a.match(/(\d+)\s*年度\s*(\S+)\s*字第\s*(\S+)\s*號/);
                if (!yearMatch)
                    continue;
                if (!unknownMap.has(code)) {
                    unknownMap.set(code, {
                        sample: {
                            code,
                            year: yearMatch[1],
                            caseType: yearMatch[2],
                            caseNum: yearMatch[3],
                            caseNo: p.caseNo,
                            chain: chainName,
                        },
                        keywords: CHAIN_KEYWORDS[chainName] || CHAIN_KEYWORDS['other'],
                    });
                }
            }
        }
    }
    console.log(`[fix-courts] 找到 ${unknownMap.size} 個未知代碼`);
    const outFile = (0, node_path_1.join)(DATA, '_court-resolution.json');
    const courtMap = {};
    try {
        const existing = JSON.parse((0, node_fs_1.readFileSync)(outFile, 'utf8'));
        Object.assign(courtMap, existing);
        console.log(`[fix-courts] 載入既有 ${Object.keys(existing).length} 個結果`);
    }
    catch (_b) { }
    for (const [code, { sample, keywords }] of unknownMap) {
        if (courtMap[code]) {
            console.log(`[fix-courts] ${code}: 已有 ${courtMap[code]}, 跳過`);
            continue;
        }
        process.stdout.write(`[fix-courts] ${code} (${sample.caseNo})... `);
        let name = null;
        for (const kw of keywords) {
            try {
                const got = await resolveCourtName(sample, kw);
                if (got) {
                    name = got;
                    break;
                }
            }
            catch (_c) {
                /* try next */
            }
        }
        if (name) {
            courtMap[code] = name;
            console.log(`→ ${name}`);
        }
        else {
            console.log(`⚠ 所有 keyword 都找不到`);
        }
        (0, node_fs_1.writeFileSync)(outFile, JSON.stringify(courtMap, null, 2));
        await sleep(300);
    }
    console.log(`\n[fix-courts] 寫出 ${outFile} (${Object.keys(courtMap).length} 個)`);
})().catch((e) => {
    console.error('FATAL:', e);
    process.exit(1);
});
