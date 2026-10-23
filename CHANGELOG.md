# Changelog

所有重要變更都會記錄於此檔。格式基於 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)。

## [v0.28.8] - 2026-10-23

### Added

- `/claims/vehicle-damage`：分開輸入零件、工資及烤漆費，試算零件折舊；支援汽車／機車、草稿與列印。
- 匿名填表事件 API、管理員近七天完成率儀表板與 `0005_journey_events.sql`。
- 草稿還原、事件傳送及純車損總額回歸測試。

### Changed

- 事故與肇責合併：受傷四步／未受傷兩步，按需展開收入、住院、看護與失能資料。
- 送出前核對摘要，結果頁可直接跳到補件與載入本次案件修改。
- 請假與扣薪證明獨立保存；看護日數只填一次並相容舊草稿。
- 未知事故前車價時，車損回傳待估並明示尚未列入小計。
- 完整表單及車損試算的本機草稿可於七天內還原；瀏覽器返回不再被攔截。
- 傷勢進階欄位收合、結果頁手機排版及隱私說明同步更新。

### Fixed

- 表單切換步驟後遺失「未受傷」狀態，導致醫療欄位重新出現。
- 歷史人傷案件改為未受傷時，第三人民事總額仍計入舊人傷資料。
- 草稿還原時機、舊草稿缺欄位與 section 淺合併造成資料遺失。
- 統計事件重複傳送造訪；網路或 HTTP 錯誤後可於下次操作重試。

### Validation

- TypeScript、完整 lint、正式建置、1,045 項單元測試及覆蓋率門檻通過。
- 27 項瀏覽器業務流程經修正重跑通過；手機 390px 無橫向溢出。
- 隔離 PostgreSQL migration、去重、保留期及權限整合已通過；正式環境仍須核對 migration。
- 正式發布進度以交付紀錄為準。

### Deployment

- 已部署至既有 Railway production，部署 `73b8bfb3-4f00-4a3a-9ae0-57eb42fcdfc4` 成功。
- 正式站兩步／四步流程、待估與補車價重算、手機版面、未登入 API 權限驗收通過；五個 migrations 執行成功。
- PR #1 已合併至 main；CI、Browser E2E 與 Lighthouse 均通過。

## [v0.19.0] - 2026-07-13

### Added

- **診斷書 AI 推論失能等級**（rule-based parser，零套件依賴）：貼中文診斷書全文
  → 自動萃取傷勢類型 / 關節 / ROM / 視力 / 聽力 → 對照強制險失能給付標準 §4 → 給建議
  等級 + reasoning trace + confidence。新檔 lib/insurance/diagnosis-parser.ts +
  21 個 unit test（**tests**/insurance/diagnosis-parser.test.ts）。
  Step4 加 UI：AI 推薦按鈕 + 結果面板（建議等級 / 信心度 / 需人工複核 / 採用建議 /
  推理過程 / disclaimer）。

### Changed

- **表單 7 步 → 4 步重構**：依用戶指定結構
  1. 事故基本（日期/地點/類型）
  2. 肇責
  3. 人身 / 工作（合併原 Step3 + Step7 聲請人/對方居住地 + 法院）
  4. 診斷書（合併原 Step4 + Step5 醫療收據 15 細項 + Step6 車損/財損）
- FormProgress 動態 gridTemplateColumns（從 hardcode grid-cols-7 改 N 步通用）

### Fixed

- 深色模式 InfoAlert 文字看不見：.ant-alert 全域 !important 覆蓋背景但 description
  文字顏色沒跟著 dark mode 調。加 .dark .ant-alert 明確覆寫：
  message color → --foreground / description color → --muted / icon color → --accent

## [v0.18.0] - 2026-07-13

### Added

- 精神慰撫金 **8 級 → 15 級** 細分（擦挫 / 疤 / 骨折 / 韌帶 / 神經 / 脊椎 / 失能）
- **Personal Factors multiplier**（民法 §195 酌定因子）：
  - 年齡（13/18/30/65 切 4 段：0.9-1.3x）
  - 職業（10 類：0.85-1.3x）
  - 扶養人數（1/2-3/4+：1.05-1.25x）
  - 勞動力減損（1.3x）
