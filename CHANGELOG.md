# Changelog

所有重要變更都會記錄於此檔。格式基於 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)。

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

### Added

- v0.13.x — 完整 GitHub Actions CI（lint + typecheck + test + build + e2e）
- v0.13.x — vercel.json 部署配置（cache headers + redirect + HSTS + Service-Worker-Allowed）
- v0.13.x — Playwright E2E 14 場景（home / navigation / business flow）
- v0.13.x — Web Vitals 上報（LCP/CLS/INP/FCP/TTFB）+ Sentry-style ErrorTracker scaffold
- v0.13.x — Service Worker 進階快取（HTML stale-while-revalidate + 靜態資源 TTL）
- v0.13.x — ThemeProvider 動態切換 AntD darkAlgorithm
- v0.12.0+ — Phase A-E 優化（25+ 項：文案 / 表單 / A11y / DX / 業務員）
- v0.12.0 — Token consolidation（#be123c 4 處硬編 → tokens.ts 單一來源）
- v0.11.0 — Hero 右側重排 + 結果頁 Stat 主視覺 + 自製 Skeleton
- v0.10.0 — framer-motion polish + 7 個 B→A 元件升級
- v0.9.0 — SEO baseline + page metadata + design tokens 模組

### Changed

- v0.13.x — 統一 Prettier 格式（154 個檔）
- v0.12.0+ — AntD Drawer width → size 棄用修正
- v0.12.0+ — TypeScript strict 加 2 個安全 flags（noImplicitOverride + noFallthroughCasesInSwitch）

### Fixed

- v0.13.x — AntD Drawer runtime deprecation warning
- v0.12.0+ — `var(--font-geist-sans)` dead ref → `var(--font-body)`
- v0.12.0+ — 移除 dev console.log

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
