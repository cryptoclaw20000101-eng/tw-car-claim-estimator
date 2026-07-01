<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# tw-car-claim-estimator — 專案層級規則

> **適用對象**: 在本專案執行任務的所有 AI agent (Claude / Codex / Hermes / 其他)
> **生效版本**: v0.8.3 (2026-07-01)
> **同步於**: `package.json` version + git tag
> **優先序**: `AGENTS.md` > commit message > 自由發揮。若有衝突以本檔為準。

---

## §0 專案定位

- **業務**: 臺灣車禍理賠金額估算器（網站 + 計算引擎 + 司法院真實判例資料庫）
- **使用者**: 保險經紀人、被害人、家屬（**非保險公司內部工具**）
- **法律邊界**: UI 一律用「試算」非「判決」、頂部加免責聲明、實際理賠仍須依保險公司審核/醫療資料/肇事責任/保單條款/金融評議或法院認定為準
- **預期輸出**: 不保證金額、不構成法律意見

---

## §1 估算規則鐵律（3 條，**永不改**）

| # | 規則 | 位置 |
|---|---|---|
| ① | **強制險無過失不乘肇責** — 強制險為無過失責任，肇責比例只影響第三人責任險 | `lib/insurance/compulsory.ts` |
| ② | **精神慰撫金 / 工作損失 / 車損不進強制險** — 這 3 類只算第三人責任險 | `lib/insurance/civil-damages.ts` |
| ③ | **資料不足不硬算** — 回傳 `null` + 補件清單，絕不憑空填值 | `lib/insurance/evidence.ts` |

> v0.5.3 移除「關節角度喪失只進失能初篩」鐵律 — 初篩計算引擎仍存在於 `lib/insurance/joint-rom.ts` + `disability.ts` 但不再視為鐵律。

UI 結果頁頂部永遠顯示這 3 條 + 完整免責聲明（見 `app/page.tsx` 「三條鐵律」段）。

---

## §2 程式碼風格鐵律

### 2.1 LSP / TypeScript

- **LSP 報紅先跑 `tsc`** — LSP 對 `useWatch` / `validateFields` 常 stale，別誤刪 import
- **`useEffect` 內禁同步 `setState`** — 會觸發 React 19 「Cannot update component while rendering」；改用 `useState` initializer 或 `useSyncExternalStore`
- **patch 工具要拆 import 段** — `scripts/scrape-judgments.ts` 用 `import { writeFileSync } from "node:fs"` 別混 `require`

### 2.2 套件管理

- **`pnpm add` 需用戶授權** — 任何新增 dep 前先問；不要自動裝 `cheerio` / `axios` / `puppeteer`（這是 **CLAUDE.md 鐵律**）
- **零套件爬蟲優先** — 司法院爬蟲只用 `node:fs` + `node:url` + 原生 `fetch`，不裝第三方 HTTP / HTML 解析庫
- **確認正版** — `npm view <pkg> maintainers` 確認 maintainer 是官方；lifecycle 跳號（0.x → 1.x 在 2024-2025 之間合理）要註記

### 2.3 AntD 6 icons

- **不存在的 icons**: `BalanceOutlined` / `ReceiptOutlined` **不存在**（AntD 6）
- **正解**: `AuditOutlined`（審計/計算）/ `FileTextOutlined`（文件）/ `DollarOutlined`（金額）/ `CalculatorOutlined`（計算機）/ `InsuranceOutlined`（保險）
- **InfoAlert wrapper**: `<Alert message=... description=...>` 已 deprecated → 改用 `<InfoAlert title=... body=...>` (`components/InfoAlert.tsx`)
- **Statistic `valueStyle` 已 deprecated**（v0.7.2+ 起）— 改用 `styles={{ content: { color / fontSize / ... } }}`（AntD 6 `StatisticSemanticType.styles.content`）。型別見 `node_modules/antd/es/statistic/Statistic.d.ts`。迴歸測試：`PainEnsembleCard.test.tsx` SSR HTML 守護 `var(--accent)` 跟字級生效

### 2.4 Next.js 16 特別注意

- **App Router 必用 React canary** — 不可用 `import` 整包 React 19 hooks，要讓 Next 16 自己控
- **`route.ts` 必 client runtime** — AntD Form / Table 依賴 client React context
- **去查 `node_modules/next/dist/docs/` 再寫** — 04-glossary.md 有完整術語表，03-architecture 解釋 server/client boundary
- **dev server LAN 訪問需 `allowedDevOrigins`** — Next.js 16 dev server 預設只允 localhost，從 LAN IP 連會被 HMR/webpack-hmr 擋；要在 `next.config.ts` 加 `allowedDevOrigins: ['192.168.1.X', ...]`，否則手機開 http://<IP>:3001 會 cross-origin error
- **AntD DatePicker 不能從 Form `initialValues` 餵字串** — rc-picker 的 `dayjs.js:95-99` 對非 dayjs 物件直接 `return value`，後續 `value.isValid()` 在字串上炸。Form schema 是 string，但 DatePicker 需要 dayjs 物件。**正解 (v0.6.5 完整版)**:
  - **(1) 父層 mount**：`useEffect` 一次性注入 dayjs 到所有日期欄位（不受 conditional render 影響，避免未 mount Step 的 useEffect 沒跑就 `validateFields()` 炸）
  - **(2) Form.Item 層**：`getValueProps={(value) => ({ value: value ? dayjs(value) : null })}` — 守護 onChange 寫字串回流後 DatePicker 永遠收 dayjs 物件
  - **(不能用 `defaultValue`)**：Form.Item 控制下無效且觸發警告
  - **迴歸測試**：`__tests__/components/date-picker-invariants.test.ts`（7 it，grep 原始碼守護 3 個 getValueProps + 3 個 useEffect 注入）

