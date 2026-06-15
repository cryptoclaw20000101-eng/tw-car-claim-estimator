# 車禍理賠估算器 — 完整升級計畫

> **目標**：從「網站 + 真實資料庫」升級成「多平台 + 智慧估算」產品
> **觸發**：使用者訊息「macOS 桌面小工具 + 手機 app + 爬蟲司法院」（最早）
> **現況快照**：v0.2.16 (2026-06-12) — 計算引擎 + 6 鏈真實資料庫 + 報表 cron 化
> **本檔同步於**：`package.json` version + git tag

---

## 現況盤點（v0.2.16，2026-06-12）

| 項目 | 現況 | 評估 |
|---|---|---|
| **Web app** | Next.js 16.2.7 + AntD 6 + Tailwind 4，3 路由（`/` + `/claims/new` + `/claims/result`） | ✅ 已上線 https://flowtracelabs.com |
| **計算引擎** | 18 個 TS 檔、`lib/insurance/` 內強制險/失能/民事/第三人/地區/霍夫曼/失能統計/疤痕/工作損失延伸 | ✅ 紮實、可復用 |
| **真實判例資料庫** | **200 件** precedents（6 鏈 + 3 小鏈）分布：car-damage 69 / labor-loss 46 / taipei-mental-distress 41 / practice-cases 17 / disability-merging 14 / mediation 6 / other 3 / scar-revision 2 / labor-capacity 2 | ✅ 已飽和近 2 年車禍判決 |
| **司法院爬蟲** | `scripts/scrape-judgments.ts` 6 鏈 24 keywords 跑通，`--retry` 機制 + `isCivilCase` 過濾 + Map 去重，cron 每小時 15 分跑 | ✅ 穩定 |
| **資料報表** | `data/precedents-report.html` 22KB 自動生成（`pnpm report:precedents`） | ✅ 律師友善 |
| **桌面 app** | 仍只有 `public/widget.html`（HTML 捷徑，無原生 .app） | ❌ 未做 |
| **手機 app** | 無 | ❌ 未做 |
| **PWA** | 無 manifest.json / service worker | ❌ 未做 |
| **失能 ML 整合** | `disabilityByHoffmann()` + `compareEstimateWithCases()` 已實作（v0.2.16） | 🟡 半成品，等經紀人補失能等級標籤 |
| **iPAS Ensemble 概念** | 6 引擎 + 規則引擎 + 霍夫曼係數 = 雛形 ensemble | 🟡 雛形 |

### 測試覆蓋（v0.2.16 期待值）

```
24 個 test 檔 / 251 個 it (含 11 個 v0.2.16 新增)
pnpm tsc --noEmit          → 0 錯
pnpm test                 → 全部綠
pnpm build                → 3 routes 靜態 build 全綠
```

### Cron 排程

```
~/.hermes/profiles/hermes-telegram/cron/jobs.json
  ├─ jlist_watch_hourly     (5 分) — 司法院新判決清單
  └─ 11ec3dc8bae1          (15 分) — scrape-judicial.sh 6 鏈全跑
                             └─ 抓新件時自動 pnpm report:precedents
```

---

## 完整升級架構（3 條工作流 v2 — 對齊現況）

### 工作流 1：多平台打包（**待啟動**）

**單一 codebase + 跨平台輸出**：

```
現有 Next.js 16 app
  │
  ├──→ Web (next start)            ← 現有 ✅
  ├──→ macOS .app (Electron)        ← 新 S1
  ├──→ iOS .ipa (Capacitor)         ← 新 S2（需 Apple Developer USD 99/年）
  ├──→ Android .apk (Capacitor)     ← 新 S3（需 Google Play USD 25）
  └──→ PWA (manifest.json + SW)     ← S1.5 補強
```

**選 Capacitor.js 而非 React Native / Flutter**：
- ✅ **完全復用現有 Next.js**（無重寫）
- ✅ Capacitor.js ~ 100KB runtime（vs RN 50MB+ / Flutter 30MB+）
- ✅ 一份 codebase 出 4 平台
- ⚠️ Capacitor 需要原生 IDE 收尾（Xcode build iOS / Android Studio build Android）
- ⚠️ 上架需 Apple Developer + Google Play 帳號

**PWA 中間選項（推薦 S1.5）**：
- ✅ 零成本（不需帳號、不需 IDE）
- ✅ macOS Safari 「加入 Dock」即可變桌面 app
- ✅ Android Chrome 「加到主畫面」即可
- ❌ iOS Safari PWA 體驗差（無推播、背景限制）
- 估時 2-3 小時

### 工作流 2：真實判例資料庫（**已超額完成**）

