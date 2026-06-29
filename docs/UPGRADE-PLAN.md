# 車禍理賠估算器 — 完整升級計畫

> **目標**：從「網站 + 真實資料庫」升級成「多平台 + 智慧估算」產品
> **觸發**：使用者訊息「macOS 桌面小工具 + 手機 app + 爬蟲司法院」（最早）
> **現況快照**：**v0.7.4**（2026-06-28）— 計算引擎 18 檔 + Ensemble + LLM + KNN debug + PWA + 13 鏈 555 件真實判例
> **本檔同步於**：`package.json` version + git tag

---

## 現況盤點（v0.7.4，2026-06-28）

### 三大面向

| 面向 | 現況 | 評估 |
|---|---|---|
| **Web app** | Next.js 16.2.7 + AntD 6 + Tailwind 4，**6 routes**（`/` + `/claims/new` + `/claims/result` + `/api/advisor` + `/manifest.webmanifest` + `/_not-found`） | ✅ 已上線 https://flowtracelabs.com |
| **PWA** | `app/manifest.ts` + `public/sw.js` + `ServiceWorkerRegistrar` + icons 192/512/favicon | ✅ v0.2.18 補強（macOS Safari「加入 Dock」可桌面化） |
| **桌面 app** | `public/widget.html` HTML 捷徑 + Tauri 2 套殼版（v0.4.x） | 🟡 Tauri 已實作但未常規發佈 |
| **手機 app** | 無 Capacitor / RN | ❌ 未做 |
| **計算引擎** | **18 個 TS 檔**，`lib/insurance/`：強制險 / 失能 / 民事 / 第三人 / 霍夫曼 / 失能統計 / 疤痕 / 工作損失延伸 / Ensemble / ML / LLM / Disability categories / Joint ROM | ✅ 紮實、可復用 |
| **真實判例資料庫** | **555 件** precedents（**13 鏈 + 2 狀態檔**） | ✅ 飽和近 2 年車禍判決 |
| **司法院爬蟲** | `scripts/scrape-judgments.ts` **6 鏈 v2（11 chain × 33 keyword）**，retry + isCivilCase + Map 去重 + cron 每小時 15 分跑 | ✅ 穩定 |
| **Ensemble 智慧估算** | 三票共識（規則 + ML + KNN）+ 共識度 4 級 + LLM 顧問複核（mock + 真 Claude API） | ✅ v0.6.2-v0.7.1 完整鏈 |
| **KNN Debug Panel** | `components/KnnDebugPanel.tsx` 5 維長條 + 距離標籤 + 相似度 5 級 + 結果頁 2 處串接 | ✅ v0.7.3 落地 |
| **資料報表** | `data/precedents-report.html` 22-33KB 自動生成（`pnpm report:precedents`） | ✅ 經紀人友善 |
| **Hero 健康度** | `EnsembleHealthHeroCard.tsx` + `pain-ensemble-health.ts` + cron 自動更新 | ✅ v0.7.0 |

### 13 鏈 precedent 分布（v0.7.4 統計）

| 鏈 | 件數 | 來源 | 用途 |
|---|---|---|---|
| car-damage | 127 | scrape v2 | 車損計算校驗 |
| taipei-mental-distress | 102 | scrape v1+v2 | 精神慰撫金 ML anchor |
| labor-loss | 75 | scrape v1+v2 | 工作損失校驗 |
| nursing-care | 42 | scrape v1 | 看護費校驗 |
| medical-expense | 39 | scrape v1 | 醫療費校驗 |
| practice-cases | 39 | 律師手動 | 理賠實務 KNN 主要來源 |
| disability-merging | 37 | scrape v1+v2 | 失能等級統計 |
| support-payment | 25 | scrape v2 | 撫養費校驗 |
| overtime-loss | 22 | scrape v2 | 加班損失校驗 |
| transport-fee | 16 | scrape v2 | 交通費用校驗 |
| death-case | 15 | scrape v2 | 死亡案件特別處理 |
| mediation-procedures | 9 | scrape v1 | 和解程序參考 |
| other-precedents | 3 | scrape v1 | 其他 |
| scar-revision | 2 | scrape v1 | 疤痕修整（樣本少） |
| labor-capacity | 2 | scrape v1 | 勞動能力（樣本少） |
| **總計** | **555** | | |