---

## §3 測試 / 驗證鐵律

- **改任何 lib/insurance 必跑**:
  ```bash
  pnpm tsc --noEmit                    # 0 錯
  pnpm test                            # 58 檔 / 689 測試全綠（v0.8.3 期待值）
  pnpm build                           # 6 routes 靜態 build 全綠
  ```
- **新增規則必先寫測試** (TDD: RED → GREEN → REFACTOR) — 沒測試的改動 revert
- **scrape 改動必先 `--dry-run`** — `pnpm scrape:dry --chain <name> --retry 0` 看 stdout 確認 regex 沒爆掉

---

## §4 Git 流程

- **commit 訊息格式**: `<type>(<scope>): <subject>` — type = feat / fix / chore / test / docs / refactor
- **每次 `feat:` commit 前先 bump version** — `0.2.X → 0.2.X+1`，確保 `package.json` version = 最新 tag
- **不可逆操作需 in-message 授權**: `git push` / `git tag` / `pnpm add` / `git reset --hard` / `rm -rf`
- **資料增量用 `chore(data):`**: 純資料變更（precedents JSON 增刪）不混 feat
- **每個 release 必有 tag**: `git tag v0.2.X` 然後 `git push --tags`

---

## §5 部署 / Cron

- **scrape cron 入口**: `~/.hermes/profiles/hermes-telegram/scripts/scrape-judicial.sh`（symlink 到 `~/.hermes/scripts/scrape-judicial.sh`）
- **不擅自填法院代碼** — 司法院 COURT_CODE 對照表由經紀人/工程師查證後才填，scrape 端用 `(未知代碼)` 標記
- **scrape 報錯的 4xx 不重試、5xx+TypeError 重試 3 次**（500ms 指數退避，CLI `--retry N` 覆蓋）

---

## §6 不可接受的內容 / 紅線

- ❌ **未成年 / 兒少性影像** — 任何 iPAS 練習、別的專案借用
- ❌ **代拿官方證書** — iPAS / 律師 / 會計師執照一律不代考、不代申請
- ❌ **保戶案例脫敏** — 當事人姓名/身分證字號一律去掉，地區可保留
- ❌ **憑空填值** — 法院代碼未知就標 `(未知代碼)`，不猜
- ❌ **保險公司邏輯混入** — 精神慰撫金/工作損失/車損不進強制險

---

## §7 與 iPAS 教學 / FlowTrace Labs 的關係

- 本專案是「真實業務」 — 計算引擎有對應 iPAS AI應用規劃師 第 2 課 Ensemble / 第 3 課 LLM
- 6 大引擎（強制 / 失能 / 民事 / 第三人 / 地區 / 補件）可借鑑 Ensemble 概念（XGBoost + 規則引擎 + 理賠顧問複核）
- 不接受純學術 demo，所有改動都要有真實業務場景

## §8 精神慰撫金 ML 區間引擎（v0.6.0+）

> **檔案**: `lib/insurance/pain-ml.ts` + `lib/insurance/index.ts` 整合層
> **測試**: `__tests__/insurance/pain-ml.test.ts` + `pain-ml-integration.test.ts`

### 三層架構
1. **Layer 1（啟發式 baseline）** — 規則引擎 8 級區間 + 治療加成（保守 +20%）+ 地區係數
2. **Layer 2（歷史 anchor）** — 從 `data/precedents/taipei-mental-distress.json` 載入 13 件有金額的真實判決（v0.6.0 為止），產 P10/P50/P90
3. **Layer 3（fallback）** — anchor < 5 件 → 純啟發式

### 為什麼 v0.6.0 不用 XGBoost？
- 樣本 13 件太少，訓練有意義模型會過擬合
- 13 件都集中在 minor_injury，傷勢梯度學不到
- v0.6.1+ 律師手動建檔補完 89 件 0 元資料 → 才能真正用 XGBoost 學出傷勢梯度

### 不變量（測試守護）
- `lower ≤ mid ≤ upper`（單調遞增）
- 地區係數正確生效（臺北 > 臺中 > 高雄）
- 未知法院 → fallback 到 1.0 係數，不報錯
- confidence: high ≥ 20 件 / medium 10-19 / low < 10

### 與規則引擎的關係
- ML 是**校驗層**不是**取代層** — 規則引擎仍負責主要金額計算
- `reconcileWithRules` 比較兩者中點：
  - agree ≤ 15% / minor_diverge 15-30% / diverge > 30%
- diverge + confidence=low → 警告降級（避免誤報）

### UI 顯示規劃（後續 v0.6.x）
- 精神慰撫金區塊加 [依據：歷史 P10 ~ P90] badge
- 信心度標籤（🟢 high / 🟡 medium / 🔴 low）
- diverge 警示 → 提示「此案件建議人工複核」

## §9 KNN 相似判例推薦引擎（v0.6.1+）

> **檔案**: `lib/estimate/precedent-knn.ts` + `lib/estimate/precedents.ts` 整合
> **測試**: `__tests__/estimate/precedent-knn.test.ts`（21 it）

### 為什麼從硬編配權升級 KNN？
- 既有 score() 用「縣市 +10 / 等級 +8 / year +2」硬編配權，無法調整維度權重
- 業務場景：當 city 維度都為 null（律師和解案件）時，level 才是主要區分
- KNN 每維距離正規化到 [0, 1]，加總可控 → 易理解、易測試、可解釋

