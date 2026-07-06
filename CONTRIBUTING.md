# Contributing

感謝你想貢獻 tw-car-claim-estimator！本指南說明開發流程、commit 規範、PR 程序。

## 開發環境需求

- **Node.js**: 20.9+ （見 `.nvmrc`）
- **pnpm**: 10.33.2+（見 `packageManager` 欄位）
- **作業系統**: macOS / Linux / Windows（WSL）
- **瀏覽器**: Chromium（Playwright 自動安裝）

## 第一次設定

```bash
# 1. Clone + 安裝依賴
git clone <repo>
cd tw-car-claim-estimator
pnpm install

# 2. 啟動 dev server
pnpm dev
# → http://localhost:3000

# 3. 跑測試（確認環境 OK）
pnpm test
pnpm e2e
```

## 開發流程

### 1. 改之前先讀 AGENTS.md

`AGENTS.md` 是本專案的**單一真相源**：
- §0 專案定位 / §1 三條鐵律（永不改） / §6 紅線（不可接受的內容）
- §2 程式碼風格 / §3 測試規範 / §4 Git 流程
- §8-§19 業務邏輯章節（v0.5.0-v0.8.4）
- §20-§28 視覺/UX 重做 + 優化章節（v0.9.0-v0.12.0+）

**改之前一定要先讀對應章節**，避免違反紅線。

### 2. 分支策略

- `main` 是 production branch
- 從 `main` 切 feature branch：`git checkout -b feat/<scope>-<short-desc>`
- 範例：`feat/form-tooltip`、`fix/dark-mode-flicker`

### 3. Commit 規範

格式（AGENTS.md §4）：

```
<type>(<scope>): <subject>

<body>

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

**type**（commitlint enforced）：

| type | 用途 |
|---|---|
| `feat` | 新功能 |
| `fix` | 修 bug |
| `docs` | 純文件（README / AGENTS / CHANGELOG）|
| `style` | 格式（不影響邏輯，Prettier 統一）|
| `refactor` | 重構（不新功能也不修 bug）|
| `perf` | 效能優化 |
| `test` | 加測試 |
| `chore` | 雜事（build / deps / config）|

**scope**（從 commitlint.config.js 的 scope-enum 選）：

`seo` / `motion` / `visual` / `tokens` / `content` / `form` / `a11y` / `dx` / `workflow` / `theme` / `pwa` / `monitor` / `batch` / `cleanup` / `security`

**subject** 規則：
- 全小寫、無句點、最長 100 字元
- 範例：`feat(form): 表單 5 個關鍵欄位加 tooltip`

### 4. Husky + lint-staged 自動檢查

Commit 時自動跑：
- `pre-commit` → prettier 自動 format staged 檔案
- `commit-msg` → commitlint 驗證格式

如果 husky 阻擋，檢查 commit message 格式。

### 5. 跑測試

```bash
# Unit / Integration（Vitest）
pnpm test                # 跑 1 次
pnpm test:watch          # watch mode
pnpm test:coverage       # 含 coverage 報告

# E2E（Playwright）
pnpm e2e                 # headless
pnpm e2e:headed           # 看瀏覽器
pnpm e2e:ui              # UI mode

# Lint + Format
pnpm format              # 修全部
pnpm format:check        # CI 用（只檢查不修）
pnpm lint                # ESLint

# 效能
pnpm perf:audit          # HTML size + TTFB + DOM timing
```

### 6. 提 PR

```bash
# 1. 確認所有測試 + format + lint 都過
pnpm test && pnpm e2e && pnpm format:check && pnpm lint

# 2. 推上 origin
git push origin feat/<scope>-<short-desc>

# 3. 在 GitHub 開 PR
#    - title 跟 commit message 格式一樣
#    - 描述包含「為什麼做這個改動」+ 「改了什麼」+ 「verify 條件」
#    - 引用相關 AGENTS.md 章節
```

## 程式碼風格

詳見 AGENTS.md §2。幾個重點：

- **TypeScript strict mode** 已啟用（v0.13.x 加 2 個安全 flags）
- **零套件原則**：能 `node:fs` 解決就不要裝 `cheerio` / `axios`
- **AntD 6 deprecations**：避免 `valueStyle` / `Drawer width` 等
- **taste-skill v1**：避免 AI 預設設計（em-dash / Inter / AI 紫藍）

## 測試規範

詳見 AGENTS.md §3：

- 改 `lib/insurance/*`（計算引擎）**必須** 加測試
- 新增規則必先寫測試（TDD: RED → GREEN → REFACTOR）
- `pnpm test` 必須 0 錯
- `pnpm e2e` 必須 0 錯
- Coverage 不低於 90/85/90/90

## 紅線（不可接受的內容）

詳見 AGENTS.md §6。摘要：

- ❌ 未成年 / 兒少性影像
- ❌ 代拿官方證書
- ❌ 保戶案例脫敏失敗
- ❌ 憑空填值（法院代碼未知就標未知）
- ❌ 保險公司邏輯混入（精神慰撫金不進強制險）

## 提問

不確定的話：
1. 先查 AGENTS.md（90% 問題都有寫）
2. 再看 `__tests__/` 找類似測試
3. 開 issue 討論
4. 或聯絡維護者

---

謝謝貢獻！