### 計算引擎檔案清單（18 個 TS）

```
lib/insurance/
├─ advisor-api.ts            LLM 顧問 API 包裝（async + AbortController + 1 retry）
├─ advisor-config.ts         LLM 提示詞 + PII 過濾 + token 計數
├─ civil-damages.ts          民事損害（精神慰撫金/工作損失/車損）
├─ compulsory.ts             強制險計算（無過失責任）
├─ disability-case-stats.ts  失能案件統計（中位數/平均/stdev/q1/q3）
├─ disability-categories.ts  12 大類失能對照表
├─ disability-joint-mapping.ts 關節 ROM → 失能等級（v0.6.6 對齊附表）
├─ disability-tables.ts      失能等級對照表（v0.6.6 修）
├─ disability.ts             失能計算主流程（ROM > 手填 優先序）
├─ evidence.ts               證據補件清單（資料不足不硬算）
├─ hoffmann.ts               霍夫曼係數計算
├─ index.ts                  整合層（estimateClaim 主入口）
├─ joint-rom.ts              關節活動角度喪失計算
├─ pain-advisor.ts           LLM 顧問純函式骨架（mock）
├─ pain-ensemble-health.ts   Ensemble 健康度計算（hero card 用）
├─ pain-ensemble.ts          三票共識（規則 + ML + KNN）
├─ pain-ml.ts                精神慰撫金 ML 區間引擎（三層架構）
├─ region-adjustments.ts     地區係數（臺北 > 臺中 > 高雄）
├─ region-court-map.ts       法院→縣市對照（含和解案件處理）
├─ scar-revision.ts          4 術式 × 北中南除疤
├─ sample.ts                 SAMPLE_INPUT demo 資料
├─ third-party.ts            第三人責任險（過失相抵）
└─ types.ts                  型別定義
```

### 測試覆蓋（v0.7.4 期待值）

```
50 個 test 檔 / 571 個 it
pnpm tsc --noEmit          → 0 錯
pnpm test                 → 全部綠
pnpm build                → 6 routes 靜態 build 全綠
```

### Cron 排程（v0.7.4）

```
~/.hermes/profiles/hermes-telegram/cron/jobs.json
  ├─ jlist_watch_hourly     (5 分) — 司法院新判決清單
  └─ 11ec3dc8bae1          (15 分) — scrape-judicial.sh 6 鏈全跑
                             └─ 抓新件時自動 pnpm report:precedents
                             └─ 自動重生 precedents-report.html
```

### UI 元件清單（7 個）

```
components/
├─ EnsembleHealthHeroCard.tsx  首頁 hero Ensemble 健康度卡（v0.6.9+）
├─ InfoAlert.tsx               AntD Alert wrapper（title=/body= 解 deprecated）
├─ KnnDebugPanel.tsx           KNN 5 維距離拆解面板（v0.7.3+）
├─ PainEnsembleCard.tsx        精神慰撫金三票 + LLM 顧問 UI（v0.6.7+）
├─ ServiceWorkerRegistrar.tsx  PWA SW 註冊（v0.2.18+）
├─ StepShell.tsx               表單 Step 共用殼層（v0.5.5+）
└─ (未來) AdvisoryCard / HistoryTimeline / ...
```

---

## 完整升級架構（3 條工作流 — 對齊 v0.7.4）

### 工作流 1：多平台打包（**部分完成**）

**單一 codebase + 跨平台輸出**：

```
現有 Next.js 16 app
  │
  ├──→ Web (next start)            ← 現有 ✅
  ├──→ PWA (manifest + sw.js)      ← v0.2.18 ✅
  ├──→ macOS .app (Tauri 2)        ← v0.4.x 🟡 (原型階段，需打包發佈流程)
  ├──→ iOS .ipa (Capacitor)         ← S2（需 Apple Developer USD 99/年）
  └──→ Android .apk (Capacitor)     ← S3（需 Google Play USD 25）
```

**已完成重點**：
- ✅ PWA：manifest + sw.js + ServiceWorkerRegistrar + 192/512/favicon icons
- ✅ macOS Tauri 2 原生套殼（v0.4.3 native menu + file dialog + notification）