### 5 維特徵向量
1. **city** — 二元（match 0 / mismatch 1）+ null 中性 0.5
2. **disability_level** — |diff| / 15（線性正規化）
3. **year** — |diff| / 26（2000-2026 範圍）
4. **injury_severity** — ordinal 距離（死亡/重傷/中/輕傷/失能）
5. **has_disability_record** — 二元（一致 0 / 不一致 1）

### 不變量（測試守護）
- distance(a, a) === 0
- distance(a, b) === distance(b, a)（對稱）
- distance(a, b) >= 0
- 5 維全極端 → distance <= 5

### 與既有 score() 比較
| 維度 | score() | KNN |
|---|---|---|
| 縣市 match | +10（fixed） | 0（正規化） |
| 等級差 1 | +4 | |1-7|/15 ≈ 0.07 |
| 等級差 7 | 0 | |7-7|/15 ≈ 0.47 |
| year 差 1 | +1 | 1/26 ≈ 0.04 |
| year 差 5 | 0 | 5/26 ≈ 0.19 |
| 失能紀錄 | +1 | 0 / 1 |

**關鍵差異**：KNN 對 year 差 5 年的懲罰 (0.19) ≈ 等級差 3 (0.20)，符合實務「近年案例參考價值高」直覺。

### v0.7.3+ 已完成（debug mode 落地）
- ✅ **5 維距離拆解**：`computeDimensionDistances(a, b)` 回傳 `{city, disabilityLevel, year, injurySeverity, hasDisabilityRecord}`（總和 === 加總距離）
- ✅ **`findRelatedPracticeCases(..., withKnnDebug=true)`**：conditional return type，傳 true 回 `PracticeCaseWithKnn[]`，預設 false 向後相容（既有 47 個測試 0 修改）
- ✅ **KnnDebugPanel 元件**：`components/KnnDebugPanel.tsx` 5 維長條（Progress）+ 距離標籤 + 解釋 Tooltip + 相似度 5 級（極相似/相似/普通/偏遠/極遠）
- ✅ **結果頁 2 處串接**：`PainEnsembleCard` KNN 票下方 + 理賠實務案例 Collapse 每件加「KNN 距離 X.XX」標籤
- ✅ **+3 測試檔 32 it**：`precedent-knn-debug.test.ts` (15) + `precedents-knn-debug.test.ts` (7) + `KnnDebugPanel.test.tsx` (10)

### v0.7.6+ 已完成（表單即時預視）
- ✅ **Step4KnnPreview 元件**：`components/Step4KnnPreview.tsx` 在 Step4「失能等級」輸入時即時顯示 top 3 相似判例
- ✅ **useDebouncedValue hook**（300ms）：避免快速切換時重複計算
- ✅ **複用 KnnDebugPanel**：展開 details 可看 5 維拆解
- ✅ **0 網路成本**：純 client-side，200+ precedents 已在 bundle（v0.5.x iOS Safari 修護時驗證）
- ✅ **+1 測試檔 8 it**：`__tests__/components/Step4KnnPreview.test.tsx` (8 SSR HTML 守護)
- ✅ **整體**：51 檔 579 測試全綠 / build 6 routes 靜態 / tsc 0 錯

### v0.7.6+ 規劃中
- injury_severity 從 practiceCase 萃取（目前都是 null，未來律師補資料）
- 動態權重：根據 query 自動調整（例如 query 是失能案件 → 等級權重 ×2）
- Step4KnnPreview 跟 PainEnsembleCard 連動（KNN 票結果雙向同步）

## §10 精神慰撫金 Ensemble 三票共識（v0.6.2+）

> **檔案**: `lib/insurance/pain-ensemble.ts` + `lib/insurance/index.ts` 整合
> **測試**: `__tests__/insurance/pain-ensemble.test.ts` + `pain-ensemble-integration.test.ts`（14+6 it）

### 三票來源
| 票 | 來源 | 給什麼 |
|---|---|---|
| 🎯 **規則票** | `computePainAndSuffering.regionalMid` | 公式推導（8 級 + 治療加成 + 地區） |
| 📊 **ML 票** | `predictPainRange.p50` | 歷史 13 件 anchor 中位數 |
| 🔍 **KNN 票** | `findRelatedPracticeCases` 平均 | 相似案件 `civilSettlement` 平均 |

### 為什麼這是真 Ensemble？
- iPAS 第 2 課 Ensemble = 多模型投票/加權（不是同一模型多次訓練）
- 我們這裡是「三種不同推理路徑」共識：
  - **規則** = 領域知識（易解釋但易過時）
  - **ML** = 統計推論（13 件樣本偏差，但能抓到新趨勢）
  - **KNN** = 案例相似度（4 件律師手動建檔，最貼近實務）
- 三種錯誤模式**互補**，不是冗餘

### 共識度判定
- **strong** — 三票差距 ≤ 20% → 加權平均
- **partial** — 兩票聚集（≤20%），一票 outlier → 用兩票平均 + 標 outlier
- **weak** — 三票分散 → 顯示區間（min-max）+ 警示人工複核
- **insufficient** — 票數 < 2 → 回 null + 補件提示

### 權重策略
- rules: 永遠 1.0
- ml: high=1.0 / medium=0.7 / low=0.4（依信心度）
- knn: 可用時 1.0

### 不變量（測試守護）
- consensusAmount 永遠 ≥ 0
- suggestedRange.low ≤ suggestedRange.high
- 三票金額獨立可讀（UI debug 顯示用）

