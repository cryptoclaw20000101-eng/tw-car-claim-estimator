# ADR 0001: 採用 Next.js static export

## 狀態

已採用（v0.5.0+）

## 背景

tw-car-claim-estimator 是車禍理賠估算工具，使用情境：

- 業務員用手機 / 桌機查詢
- 偶爾網路不穩（車行現場、客戶家）
- 必須極速載入（使用者耐心 < 3s）
- 不需要登入（純計算工具）
- 預算有限（個人 / 業餘專案）

## 選項

### A. Next.js SSR（Node.js server）

- 優：動態內容、API routes、ISR
- 缺：要長期運行的 server、成本高

### B. Next.js static export（output: "export"）

- 優：CDN 友善、零 server 成本、秒開
- 缺：不能用 API routes 動態內容、不能用 cookies

### C. 純 SPA（Vite + React Router）

- 優：開發簡單
- 缺：SEO 差、首次載入慢、無 SSR

## 決定

**選 B（Next.js static export）**

理由：

- 純計算工具，沒用戶資料 → 不需要 server-side session
- 業務員手機網路不穩 → 邊緣快取是必須
- Vercel Edge CDN 免費 hosting 適合個人專案
- 16 個靜態 route 部署即可，無運維成本

## 後果

- ✅ 部署簡單：`pnpm build` → 上傳 `out/` 資料夾
- ✅ 極速載入：CDN 邊緣 + Service Worker 快取（v0.13.x）
- ✅ SEO 友善：sitemap / robots / OG image 自動生成（v0.9.0+）
- ⚠️ LLM Advisor 必須做 mock（v0.6.3+），無法串真實 LLM API
- ⚠️ 不能用 cookies 持久化狀態，改用 localStorage（v0.12.0+ Phase B3）
- ⚠️ 動態 API 需用 Vercel Functions（v0.7.0+ §13 部署矩陣）

## 替代方案

若未來需要真實 LLM API 串接，可：

1. 改用 Vercel Functions（partial SSR，v0.7.0+ 已設計）
2. 切到 Tauri 桌面版（已有 v0.5.0+ 殼，純前端運算）
3. 維持 mock 但接 Sentry / 第三方錯誤追蹤（v0.13.x 已 scaffold）

## 變更紀錄

- 2026-05-15 — 採用 Next.js static export（v0.5.0）
- 2026-07-03 — 加 SEO / metadata / per-page OG（v0.9.0+）
- 2026-07-06 — 加 Service Worker 進階快取（v0.13.x）