**剩餘缺口**：
- ❌ iOS / Android 原生 app（需帳號 + Capacitor 整合）
- 🟡 Tauri 2 打包發佈流程未常規化（無 .dmg / .app bundle 自動生成）

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
 結構化 JSON（data/precedents/{13 鏈}.json）
  │
  ↓ 民事過濾（isCivilCase 排除刑庭/家事，v0.2.15）
  ↓ (未知代碼) 標記（不擅自填，v0.2.11）
  ↓ courtToCity 對齊縣市（v0.2.9）
  │
  ├──→ 報表 HTML（22-33KB，自動重生）
  ├──→ 給估算器用（findRelatedPracticeCases KNN 推薦）
  ├──→ 給 Ensemble ML 用（taipei-mental-distress anchor 102 件）
  └──→ 給未來 XGBoost / NN 用（資料量未達 1,000 件前不考慮）
```

**已完成重點**：
- ✅ 6 鏈 v1 + 5 鏈 v2（mental_distress_v2/labor_loss_v2/car_damage_v2/disability_v2/settlement_v2）
- ✅ 民事過濾（v0.2.15 排除刑庭/家事）
- ✅ retry 機制（5xx+TypeError 重試 3 次，4xx 不重試，v0.2.8）
- ✅ Map 去重（v0.2.14 in-memory dedupe by href）
- ✅ courtToCity 涵蓋 18 縣市（v0.2.9 修補）
- ✅ 報表 cron 化（v0.2.9，scrape 後自動重生 HTML）
- ✅ 衝量 200 → 555 件（v0.2.14-v0.2.20）

**剩餘缺口**（**S5-S7 補完**）：
- 🟡 8 件經紀人實務案例 court 標記待補（v0.2.11 _pending-courts-to-fill）
- 🟡 16 個法院代碼待經紀人/查證（CHDM 已驗證=彰化地院，其他待補）
- 🟡 2 個小鏈（scar-revision/labor-capacity）樣本各 2 件，需律師手動建檔

### 工作流 3：ML / Ensemble 智慧估算（**核心完成**）

```
司法院真實判決 + 結構化 features
  │
  ↓ 特徵工程（city, disability_level, year, injury_severity, has_disability_record）
  │
  KNN 相似判例推薦（v0.6.1+）─── 5 維距離正規化
  │
  ├──→ 精神慰撫金 Ensemble 三票共識（v0.6.2+）
  │    ├──→ 🎯 規則票：computePainAndSuffering.regionalMid
  │    ├──→ 📊 ML 票：predictPainRange.p50（13 件 anchor → 102 件）
  │    └──→ 🔍 KNN 票：findRelatedPracticeCases 相似案件平均
  │
  ├──→ LLM 理賠顧問複核（v0.6.4+）
  │    ├──→ 風險標示（low / medium / high）
  │    ├──→ 建議事項
  │    └──→ requiresHumanReview 旗標
  │
  └──→ KNN 推薦理由面板（v0.7.3+ debug mode）
       ├──→ 5 維長條（city / disability_level / year / injury_severity / has_disability_record）
       ├──→ 相似度 5 級（極相似/相似/普通/偏遠/極遠）
       └──→ 解釋 Tooltip