### iPAS 教學應用
本引擎完整呼應 iPAS AI應用規劃師 第 2 課 Ensemble 概念：
- **Bagging**：三票 = 三種 bootstrap 樣本視角
- **Boosting**：confidence = 樣本權重
- **Voting**：共識度 = 投票結果

## §11 LLM 理賠顧問複核（v0.6.3+）

> **檔案**: `lib/insurance/pain-advisor.ts` + `lib/insurance/index.ts` 整合
> **測試**: `__tests__/insurance/pain-advisor.test.ts` + `pain-advisor-integration.test.ts`（21+6 it）

### 設計策略：分階段交付
| 階段 | 內容 | 風險 |
|---|---|---|
| **v0.6.3 (現在)** | 純函式骨架 + mock LLM（同步） | 0（不接 API） |
| v0.6.4 | 接 Claude API + 個資脫敏 + cost control | 中 |
| v0.6.5 | UI 整合 + 複核 SOP + 律師審核流程 | 高 |

### 為什麼 v0.6.3 mock 是「同步」？
- `estimateClaim` 有 134 處呼叫端，改 async 會污染全 codebase
- mock LLM 確定性 → 沒必要 async
- v0.6.4 接真 API 時才會：
  1. 拆出 `callClaudeAdvisor(input)` async 函式
  2. `estimateClaim` 改 async
  3. UI 端用 React 19 `use()` + Suspense 處理 loading

### 三個純函式
1. **`buildAdvisorPrompt(input)`** — 吃 AdvisorInput 吐 Markdown prompt
   - 包含免責聲明、三票金額、共識度、預判風險因子
   - 要求 LLM 回結構化 JSON
2. **`parseAdvisorResponse(raw)`** — 吃 LLM 字串吐 AdvisorOutput
   - 安全處理 malformed JSON（fallback medium）
   - 永遠補 disclaimer
3. **`mockLLMAdvisor(input)`** — 純規則確定性 mock
   - 預判 riskLevel（依 ensembleConsensus + mlConfidence）
   - 預判 riskFactors / recommendations

### 個資保護（v0.6.3 已守護）
- ❌ 絕不傳：姓名、身分證字號、車牌號碼、精確事故日期
- ✅ 可傳：法院名、傷勢等級、金額、年份、縣市、共識度
- 測試守護：`buildAdvisorPrompt` 不含「姓名/身分證/車牌」字串

### 責任歸屬（重要）
- **規則引擎 + ML + KNN 三票共識**才是「真實估算」
- **LLM 顧問只是「風險標示 + 建議補充資料」**
- `requiresHumanReview=true` 時 UI 必須顯示律師複核按鈕
- 免責聲明永遠在 `painAdvisor.disclaimer`，UI 必須顯示

### iPAS 教學應用
完整呼應 iPAS AI應用規劃師 第 3 課 LLM 概念：
- **Token context** — prompt template 是結構化 context window
- **Temperature** — v0.6.4 接 API 時設 0.3（穩定但有變化）
- **Hallucination** — 結構化 JSON 輸出 + parser fallback
- **Human-in-the-loop** — requiresHumanReview = 強制 human 介入

### v0.6.4 規劃
- 接 Claude API（MiniMax M3 或 Claude Fable 5，依 cost 決定）
- 個資脫敏層（v0.6.3 prompt 已設計，但 runtime 也要防呆）
- Cost control：每案件最多 1 次 LLM 呼叫
- Rate limit fallback：API 失敗時降級回 mockLLMAdvisor

## §11 精神慰撫金 Ensemble UI 呈現（v0.6.7+）

> **檔案**: `components/PainEnsembleCard.tsx` + 結果頁 `app/claims/result/_form.tsx`
> **測試**: `__tests__/components/PainEnsembleCard.test.tsx`（13 it）

### 三層渲染結構
1. **上方 — 共識金額 + badge**
   - 大字統計 = `consensusAmount`（若 null → fallback 規則中標）
   - 旁邊：共識度 badge（🟢 strong / 🟡 partial / 🔴 weak / ⚪ insufficient）
   - Tooltip 顯示判定規則
2. **中間 — 三票展開（TicketTile ×3）**
   - 🎯 規則票 / 📊 ML 票 / 🔍 KNN 票
   - 每票顯示：金額 + 權重 + outlier 標記
   - KNN 票 null 時 dim + 「無相似案件」標籤
3. **下方 — LLM 顧問複核面板**
   - 風險等級 tag（low/medium/high）+ 共識解讀
   - 風險因子清單（用「·」分隔）
   - 建議清單（用「·」分隔）
   - 人工複核旗標（紅框警示，引擎判定時顯示）
   - 計算成本（prompt + completion tokens）
   - 免責聲明（永遠顯示，不可隱藏）

### 不變量（測試守護）
- `consensus: 'strong'` 必搭配 `consensusAmount !== null`
- `consensus: 'weak'` 必搭配 `suggestedRange !== null`
- `outlier` 只能是 `'rules' | 'ml' | 'knn'`，無第四選項
- `painAdvisor.disclaimer` 不可為空字串（個資法）
- `painAdvisor.requiresHumanReview=true` → UI 必顯示紅框警示

### 為什麼這層重要？
v0.6.0~v0.6.4 引擎端已算好 Ensemble + Advisor，但結果頁還停在規則時代（v0.5.4 只看 regionalLow/Mid/High）。
保經業務員看不到「為什麼這個金額」就無法對客戶解釋，
此元件把「規則公式 / 歷史 anchor / 相似案件」三條推理路徑攤開來，是 v0.6.x 整套 Ensemble 投資的價值收口。