```
司法院公開搜尋頁 (law.judicial.gov.tw)
  │
  ↓ 爬蟲（node:fs + 原生 fetch，零第三方依賴）
  │
司法判決書 HTML
  │
  ↓ regex 抽取金額/案號/法院/年度
  │
結構化 JSON（data/precedents/{chain}.json）
  │
  ↓ 民事過濾（isCivilCase 排除刑庭/家事）
  ↓ (未知代碼) 標記（不擅自填）
  ↓ courtToCity 對齊縣市
  │
  ├──→ 報表 HTML（經紀人友善檢視）
  ├──→ 給估算器用（findRelatedPracticeCases 配權）
  └──→ 給未來 ML 模型用
```

**已完成重點**：
- ✅ 6 鏈（mental_distress / labor_loss / car_damage / disability / mediation / practice）全跑通
- ✅ 民事過濾（v0.2.15 排除刑庭/家事）
- ✅ retry 機制（5xx+TypeError 重試 3 次，4xx 不重試）
- ✅ Map 去重（v0.2.14 in-memory dedupe by href）
- ✅ courtToCity 涵蓋 18 縣市（v0.2.9 修補）
- ✅ 報表 cron 化（v0.2.9，scrape 後自動重生 HTML）

**剩餘缺口**（**S5-S7 補完**）：
- 🟡 8 件經紀人實務案例 court 標記待補（v0.2.11 _pending-courts-to-fill）
- 🟡 14 個法院代碼待經紀人/查證（CHDM 已驗證=彰化地院，其他待補）
- 🟡 3 個小鏈（scar-revision/labor-capacity/other-precedents）需經紀人手動建檔

### 工作流 3：ML 預測模型（**雛形階段**）

```
司法院判決書 + 結構化 features
  │
  ↓ 特徵工程（age, region, injury_severity, fault_ratio, ...）
  │
當前雛形：霍夫曼係數 × 失能等級 × 地區係數
  │
  ├──→ disabilityByHoffmann()    ✅ v0.2.16
  ├──→ compareEstimateWithCases() ✅ v0.2.16
  └──→ 完整 XGBoost / Neural Net  ← S9 進階
```

**v0.2.16 已做**：
- ✅ `disability-case-stats.ts` 載入 10 件真實失能案件，計算中位數/平均/區間/stdev/q1/q3
- ✅ `disabilityByHoffmann()` 整合霍夫曼係數 × 1-15 級減損 × 地區係數
- ✅ `compareEstimateWithCases()` 試算 vs 真實案件中位數比對（withinRange 判斷）

**S9 待做**（**過度工程，先不做**）：
- 等經紀人補完失能等級標籤後，重新分組統計
- 等資料量 > 1,000 件才考慮 XGBoost / LightGBM
- iPAS Ensemble 雛形：6 引擎（規則）+ 失能統計（貝葉斯）+ 霍夫曼（精算）= 三票 ensemble

---

## 執行排程（v2 對齊）

| Sprint | 工作 | 工作量 | 依賴 | 狀態 |
|---|---|---|---|---|
| **S0** | 本計畫 review | 0.5 小時 | — | 🟡 進行中 |
| **S1.5** | PWA 補強（manifest.json + service worker） | 2-3 小時 | — | 📋 推薦優先 |
| **S1** | macOS .app（Electron 包現有） | 1-2 天 | — | 📋 排隊中 |
| **S2** | iOS .ipa（Capacitor） | 3-5 天 + Xcode build | 需 Apple Developer | 📋 排隊中 |
| **S3** | Android .apk（Capacitor） | 3-5 天 + AS build | 需 Google Play | 📋 排隊中 |
| **S5** | 經紀人實務案例 court 補完（3 件） | 30 分鐘（經紀人口述） | 需經紀人 | 📋 等經紀人 |
| **S6** | 14 個法院代碼查證 | 1 小時（查司法院表） | 需查證 | 📋 等查證 |
| **S7** | 3 個小鏈（scar/labor/other）建檔 | 半天（經紀人手動） | 需經紀人 | 📋 等經紀人 |
| **S8** | scrape v2 chain 補完（精選 keyword） | 1-2 天 | — | 🟡 可做 |
| **S9** | ML 進階（XGBoost / 完整 ensemble） | 1 個月 | 需 S5-7 資料 | 📋 過度工程 |

**MVP 建議順序**（2026-Q3）：
1. **S1.5 PWA**（2-3 小時，零成本）→ 立即可桌面化
2. **S5+S6+S7 經紀人補完**（經紀人有空時，1 天內可清完）
3. **S1 macOS .app**（1-2 天，可上架）
4. **S8 scrape v2 keyword**（持續優化）
5. **S2/S3 iOS+Android**（需帳號 + 1 週工作）
6. **S9 ML**（資料 > 1,000 件再談）

