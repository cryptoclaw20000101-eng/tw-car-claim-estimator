# ADR 0003: 改採 serverful Next.js

## 狀態

已採用（v0.16.x 起）

## 背景

[ADR 0001](./0001-static-export.md) 原先選擇 static export，當時產品是沒有登入、API
與伺服器資料的純前端計算工具。後續產品已加入：

- Next.js API routes
- Cookie / Bearer token 驗證與使用者帳號
- PostgreSQL 儲存與雲端同步
- 管理與動態服務端路由

這些能力需要 Node.js runtime，已不符合 `output: "export"` 的限制。

## 決定

移除 `output: "export"`，使用 Next.js 標準 serverful build：

- 建置：`pnpm build`
- 啟動：`pnpm start`
- 部署產物：`.next/`，不再使用 `out/`
- 動態資料與個資 API 明確使用 `no-store`，不得依賴靜態頁面快取
- PWA Service Worker 只快取靜態資源；頁面、RSC、`/api/` 與 `/data/` 不作持久快取

## 後果

- ✅ API、驗證、資料庫及服務端安全標頭可在同一個 Next.js 應用運作
- ✅ 本機、CI 與 Lighthouse 都以 production server 驗證實際部署行為
- ✅ 不再需要為動態能力另接一套 Functions 架構
- ⚠️ 部署環境必須能長期執行 Node.js server
- ⚠️ 需要持續監控資料庫連線、環境變數及 runtime 錯誤
- ⚠️ 離線能力限於安全的靜態資源，不承諾離線提供過期估算頁面

## 驗證

- `next.config.ts` 不得設定 `output: "export"`
- CI 必須執行 production build
- Browser E2E 與 Lighthouse 必須透過 `pnpm start` 啟動應用

## 變更紀錄

- 2026-08-10 — 補齊 serverful 架構決策與部署契約