## §12 Hero Ensemble 健康度自動化更新（v0.7.0+）

> **檔案**: `scripts/rebuild-hero.sh` + `package.json` script `report:rebuild-hero`
> **觸發時機**: scrape cron 跑完後 / 手動執行

### 為什麼需要 hero rebuild？

v0.6.9 把 Ensemble 健康度拉到首頁 hero（`components/EnsembleHealthHeroCard.tsx`），
但 `import anchorData from '@/data/precedents/taipei-mental-distress.json'` 是 **build-time 靜態內嵌**。

Next 16 `output: "export"` 靜態 export 模式：
- ❌ 不支援 `revalidatePath` / ISR / on-demand revalidation
- ❌ 不支援 API route（v0.6.4 advisor route 在部署上會壞，獨立問題）
- ✅ Hero 健康度只能靠 `pnpm build` 重生

### 3 步流程（必須按序）

```bash
pnpm report:rebuild-hero
```

內部依序執行：
1. `pnpm report:precedents` — 重生 `data/precedents-report.html`
2. `touch data/precedents/taipei-mental-distress.json` — bump mtime 觸發 Next turbopack cache 失效
3. `pnpm build` — 全站 rebuild（含 hero Ensemble 健康度卡 build-time import）

### 為什麼 bump mtime（步驟 2）？

Next turbopack 對 JSON imports 有 in-memory cache，純粹 `report:precedents` 重生 JSON 內容但 mtime 不變，
turbopack 不會 re-bundle 該 JSON → hero 仍用舊值。
`touch` 是 surgical 解法，比清 `.next/cache` 安全。

### 與 scrape cron 的整合

Hermes cron `11ec3dc8bae1` 排程 `15 * * * *`（每小時第 15 分）跑 `~/.hermes/scripts/scrape-judicial.sh`，
**未來可加**：scrape 完若抓到新件，自動 trigger `pnpm report:rebuild-hero`。
當前手動觸發即可（cron 跑頻率低，30s build 成本可接受）。

### 部署場景

| 場景 | 流程 |
|---|---|
| **本地 / 自管 prod** | `pnpm report:rebuild-hero` 跑完即生效 |
| **Vercel deploy** | 本地 rebuild + push → Vercel CI 觸發 `vercel deploy` |
| **dev server** | `pnpm dev` 跑時 Next turbopack 自動 re-bundle（無需手動 rebuild） |

### 預期耗時
- `pnpm report:precedents`：~2 秒
- `touch`：瞬間
- `pnpm build`：~25-30 秒（靜態 export 含 6 routes + PWA sw）
- **總計**：~30 秒
- 對 cron 每小時第 15 分跑一次的頻率：**可接受**

### 紅線

- ❌ **不要在 production cron 跑此 script 不通知 user**（30s build 期間 hero 顯示 stale snapshot）
- ❌ **不要試圖用 revalidatePath / ISR 解這個問題**（output: export 不支援）
- ❌ **不要改 pnpm build 為 pnpm dev**（dev 模式無靜態檔，無法部署）

## §13 LLM Advisor 部署場景矩陣（v0.7.0+）

> **檔案**：`app/api/advisor/route.ts` + `lib/insurance/advisor-api.ts` + `components/PainEnsembleCard.tsx`
> **測試**：`__tests__/api/export-mode-guard.test.ts`（守 `output: export` 限制）

### 核心事實

`next.config.ts` 設 `output: "export"`（Vercel Edge CDN 靜態站點），
**`/api/advisor` route 不會被打包進 `out/` 目錄**：

```bash
$ ls out/                       # 純 HTML + JS + assets
$ ls out/api/                   # 404 — 不存在
$ ls .next/server/app/api/      # 存在（build artifact，但 deploy 不會用）
```

### 場景矩陣

| 場景 | advisor 行為 | 適合對象 |
|---|---|---|
| **Vercel Edge CDN**（當前預設） | ❌ `/api/advisor` 404 — UI 用 build-time 內嵌 mockLLMAdvisor | 公開展示、行銷頁、SEO 友善 |
| **本地 dev server**（`pnpm dev`） | ✅ route 跑得起來，但 UI 仍用 build-time mock | 工程師開發 |
| **Vercel Functions / Edge Functions** | ✅ live mode 可用 — 需手動加 `vercel.json` 設定 | 商業模式、需要 LLM live 回應 |
| **自架 Node server**（移除 `output: export`） | ✅ live mode 完整 — 需自管 PWA / CDN | 律師事務所內網 |

### 為什麼 UI 永遠顯示 mock 標籤？

`PainEnsembleCard` Divider 文字目前是：

> LLM 理賠顧問複核（靜態 mock · 部署模式請見 AGENTS.md §13）

這是**故意為之** — 在 Vercel Edge CDN 部署下，使用者看到明確標籤不會誤以為是真 LLM 回應。
若部署到 Vercel Functions / 自架 server，需同步：

1. `PainEnsembleCard` 加 useEffect fetch `/api/advisor` 拿 `AdvisorApiResult`
2. 把 build-time `mockLLMAdvisor` prop 改成 `useState` + loading skeleton
3. route.ts 移除 deprecation 警告 + 改 `maxDuration` 對齊 Functions timeout

### 為什麼不直接移除 `route.ts`？

- **教育價值**：iPAS AI 應用規劃師 第 3 課「LLM 機制 + API 整合」的完整範例（含 PII 過濾 / token 上限 / fallback 分類 / timeout + retry）
- **未來商業模式**：若律師事務所要內網自架或升級 Vercel Functions，這個檔案直接可用
- **投資保護**：v0.6.4 寫的 5 個測試檔 43 it 仍有效（純函式測試不依賴 runtime）

