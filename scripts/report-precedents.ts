/**
 * 6 鏈 precedents 報表產生器
 *
 * 讀 data/precedents/ 全部 JSON，統計：
 *   - 各鏈件數 + 6 鏈 vs 既有 legacy 對比
 *   - 法院分布（6 鏈各自 top 5）
 *   - 金額分佈（min/median/max/quartile）
 *   - 抓取時間軸（最近 30 筆）
 *   - 失能等級 / 傷勢類別分布
 * 產出 data/precedents-report.html（手機可看、單檔零依賴）
 *
 * 設計：
 *   - 純 Node 內建（fs / path）
 *   - 零外部 deps
 *   - 適合給 cron 跑完後看
 */

import { writeFileSync, readFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT_FILE = join(process.cwd(), "data", "precedents-report.html");

/** 6 鏈檔名 → 標籤 */
const CHAIN_FILE_TO_LABEL: Record<string, string> = {
  "taipei-mental-distress.json": "精神慰撫金",
  "labor-loss.json": "工作損失",
  "car-damage.json": "車損",
  "disability-merging.json": "失能慰撫金",
  "mediation-procedures.json": "車禍調解",
  "practice-cases.json": "律師實務",
};

/** Legacy / 補充檔（給整體健康度看） */
const LEGACY_FILES = [
  "labor-capacity.json",
  "other-precedents.json",
  "scar-revision.json",
];

interface PrecedentRow {
  id?: string;
  caseNo?: string;
  court?: string;
  year?: number;
  category?: string;
  amount?: number;
  mentalDistressAmount?: number;
  chain?: string;
  scrapedAt?: string;
  [k: string]: unknown;
}

function loadAllPrecedents(): { chain: Map<string, PrecedentRow[]>; legacy: PrecedentRow[] } {
  const chain = new Map<string, PrecedentRow[]>();
  const legacy: PrecedentRow[] = [];
  const dir = join(process.cwd(), "data", "precedents");
  if (!existsSync(dir)) return { chain, legacy };
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const arr = JSON.parse(readFileSync(join(dir, f), "utf-8")) as PrecedentRow[];
    if (!Array.isArray(arr)) continue;
    if (CHAIN_FILE_TO_LABEL[f]) {
      chain.set(f, arr);
    } else {
      legacy.push(...arr);
    }
  }
  return { chain, legacy };
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function stats(nums: number[]): { min: number; p25: number; med: number; p75: number; max: number; n: number } {
  if (nums.length === 0) return { min: 0, p25: 0, med: 0, p75: 0, max: 0, n: 0 };
  const sorted = [...nums].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return {
    min: sorted[0],
    p25: at(0.25),
    med: median(sorted),
    p75: at(0.75),
    max: sorted[sorted.length - 1],
    n: nums.length,
  };
}

function topCourts(rows: PrecedentRow[], k = 5): [string, number][] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const c = r.court || "(unknown)";
    m.set(c, (m.get(c) ?? 0) + 1);
  }
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, k);
}

function categoryDist(rows: PrecedentRow[]): [string, number][] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const c = String(r.category || "(none)");
    m.set(c, (m.get(c) ?? 0) + 1);
  }
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
}

function recentTimeline(rows: PrecedentRow[], k = 30): PrecedentRow[] {
  return [...rows]
    .filter((r) => r.scrapedAt)
    .sort((a, b) => (b.scrapedAt! > a.scrapedAt! ? 1 : -1))
    .slice(0, k);
}

function esc(s: string | number | undefined | null): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return "";
  return iso.replace("T", " ").slice(0, 16);
}

