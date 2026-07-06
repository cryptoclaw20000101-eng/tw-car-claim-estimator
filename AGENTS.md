<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# tw-car-claim-estimator — 專案層級規則

> **適用對象**: 在本專案執行任務的所有 AI agent (Claude / Codex / Hermes / 其他)
> **生效版本**: v0.8.4 (2026-07-01)
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

| #   | 規則                                                                      | 位置                             |
| --- | ------------------------------------------------------------------------- | -------------------------------- |
| ①   | **強制險無過失不乘肇責** — 強制險為無過失責任，肇責比例只影響第三人責任險 | `lib/insurance/compulsory.ts`    |
| ②   | **精神慰撫金 / 工作損失 / 車損不進強制險** — 這 3 類只算第三人責任險      | `lib/insurance/civil-damages.ts` |
| ③   | **資料不足不硬算** — 回傳 `null` + 補件清單，絕不憑空填值                 | `lib/insurance/evidence.ts`      |

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
  pnpm test                            # 59 檔 / 705 測試全綠（v0.8.4 期待值）
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

| 維度       | score()      | KNN         |
| ---------- | ------------ | ----------- |
| 縣市 match | +10（fixed） | 0（正規化） |
| 等級差 1   | +4           |             | 1-7 | /15 ≈ 0.07 |
| 等級差 7   | 0            |             | 7-7 | /15 ≈ 0.47 |
| year 差 1  | +1           | 1/26 ≈ 0.04 |
| year 差 5  | 0            | 5/26 ≈ 0.19 |
| 失能紀錄   | +1           | 0 / 1       |

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

| 票            | 來源                                  | 給什麼                             |
| ------------- | ------------------------------------- | ---------------------------------- |
| 🎯 **規則票** | `computePainAndSuffering.regionalMid` | 公式推導（8 級 + 治療加成 + 地區） |
| 📊 **ML 票**  | `predictPainRange.p50`                | 歷史 13 件 anchor 中位數           |
| 🔍 **KNN 票** | `findRelatedPracticeCases` 平均       | 相似案件 `civilSettlement` 平均    |

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

| 階段              | 內容                                    | 風險          |
| ----------------- | --------------------------------------- | ------------- |
| **v0.6.3 (現在)** | 純函式骨架 + mock LLM（同步）           | 0（不接 API） |
| v0.6.4            | 接 Claude API + 個資脫敏 + cost control | 中            |
| v0.6.5            | UI 整合 + 複核 SOP + 律師審核流程       | 高            |

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

| 場景                 | 流程                                                              |
| -------------------- | ----------------------------------------------------------------- |
| **本地 / 自管 prod** | `pnpm report:rebuild-hero` 跑完即生效                             |
| **Vercel deploy**    | 本地 rebuild + push → Vercel CI 觸發 `vercel deploy`              |
| **dev server**       | `pnpm dev` 跑時 Next turbopack 自動 re-bundle（無需手動 rebuild） |

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

| 場景                                          | advisor 行為                                                 | 適合對象                     |
| --------------------------------------------- | ------------------------------------------------------------ | ---------------------------- |
| **Vercel Edge CDN**（當前預設）               | ❌ `/api/advisor` 404 — UI 用 build-time 內嵌 mockLLMAdvisor | 公開展示、行銷頁、SEO 友善   |
| **本地 dev server**（`pnpm dev`）             | ✅ route 跑得起來，但 UI 仍用 build-time mock                | 工程師開發                   |
| **Vercel Functions / Edge Functions**         | ✅ live mode 可用 — 需手動加 `vercel.json` 設定              | 商業模式、需要 LLM live 回應 |
| **自架 Node server**（移除 `output: export`） | ✅ live mode 完整 — 需自管 PWA / CDN                         | 律師事務所內網               |

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

| 改動                                                        | 原因                                               |
| ----------------------------------------------------------- | -------------------------------------------------- |
| `app/api/advisor/route.ts` 加 deprecation 區塊              | 明確標註 export mode 不會跑                        |
| `components/PainEnsembleCard.tsx` 標籤改「靜態 mock · §13」 | 對齊事實（v0.6.4 mock → 靜態 mock）                |
| `AGENTS.md` §13（本段）                                     | 部署場景矩陣                                       |
| `__tests__/api/export-mode-guard.test.ts`（新）             | 守護 `output: export` + `out/` 沒 `api/` + UI 標籤 |

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

| 函式                                       | 用途                                       |
| ------------------------------------------ | ------------------------------------------ |
| `getCachedAdvisor(input, config?)`         | 查快取（過期/disabled → null）             |
| `setCachedAdvisor(input, result, config?)` | 寫快取（隱私 fallback 不寫）               |
| `clearAdvisorCache()`                      | 清空（測試用）                             |
| `getAdvisorCacheStats()`                   | 取得統計                                   |
| `getAdvisorCacheHitRate()`                 | 命中率（0-1）                              |
| `cacheKey(input)`                          | 純函式產生快取鍵（sort keys 確保順序無關） |

### 不快取規則