```

**已完成重點**：
- ✅ KNN 引擎（v0.6.1 — 從硬編配權升級）
- ✅ Pain ML 區間引擎（v0.6.0 — 三層架構 13 件 anchor）
- ✅ Ensemble 三票共識（v0.6.2 — 加權共識度 4 級）
- ✅ LLM 顧問 mock + 真 API（v0.6.3-v0.6.4）
- ✅ Hero 健康度卡 + 報表 Ensemble 區塊（v0.6.8-v0.7.0）
- ✅ KNN Debug Panel（v0.7.3 — 推薦理由透明化）

**剩餘缺口**：
- 🟡 KNN 動態權重（§9 規劃中 — query 是失能案件→等級權重 ×2）
- 🟡 LLM 真正接到 Vercel Functions（目前用 mock + 真 Claude API 雙模式）
- ❌ XGBoost / 完整 NN（資料量需 > 1,000 件，目前 555 → 過早）

---

## 執行排程（v3 對齊 v0.7.4）

| Sprint | 工作 | 工作量 | 依賴 | 狀態 |
|---|---|---|---|---|
| **S0** | 本計畫 review | 0.5 小時 | — | 🟡 進行中（v0.7.5 重寫） |
| **S1** | macOS Tauri 2 打包發佈流程 | 1-2 天 | — | 📋 排隊中 |
| **S2** | iOS .ipa（Capacitor） | 3-5 天 + Xcode build | 需 Apple Developer | 📋 排隊中 |
| **S3** | Android .apk（Capacitor） | 3-5 天 + AS build | 需 Google Play | 📋 排隊中 |
| **S5** | 經紀人實務案例 court 補完（8 件） | 30 分鐘（經紀人口述） | 需經紀人 | 📋 等經紀人 |
| **S6** | 16 個法院代碼查證 | 1 小時（查司法院表） | 需查證 | 📋 等查證 |
| **S7** | 2 個小鏈（scar/labor）建檔 | 半天（經紀人手動） | 需經紀人 | 📋 等經紀人 |
| **S8** | KNN 動態權重 | 1 天 | — | 🟡 可做 |
| **S9** | 衝量 → 1000 件（加新 keyword 角度） | 1-2 天 | — | 🟡 可做 |
| **S10** | LLM Vercel Functions 部署 | 半天 | 需 API key | 📋 排隊中 |
| **S11** | XGBoost / 完整 NN | 1 個月 | 需資料 > 1,000 件 | 📋 過早不做 |

**MVP 建議順序（2026-Q3-Q4）**：
1. **S8 KNN 動態權重**（1 天）— 立即可優化推薦品質
2. **S9 衝量**（1-2 天）— 突破 555 → 1000 件，提升 ML 信心度
3. **S5+S6+S7 經紀人補完**（經紀人有空時，1 天內可清完）
4. **S1 macOS Tauri 發佈**（1-2 天，可上架）
5. **S10 LLM Vercel**（半天，需 API key）
6. **S2/S3 iOS+Android**（需帳號 + 1 週工作）

---

## 風險與對策

| 風險 | 對策 |
|---|---|
| Apple Developer 帳號（USD 99/年） | 先做 S1 Tauri 打包 + PWA 給自己用，不急著上架 |
| Google Play 帳號（USD 25） | 同上 |
| 司法院反爬 | ✅ **已解決**：用公開搜尋頁，無驗證碼、無 Cloudflare |
| 個資法風險 | ✅ **已處理**：regex 抽取金額/案號，不存當事人姓名/身分證字號 |
| 商業化引用判決 | 走「加值應用」授權（司法院有窗口） |
| 經紀人時程卡住（待補 8+16+2 件） | 提供 `_pending-courts-to-fill.json` 給經紀人一次清單 |
| scrape 飽和（99.2% 去重率） | 改加新 keyword 角度 + 新鏈（v0.2.20 已擴 22 keyword） |
| 法院代碼猜錯污染資料 | ✅ **鐵律**：未知就標 `(未知代碼)`，不猜（v0.2.11 確立） |
| Tauri 2 打包發佈流程 | 需原生 IDE（Xcode build macOS bundle） |
| Capacitor 跟 Next.js SSR 衝突 | Capacitor 用 static export（`output: 'export'`），純 client rendering |

---

## 現階段 pending 決策

### 立即可開工（不需經紀人 / 不需帳號）

- [ ] **S8 KNN 動態權重**（1 天）— §9 規劃中
- [ ] **S9 衝量 → 1000 件**（1-2 天，純程式）— v0.2.20 已加 22 keyword
- [ ] **本計畫 review**（S0，30 分鐘）— v0.7.5 重寫

### 需經紀人決策（可批次一次給）

- [ ] **S5 經紀人實務案例 court 補完**（8 件，30 分鐘）— 給我 8 個答案
- [ ] **S6 16 個法院代碼**（1 小時）— 給我 16 個答案
- [ ] **S7 2 個小鏈建檔**（半天）— 給我案例細節

### 需帳號 / 預算（先不做）

- [ ] **S1 macOS Tauri 打包**（需決定發行管道）
- [ ] **S2 iOS**（需 Apple Developer USD 99/年）
- [ ] **S3 Android**（需 Google Play USD 25）
- [ ] **S10 LLM Vercel**（需 Claude API key + Vercel 帳號）

### 過早不做（等資料量）

- [ ] **S11 XGBoost / NN**（需資料 > 1,000 件，目前 555）

---

## 已完成（v0.6.0 - v0.7.4 歷史）

| 版本 | 主題 | 關鍵改動 |
|---|---|---|
| v0.6.0 | 精神慰撫金 ML 區間引擎 | 三層架構 + 13 件 anchor |
| v0.6.1 | KNN 相似判例推薦引擎 | 5 維距離正規化 |
| v0.6.2 | Ensemble 三票共識 | 規則 + ML + KNN |
| v0.6.3 | LLM 顧問純函式骨架 | mock + prompt/parse |
| v0.6.4 | LLM 顧問 route handler | 真 Claude API 整合 |
| v0.6.5 | DatePicker isValid 修護 | useEffect 注入 dayjs |
| v0.6.6 | 失能對齊強制險附表 | ROM 真實附表對照 |
| v0.6.7 | Ensemble 三票 UI 呈現 | PainEnsembleCard |
| v0.6.8 | 報表 Ensemble 健康度區塊 | precedents-report.html |
| v0.6.9 | Hero Ensemble 健康度卡 | 首頁 hero |
| v0.7.0 | Hero 健康度自動化更新 | cron + rebuild-hero.sh |
| v0.7.1 | LLM Advisor 部署場景矩陣 | export mode guard |
| v0.7.2 | Statistic valueStyle deprecation 清除 | 9 處 → 0 處 |
| v0.7.3 | KNN 推薦理由面板 | 5 維距離拆解 + debug mode |
| v0.7.4 | AGENTS.md 同步 v0.7.3 | §9 KNN debug 落地段 |

---

## 給未來 agent 的「已知地圖」

接手時必讀 AGENTS.md §1-§13 規則 + 記憶體的「CLAUDE.md 鐵律 8 條」。

**已完成不要重做**：
- ❌ 不要再用 `cheerio` / `axios` / `puppeteer` — 違反 CLAUDE.md 鐵律
- ❌ 不要再裝「醫材+輔具合併 2 萬上限」 — v0.2.5 法規修訂已拆 subItems
- ❌ 不要再用 `BalanceOutlined` / `ReceiptOutlined` — AntD 6 不存在
- ❌ 不要再用 `<Alert message= description=...>` — 已 deprecated，改 `<InfoAlert>`
- ❌ 不要再寫 `useEffect` 內同步 setState — React 19 會爆
- ❌ 不要再擅自填法院代碼 — 未知就標 `(未知代碼)`
- ❌ 不要再用 `Statistic valueStyle` — v0.7.2 改用 `styles={{ content }}`
- ❌ 不要再硬編 KNN 配權 — v0.6.1 已升級為 5 維距離正規化
- ❌ 不要再用 mock LLM advisor（部署模式） — v0.7.1 已加 export mode guard

**v0.7.5+ 合理下一步排序**：
1. **S8 KNN 動態權重**（最低成本，1 天優化推薦品質）
2. **S9 衝量**（1-2 天，加新 keyword 突破飽和）
3. **S5-S7 經紀人補完**（清 8+16+2 件待補，提升 cityOf 觸發率）
4. **S1 macOS Tauri 打包**（1-2 天，發佈流程常規化）

**明確不做**：
- ❌ React Native / Flutter 重寫
- ❌ 純學術 iPAS demo
- ❌ AI 代拿官方證書（iPAS / 保險經紀人 / 會計師）
- ❌ XGBoost / NN 在資料量 < 1,000 件時啟動

---

## 文檔同步 SOP（給未來維護者）

每次 release 完必檢查：

1. **`package.json` version** = 最新 tag
2. **`AGENTS.md`**：
   - 生效版本（line 10）
   - §3 測試期待值（檔數/it 數）
   - 對應章節（§8/§9/§10/§11/§12/§13）的「v0.X.Y+ 已完成」+「規劃中」
   - §13 後續候選 + 已完成清單
3. **`docs/UPGRADE-PLAN.md`**（本檔）：
   - 現況快照版本 + 日期
   - 13 鏈 precedent 分布表
   - 計算引擎檔案清單
   - 測試覆蓋期待值
   - Cron 排程
   - 歷史已發佈版本表

不更新會讓未來 agent 接手時做白工（v0.2.17 復活 AGENTS.md 教訓）。