function buildHtml(args: {
  chain: Map<string, PrecedentRow[]>;
  legacy: PrecedentRow[];
  generatedAt: string;
}): string {
  const { chain, legacy, generatedAt } = args;
  const totalChain = Array.from(chain.values()).reduce((s, r) => s + r.length, 0);
  const grand = totalChain + legacy.length;

  // 6 鏈摘要
  const chainSections: string[] = [];
  for (const [file, label] of Object.entries(CHAIN_FILE_TO_LABEL)) {
    const rows = chain.get(file) ?? [];
    const amounts = rows.map((r) => Number(r.amount ?? r.mentalDistressAmount ?? 0)).filter((n) => n > 0);
    const st = stats(amounts);
    const courts = topCourts(rows, 5);
    const cats = categoryDist(rows);

    const bar = (label: string, n: number, total: number, color: string): string => {
      const pct = total > 0 ? (n / total) * 100 : 0;
      return `<div class="bar"><span class="bar-label">${esc(label)}</span><div class="bar-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div><span class="bar-n">${n}</span></div>`;
    };

    chainSections.push(`
      <section class="chain">
        <h2>🔗 ${esc(label)} <span class="muted">(${file})</span></h2>
        <div class="kpi-row">
          <div class="kpi"><div class="kpi-n">${rows.length}</div><div class="kpi-l">件數</div></div>
          <div class="kpi"><div class="kpi-n">${st.med.toLocaleString()}</div><div class="kpi-l">中位數</div></div>
          <div class="kpi"><div class="kpi-n">${st.max.toLocaleString()}</div><div class="kpi-l">最高</div></div>
          <div class="kpi"><div class="kpi-n">${st.min.toLocaleString()}</div><div class="kpi-l">最低</div></div>
        </div>
        <h3>金額分佈 (${st.n} 筆有金額)</h3>
        <p class="muted">P25 ${st.p25.toLocaleString()} · 中位 ${st.med.toLocaleString()} · P75 ${st.p75.toLocaleString()}</p>
        <h3>法院分布 (Top 5)</h3>
        <div class="bars">
          ${courts.map(([c, n]) => bar(c, n, rows.length, "#3b82f6")).join("") || "<p class='muted'>無資料</p>"}
        </div>
        <h3>類別分布</h3>
        <div class="bars">
          ${cats.map(([c, n]) => bar(c, n, rows.length, "#10b981")).join("") || "<p class='muted'>無資料</p>"}
        </div>
      </section>
    `);
  }

  // 時間軸
  const allChainRows: PrecedentRow[] = [];
  for (const rows of chain.values()) allChainRows.push(...rows);
  const recent = recentTimeline(allChainRows, 30);
  const recentHtml = recent.length === 0
    ? "<p class='muted'>無抓取紀錄</p>"
    : `<table class="table">
        <thead><tr><th>抓取時間</th><th>鏈</th><th>法院</th><th>案號</th><th>金額</th></tr></thead>
        <tbody>
          ${recent
            .map(
              (r) => `<tr>
                <td>${esc(fmtDate(r.scrapedAt))}</td>
                <td>${esc(String(r.chain ?? r.category ?? ""))}</td>
                <td>${esc(String(r.court ?? ""))}</td>
                <td>${esc(String(r.caseNo ?? ""))}</td>
                <td class="num">${Number(r.amount ?? r.mentalDistressAmount ?? 0).toLocaleString()}</td>
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>`;

  // Legacy 摘要
  const legacySection = `
    <section class="legacy">
      <h2>📚 Legacy / 補充檔 <span class="muted">(${legacy.length} 件)</span></h2>
      <ul class="muted">
        ${LEGACY_FILES.map((f) => {
          const n = (chain.get(f)?.length ?? 0) + legacy.filter((r) => true).length;
          return `<li>${esc(f)}：歸在 legacy 區段</li>`;
        }).join("")}
      </ul>
    </section>
  `;

  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>tw-car-claim-estimator · precedents 報表</title>
<style>
  :root { --fg:#1f2937; --muted:#6b7280; --bg:#f9fafb; --card:#fff; --border:#e5e7eb; --accent:#3b82f6; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang TC", "Microsoft JhengHei", sans-serif; margin: 0; padding: 1rem; color: var(--fg); background: var(--bg); line-height: 1.5; }
  header { background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 1.5rem; border-radius: 0.5rem; margin-bottom: 1rem; }
  h1 { margin: 0 0 0.25rem; font-size: 1.4rem; }
  h2 { font-size: 1.1rem; margin: 1.5rem 0 0.5rem; border-bottom: 2px solid var(--accent); padding-bottom: 0.25rem; }
  h3 { font-size: 0.95rem; margin: 1rem 0 0.5rem; color: #374151; }
  .muted { color: var(--muted); font-size: 0.85rem; }
  .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin: 0.5rem 0; }
  .kpi { background: var(--card); padding: 0.6rem; border-radius: 0.375rem; border: 1px solid var(--border); text-align: center; }
  .kpi-n { font-size: 1.2rem; font-weight: 700; color: var(--accent); }
  .kpi-l { font-size: 0.75rem; color: var(--muted); }
  .chain, .legacy { background: var(--card); padding: 1rem; border-radius: 0.5rem; margin: 0.75rem 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
  .bars { display: flex; flex-direction: column; gap: 0.25rem; margin: 0.5rem 0; }
  .bar { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; }
  .bar-label { min-width: 8rem; max-width: 12rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar-fill { height: 1rem; border-radius: 0.125rem; min-width: 2px; }
  .bar-n { font-variant-numeric: tabular-nums; color: var(--muted); }
  .table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  .table th, .table td { padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--border); text-align: left; }
  .table th { background: #f3f4f6; font-weight: 600; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  @media (max-width: 640px) {
    .kpi-row { grid-template-columns: repeat(2, 1fr); }
    .bar-label { min-width: 5rem; max-width: 7rem; }
  }
</style>
</head>
<body>
<header>
  <h1>📊 precedents 監控報表</h1>
  <p class="muted" style="color:#dbeafe;margin:0">產生時間：${esc(generatedAt)} · 6 鏈合計 ${totalChain} 件 · 總計 ${grand} 件（6 鏈 + legacy）</p>
</header>
<main>
  ${chainSections.join("")}
  ${legacySection}
  <section class="chain">
    <h2>🕐 最近 30 筆抓取</h2>
    ${recentHtml}
  </section>
</main>
<footer style="text-align:center;margin:1.5rem 0;color:var(--muted);font-size:0.75rem">
  純 Node 內建 · 零 deps · 給 cron / 手機看
</footer>
</body>
</html>`;
}

function main() {
  console.log("[report] 讀全部 precedents...");
  const { chain, legacy } = loadAllPrecedents();
  const totalChain = Array.from(chain.values()).reduce((s, r) => s + r.length, 0);
  const generatedAt = new Date().toISOString();

  console.log(`[report] 6 鏈合計 ${totalChain} 件、legacy ${legacy.length} 件`);
  for (const [f, rows] of chain) console.log(`[report]   ${f}: ${rows.length} 件`);

  const html = buildHtml({ chain, legacy, generatedAt });
  const dir = join(process.cwd(), "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(OUT_FILE, html, "utf-8");
  console.log(`[report] ✅ 寫出 ${OUT_FILE} (${html.length} bytes)`);
}

if (process.argv[1]?.endsWith("report-precedents.js")) {
  main();
}

export { main, buildHtml, loadAllPrecedents };