### 紅線

- ❌ **不要把 `output: "export"` 改 `undefined`** 而不重新評估部署策略（會失去 Vercel Edge CDN）
- ❌ **不要讓 UI fetch `/api/advisor` 在 Vercel Edge CDN 部署下被誤導**（會一直 404）
- ❌ **不要把 deprecation 警告從 route.ts 移除**（這個警告保護未來的 agent 不誤改 config）

### v0.7.0 觸碰的範圍

| 改動 | 原因 |
|---|---|
| `app/api/advisor/route.ts` 加 deprecation 區塊 | 明確標註 export mode 不會跑 |
| `components/PainEnsembleCard.tsx` 標籤改「靜態 mock · §13」 | 對齊事實（v0.6.4 mock → 靜態 mock） |
| `AGENTS.md` §13（本段） | 部署場景矩陣 |
| `__tests__/api/export-mode-guard.test.ts`（新） | 守護 `output: export` + `out/` 沒 `api/` + UI 標籤 |

**沒改**：`next.config.ts`（保持 `output: export`）、`PainEnsembleCard` 邏輯、計算引擎、報表、scrape cron、scrape script。

### 後續 v0.7.x 候選

1. **KNN 動態權重**（§9 規劃中）— query 是失能案件 → 等級權重 ×2
2. **真的接 Vercel Functions + live LLM**（需 API key + 商業模式評估）
3. **scrape cron 自動 trigger `pnpm report:rebuild-hero`**（file watcher 或 shell 串接）
**沒改**：`next.config.ts`（保持 `output: export`）、`PainEnsembleCard` 邏輯、計算引擎、報表、scrape cron、scrape script。

### 已完成（v0.7.0-v0.7.3）
- v0.7.0 Hero Ensemble 健康度自動化更新
- v0.7.1 LLM Advisor 部署場景矩陣 + export mode guard
- v0.7.2 清除 Statistic valueStyle deprecation warning（9 處 → 0 處）
- v0.7.3 KNN 推薦理由面板（5 維距離拆解 + debug mode）

## §14 LLM Advisor in-memory 快取（v0.7.7+）

> **檔案**: `lib/insurance/advisor-cache.ts`
> **測試**: `__tests__/insurance/advisor-cache.test.ts` (17 it) + `advisor-api.test.ts` 補 2 it

### 為什麼 v0.7.7 加快取？
- callClaudeAdvisor 每次都重打 Claude API（$0.015/次）
- 實務：業務員重複查看同案件「理賠顧問建議」按鈕 → 重複計費
- 預估省 60%+ Claude API 費（同 input 第二次起命中快取）

### 設計
- **0 套件**（AGENTS §2.2）— 原生 `Map` + 手刻 LRU 驅逐
- **LRU + TTL 雙重驅逐**：容量上限（預設 100）+ 時間到期（預設 1 小時）
- **Process-level singleton**：Next.js dev/prod 都共享同一 process
- **統計**：hits/misses/evictions/expirations + hit rate

### 5 個公開函式
| 函式 | 用途 |
|---|---|
| `getCachedAdvisor(input, config?)` | 查快取（過期/disabled → null） |
| `setCachedAdvisor(input, result, config?)` | 寫快取（隱私 fallback 不寫） |
| `clearAdvisorCache()` | 清空（測試用） |
| `getAdvisorCacheStats()` | 取得統計 |
| `getAdvisorCacheHitRate()` | 命中率（0-1） |
| `cacheKey(input)` | 純函式產生快取鍵（sort keys 確保順序無關） |

### 不快取規則
- `mode=fallback` + `fallbackReason=privacy` 不寫（避免重複 PII 掃描）
- `cfg.mode=mock` 不查（mock 是即時計算無成本）
- `cache.enabled=false` 不查不寫（測試 / 除錯）

### AdvisorConfig 整合
```ts
interface AdvisorConfig {
  // ...既有
  cache?: AdvisorCacheConfig  // v0.7.7+ 新增
}
```

### 測試整合
- `advisor-api.test.ts` + `advisor-route.test.ts` 都在 `beforeEach` 呼叫 `clearAdvisorCache()` 避免跨測試共享 Map 污染
- `liveConfig` fixture 加 `cache: { enabled: false }` 預設關閉（v0.7.7+ 新測試顯式啟用驗證命中）

### 不變量（測試守護）
- 同 input 第二次呼叫 → 命中快取（不打 fetch）
- LRU 超過 maxEntries → 驅逐最舊
- TTL 過期 → 視同 miss
- privacy fallback → 不寫
- `cacheKey({a, b}) === cacheKey({b, a})`（sort keys）

## §15 PWA + 手機優化（v0.8.0+）

> **檔案**: `components/InstallPWAButton.tsx` + `components/MobileNav.tsx` + `app/globals.css`
> **測試**: `__tests__/components/InstallPWAButton.test.tsx` (3 it)

### 為什麼 v0.8.0 加快捷？
- v0.7.18 已配 PWA manifest / sw.js / icons，但用戶不知「可裝」— 90% 不知道 Safari/Chrome 右上「加到主畫面」
- 桌機 AntD 6 已是 RWD，但「漢堡選單」「iOS safe-area」「拇指友善 44px」沒做