- `pas-table.ts` 共用模組（pain-ml.ts + civil-damages.ts 都 import）
- 738 件 precedents 萃取 (severity × region) brackets：death_north N=12 / minor_north N=48 / minor_central N=24
- 19 件家事件清理（從 precedents JSON 移除）
- **下載 PDF 限定會員**（估算本身開放所有訪客）
- **PDF 浮水印**「信安保經小鄭製作」每頁重複（淺灰對角線 -30°）
- 「信安保經小鄭製作」簽名（footer + PDF 封面）
- 註冊加「再次輸入密碼」確認欄位
- 表單 Enter 鍵自動進下一步 / 最後一步 = 送出
- PDF 按鈕未登入顯示「下載 PDF（需登入）」
- `lib/api-security.ts`：CSRF (Origin) + rate limit (60 req/min/IP) 守護
- 表單 field-level 即時驗證（`validateTrigger=['onBlur', 'onChange']`）
- Result page 8 個 section 改 `next/dynamic` 載入（每 section 獨立 chunk）
- Result page Tabs `destroyOnHidden` + sessionStorage v2 版本檢查 + 1 小時過期
- PDF 12/13 內容測試通過（cover / TCE 編號 / NT$ 金額 / 免責 / 強制險 / 失能 / 第三人 / 精神慰撫金 / 頁碼 / 法院 / 版本）
- `docs/precedents-reference.md` 715+ 件 precedents 整理（各鏈分布 / 失能/勞減焦點）

### Fixed

- `loadAnchorCases` 欄位名 bug（`mentalDistressAmount` → `amount`）：13 件 anchor 全部沒讀到的問題修了
- 5 年 filter bug（`if (yearInt < 2021)` 比西元 2021 對民國年 110-115 永 reject）：改用 env `SCRAPE_YEAR_MIN` 預設 108 民國
- scrape-judgments.ts IP-block 強烈（司法院 QPS）：新 `scrape-cloud.ts` 加 fetch 30s AbortController
- `MultiFaultCompare` 對 null 呼叫 toLocaleString crash：加 `?? 0` / optional chaining 守護
- 深色模式多處 `text-gray-500` / `text-zinc-500` / `--muted` zinc-400 對比不足：升 zinc-300 (11:1)
- 深色模式 `!bg-white` 反白（KnnDebugPanel）+ 4 處淺色背景：改 `!bg-surface` / dark variant
- 19 件家事件（家親聲 / 家聲抗 / 家繼簡）誤混入民事 precedents
- sessionStorage v1 → v2 升級時舊版資料 crash：版本戳 + 過期檢查
- `Result: null` 導致結果頁 error boundary：加防護
- tsc bleed-over 清理：刪除 untracked `scripts/scripts/scrape-cloud.js` + `scripts/scripts/import-cjcourt.js`；reset `scripts/lib/insurance/types.js` uncommitted Prettier diff
- `.gitignore` 加 `/scripts/scripts/` 與 `/scripts/lib/` 防未來 tsc rebuild 把 bleed-over 加進 git

## [Unreleased]

（v0.19.0 已發布，後續工作項目另開 issue tracker）

## [v0.8.4] - 2026-07-01

### Added

- 法規切換 CLI 工具（pnpm law-cutoff）
- 強制險新/舊法依事故日自動切換（2026-07-01 上路）
- LawVersionBadge UI 標籤（v0.8.3）
- MobileStickyCTA + 表單 input 優化（v0.8.1）
- PWA 安裝引導 + 手機專屬導覽 + safe-area + 拇按友善（v0.8.0）
- 精神慰撫金 ML 區間引擎 + Ensemble 三票共識（v0.6.0-v0.6.2）
- LLM 理賠顧問 mock（v0.6.3）
- KNN 相似判例推薦（v0.6.1+）

## [v0.5.7] - 2026-06-22

### Added

- 衝量資料增量 +118 件
- StepShell 共用元件重構
- 拆第三人 Bug A 測試到獨立檔

## [v0.5.0] - 2026-05-15

### Added

- 6 大核心引擎（強制 / 失能 / 民事 / 第三人 / 補件 / 地區）
- 3 個資料來源（foi.org.tw / 司法院 / 法務部法規）
- iPAS AI 應用規劃師備考練習

---

## 版本規範

格式：`v<major>.<minor>.<patch>`，依 AGENTS.md §4 規範：

- 每次 `feat:` commit 前必須 bump version
- 重大重構 → bump minor
- 修 bug → bump patch
