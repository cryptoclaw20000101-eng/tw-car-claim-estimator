# Changelog

所有重要變更都會記錄於此檔。格式基於 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)。

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