### 跨平台 PWA 安裝引導（`InstallPWAButton`）
| 平台 | 行為 |
|---|---|
| Android Chrome | 攔截 `beforeinstallprompt` → 按鈕觸發原生 prompt |
| iOS Safari | 沒 prompt 事件 → 按鈕打開 Modal 顯示「分享 → 加主畫面」2 步驟 |
| 已安裝（standalone） | 自動隱藏（不重複打擾） |
| 不支援（舊瀏覽器） | 自動隱藏 |

### `PWAHintCard` 永遠顯示（手機桌機都看得到）
- 已安裝 → 隱藏
- 顯示「可以裝到手機當 app 用」+ iOS/Android 引導

### 手機導覽列（`MobileNav`）
- 桌機（≥ 768px）：水平並排 nav + 當前頁 primary 高亮
- 手機（< 768px）：漢堡按鈕 → Drawer 從右滑入
- `sticky top-0` + `backdrop-blur` + `env(safe-area-inset-top)` 處理 iPhone 劉海

### 手機 CSS token（`globals.css`）
- `--safe-top/bottom/left/right` = `env(safe-area-inset-*)`
- `--touch-target-min` = 44px（Apple HIG 拇指友善）
- `.safe-top / .safe-bottom / .safe-x / .touch-target` 工具類
- `.mobile-sticky-cta` 表單底部固定按鈕區
- `@media (max-width: 768px) html { font-size: 16px }` 防止 iOS Safari focus input 自動放大

### layout.tsx 補強
- `viewport.viewportFit: 'cover'` 啟用 safe-area
- `viewport.maximumScale: 5` accessibility
- `<MobileNav />` 在 `<App>` 內、`<ServiceWorkerRegistrar />` 前

### 不變量（測試守護）
- SSR 不 render InstallPWAButton（避免 hydration mismatch — `platform=loading` 時 null）
- SSR 不 render PWAHintCard（同理）
- 已安裝 → 兩個都隱藏
- iOS → 顯示步驟 Modal，非原生按鈕

### 已完成（v0.7.x 範圍：v0.7.0-v0.7.7）
- v0.7.0 Hero Ensemble 健康度自動化更新
- v0.7.1 LLM Advisor 部署場景矩陣 + export mode guard
- v0.7.2 清除 Statistic valueStyle deprecation warning
- v0.7.3 KNN 推薦理由面板
- v0.7.6 Step4 KNN 即時預視
- v0.7.7 LLM Advisor in-memory LRU+TTL 快取

## §16 手機 sticky CTA + 表單 input 優化（v0.8.1+）

> **檔案**: `components/MobileStickyCTA.tsx`
> **測試**: `__tests__/components/MobileStickyCTA.test.tsx` (3 it)

### 為什麼 v0.8.1 加快捷？
- v0.8.0 加了 safe-area / mobile 字體，但「下一步 / 上一步」按鈕在長表單最下方要捲很久
- 表單填到一半看不到「送出」按鈕 → UX 卡住
- 結果頁 7 個 Tabs 區塊很長，要「重新估算 / 回首頁」也要滑回去

### `MobileStickyCTA` 元件
- 桌機（≥ 768px）：回傳普通 flex 容器（`md:static`），不固定
- 手機（< 768px）：套 `.mobile-sticky-cta` class
  - `position: sticky; bottom: 0`
  - `padding-bottom: max(12px, var(--safe-bottom))` 處理 iPhone home indicator
  - 軟陰影 + 白底 + 邊框
- `<Button block>` 寬度自動填滿左/右半邊

### 套用範圍
| 頁 | left | right |
|---|---|---|
| `/claims/new` Step 1-6 | 「上一步」disabled=current===0 | 「下一步」type=primary |
| `/claims/new` Step 7 | 「上一步」 | 「送出並估算」type=primary |
| `/claims/result` | 「重新估算」→ `/claims/new` | 「回首頁」→ `/` type=primary |

### 表單 input 優化（v0.8.1）
- `accidentLocation` → `autoComplete="street-address"` + `enterKeyHint="next"`
- `occupation` → `autoComplete="organization-title"` + `enterKeyHint="next"`
- AntD `InputNumber` 已內建 `inputMode="decimal"`（不用改）
- `enterKeyHint` iOS Safari 鍵盤右下角按鈕顯示「下一個」

### 不變量（測試守護）
- 空 children 仍 render 容器
- 左右按鈕都 render
- `mobile-sticky-cta` + `md:static` class 都在 SSR HTML 中

## §17 法規版本切換（新法 / 舊法）（v0.8.2+）

> **檔案**: `lib/data-sources/regulation-cutoff.ts` + `lib/insurance/compulsory.ts` + `lib/insurance/disability-joint-mapping.ts` + `lib/insurance/index.ts`
> **測試**: `__tests__/data-sources/regulation-cutoff.test.ts` (17 it) + `__tests__/insurance/compulsory-medical-material.test.ts` (19 it) + `__tests__/insurance/disability-joint-mapping-by-date.test.ts` (34 it)

### 為什麼 v0.8.2 加日期切換？
- **2026-07-01 是強制險 §2.3.6 醫材 + 失能給付標準表 雙法同日施行日**
- 之前 v0.2.5 + v0.6.6 修了新法邏輯，但**沒有日期判斷** — 連 2024 年舊事故都用新法算（這是 bug）
- v0.8.2 補上 `isNewLaw(accidentDate)` 切換，確保：
  - **事故日 >= 2026-07-01** → 新法（拆 subItems / 三分類查表）
  - **事故日 < 2026-07-01** → 舊法（合併 3 項上限 / 百分比段）

### 切換 API（純函式 + 向後相容）