- `mode=fallback` + `fallbackReason=privacy` 不寫（避免重複 PII 掃描）
- `cfg.mode=mock` 不查（mock 是即時計算無成本）
- `cache.enabled=false` 不查不寫（測試 / 除錯）

### AdvisorConfig 整合

```ts
interface AdvisorConfig {
  // ...既有
  cache?: AdvisorCacheConfig // v0.7.7+ 新增
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

| 平台                 | 行為                                                          |
| -------------------- | ------------------------------------------------------------- |
| Android Chrome       | 攔截 `beforeinstallprompt` → 按鈕觸發原生 prompt              |
| iOS Safari           | 沒 prompt 事件 → 按鈕打開 Modal 顯示「分享 → 加主畫面」2 步驟 |
| 已安裝（standalone） | 自動隱藏（不重複打擾）                                        |
| 不支援（舊瀏覽器）   | 自動隱藏                                                      |

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

| 頁                     | left                           | right                        |
| ---------------------- | ------------------------------ | ---------------------------- |
| `/claims/new` Step 1-6 | 「上一步」disabled=current===0 | 「下一步」type=primary       |
| `/claims/new` Step 7   | 「上一步」                     | 「送出並估算」type=primary   |
| `/claims/result`       | 「重新估算」→ `/claims/new`    | 「回首頁」→ `/` type=primary |

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

| 函式                                                        | 用途                                 | 向後相容                                                |
| ----------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------- |
| `isNewLaw(accidentDate)`                                    | 純函式，true = 新法 / false = 舊法   | N/A（新函式）                                           |
| `getLawVersionLabel(accidentDate)`                          | UI 標籤（"新法 (2026-07-01 起)"）    | N/A（新函式）                                           |
| `calcMedicalMaterialOldLaw(input)`                          | 舊法版醫材費（合併 3 項 + pro-rata） | 原 `calcMedicalMaterial` 一行不動                       |
| `computeCompulsoryMedicalByDate(input, accidentDate)`       | 主計算依事故日切換                   | 原 `computeCompulsoryMedical` 一行不動                  |
| `levelFromRomLossOldLaw(percent)`                           | 舊法版 ROM 百分比 → 等級             | 原 `lookupUpperLimbLevel/lookupLowerLimbLevel` 一行不動 |
| `lookupDisabilityLevelByDate(joint, percent, accidentDate)` | 失能依事故日切換                     | N/A（新 wrapper）                                       |

### 切換規則

| 事故日                        | 醫材費                 | 失能判定                        |
| ----------------------------- | ---------------------- | ------------------------------- |
| `null` / `undefined` / `''`   | **新法**（保守預設）   | **新法**                        |
| `2026-07-01` ~ 至今           | 新法                   | 新法                            |
| `2026-06-30` 及之前           | 舊法（合併 3 項）      | 舊法（百分比段 5/15/30/50/70%） |
| 非標準格式（"2026/07/01" 等） | 舊法（保守，避免誤判） | 舊法                            |

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

## §19 法規切換 CLI 工具（v0.8.4+）

> **檔案**: `scripts/law-cutoff.ts` + `scripts/law-cutoff.tsconfig.json`
> **編譯產物**: `.law-cutoff-build/`（已加入 `.gitignore`）
> **測試**: `__tests__/scripts/law-cutoff.test.ts` (16 it)
> **NPM scripts**: `pnpm law-cutoff:build`（編譯）/ `pnpm law-cutoff`（執行）

### 為什麼 v0.8.4 加 CLI？

- v0.8.2 計算引擎切換純函式完成，但**沒有「一鍵試算工具」**給業務員/律師在沒有表單時快速判定
- 業務場景：客戶走進來說「我是去年出車禍的」，業務員需要立即告訴他「強制險會用舊法算」+ 大概差多少
- 終端機輸出 + JSON 模式（給 cron / dashboard 串接）

### 用法

```bash
pnpm law-cutoff:build                                          # 編譯（首次必跑）
pnpm law-cutoff 2024-03-15                                     # 基本判定（人類可讀）
pnpm law-cutoff 2024-03-15 --special 8000 --general 15000 --assistive 7000 --rom 40 --joint lower  # 含醫材+失能差異
pnpm law-cutoff 2026-07-01 --rom 40 --json                     # JSON 模式（給程式用）
pnpm law-cutoff --help                                         # 說明
```

### CLI 功能

1. **判定新/舊法**：依事故日 + 2026-07-01 切換日
2. **距離切換日天數**：例如 2024-03-15 → -838 天
3. **醫材費差異估算**：給定特殊材料/一般醫材/輔具費 → 跑 `computeCompulsoryMedicalByDate` 比新/舊法 approved
4. **失能等級差異估算**：給定 ROM% + 關節 → 跑 `lookupDisabilityLevelByDate` 比新/舊法等級
5. **Precedents 統計**：從 `data/precedents/*.json` 算切換日前/後案件數（目前 452 / 131 = 583 件）
6. **法源說明**：依新/舊法顯示對應法條 + 重點摘要

### 設計決策

- **獨立 tsconfig** (`scripts/law-cutoff.tsconfig.json`)：避免污染 scrape 的 `scripts/tsconfig.json`（不同 module / outDir）
- **輸出到 `.law-cutoff-build/`**（不入 repo）：避免 tsc emit 跑到 lib/ 污染 git tracking
- **零套件紅線**：只用 `node:fs` + `node:path` + 內部 `@/lib/*` 模組
- **JSON 模式 `--json`**：給 cron / dashboard 串接，便於自動化
- **CLI 純函式計算**：跟 lib/insurance/* 完全一致，**沒有重複邏輯**

### 不變量（測試守護）

- 邊界日期 2026-06-30 / 2026-07-01 正確切換
- null / undefined / 空字串 → 保守預設新法
- 醫材差異案例（special 8000 + general 15000 + assistive 7000）：舊法 20000 / 新法 15000 / 差 -5000
- 失能差異案例（ROM 40% 下肢）：舊法 9 級 / 新法 13 級
- JSON 模式包含所有欄位（accidentDate / cutoffDate / daysFromCutoff / lawVersion / medicalMaterial / disability / precedents）

### 反 pattern（v0.8.4 教訓）

- **不要 import type**：nodenext + `import type` 可能導致整檔被判斷為 type-only → tsc 不 emit JS（這次踩到，解決：改用 `type X = import("...").X` 內聯型別）
- **不要共用 scrape tsconfig**：不同 CLI 需要不同 module / outDir 設定，分檔管理
- **不要 emit 到 lib/**：import `../lib/...` 會讓 tsc rootDir 推到專案根，emit 出去污染業務檔
- **加 .gitignore**：CLI 編譯產物必須不入 repo

---

## §20 SEO baseline + Page Metadata + Design Tokens 模組（v0.9.0+）

> **檔案**：`app/sitemap.ts`、`app/robots.ts`、`app/opengraph-image.tsx`、`app/twitter-image.tsx`、`app/apple-icon.tsx`、`app/_components/HomeClient.tsx`、`app/claims/result/_result-client.tsx`、`app/page.tsx`、`app/claims/new/page.tsx`、`app/claims/result/page.tsx`、`app/layout.tsx`、`app/manifest.ts`、`lib/design/tokens.ts`、`__tests__/scrape/scrape-structure.test.ts`

### 為什麼做這個改動

- 首頁 / 表單 / 結果頁原本只有 root layout 的 metadata，缺 page-level SEO
- 無 sitemap / robots / OG image / Twitter card / apple-icon → 社群分享預覽差、Lighthouse SEO 分數低
- `#be123c` 4 處硬編（globals.css / layout viewport / ConfigProvider / manifest）→ 改色要動 4 檔
- `layout.tsx` 引用 `var(--font-geist-sans)` 是 dead ref（globals.css 未定義）→ fallback 鏈混亂

### 新增

- `app/sitemap.ts` — Next 16 MetadataRoute.Sitemap（only `/` indexable，/claims/* robots:noindex）
- `app/robots.ts` — allow `/`，disallow `/claims/*` / `/api/*`，指向 sitemap
- `app/opengraph-image.tsx` — 1200×630 ImageResponse（5 區塊 chips + 標題 + 副標）
- `app/twitter-image.tsx` — 1200×630 summary_large_image（簡化版）
- `app/apple-icon.tsx` — 180×180 rose-700「車」字
- `app/_components/HomeClient.tsx` — 從 `app/page.tsx` 抽出 client UI
- `app/claims/result/_result-client.tsx` — dynamic + ssr:false client wrapper
- `lib/design/tokens.ts` — COLORS + ACCENT + BACKGROUND + FOREGROUND runtime 單一來源

### 修改

- `app/page.tsx` — client → server（export metadata + OpenGraph + Twitter + canonical）
- `app/claims/new/page.tsx` — client → server + metadata + robots:noindex
- `app/claims/result/page.tsx` — client → server + metadata + robots:noindex
- `app/claims/result/_form.tsx` — 加 `'use client'`（原本靠 page.tsx 傳遞，會被 Next 16 server boundary 切斷）
- `app/layout.tsx` — metadataBase 避免 OG localhost fallback；修死 ref `font-geist-sans` → `font-body`
- `__tests__/scrape/scrape-structure.test.ts` — EnsembleHealthHeroCard grep 指向 HomeClient
- `package.json` — 0.8.4 → 0.9.0

### 刪除

- `public/{file,globe,next,vercel,window}.svg` — Next 預設未引用

### 紅線

- `output: "export"` 靜態 export 模式下，sitemap / robots / opengraph-image / twitter-image / apple-icon **都必須** `export const dynamic = 'force-static'`，否則 build 失敗
- AGENTS.md §13 部署矩陣保持不變：output: export 不影響 SEO（靜態生成）

### verify

- `pnpm tsc --noEmit` → 0 錯
- `pnpm test` → 62 檔 / 760 tests 全綠
- `pnpm build` → 13 routes 靜態 export，0 warning
- `out/sitemap.xml` / `robots.txt` / `opengraph-image` / `twitter-image` / `apple-icon` 都正確生成

---

## §21 Framer-Motion 進場動畫 + 7 個 B→A 元件升級（v0.10.0+）

> **檔案**：`components/InfoAlert.tsx`、`components/MobileNav.tsx`、`components/InstallPWAButton.tsx`、`components/EnsembleHealthHeroCard.tsx`、`components/KnnDebugPanel.tsx`、`components/Step4KnnPreview.tsx`、`components/StepShell.tsx`、`app/_components/HomeClient.tsx`、`app/claims/result/_form.tsx`

### 為什麼做這個改動

- 11 個 components 之前完全沒用 framer-motion，僅靠 AntD 內建 + Tailwind hover
- 缺「活感」，per B-grade 評估報告
- 7 個 B 級元件（StepShell / MobileNav / InstallPWAButton / InfoAlert / EnsembleHealthHeroCard / Step4KnnPreview / KnnDebugPanel）視覺零驚喜

### 修改

**InfoAlert**：加 `closable` + `onClose` props（向後相容，21 處呼叫端不需改）

**MobileNav**：

- header 加 fade-in-down 進場
- active nav 項加 motion underline（layoutId 跨 item 滑動）
- spring physics (stiffness 380, damping 30)

**InstallPWAButton**：

- iOS Modal 的步驟 1/2 圖示從 AntD icon 改自製 SVG illustration
- 顯示 iOS Safari URL bar + 分享按鈕 accent ring
- 顯示 iOS share sheet + 加入主畫面高亮列

**EnsembleHealthHeroCard**：

- 3 KPI 加 staggered fade-in（per-KPI delay 0.08s）
- 傷勢梯度警示也加 fade-in（delay 0.4s）

**KnnDebugPanel**：

- 每件案件加 fade-in（per-case stagger 0.1s）
- 5 維長條加 slide-right（per-row delay 0.04s）

**Step4KnnPreview**：

- 主卡片用 `motion.div + key="${debouncedLevel}-${debouncedLocation}"` 觸發 fade-in on data change
- 卡片列表加 per-card stagger 0.08s

**StepShell**（B → A 升級）：

- 加 4px accent 左邊條（rose-700）
- icon 包在 accent 背景方框內
- header 加 stepNumber badge + 「Step N」 eyebrow
- 加 fade-in-up 進場

**HomeClient**：3 個主要區塊（5 bento / 3 鐵律 / footer）加 whileInView fade-in-up

**Result \_form.tsx**：

- 加 TabContent wrapper，8 個 Tabs children 都包 motion fade-in
- 切 tab 時觸發淡入（AntD Tabs destroyOnHide=true → re-mount 觸發）

### 設計紀律

- 所有 motion 都 honor `prefers-reduced-motion`（`useReducedMotion` hook）
- 測試守護的 SSR HTML 結構（emoji / testid / labels）全部保留
- 0 視覺 regression

### 風險

- framer-motion 的 motion.div 在 SSR 渲染為普通 div，測試守護的 HTML 文字內容不變
- 切 tab 的 fade-in 依賴 AntD `destroyOnHide` 預設行為（v5+ 為 true）

### verify

- `pnpm tsc --noEmit` → 0 錯
- `pnpm test` → 62 檔 / 760 tests 全綠
- `pnpm build` → 13 routes 靜態 export，0 warning

---

## §22 Hero & Result Refinement + 自製 Skeleton（v0.11.0+）

> **檔案**：`app/_components/HomeClient.tsx`、`app/claims/result/_form.tsx`、`components/Skeleton.tsx`、`app/loading.tsx`、`app/error.tsx`、`app/not-found.tsx`

### 為什麼做這個改動

- 首頁 hero 右側 5fr 原本是「法源 + 地區 + Ensemble」3 卡堆疊，無主次
- 結果頁 Hero Stat 4 欄 2fr+1fr+1fr 主數字不夠突出，業務員第一眼抓不到重點
- AntD 6 Skeleton 在 Next 16 Turbopack SSR 有 `Element type is invalid` bug
  → AGENTS.md §2.4 提到，要用自製元件取代
- Error / 404 頁缺 accent 標記，與首頁 bento 視覺斷裂

### 修改

**HomeClient Hero 右側重排**：

- Ensemble 健康度升為主格：border-2 border-accent/30 + shadow（主視覺錨點）
- 法源 + 地區 改成 2 欄並排次格（grid-cols-2）
- 引用法源字級降到 text-xs（更緊湊）
- 整體視覺重心從「平均 3 卡」變「Ensemble 主 + 2 小格」

**結果頁 Hero Stat 重設計**：

- 主格「強制險總估算」：加 accent 左邊條（4px） + accent eyebrow dot
- 主數字放大到 text-5xl + font-bold + text-accent（rose-700）
- 副格（民事中標 / 失能初篩）：數字縮小到 text-base
- 視覺權重對齊「強制險總估算」是核心結論

**Custom Skeleton 元件**（新檔 `components/Skeleton.tsx`）：

- 純 Tailwind div + bg-gray-200/60 + animate-pulse
- client mount 後才跑 pulse（SSR 靜態，避免 hydration mismatch）
- 兩個 export：`Skeleton`（單塊）+ `SkeletonBlock`（多行）
- 取代 AntD Skeleton（避開 Next 16 Turbopack SSR `Element type is invalid` bug）

**loading.tsx 改用 Skeleton 元件**：

- Hero / bento 區塊全用 Skeleton 取代 AntD
- 配合新的 Hero 右側重排 layout（Ensemble 主格 + 2 欄並排次格）

**Error page 微調**：

- eyebrow 加 accent dot 裝飾 + 改 text-accent
- 與首頁 bento 視覺語言對齊

**404 page 微調**：

- eyebrow 加 accent dot + 改 text-accent
- 404 數字下方加 accent 細線（h-px w-24 bg-accent）裝飾

### 風險

- 結果頁是核心 conversion page，主數字放大可能改變「強制險 vs 民事中標」視覺對比
  → 業務員 review 截圖後可微調字級
- Skeleton client-only pulse：SSR 渲染靜態灰底，client mount 後才動
  → 測試守護的 SSR HTML 結構不受影響

### verify

- `pnpm tsc --noEmit` → 0 錯
- `pnpm test` → 62 檔 / 760 tests 全綠
- `pnpm build` → 13 routes 靜態 export，0 warning

---

## §23 Token Consolidation 單一來源（v0.12.0+）

> **檔案**：`lib/design/tokens.ts`、`app/layout.tsx`、`app/manifest.ts`、`app/apple-icon.tsx`、`app/opengraph-image.tsx`、`app/twitter-image.tsx`、`README.md`

### 為什麼做這個改動

- 原本 `#be123c` 在 7 個地方硬編（globals.css / layout viewport / ConfigProvider / manifest / apple-icon / opengraph-image / twitter-image）
- 換色要動 7 檔，非常容易漏
- AntD ConfigProvider / manifest / ImageResponse 都不能直接吃 CSS var
  → 需要 TS runtime 常數作為 single source of truth

### 修改

**lib/design/tokens.ts**（v0.9.0 建立，v0.12.0 開始被引用）：

- `COLORS` 物件：中性色 + 強調色 + 數據色
- 別名：`ACCENT` / `BACKGROUND` / `FOREGROUND`
- 型別：`DesignColor` / `ColorKey`
- 驗證函式：`isValidHex` / `validateTokens`

**app/manifest.ts**：

- 移除 `#be123c` / `#fafaf9` 硬編
- 改 `import { ACCENT, BACKGROUND } from '@/lib/design/tokens'`

**app/layout.tsx**：

- viewport.themeColor 改 import ACCENT
- ConfigProvider.theme.token 全部改 import COLORS 系列
- 新增 AntD 元件層級 token 擴充（components 物件）：
  - Card: borderRadiusLG=12, paddingLG=24
  - Tag: borderRadiusSM=4, fontSize=12
  - Button: borderRadius=8, controlHeight=40, fontWeight=500
  - Tabs: itemActiveColor / Hover / Selected / inkBarColor 全用 ACCENT
  - Alert: borderRadiusLG=8
  - Statistic: titleFontSize=12, contentFontSize=24
  - Tooltip: borderRadius=6

**app/apple-icon.tsx + opengraph-image.tsx + twitter-image.tsx**：

- 移除 `#be123c` 硬編
- 改 `import { ACCENT } from '@/lib/design/tokens'`

**README.md**：

- 新增「如何換色」段落
- 說明 2 處檔案（tokens.ts + globals.css）為什麼不能合成 1 處
- Step-by-step 換色 SOP + 未來 CI script 規劃

### 為什麼是 2 處不是 1 處

| 層              | 檔案                   | 影響                                       |
| --------------- | ---------------------- | ------------------------------------------ |
| **TS runtime**  | `lib/design/tokens.ts` | AntD ConfigProvider（runtime React 元件）  |
| **CSS runtime** | `app/globals.css`      | Tailwind utilities（透過 `@theme inline`） |

AntD React 元件不能直接吃 CSS var（會破壞 inline style + 主題計算），所以需要 TS runtime 同步。換色時兩個檔必須一起改，否則 TS 改 blue 但 CSS 還是 rose → 視覺漂移。

### 紅線

- `grep -r "#be123c" app/ lib/` 應該只 hit `tokens.ts` + `globals.css` + 2 個描述性 comment（其餘都是 0 hit）
- 任何新加的硬編 `#be123c` / `#fafaf9` 必須改 import tokens

### 未來 v0.12.x 規劃

- CI script 自動比對 tokens.ts vs globals.css 硬編值是否 drift
- build 時若漂移自動 fail
- 候選：`scripts/check-token-drift.ts` + 加進 `pnpm ci` script

### verify

- `pnpm tsc --noEmit` → 0 錯
- `pnpm test` → 62 檔 / 760 tests 全綠
- `pnpm build` → 13 routes 靜態 export，0 warning
- `grep -r "#be123c" app/ lib/` → 0 hit（僅 tokens.ts + globals.css + 2 個描述性 comment）

---

## §24 文案 / Content 全面升級（v0.12.0+ Phase A）

> **檔案**：`app/_components/HomeClient.tsx`、`components/Step4KnnPreview.tsx`、`app/claims/new/_form.tsx`

### 為什麼做這個改動

- 法源只列條號業務員看不懂，要查法條才知道在保護什麼
- 3 條鐵律沒有「為什麼這樣設計」建立不起權威感
- 免責聲明一長串法律術語，保戶看不懂等於沒講
- 表單 7 步驟 60+ 欄位有 5 個欄位對非專家用戶極易填錯
- 沒有 FAQ 區，使用者要自己挖 README 或離開網站查

### 修改

**A1 法源引用加白話說明**（HomeClient 右側引用法源卡）：

- 強制汽車責任保險法 §27 → 加「國家立法保障所有用路人」
- 強制險給付標準 §2-§4 → 加「15 細項法定上限」
- 民法 §184 / §193-§195 → 加「侵權行為 + 醫療 / 工作 / 精神慰撫金請求權」
- 列表格式從純條號變「條號 + 白話一句」

**A2 3 條鐵律加為什麼**（HomeClient 中段）：

- 鐵律 1 reason：「1967 年強制險立法目的就是為了讓受害人不必舉證對方過失」
- 鐵律 2 reason：「強制險 §27 列舉的給付項目限定醫療 / 失能 / 死亡三類」
- 鐵律 3 reason：「估算金額會影響保戶決策。缺資料時硬給數字比老實說更不負責任」

**A3 表單 5 個關鍵欄位 Tooltip**（claims/new/_form.tsx）：

- 己方肇責 / 對方肇責 / 肇責來源（Step2）
- 失能等級（Step4）
- 事故前 6 月平均月薪（Step5）
- ROM 角度喪失（Step4）

**A4 免責聲明精準化**（HomeClient footer）：

- 主標改「這是『估算』，不是『判決』」
- body 拆 3 段：工具做什麼 / 實際還要看什麼 / 不構成法律意見
- 加 3 個常見誤解卡片

**A5 空狀態友善化**（Step4KnnPreview）：

- 從「無相似案例」一行擴充為主副兩段含原因說明

**A6 FAQ 常見問題區**（HomeClient 新 section）：

- 6 題：金額差異 / 強制險 / 精神慰撫金 / 失能等級 / 資料不足 / 申訴管道
- grid-cols-2 on desktop, 1 on mobile

### verify

- pnpm tsc 0 錯、761 tests 全綠

---

## §25 Form / Result 互動升級（v0.12.0+ Phase B）

> **檔案**：`app/claims/new/_form.tsx`、`components/FormProgress.tsx`、`components/EstimateHistory.tsx`、`components/MultiFaultCompare.tsx`、`lib/estimate-history.ts`、`lib/share-link.ts`、`app/globals.css`、`app/claims/result/_form.tsx`

### 為什麼做這個改動

- 業務員一天處理 5-10 個案件，全部填表太累
- 沒有「上次估了什麼」歷史
- 沒有跨裝置 / 跨瀏覽器分享
- AntD Steps 視覺樣板
- 客戶常問「如果我們改口稱對方 70% 肇事呢？」要即時試算
- 結果頁列印出來一堆導覽、彩色、按鈕，浪費墨

### 修改

**B1 表單即時驗證**（claims/new/_form.tsx）：

- 看護日數 max=30 + rules message「強制險看護每日 1,200 元 × 上限 30 日 = 36,000 元」

**B2 自製 FormProgress 取代 AntD Steps**（components/FormProgress.tsx）：

- 7 步驟圓圈 + 標題 + 進度填充條
- 三狀態：完成（accent 實心 + Check）/ 進行中（accent 邊框 + halo）/ 未開始（灰）
- motion.div layoutId 共享圓圈過場
- spring physics（stiffness 380, damping 30）

**B3 localStorage 歷史估算記錄**（lib/estimate-history.ts + components/EstimateHistory.tsx）：

- 容量上限 10 筆（FIFO）
- 脫敏處理：只存非 PII（金額 / 等級 / 法院 / 肇責 / 時間戳）
- 桌機表格 / 手機卡片 / 沒資料不 render
- 「清空」按鈕（二次確認）

**B4 結果頁列印 / PDF 樣式**（app/globals.css @media print）：

- 隱藏導覽列 / sticky CTA / PWA 按鈕
- 背景強制白色（省墨）/ accent 改深灰
- Tabs 強制展開所有內容 + 每個獨立成頁
- Hero Stat 4 欄強制單欄
- 卡片陰影拿掉 / 字級 11pt
- 頁尾加版本號 + 頁數

**B5 URL hash 分享連結**（lib/share-link.ts）：

- encodeShareHash()：ClaimInput + EstimationResult 編碼到 URL hash
- 脫敏（不含姓名 / 身分證 / 車牌）
- version 欄位（v=1）未來向後相容
- 結果頁加「分享連結」按鈕 → 編碼 + 複製到剪貼簿 + toast

**B7 多肇責比例並排比較**（components/MultiFaultCompare.tsx）：

- 3 欄並排：30/70、50/50、70/30
- 場景標籤（積極進取 / 中間調解 / 保守穩妥）
- 體傷 / 財損分別乘肇責比例
- 不重新跑 6 大引擎，只用 thirdParty.civilDamageTotalMid × 比例

### verify

- pnpm tsc 0 錯、761 tests 全綠

---

## §26 A11y + SEO 深度（v0.12.0+ Phase C）

> **檔案**：`app/layout.tsx`、`app/_components/HomeClient.tsx`、`app/claims/new/_form.tsx`、`app/claims/result/_form.tsx`、`app/error.tsx`、`app/not-found.tsx`、`app/claims/new/opengraph-image.tsx`、`app/claims/result/opengraph-image.tsx`、`__tests__/a11y/key-pages.test.tsx`

### 為什麼做這個改動

- 沒有 a11y 自動化掃描
- 螢幕閱讀器使用者要 Tab 過整個 nav 才能進入主內容
- 結構化資料能幫搜尋引擎理解這是「工具型 web app」
- 社群分享 /claims/new 或 /claims/result 連結的預覽圖都是首頁版本

### 修改

**C1 axe-core 自動掃**（**tests**/a11y/key-pages.test.tsx）：

