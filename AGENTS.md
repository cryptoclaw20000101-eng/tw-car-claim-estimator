<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# tw-car-claim-estimator — 專案層級規則

> **適用對象**: 在本專案執行任務的所有 AI agent (Claude / Codex / Hermes / 其他)
> **生效版本**: v0.6.1 (2026-06-19)
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

### 2.4 Next.js 16 特別注意

- **App Router 必用 React canary** — 不可用 `import` 整包 React 19 hooks，要讓 Next 16 自己控
- **`route.ts` 必 client runtime** — AntD Form / Table 依賴 client React context
- **去查 `node_modules/next/dist/docs/` 再寫** — 04-glossary.md 有完整術語表，03-architecture 解釋 server/client boundary
- **dev server LAN 訪問需 `allowedDevOrigins`** — Next.js 16 dev server 預設只允 localhost，從 LAN IP 連會被 HMR/webpack-hmr 擋；要在 `next.config.ts` 加 `allowedDevOrigins: ['192.168.1.X', ...]`，否則手機開 http://<IP>:3001 會 cross-origin error
- **AntD DatePicker 不能從 Form `initialValues` 餵字串** — rc-picker 的 `dayjs.js:95-99` 對非 dayjs 物件直接 `return value`，後續 `value.isValid()` 在字串上炸。Form schema 是 string，但 DatePicker 需要 dayjs 物件。**正解**: mount 時 `useEffect` 用 `setFieldsValue({ field: dayjs() } as any)` 注入 dayjs 物件（不能用 `defaultValue`，Form.Item 控制下無效且觸發警告）

---

## §3 測試 / 驗證鐵律

- **改任何 lib/insurance 必跑**:
  ```bash
  pnpm tsc --noEmit                    # 0 錯
  pnpm test                            # 33 檔 / 348 測試全綠（v0.6.1 期待值）
  pnpm build                           # 5 routes 靜態 build 全綠
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

### v0.6.2+ 規劃
- injury_severity 從 practiceCase 萃取（目前都是 null，未來律師補資料）
- 動態權重：根據 query 自動調整（例如 query 是失能案件 → 等級權重 ×2）
- 報表呈現「為什麼這個案例被推薦」（debug mode）