| 函式 | 用途 | 向後相容 |
|---|---|---|
| `isNewLaw(accidentDate)` | 純函式，true = 新法 / false = 舊法 | N/A（新函式）|
| `getLawVersionLabel(accidentDate)` | UI 標籤（"新法 (2026-07-01 起)"）| N/A（新函式）|
| `calcMedicalMaterialOldLaw(input)` | 舊法版醫材費（合併 3 項 + pro-rata）| 原 `calcMedicalMaterial` 一行不動 |
| `computeCompulsoryMedicalByDate(input, accidentDate)` | 主計算依事故日切換 | 原 `computeCompulsoryMedical` 一行不動 |
| `levelFromRomLossOldLaw(percent)` | 舊法版 ROM 百分比 → 等級 | 原 `lookupUpperLimbLevel/lookupLowerLimbLevel` 一行不動 |
| `lookupDisabilityLevelByDate(joint, percent, accidentDate)` | 失能依事故日切換 | N/A（新 wrapper）|

### 切換規則
| 事故日 | 醫材費 | 失能判定 |
|---|---|---|
| `null` / `undefined` / `''` | **新法**（保守預設）| **新法** |
| `2026-07-01` ~ 至今 | 新法 | 新法 |
| `2026-06-30` 及之前 | 舊法（合併 3 項）| 舊法（百分比段 5/15/30/50/70%）|
| 非標準格式（"2026/07/01" 等）| 舊法（保守，避免誤判）| 舊法 |

### User 真實案例驗證
**踝關節 ROM 20°（40% 喪失）**：
- 事故日 2024-01-01（舊法）：40% ≥ 30% → **第 9 級**
- 事故日 2026-07-01（新法）：33% ≤ 40% < 50% → motion → 12-35 → **第 13 級**

### 設計決策
- **保守預設 = 新法**：null/undefined 走新法，避免低估（向後相容 v0.8.2 前行為）
- **原函式不動**：所有 wrapper 都是「新增」，沒有改既有 export → 既有 47 個測試 0 修改全綠
- **UI 暫不顯示切換標籤**：表單結果頁頂部可考慮加 "依事故日判定：舊法 (2026-07-01 前)" badge（後續 v0.8.3+）
- **subItems 結構差異**：新法 2 項 (special + assistive) / 舊法 3 項 (special + generalMaterial + assistive)，UI 顯示自動反映
- **approved 可能相同**：當 special + assistive 合計已超過 2 萬，新舊法 approved 都 = 20000（因為都套上限）；但 subItems 結構不同，UI 可看出差異

### 不變量（測試守護）
- `isNewLaw('2026-06-30') === false`（邊界前一日）
- `isNewLaw('2026-07-01') === true`（邊界當日，含當日）
- `isNewLaw(null) === true`（保守預設）
- `isNewLaw('invalid') === false`（格式錯走舊法，避免誤判）
- 同一個案 2024 vs 2026-07-01 subItems 結構不同（舊法 3 項 / 新法 2 項）
- DIFF_INPUT（special 8000 + generalMaterial 15000 + assistive 7000）：舊法 20000 / 新法 15000
- level 結果必在 1-15 範圍內

## §18 法規版本標籤 UI（v0.8.3+）

> **檔案**: `components/LawVersionBadge.tsx`
> **測試**: `__tests__/components/LawVersionBadge.test.tsx` (15 it)
> **串接**: `app/claims/result/_form.tsx` 第 141 行後（事故日 / 法院資訊旁）

### 為什麼 v0.8.3 加 UI 標籤？
- v0.8.2 加了計算引擎切換（純函式），但**結果頁 UI 沒顯示「依事故日判定的新/舊法」**
- 使用者看到理賠金額差異會困惑「為什麼同樣骨折，金額不同？」 → 需要 badge 標明哪條法源
- 一眼可辨「🆕 新法」vs「📜 舊法」 + hover tooltip 解釋差異

### `LawVersionBadge` 元件
- props: `accidentDate?: string | null`, `tooltip?: string`, `showIcon?: boolean`（預設 true）
- 顯示：
  - 新法（事故日 >= 2026-07-01 或未填）→ 綠色 Tag `ant-tag-success` + 🆕
  - 舊法（事故日 < 2026-07-01）→ 橘色 Tag `ant-tag-warning` + 📜
- Tag label 文字本身已帶說明（不依賴 hover）：
  - 新法：`強制險新法 (2026-07-01 起) · 特殊材料＋輔具各自 2 萬上限`
  - 舊法：`強制險舊法 (2026-07-01 前) · 醫材＋特殊材料＋輔具合併 2 萬上限`
- SSR-safe：`'use client'` 但無 client state，純 props 渲染
- AntD `Tooltip` 提供詳細說明（client-side hover 才顯示）

### 串接位置
結果頁頂部「事故地點：xxx · 事故日：YYYY-MM-DD · 管轄法院：xxx」後面加 badge。

### 設計決策
- **Tag 顏色**：新法 = success（綠）暗示「新版好」、舊法 = warning（橘）暗示「需注意」
- **Emoji 圖示**：🆕 新法 / 📜 舊法（可關閉 `showIcon={false}`）
- **Tag label 含說明**：避免使用者看不到 tooltip 也能懂差異
- **`<Tooltip>` 詳細說明**：hover 顯示法源條文 + 計算差異

### 不變量（測試守護）
- 新法日期集合（含 null/undefined）→ 顯示 `data-law-version="new"` + 綠色
- 舊法日期集合 → 顯示 `data-law-version="old"` + 橘色
- 每個變體都 render AntD Tag
- Tag label 必含「2026-07-01」標示（不論新舊法）
- `showIcon={false}` → 不顯示 emoji

