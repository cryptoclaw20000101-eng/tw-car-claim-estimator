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
  pnpm test                            # 執行目前完整測試；歷史測試數不是驗收門檻
  pnpm build                           # 標準 serverful Next.js build（.next/）
  ```
- **新增規則必先寫測試** (TDD: RED → GREEN → REFACTOR) — 沒測試的改動 revert
- **scrape 改動必先 `--dry-run`** — `pnpm scrape:dry --chain <name> --retry 0` 看 stdout 確認 regex 沒爆掉

### 現行架構與歷史紀錄

- v0.16.x 起採標準 serverful Next.js；現行部署契約見 `docs/adr/0003-serverful-nextjs.md`。
- **歷史版本敘事已歸檔**到 `docs/AGENTS-HISTORY.md`（原 §8-§30，含每個引擎「當初為什麼這樣做」的決策理由）。AGENTS.md 只留現況事實 + 紅線 + 不變量。
- 現行安全與執行方式以程式碼、測試及 ADR 為準；整理工作目錄不等同發布 release，不自動新增 tag 或推送。

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

---

## §8 架構速查（引擎 / 元件 / 紅線）

> 這個專案有 20+ 個引擎與元件。以下是**現況速查** — 改任何一塊前先查這裡。
> 每段的「當初為什麼這樣做」決策理由歸檔在 `docs/AGENTS-HISTORY.md`（§8-§30 原版）。

### 8.1 精神慰撫金 ML 區間引擎

`lib/insurance/pain-ml.ts` — 三層：①啟發式 baseline（8 級 + 治療加成 + 地區係數）②歷史 anchor（`data/precedents/taipei-mental-distress.json` → P10/P50/P90）③fallback（anchor < 5 件走純啟發式）。
**不變量**：`lower ≤ mid ≤ upper`；地區係數 臺北 > 臺中 > 高雄；未知法院 → 1.0 不報錯；confidence high ≥20 / medium 10-19 / low <10 件。
**紅線**：ML 是**校驗層不是取代層**（規則引擎負責主要計算）。`reconcileWithRules`：agree ≤15% / minor_diverge 15-30% / diverge >30%。diverge + confidence=low → 警告降級。
**為什麼不用 XGBoost**：樣本集中在 minor_injury，傷勢梯度學不到；需律師手動補完 0 元資料才有意義。

### 8.2 KNN 相似判例推薦引擎

`lib/estimate/precedent-knn.ts` + `lib/estimate/precedents.ts`（`findRelatedPracticeCases`）。5 維特徵：city（二元/null=0.5）/ disability_level（|diff|/15）/ year（|diff|/26）/ injury_severity（ordinal）/ has_disability_record（二元）。
**不變量**：`distance(a,a)===0` / 對稱 / `>=0` / 5 維全極端 ≤5。
**為什麼 KNN 取代硬編配權**：硬編「縣市+10/等級+8/year+2」無法調整維度權重；KNN 每維正規化到 [0,1]，可解釋可測試。KNN 對 year 差 5 年懲罰 (0.19) ≈ 等級差 3 (0.20)，符合「近年案例參考價值高」。
**debug mode**：`computeDimensionDistances()` 回 5 維拆解；`findRelatedPracticeCases(..., withKnnDebug=true)` 回 `PracticeCaseWithKnn[]`（預設 false 向後相容）。UI = `components/KnnDebugPanel.tsx` + `components/Step4KnnPreview.tsx`（表單即時預覽，300ms debounce，純 client 0 網路成本）。

### 8.3 精神慰撫金 Ensemble 三票共識

`lib/insurance/pain-ensemble.ts` — 三票：🎯規則票（`computePainAndSuffering.regionalMid`）/ 📊ML票（`predictPainRange.p50`）/ 🔍KNN票（相似案 `civilSettlement` 平均）。
**共識度**：strong（三票差距 ≤20% → 加權平均）/ partial（兩票聚集一票 outlier）/ weak（三票分散 → 顯示區間+人工複核警示）/ insufficient（票數<2 → null + 補件）。
**權重**：rules 永遠 1.0 / ml 依 confidence（high 1.0, medium 0.7, low 0.4）/ knn 可用時 1.0。
**紅線**：三票是**三種不同推理路徑**（領域知識 / 統計推論 / 案例相似度），錯誤模式互補 — 不是同一模型重複投票。

### 8.4 LLM 理賠顧問複核

`lib/insurance/pain-advisor.ts`（純函式）+ `lib/insurance/advisor-api.ts`（async 真呼叫）+ `lib/insurance/advisor-config.ts`（config 驗證）+ `lib/insurance/advisor-cache.ts`（LRU+TTL）+ `app/api/advisor/route.ts`。
三純函式：`buildAdvisorPrompt(input)` / `parseAdvisorResponse(raw)` / `mockLLMAdvisor`。
**紅線**：`parseAdvisorResponse` 必須安全處理 malformed JSON（fallback medium）且永遠補 disclaimer。prompt 不得含身分證/車牌/手機號（`validatePromptForPII` 守衛）。`advisor-api.ts` 永不 throw — 回 `AdvisorApiResult{mode, advisor, fallbackReason, usage}`。
**Next 16 static export 紅線**：不接受 `dynamic='force-dynamic'`，靠 Next 預設 POST 不快取 + route 顯式 `cache-control: no-store` 雙保險。

### 8.5 法規版本切換（2026-07-01 強制險新舊法）

`lib/data-sources/regulation-cutoff.ts` + `lib/insurance/compulsory.ts` + `lib/insurance/disability-joint-mapping.ts` + `scripts/law-cutoff.ts`（CLI）。
**切換日**：2026-07-01（死亡/失能給付上限 200 萬 → 300 萬）。
**保守預設 = 新法**：`null`/`undefined`/`''` → 新法 300 萬；非標準格式（如 "2026/07/01"）→ 舊法（避免誤判）。`isNewLaw('2026-06-30')===false` / `isNewLaw('2026-07-01')===true`。
**wrapper 設計**：原函式一律不動（`calcMedicalMaterial` / `computeCompulsoryMedical` / `lookupUpperLimbLevel` 一行不改），全部用 `*ByDate` wrapper 切換 → 既有測試 0 修改全綠。
**CLI 用法**：`pnpm law-cutoff:build` 然後 `pnpm law-cutoff <date> [--rom N --joint lower --json]`。
**反 pattern**：不要 `import type`（nodenext 會讓 tsc 不 emit）；不要共用 scrape tsconfig（不同 CLI 需不同 module/outDir）；不要 emit 到 `lib/`。

### 8.6 失能初篩（真實強制險附表對照）

`lib/insurance/disability-joint-mapping.ts`（真實附表三大關節對照）+ `lib/insurance/joint-rom.ts`（ROM 細算）+ `lib/insurance/disability-standard.ts` + `lib/insurance/disability-tables.ts` + `lib/insurance/disability-categories.ts`（12 大類）+ `lib/insurance/scar-revision.ts` + `lib/insurance/disability-case-stats.ts`。
**三類分級**：喪失機能（1/1）/ 顯著運動障害（≥50%）/ 運動障害（≥33%）。
**優先序**：ROM 細算 > 手填（`index.ts` priority）。
**法律參考**：民國 115-05-29 修正、115-07-01 施行。PDF ground truth 在 `data/legal-sources/compulsory-disability-table-2026.pdf`。
**不變量**：等級必在 1-15 範圍內。

### 8.7 雲端持久化（Railway Postgres + 自寫 Auth）

`lib/db.ts`（pg Pool singleton）+ `lib/auth.ts`（JWT HS256 + bcrypt cost 10）+ `db/migrations/0001_init.sql` + `app/api/auth/*` + `app/api/estimates/*` + `components/AuthProvider.tsx`。
**紅線（build fail 級）**：

- ❌ **不要把 `pg` import 進 client component** — Next 16 build 把 server module bundle 進 client → `Element type is invalid` + production browser crash
- ❌ **不要把 `pg` import 進 `lib/estimate-storage.ts`** — 即使檔內有 `'use client'`，build 仍會 bundle 進 client
- ✅ **正解**：所有 pg 操作只在 `/api/*` serverful route 內跑；client 端 `lib/estimate-storage.ts` 是 fetch wrapper
- ❌ **不要在 query 內忘記 `WHERE user_id = $1`** — 沒 RLS 保護會洩漏所有資料
- ❌ **不要 commit `JWT_SECRET`** — `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- ❌ **不要在 API route 內 log 用戶密碼 / JWT**

### 8.8 監控（Sentry）+ 錯誤上報

`sentry.client.config.ts` + `sentry.server.config.ts` + `next.config.ts`（`withSentryConfig`）+ `app/api/errors/route.ts` + `app/error.tsx`。
**紅線**：

- ❌ **不要在 `captureMessage` / `captureException` 內傳 stack / 個資** — 避免 PII 上雲端
- ❌ **不要移除 `if (!process.env.SENTRY_DSN) return` 守護** — dev 走 console.error 而非 Sentry
- ❌ **不要把 `sentry.{client,server}.config.ts` 改成 `.js`** — Next 16 + Turbopack 只認 .ts
- ✅ `next.config.ts` 條件式 wrap + `sourcemaps.disable`（沒 `SENTRY_AUTH_TOKEN` 就跳過 upload）→ 本地 build 不 fail

### 8.9 PWA + 手機

`app/manifest.ts` + `public/sw.js` + `components/ServiceWorkerRegistrar.tsx`（dev 不註冊，避免 HMR）+ `components/InstallPWAButton.tsx`（iOS 走「分享→加主畫面」Modal）+ `components/MobileNav.tsx`（<768px 漢堡 Drawer）+ `components/MobileStickyCTA.tsx`（`position:sticky; bottom:0`）。
**不變量**：SSR 不 render `InstallPWAButton`（`platform=loading` 時 null，避免 hydration mismatch）；已安裝 → 自動隱藏。
**Next 16 manifest 陷阱**：`purpose` 是 union `'any' | 'maskable' | 'monochrome'` — **不接受空白分隔的 'any maskable'**。測試要 `expect(purpose).toBe('any')` 別用 `toMatch`。
**AntD 6 Skeleton bug**：Next 16 Turbopack SSR 會炸 `Element type is invalid` → 用自製 `components/Skeleton.tsx`（純 Tailwind div + `animate-pulse`，client mount 後才跑 pulse）。

### 8.10 SEO + Design Tokens

`app/sitemap.ts`（只 `/` indexable，`/claims/*` robots:noindex）+ `app/robots.ts` + `app/opengraph-image.tsx` + `app/twitter-image.tsx` + `app/apple-icon.tsx` + `lib/design/tokens.ts`（COLORS/ACCENT runtime 單一來源）。
**紅線**：`app/layout.tsx` 的 `metadataBase` 不設 → OG image 變 localhost fallback。`#be123c` 硬編只能存在 `lib/design/tokens.ts` 一處。

### 8.11 動畫 + 視覺

framer-motion 進場動畫（`components/InfoAlert.tsx` / `components/MobileNav.tsx` / `components/InstallPWAButton.tsx` / `components/EnsembleHealthHeroCard.tsx` / `components/KnnDebugPanel.tsx` / `components/Step4KnnPreview.tsx` / `components/StepShell.tsx` / `app/_components/HomeClient.tsx` / 結果頁 Tabs）。
**紅線**：所有 motion 必須 honor `prefers-reduced-motion`（`useReducedMotion`）；測試守護的 SSR HTML 結構（emoji / testid / labels）不能變。
`components/ThemeProvider.tsx` 用 AntD 動態 algorithm 切換 dark mode。

### 8.12 資料與報表

`scripts/scrape-judgments.ts`（司法院爬蟲，零套件）+ `scripts/report-precedents.js` + `scripts/rebuild-hero.sh`。
`pnpm report:build` / `report:precedents` / `report:rebuild-hero` / `report:all`。
**紅線**：不擅自填法院代碼（`(未知代碼)` 標記）；scrape 改動必先 `--dry-run`；4xx 不重試 / 5xx+TypeError 重試 3 次。

### 8.13 步驟殼層 + 表單

`components/StepShell.tsx`（共用 step 殼層：accent 左邊條 + stepNumber badge + 淡入）+ `app/claims/new/_steps/*`。
`useDebouncedValue`（自製 300ms，避免 lodash 依賴）。

---

## §9 雲端持久化（Railway Postgres + 自寫 Auth）

> **檔案**：`lib/db.ts` + `lib/auth.ts` + `db/migrations/0001_init.sql` + `app/api/auth/*` + `app/api/estimates/*` + `components/AuthProvider.tsx` + `app/login/_form.tsx`
> **部署契約**：見 `docs/adr/0003-serverful-nextjs.md`（v0.16.x 起採標準 serverful Next.js）

### 架構

| 層     | 元件                           | 職責                    |
| ------ | ------------------------------ | ----------------------- |
| DB     | Railway Postgres（`pgcrypto`） | users + estimates table |
| ORM    | 純 SQL（`pg` Pool）            | 沒 ORM 依賴             |
| Auth   | 自寫 JWT + bcrypt              | 取代 Supabase Auth      |
| Client | `fetch('/api/...')`            | 取代 Supabase client    |
| Cookie | httpOnly + SameSite=lax        | 7 天有效                |

### API routes

| Method | Path                  | 用途                                        |
| ------ | --------------------- | ------------------------------------------- |
| POST   | `/api/auth/signup`    | 註冊 + bcrypt hash + 設 JWT cookie          |
| POST   | `/api/auth/signin`    | 登入 + 驗密碼 + 設 JWT cookie               |
| POST   | `/api/auth/signout`   | 清 cookie                                   |
| GET    | `/api/auth/me`        | 查當前 user（cookie JWT 解析）              |
| GET    | `/api/estimates`      | 列出 user 估算（limit 20, created_at DESC） |
| POST   | `/api/estimates`      | 儲存估算                                    |
| DELETE | `/api/estimates/[id]` | 刪單筆                                      |

### 不變量 + 紅線

- **app-level filter 取代 RLS**：每個 query 加 `WHERE user_id = $1`（`lib/auth.ts` `getUserFromRequest` 解析 JWT → 傳入 query）
- **bcrypt cost 10**（~100ms/hash）· **JWT HS256 + 7 天有效** · **密碼至少 8 字符**
- ❌ **不要把 `pg` import 進 client component** — Next 16 build 把 server module bundle 進 client → `Element type is invalid` + production browser crash
  - ✅ **正解**：所有 pg 操作放 `/api/*` route 內，client 用 `fetch`
- ❌ **不要把 `pg` import 進 `lib/estimate-storage.ts`** — 即使在 `'use client'` 檔內，Next.js build 仍會把它 bundle 進 client
  - ✅ **正解**：`lib/estimate-storage.ts` 改 fetch wrapper
- ❌ **不要在 query 內忘記加 `WHERE user_id = $1`** — 沒 RLS 保護，所有資料都會洩漏
- ❌ **不要把 `JWT_SECRET` commit 到 git** — `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- ❌ **不要在 production 用 `bcrypt cost < 10`** — 太低會被暴力破解
- ❌ **不要在 API route 內 log 用戶密碼 / JWT** — 即使 debug 也不要

### 環境變數（Railway）

- `DATABASE_URL` — Postgres 連線字串（Railway 自動注入）
- `JWT_SECRET` — 隨機 96 hex
- `NEXT_PUBLIC_SITE_URL` — production URL（已設）
- 舊的 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `ANTHROPIC_API_KEY` / `ANTHROPIC_BASE_URL` — **不再需要**

### Dockerfile

```dockerfile
FROM node:24-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"
CMD ["pnpm", "start"]
```

---

## §10 監控（Sentry 整合）

> **檔案**：`sentry.client.config.ts` + `sentry.server.config.ts` + `next.config.ts` + `app/api/errors/route.ts` + `app/error.tsx` + `.env.example`
> **套件**：`@sentry/nextjs ^10.65.0`

### 4 層 wire-up

1. **`sentry.client.config.ts`** — 讀 `NEXT_PUBLIC_SENTRY_DSN`，沒設則不 init（SDK no-op）；`tracesSampleRate: 0.1`；`browserTracingIntegration()` 自動接 Web Vitals
2. **`sentry.server.config.ts`** — 讀 `SENTRY_DSN`，同上條件式 init；`tracesSampleRate: 0.1`
3. **`next.config.ts`** — `withSentryConfig` 條件式 wrap（`SENTRY_DSN` 有設才 wrap；沒 `SENTRY_AUTH_TOKEN` 就靜默 + `sourcemaps.disable`）→ 本地 build 不 fail
4. **runtime 接點** — `app/api/errors/route.ts`（POST → console.error + `Sentry.captureMessage`，level=error + tags+extra）；`app/error.tsx`（`useEffect` 內 `Sentry.captureException(error, { tags: { digest } })`）

### 環境變數

| 變數                     | 必要 | 用途                                     |
| ------------------------ | ---- | ---------------------------------------- |
| `SENTRY_DSN`             | 是   | Server-side error 上報 DSN               |
| `NEXT_PUBLIC_SENTRY_DSN` | 是   | Client-side error 上報 DSN               |
| `SENTRY_ORG`             | 選填 | Sentry org slug（source map upload）     |
| `SENTRY_PROJECT`         | 選填 | Sentry project slug（source map upload） |
| `SENTRY_AUTH_TOKEN`      | 選填 | Sentry API token（CI / production only） |

不設任一 DSN → Sentry 完全不啟動；只設 DSN 沒設 token → runtime 監控運作但 build 不上傳 source map。

### 紅線

- ❌ **不要在 `Sentry.captureMessage` / `captureException` 內傳 stack / 個資** — 避免 PII 上雲端
- ❌ **不要移除 `if (!process.env.SENTRY_DSN) return` 守護** — dev 環境應走 console.error 而非 Sentry
- ❌ **不要把 `sentry.{client,server}.config.ts` 改成 `.js`** — Next.js 16 + Turbopack 只認 .ts 自動載入
- ❌ **不要在 CI 之外設 `SENTRY_AUTH_TOKEN`** — 避免 local dev 意外上傳

---

<!-- trail:start -->

## Trail — repo context graph

This repo is indexed in `.trail/cache/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `trail map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `trail ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `trail grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `trail skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `trail callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `.trail/cache/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `trail ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `trail build` (deterministic,
no API key, $0).
<!-- trail:end -->
