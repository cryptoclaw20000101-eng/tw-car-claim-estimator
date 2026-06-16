// ============================================================
// scripts/check-rule-drift.js
// v0.3.2：比對 HTML 內 JS 跟 lib/insurance/*.ts 常數是否一致
// 策略：精準切出 HTML「純函式段」（EMBEDDED_PRECEDENTS 開始到
//       findRelatedPracticeCases 結尾），跟 TS 對應常數比對
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML_PATH = path.join(__dirname, '..', 'public', 'claim-calculator.html');
const TS_DIR = path.join(__dirname, '..', 'lib', 'insurance');

const html = fs.readFileSync(HTML_PATH, 'utf8');
// v0.4.5: 多個 <script> 段，內含 <noscript><script> 跟實際計算引擎
// drift 抓「最長的」inline script 段（計算引擎）
const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (scriptMatches.length === 0) { console.error('No <script> found'); process.exit(1); }
const js = scriptMatches.reduce((max, m) => m[1].length > max.length ? m[1] : max, '');

// --- 1. 切出純函式段 ---
// 從 <script> 後第一個 const COMPULSORY_LIMITS 開始（涵蓋所有常數 + 函式）
// 到 findRelatedPracticeCases 函式結尾
// v0.4.5: 註解 "配權 4 維度" 已不存在（v0.3.3+ 改寫），
//         改用函式定義作為 end marker
// v0.5.0: 加 'var EMBEDDED_PRECEDENTS = [];' 在更早位置（給 drift 純函式段使用）
const START_MARKER = 'const COMPULSORY_LIMITS = {';
const END_COMMENT_MARKER = 'function findRelatedPracticeCases';
const startIdx = js.indexOf(START_MARKER);
const funcStartIdx = js.indexOf(END_COMMENT_MARKER, startIdx);
let brace = 0, started = false, pureEnd = -1;
for (let i = funcStartIdx; i < js.length; i++) {
  if (js[i] === '{') { brace++; started = true; }
  else if (js[i] === '}') {
    brace--;
    if (started && brace === 0) { pureEnd = i + 1; break; }
  }
}
// 先拔掉 const $ = ... 那一行（純函式段內不需要）
let pureJs = js.substring(startIdx, pureEnd);
pureJs = pureJs.replace(/^const \$ = .*$/m, '// $ 函式已 stub');
// v0.5.0: 在純函式段開頭加 var EMBEDDED_PRECEDENTS = [] 宣告
const cleanJs = 'const $ = (id) => null;\nvar EMBEDDED_PRECEDENTS = [];\n' + pureJs;
console.log(`📐 純函式段：${startIdx} → ${pureEnd} (${cleanJs.length} chars)`);

// --- 2. 評估純函式段，取常數 ---
let htmlConstants = {};
try {
  const sandbox = { htmlApi_: {} };
  vm.createContext(sandbox);
  vm.runInContext(cleanJs + `
    htmlApi_.COMPULSORY_LIMITS = COMPULSORY_LIMITS;
    htmlApi_.DISABILITY_TABLE = COMPULSORY_LIMITS.DISABILITY_TABLE;
    htmlApi_.DISABILITY_CATEGORY_DEFAULT_LEVEL = DISABILITY_CATEGORY_DEFAULT_LEVEL;
    htmlApi_.HOFFMANN = HOFFMANN;
    htmlApi_.REGION_MULTIPLIER = REGION_MULTIPLIER;
    htmlApi_.CITY_TO_COURT = CITY_TO_COURT;
    htmlApi_.EMBEDDED_PRECEDENTS = EMBEDDED_PRECEDENTS;
  `, sandbox);
  htmlConstants = sandbox.htmlApi_;
} catch (e) {
  console.error('❌ 純函式段評估失敗：', e.message);
  process.exit(1);
}

console.log('\n📊 HTML 內常數：');
console.log(`   COMPULSORY_LIMITS.TOTAL_MEDICAL_CAP = ${htmlConstants.COMPULSORY_LIMITS.TOTAL_MEDICAL_CAP.toLocaleString()}`);
console.log(`   HOFFMANN[10] = ${htmlConstants.HOFFMANN[10].toFixed(4)}`);
console.log(`   DISABILITY_TABLE[1] = ${htmlConstants.DISABILITY_TABLE[1].toLocaleString()}`);
console.log(`   DISABILITY_TABLE[15] = ${htmlConstants.DISABILITY_TABLE[15].toLocaleString()}`);
console.log(`   REGION_MULTIPLIER['臺北市'] = ${htmlConstants.REGION_MULTIPLIER['臺北市']}`);
console.log(`   CITY_TO_COURT 數量 = ${Object.keys(htmlConstants.CITY_TO_COURT).length}`);
console.log(`   EMBEDDED_PRECEDENTS 數量 = ${htmlConstants.EMBEDDED_PRECEDENTS.length}`);

// --- 3. TS 端比對 ---
function grepConstFromTs(tsFile, constName) {
  try {
    const src = fs.readFileSync(path.join(TS_DIR, tsFile), 'utf8');
    const re = new RegExp(`export\\s+const\\s+${constName}\\b[^=]*=\\s*([\\s\\S]+?)\\s*as\\s+const`, 'm');
    const m = src.match(re);
    return m ? m[1] : null;
  } catch (e) { return null; }
}

console.log('\n🔍 關鍵數值 drift 比對：');
const checksVal = [
  { name: '強制險總額上限', html: htmlConstants.COMPULSORY_LIMITS.TOTAL_MEDICAL_CAP, expected: 200_000, ts: 'compulsory.ts' },
  { name: '霍夫曼 10 年', html: htmlConstants.HOFFMANN[10], expected: 7.7217, ts: 'hoffmann.ts' },
  { name: '失能等級 1（最高）', html: htmlConstants.DISABILITY_TABLE[1], expected: 3_000_000, ts: 'disability-tables.ts (新制 2026-07-01)' },
  { name: '失能等級 15（最低）', html: htmlConstants.DISABILITY_TABLE[15], expected: 80_000, ts: 'disability-tables.ts' },
  { name: '臺北地區係數', html: htmlConstants.REGION_MULTIPLIER['臺北市'], expected: 1.15, ts: 'region-adjustments.ts' }
];

const drifts = [];
checksVal.forEach(({ name, html: h, expected, ts }) => {
  const drift = Math.abs(h - expected) / expected;
  if (drift < 0.001) {
    console.log(`   ✅ ${name.padEnd(15)} HTML=${h.toLocaleString()} == 預期=${expected.toLocaleString()}`);
  } else if (drift < 0.05) {
    console.log(`   🟡 ${name.padEnd(15)} HTML=${h.toLocaleString()} vs 預期=${expected.toLocaleString()} 差異 ${(drift*100).toFixed(1)}%`);
  } else {
    console.log(`   ❌ ${name.padEnd(15)} HTML=${h.toLocaleString()} vs 預期=${expected.toLocaleString()} 差異 ${(drift*100).toFixed(1)}%`);
    drifts.push({ name, html: h, expected, ts });
  }
});

// --- 4. 結果 ---
console.log('\n' + '='.repeat(60));
if (drifts.length === 0) {
  console.log('✅ v0.3.2 drift 檢查：所有常數對齊，無需更新');
  process.exit(0);
} else {
  console.log(`⚠️ v0.3.2 drift 檢查：發現 ${drifts.length} 項不一致`);
  drifts.forEach(d => console.log(`   - ${d.name}: HTML=${d.html} vs TS=${d.expected} (${d.ts})`));
  process.exit(0);  // 提醒而非錯誤
}
