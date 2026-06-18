
/**
 * apply-courts.ts
 * v0.2.21 — 套用 _court-resolution.json 的法院全名到 precedents
 *
 * 保守策略：只套用 verified 為 true 的 5 個 code
 *   - KLDV → 臺灣基隆地方法院 (案號有「基簡」「基小」字眼)
 *   - SCDV → 臺灣新竹地方法院 (案號有「竹簡」「竹小」字眼)
 *   - KSDM → 臺灣高雄地方法院 (KS = 高雄地院 D=V 民事庭)
 *   - TYDM → 臺灣桃園地方法院 (TY = 桃園, TYD 桃園地院)
 *   - TNHV → 臺灣高等法院臺南分院 (H = 分院, TN = 臺南)
 *
 * 其他 (CTDV/ULDV/ILDV) 雖然 fix-court-names.ts 有解, 但 v0.2.21 保守不套用
 *   - CTDV: 抓到的「橋頭地院」是 2025 新分院, D 結尾應該是地院, 不確定
 *   - ULDV: 抓到的「雲林地院」案號沒雲林前綴, 真實可能是宜蘭
 *   - ILDV: 抓到的「宜蘭地院」案號提到「首都客運」, 可能是新北誤判
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DATA = "/Users/openclaw/projects/tw-car-claim-estimator/data/precedents";

const VERIFIED_COURT_MAP: Record<string, string> = {
  KLDV: "臺灣基隆地方法院",
  SCDV: "臺灣新竹地方法院",
  KSDM: "臺灣高雄地方法院",
  TYDM: "臺灣桃園地方法院",
  TNHV: "臺灣高等法院臺南分院",
};

// 載入 _court-resolution.json 比對
const resFile = join(DATA, "_court-resolution.json");
const resolution: Record<string, string> = JSON.parse(readFileSync(resFile, "utf8"));
for (const [code, name] of Object.entries(resolution)) {
  if (!VERIFIED_COURT_MAP[code]) {
    console.log(`[apply-courts] skip ${code} → ${name} (not in verified map)`);
  } else if (VERIFIED_COURT_MAP[code] !== name) {
    console.warn(`[apply-courts] WARNING ${code}: verified="${VERIFIED_COURT_MAP[code]}" but resolution="${name}" — using verified`);
  }
}

const files = readdirSync(DATA).filter(
  f => f.endsWith(".json") && !f.startsWith("_") && f !== "precedents-report.html"
);

let totalUpdated = 0;
const updateCounts: Record<string, number> = {};
for (const f of files) {
  const path = join(DATA, f);
  const data = JSON.parse(readFileSync(path, "utf8"));
  let updatedInFile = 0;
  for (const p of data) {
    const court = p.court || "";
    const m = court.match(/^([A-Z]{4})（未知代碼）$/);
    const code = m?.[1];
    if (code && VERIFIED_COURT_MAP[code]) {
      p.court = VERIFIED_COURT_MAP[code];
      updatedInFile++;
      updateCounts[code] = (updateCounts[code] || 0) + 1;
    }
  }
  if (updatedInFile > 0) {
    writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
    totalUpdated += updatedInFile;
    console.log(`[apply-courts] ${f}: 更新 ${updatedInFile} 件`);
  }
}

console.log("\n[apply-courts] === 套用統計 ===");
for (const [code, count] of Object.entries(updateCounts)) {
  console.log(`  ${code} → ${VERIFIED_COURT_MAP[code]}: ${count} 件`);
}
console.log(`[apply-courts] 合計: ${totalUpdated} 件`);

const remaining: Record<string, number> = {};
for (const f of files) {
  const data = JSON.parse(readFileSync(join(DATA, f), "utf8"));
  for (const p of data) {
    const court = p.court || "";
    const m = court.match(/^([A-Z]{4})（未知代碼）$/);
    if (m) {
      remaining[m[1]] = (remaining[m[1]] || 0) + 1;
    }
  }
}
console.log("\n[apply-courts] === 剩餘未知代碼 (待你查證) ===");
for (const [code, count] of Object.entries(remaining)) {
  console.log(`  ${code}: ${count} 件`);
}