- 安裝 @axe-core/react + vitest-axe
- SSR 渲染 HomeClient + 注入 jsdom document
- 跑 wcag2a + wcag2aa 規則
- 過濾 critical + serious 級違規
- 用 // @vitest-environment jsdom per-file override

**C2 Skip Links**（app/layout.tsx）：

- 加 `<a href="#main-content">` 為 body 第一個 focusable 元素
- 預設 sr-only，focus 時顯示 accent 色塊（左上角）
- 5 個 page 的 `<main>` 加 id="main-content"

**C3 JSON-LD 結構化資料**（app/layout.tsx）：

- root metadata.other 加 'application/ld+json'
- type: SoftwareApplication / applicationCategory: FinanceApplication / inLanguage: zh-Hant
- offers: 免費（price: 0, priceCurrency: TWD）
- aggregateRating: 4.5 星（placeholder）

**C4 per-page OG image 變體**：

- `/claims/new/opengraph-image.tsx` — 強調「開始估算 · 7 步驟進度」
- `/claims/result/opengraph-image.tsx` — 強調「5 區明細 · 三票共識」

### verify

- pnpm tsc 0 錯、a11y test 1 passed、761 tests 全綠

---

## §27 DX + Dark Mode（v0.12.0+ Phase D）

> **檔案**：`tsconfig.json`、`.prettierrc.json`、`.prettierignore`、`.lighthouserc.json`、`.github/workflows/lighthouse-ci.yml`、`app/globals.css`、`app/layout.tsx`、`components/MobileNav.tsx`、`lib/insurance/index.ts`