---

## 風險與對策

| 風險 | 對策 |
|---|---|
| Apple Developer 帳號（USD 99/年）| 先做 S1.5 PWA + S1 macOS 免簽名（給自己用），**不急著上架** |
| Google Play 帳號（USD 25）| 同上 |
| 司法院反爬 | ✅ **已解決**：用公開搜尋頁，無驗證碼、無 Cloudflare |
| 個資法風險 | ✅ **已處理**：regex 抽取金額/案號，**不存當事人姓名/身分證字號** |
| 商業化引用判決 | 走「加值應用」授權（司法院有窗口）|
| 經紀人時程卡住（待補 8+14+3 件）| 提供 `_pending-courts-to-fill.json` 給經紀人一次清單 |
| scrape 飽和（v0.2.13 99.2% 去重率）| 改加新 keyword 角度（如「慰撫金 死亡等級」）+ 新鏈（死亡案件鏈）|
| 法院代碼猜錯污染資料 | ✅ **鐵律**：未知就標 `(未知代碼)`，不猜（v0.2.11 確立）|
| Capacitor 跟 Next.js SSR 衝突 | Capacitor 用 static export（`output: 'export'`），純 client rendering |

---

## 現階段 pending 決策

### 立即可開工（不需經紀人 / 不需帳號）

- [ ] **S1.5 PWA 補強**（推薦優先，2-3 小時起步）— 零成本，立即可桌面化
- [ ] **S8 scrape v2 keyword**（1-2 天，純程式）— 提升命中率
- [ ] **本計畫 review**（S0，30 分鐘）— 確認方向

### 需經紀人決策（可批次一次給）

- [ ] **S5 經紀人實務案例 court 補完**（3 件，30 分鐘）— 給我 3 個答案
- [ ] **S6 14 個法院代碼**（1 小時）— 給我 14 個答案
- [ ] **S7 3 個小鏈建檔**（半天）— 給我案例細節

### 需帳號 / 預算（先不做）

- [ ] **S1 macOS .app**（需決定 Electron vs Tauri）
- [ ] **S2 iOS**（需 Apple Developer USD 99/年）
- [ ] **S3 Android**（需 Google Play USD 25）
- [ ] **S9 ML 進階**（過度工程）

### 已自動完成（無需決策）

- [x] 工作流 2 爬蟲 + 結構化 + 報表（v0.2.0 - v0.2.15）
- [x] 失能統計 + 霍夫曼整合（v0.2.16）
- [x] AGENTS.md / CLAUDE.md 復活（v0.2.12）
- [x] cron 整合（v0.2.10）

---

## 給未來 agent 的「已知地圖」

接手時必讀 AGENTS.md 7 段規則 + 記憶體的 `CLAUDE.md 鐵律 8 條`。

**已完成不要重做**：
- ❌ 不要再用 `cheerio` / `axios` / `puppeteer` — 違反 CLAUDE.md 鐵律
- ❌ 不要再裝「醫材+輔具合併 2 萬上限」 — v0.2.5 法規修訂已拆 subItems
- ❌ 不要再用 `BalanceOutlined` / `ReceiptOutlined` — AntD 6 不存在
- ❌ 不要再用 `<Alert message= description=...>` — 已 deprecated，改 `<InfoAlert>`
- ❌ 不要再寫 `useEffect` 內同步 setState — React 19 會爆
- ❌ 不要再擅自填法院代碼 — 未知就標 `(未知代碼)`

**資料增量規則**：
- ✅ 純資料變更用 `chore(data):` commit
- ✅ 程式碼變更用 `feat:` / `fix:` / `refactor:`
- ✅ 每次 `feat:` commit 前先 bump version（避免 tag 領先 package.json）
- ✅ scrape 改動必先 `pnpm scrape:dry --chain <name> --retry 0`
- ✅ 改 lib/insurance 必跑 tsc + test + build 三綠

**v0.2.17 之後的合理下一步**（推薦排序）：
1. **S1.5 PWA 補強**（最低成本，立即可桌面化）
2. **S8 scrape v2 keyword 角度**（突破飽和）
3. **S5-S7 經紀人補完**（清 8+14+3 件待補，提升 cityOf 觸發率）
4. **S1 macOS .app**（Electron 套殼，1-2 天）

**明確不做**：
- ❌ React Native / Flutter 重寫
- ❌ 純學術 iPAS demo
- ❌ AI 代拿官方證書（iPAS / 保險經紀人 / 會計師）