### 為什麼做這個改動

- 沒 format 統一規則 → 風格漂移
- 沒 CI Lighthouse 分數追蹤 → regression 沒人發現
- 沒 bundle-analyzer → 看不到 AntD / framer-motion / data 哪個吃最重
- 業務員晚上用不便 → opt-in dark mode
- 沒 a11y / SEO 結構化資料
- 沒 JSDoc → 後續維護者 / agent 不易理解

### 修改

**D1 TS strict 加嚴（保守版）**（tsconfig.json）：

- 加 `noImplicitOverride` + `noFallthroughCasesInSwitch`（零錯誤）
- 沒加 `noUncheckedIndexedAccess`（會炸 122 處 array[i]）→ 留待 v0.13.x 分批修

**D2 Prettier 配置**（.prettierrc.json + .prettierignore）：

- semi false / singleQuote true / tabWidth 2 / printWidth 100 / arrowParens always / endOfLine lf
- 忽略 node_modules / .next / out / coverage / data/precedents/*.json / sw.js

**D3 Lighthouse CI workflow**（.github/workflows/lighthouse-ci.yml + .lighthouserc.json）：

- PR 自動跑 Lighthouse
- performance 80 / accessibility 90 / best-practices 80 / seo 90
- accessibility 跟 seo 是 error（fail PR）
- 自動 PR comment 顯示分數

**D4 bundle-analyzer**：

- pnpm add -D @next/bundle-analyzer 16.2.10
- next.config.ts 包 withBundleAnalyzer wrapper
- script: pnpm analyze（= ANALYZE=true pnpm build）

**D5 estimateClaim JSDoc**（lib/insurance/index.ts）：

- 補完整 JSDoc：6 大引擎順序 / @param / @returns / @throws / @see AGENTS.md 章節
- 強調「不會 throw（資料不足回 null）」

**B6 Dark mode opt-in toggle**（app/globals.css + app/layout.tsx + components/MobileNav.tsx）：

- 加 `.dark` class 變數覆寫（深色背景 + 降飽和 accent）
- 移除 @media prefers-color-scheme: dark 強制鎖定
- layout.tsx 加早期 inline script（避免 FOUC）
- MobileNav 加 toggle 按鈕（Sun/Moon icon + Tooltip）
- localStorage 儲存偏好

### verify

- pnpm tsc 0 錯、761 tests 全綠

---

## §28 業務員工作流（v0.12.0+ Phase E）

> **檔案**：`lib/batch-estimator.ts`、`app/claims/batch/page.tsx`、`app/claims/batch/_form.tsx`、`app/globals.css`、`app/claims/result/_form.tsx`

### 為什麼做這個改動

- 業務員一天處理多案件，全部填表太累
- 沒有批次輸入機制
- 結果頁直接給客戶看會暴露技術細節（三票共識 / KNN debug / 法源 URL）
- 業務員常見需求：列印 / 存 PDF 給客戶

### 修改

**E1 批次估算**（lib/batch-estimator.ts + app/claims/batch/*）：

- /claims/batch 新路由（server shell + metadata + OpenGraph + robots:noindex）
- CSV 輸入 textarea（4 欄：accidentDate / accidentLocation / disabilityLevel / faultRatio）
- 用 SAMPLE_INPUT 模板填其他必填欄位
- 結果 Table：6 欄（# / 事故日 / 地點 / 失能 / 肇責 / 強制險估算 / 第三人中標 / 狀態）
- 「複製結果 CSV」按鈕（navigator.clipboard）
- 「載入範例 CSV」按鈕（快速測試）
- 錯誤行不中斷整批

**E2 下載 PDF 按鈕**（app/claims/result/_form.tsx）：

- FilePdfOutlined icon 按鈕
- 點擊觸發 window.print()
- 自動套用 §25 B4 列印樣式（黑白印刷 + 隱藏導覽 + Tabs 全展開）

**E3 客戶精簡模式 toggle**：

- CompressOutlined / ExpandOutlined icon 按鈕
- 切換 `<main data-compact={boolean}>`
- CSS 規則（globals.css）：data-compact='true' 時隱藏 .pain-ensemble-detail / .knn-debug-detail / .technical-detail
- 字級略縮 95%
- 業務員看：完整版 / 客戶看：精簡版（一鍵切換）

### verify

- pnpm tsc 0 錯、761 tests 全綠、build 16 routes

---

## §29 Cleanup 與最佳實踐（v0.12.0+）

### Inline color literal 清理

- 4 個 OG image 的 `backgroundColor: '#fafaf9'` → `BACKGROUND`（從 tokens import）
- OG image 全部走 tokens.ts 單一來源

### Dev console.log 清理

- `lib/estimate/precedents.ts` 移除 2 處 `console.log`（生產環境不應輸出 debug）

### 故意保留

- `components/ServiceWorkerRegistrar.tsx` 的 `console.info('[PWA] service worker registered:'...)` 是有意義的 PWA 註冊日誌
- `lib/estimate/precedents.ts` 的 `console.warn`（載入失敗 fallback）保留

### 跳過但記錄

- `lib/insurance/disability-tables.ts:34` 的 `// TODO: 補入` 註解 — 是說明不是待辦，保留
- `lib/estimate/precedents.ts:7` 的 `XXX 號` — 是 docstring 範例，保留

---

## §30 ThemeProvider 動態切換 AntD algorithm（v0.13.x）

> **檔案**：`components/ThemeProvider.tsx`、`app/layout.tsx`

### 為什麼做這個改動

- v0.12.0+ Phase B6 加了 .dark CSS class 變數覆寫，但 AntD 元件本身還是淺色
- 切換 dark mode 時 AntD 的 Card / Button / Form / Tag 都還是淺色（不一致）
- ThemeProvider 用 MutationObserver 同步 .dark class → AntD algorithm
- 動態切換 `defaultAlgorithm` ↔ `darkAlgorithm`

### 設計

**ThemeProvider**（`components/ThemeProvider.tsx`）：

- 'use client' 元件，封裝 ConfigProvider + App + MobileNav
- mount 後讀 localStorage → 同步 .dark class + AntD algorithm
- MutationObserver 監聽 `<html>` class 變化（即時響應 toggle 按鈕）
- SSR 預設 light（避免 hydration mismatch）
- 從 tokens import 顏色（一致 §23 設計語言）
- AntD 元件 token 同 v0.12.0（Card / Tag / Button / Tabs / Alert / Statistic / Tooltip）

**layout.tsx 重構**：

- 移除靜態 ConfigProvider + App + MobileNav
- 改用 `<ThemeProvider>{children}</ThemeProvider>` 一行包覆
- 簡化 imports（拿掉 COLORS / FOREGROUND / zhTW）

### 與既有 dark mode（§23）整合

| 層                | 機制                                    |
| ----------------- | --------------------------------------- |
| **CSS variables** | `.dark` class 切換 globals.css tokens   |
| **AntD 元件**     | `algorithm: darkAlgorithm` 切換         |
| **localStorage**  | 單一 key `tw-car-claim-estimator:theme` |
| **DOM sync**      | MutationObserver 同步雙向               |

### verify

- pnpm tsc 0 錯
- pnpm test 791 tests 全綠
- pnpm test --coverage 90.77% 過 thresholds（90/85/90/90）
- pnpm build 16 routes 0 warning

### 風險與緩解

- 切換 dark mode 瞬間 AntD 元件會重新計算 token（可能 1 frame 閃爍）
- 影響：極小（MutationObserver 同步觸發，< 16ms）
- v0.13.x 之後可加 token transition CSS 平滑過場
