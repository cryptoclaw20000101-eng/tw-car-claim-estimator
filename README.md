# 台灣車禍理賠金額估算器（tw-car-claim-estimator）

> **iPAS AI 應用規劃師**備考練習作品 — 一個把法律條文 + 醫療規則 + 地區實務**即時運算**成理賠預估金額的小工具。

---

## 這個專案在做什麼

車禍發生後，受害人常見的困擾是：

- **強制險**到底能賠我多少？
- **失能**是幾級？能拿多少？
- **民事賠償**（醫療差額、看護、精神慰撫金、工作損失、勞動能力減損）對方要賠多少？
- **第三人責任險**買夠了沒？**肇責比例**怎麼影響可拿到的錢？
- 我住在**台中**，法院在這裡會判多少？跟台北差多少？
- 我還缺哪些**文件**？哪些**風險**要先處理？

這個工具把上述問題用**前端即時計算**的方式一次回答，並附上**法源依據**與**同類法院判決/評議案例**作為佐證。

### 6 大核心引擎

| 引擎 | 用途 | 主要法源 |
| --- | --- | --- |
| 強制險醫療 | 20 個醫療項目逐項核對，總額 20 萬 cap | 強制汽車責任保險法 §27、給付標準 §2 |
| 失能初篩 | 4 級（A/B/C/D）分級 + 14 級失能金額推算 | 強制汽車責任保險給付標準 §4 附表 |
| 民事損害賠償 | 醫療差額、看護（地區係數）、精神慰撫金、工作損失、勞動能力減損 | 民法 §184-196 |
| 第三人責任險 | 體傷/財損/超額三層保額配置，肇責比例分攤 | 保險法 §65、保單條款示範 |
| 補件與風險 | 缺文件警示、訴訟風險提醒、證據強度評等 | 民事訴訟法 §277 |
| 地區差異 | 6 法院（北/中/南/高/花/宜）精神慰撫金 0.95~1.10 係數 + 看護日額 1,200/1,500/2,000 元 | 實務統計 |

### 3 個資料來源（MVP 全 mock，不接真 API）

| 來源 | 真實位置 | 用途 |
| --- | --- | --- |
| 財團法人汽車交通事故特別補償基金 | [foi.org.tw](https://www.foi.org.tw) | 6 大爭議類型（因果關係/必要性醫療/失能/看護/工作損失/強制險競合）評議案例 |
| 司法院判決書 | [judicial.gov.tw](https://www.judicial.gov.tw) | 6 法院 12 個區間中位數賠償金額 + 6 件代表性判決 |
| 法務部全國法規資料庫 | [law.moj.gov.tw](https://law.moj.gov.tw) | 6 部核心法源（強保法/民法 184-196/民訴法 277/保險法 65）+ 定期更新偵測 |

> MVP 階段全部使用 mock 資料（已寫入 `lib/data-sources/`），但介面已設計成未來可無痛切換真 API。詳見 [SPEC §十一](https://github.com/)：MVP 不接真 API。

---

## 快速啟動

```bash
# 1. 安裝依賴
pnpm install

# 2. 跑測試（62 個檔案、760 個測試）
pnpm test

# 3. 啟動開發伺服器（http://localhost:3000）
pnpm dev

# 4. 型別檢查 + 生產建置
pnpm tsc --noEmit
pnpm build
```

> 需要 Node.js 20+ 與 pnpm 10+。
>
> **v0.9.0+ 重要更新**：專案已從純 SPA 升級到 SEO 友善版（sitemap / robots / OG image / Twitter card / apple-icon 全部自動生成）。production build 產出 13 個靜態 routes。

---

## 使用流程

1. 開首頁 → 按「開始估算」
2. 走 7 步表單（事故基本/肇責比例/人身/診斷/醫療收據/車損財損/地區）
3. 結果頁用 **Tabs** 切換 7 區：
   - **強制險**：醫療 20 項細目 + 失能等級 + 死亡（MVP 不處理）
   - **失能初篩**：A/B/C/D 評等 + 14 級失能金額表
   - **民事賠償**：5 大項（醫療差額/看護/工作損失/勞動能力/精神慰撫金）
   - **第三人責任險**：體傷/財損/超額三層試算
   - **補件與風險**：缺文件清單 + 風險提醒 + 證據強度
   - **地區實務**：自動帶出對應法院 + 當地實務係數
   - **法源依據**：每筆金額引用的法條 + URL（標註最後檢視日，> 365 天自動警示）
4. **列印**或**截圖**保存（暫無匯出 PDF，可在瀏覽器列印 → 存 PDF）

---

## 估算規則速覽

| 項目 | 規則 |
| --- | --- |
| 強制險醫療 | 20 萬 cap，超過不賠；20 項逐項核對 |
| 看護費 | 1,200 ~ 2,000 元/日 × 住院天數（30 日硬上限），出院後需另附醫囑 |
| 精神慰撫金 | 6 法院係數 0.95 ~ 1.10 × 基礎額（依傷殘等級） |
| 工作損失 | 需附 6 個月薪資證明；無證明者按基本工資 |
| 勞動能力減損 | 14 級失能等級 × 計算公式（含霍夫曼係數） |
| 肇責比例 | 雙方各 100% 分擔，例：對方 70% 肇事，民事可求償 70% |
| 地區自動帶法院 | 依事故地城市自動帶對應地方法院，可手改 |

---

## 專案結構

```
tw-car-claim-estimator/
├── app/                          # Next.js 16 App Router
│   ├── layout.tsx                # AntdRegistry + ConfigProvider + viewport + metadataBase
│   ├── page.tsx                  # 首頁 server component + metadata
│   ├── _components/              # 私人 server-only client components（_ prefix 資料夾不路由）
│   │   └── HomeClient.tsx        # 首頁實際 UI（motion + bento + scroll reveal）
│   ├── sitemap.ts                # v0.9.0+ MetadataRoute.Sitemap
│   ├── robots.ts                 # v0.9.0+ MetadataRoute.Robots
│   ├── opengraph-image.tsx       # v0.9.0+ 1200×630 ImageResponse
│   ├── twitter-image.tsx         # v0.9.0+ 1200×630 summary_large_image
│   ├── apple-icon.tsx            # v0.9.0+ 180×180 自動生成
│   ├── manifest.ts               # PWA manifest（v0.12.0+ import tokens）
│   ├── loading.tsx               # v0.11.0+ 自製 Skeleton（取代 AntD Skeleton）
│   ├── error.tsx                 # 全站 Error Boundary
│   ├── not-found.tsx             # 404
│   └── claims/
│       ├── new/                  # 估算表單（7 步 Steps）
│       │   ├── page.tsx          # server shell + metadata
│       │   └── _form.tsx         # client 表單本體（AntD Form + StepShell）
│       └── result/               # 結果頁（7 區 Tabs）
│           ├── page.tsx          # server shell + metadata
│           ├── _result-client.tsx # v0.9.0+ client wrapper（ssr:false dynamic）
│           └── _form.tsx         # client 結果頁（Tabs + 8 區段）
├── components/                   # 共用元件（v0.10.0+ 大多有 framer-motion）
│   ├── PainEnsembleCard.tsx      # A 級：精神慰撫金三票共識 UI
│   ├── EnsembleHealthHeroCard.tsx # A 級：首頁 hero 健康度卡
│   ├── KnnDebugPanel.tsx         # A 級：KNN 5 維拆解
│   ├── StepShell.tsx             # B→A：v0.10.0+ 加 accent 左邊條 + Step badge
│   ├── MobileNav.tsx             # B→A：v0.10.0+ active underline motion
│   ├── InstallPWAButton.tsx      # B→A：v0.10.0+ 自製 iOS SVG illustration
│   ├── Step4KnnPreview.tsx       # B→A：v0.10.0+ motion fade-in
│   ├── InfoAlert.tsx             # B→A：v0.10.0+ 加 closable / onClose
│   ├── LawVersionBadge.tsx       # 強制險新/舊法標籤
│   ├── MobileStickyCTA.tsx       # 手機底部固定按鈕
│   ├── ServiceWorkerRegistrar.tsx # PWA service worker 註冊
│   └── Skeleton.tsx              # v0.11.0+ 自製 branded skeleton
├── lib/
│   ├── insurance/                # 計算引擎（AGENTS §1 鐵律保護，不可改語意）
│   │   ├── compulsory.ts         # 強制險醫療
│   │   ├── disability.ts         # 失能初篩
│   │   ├── civil-damages.ts      # 民事 5 大項
│   │   ├── third-party.ts        # 第三人責任險
│   │   ├── evidence.ts           # 補件與風險
│   │   ├── region-adjustments.ts # 6 法院係數
│   │   ├── region-court-map.ts   # 城市→法院對照
│   │   ├── joint-rom.ts          # 關節活動度規則
│   │   ├── disability-tables.ts  # 14 級失能金額表
│   │   ├── pain-ml.ts            # §8 精神慰撫金 ML
│   │   ├── pain-ensemble.ts      # §10 三票共識
│   │   ├── pain-advisor.ts       # §11 LLM 顧問 mock
│   │   ├── pain-ensemble-health.ts # §12 健康度計算
│   │   ├── advisor-cache.ts      # §14 LRU+TTL 快取
│   │   ├── regulation-cutoff.ts  # §17 依事故日切換
│   │   ├── disability-joint-mapping.ts # §17 失能等級映射
│   │   ├── types.ts              # 全部型別定義
│   │   └── index.ts              # 統一對外 API: estimateClaim()
│   ├── estimate/                 # KNN + precedents（§9）
│   ├── data-sources/             # 外部資料來源（mock）
│   ├── legal/                    # §17 法規版本表
│   ├── types/                    # 共用型別
│   └── design/
│       └── tokens.ts             # v0.12.0+ 設計 tokens 單一來源
├── data/
│   └── precedents/               # 司法院 / 金融評議案例 JSON（build-time 內嵌）
├── __tests__/                    # Vitest 4 測試
│   ├── insurance/                # 計算引擎測試
│   ├── estimate/                 # KNN + precedent 測試
│   ├── data-sources/             # 資料來源測試
│   ├── components/               # 元件 SSR HTML 守護
│   ├── api/                      # API route 測試
│   ├── scripts/                  # CLI 工具測試
│   ├── pwa/                      # PWA / service worker 測試
│   └── scrape/                   # scrape 結構性測試
├── scripts/                      # CLI 工具（§19 law-cutoff 等）
├── package.json                  # v0.12.0
├── tsconfig.json
├── next.config.ts                # output: "export" 靜態 export
└── vitest.config.ts
```

---

## 如何換色（v0.12.0+ single source of truth）

v0.9.0 之後把 `#be123c` 等硬編從 4 處收斂到 `lib/design/tokens.ts` + `app/globals.css` 兩處。要改主色（例如從 rose-700 換到 blue-700）只需動 2 個檔：

### Step 1：改 TS runtime token

`lib/design/tokens.ts` 裡的 `COLORS.accent`（影響 AntD ConfigProvider + manifest + viewport）：

```ts
export const COLORS = {
  accent: '#1d4ed8', // blue-700（從 rose-700 換到 blue-700）
  // ... 其他顏色
}
```

### Step 2：改 CSS runtime token

`app/globals.css` 裡的 `:root --accent`（影響 Tailwind + 所有 CSS var 使用處）：

```css
:root {
  --accent: #1d4ed8; /* blue-700 */
  --accent-soft: #dbeafe; /* blue-100 */
  /* ... 其他顏色 */
}
```

### Step 3：重新 build

```bash
pnpm tsc --noEmit   # 確保型別沒漂
pnpm test           # 確保 760 tests 沒漂
pnpm build          # 重新產生靜態檔
```

### 為什麼是 2 處不是 1 處？

| 層 | 檔案 | 影響 |
|---|---|---|
| **TS runtime** | `lib/design/tokens.ts` | AntD ConfigProvider（runtime React 元件）|
| **CSS runtime** | `app/globals.css` | Tailwind utilities（透過 `@theme inline`）|

AntD React 元件不能直接吃 CSS var（會破壞 inline style + 主題計算），所以需要 TS runtime 同步。換色時兩個檔必須一起改，否則 TS 改 blue 但 CSS 還是 rose → 視覺漂移。

> **未來自動化（v0.12.x 規劃）**：加一個 CI script 比對 `tokens.ts` 跟 `globals.css` 的硬編值，跑 `pnpm build` 時若漂移就 build fail。

---

## 技術棧

- **框架**：Next.js 16.2.7（App Router + Turbopack + `output: "export"`）
- **UI**：React 19.2.4 + Ant Design 6.4.3 + @ant-design/nextjs-registry
- **樣式**：Tailwind CSS v4（CSS-first `@theme inline`）
- **動畫**：Framer Motion 12（v0.10.0+ 大量採用）
- **圖示**：@ant-design/icons 6（主）+ lucide-react 1.17（404 頁輔助）
- **桌面殼**：Tauri 2（`pnpm tauri:dev` / `pnpm tauri:build`）
- **型別**：TypeScript 5（strict mode）
- **測試**：Vitest 4 + @testing-library/react 16 + jsdom
- **套件管理**：pnpm 10
- **node 引擎**：>= 20.9.0

> ⚠️ **Next.js 16 + AntD 6 SSR 雙檔 pattern**：所有用到 AntD `Form` / `Table` / `Statistic` 等 client-side hook 的頁面都需拆成 `page.tsx`（server shell + metadata）+ `_form.tsx`（client），並用 `dynamic(() => import('./_form'), { ssr: false })` 載入。ssr:false 的 wrapper 必須獨立 client 元件（v0.9.0+ 用 `_result-client.tsx`）。否則會在 prerender 階段炸 `isValid/createContext is not a function`。
>
> ⚠️ **AntD 6 deprecations 已守護**：`Statistic` 的 `valueStyle` 已 deprecated（v0.7.2+ 起），改用 `styles={{ content: { color / fontSize } }}`（`StatisticSemanticType.styles.content`）。迴歸測試：`PainEnsembleCard.test.tsx` SSR HTML 守護 `var(--accent)` 跟字級生效。

---

## 16 條估算鐵律（SPEC §十六）

本工具遵守以下硬規則，違反任何一條都會在測試階段被擋下：

1. 強制險醫療 20 萬硬上限，**不可**超過
2. 看護費 30 日住院硬上限，**不可**超過
3. 失能等級 1-15 級，**不可**自創等級
4. 精神慰撫金必須依**法院實務係數**，**不可**硬編金額
5. 工作損失需附**6 個月薪資證明**，無證明者必須標示
6. 肇責比例**雙方總和 100%**，違反必須報錯
7. 地區自動帶法院，**可手改**但需標示
8. 法源引用必須附**URL**（mock 階段也要有真實 URL 格式）
9. 法源**最後檢視日**超過 365 天必須標示「請重新確認」
10. 評議/判決案例**僅供參考**，不可當成判決依據
11. MVP 階段**不接真 API**，全 mock
12. 死亡給付 MVP **不處理**（標 0）
13. 計算結果**不可**寫死，必須由 input 推導
14. 金額計算結果**必須**附依據（公式/法條/案例）
15. 缺文件/風險**必須**明確標示，不可隱藏
16. **免責聲明**必須在首頁與結果頁都出現

---

## 免責聲明

> ⚠️ **本工具僅供參考，不構成法律、會計、稅務或保險諮詢意見。**
>
> - 計算結果依據現行法規與公開案例統計，**實際理賠金額**須以保險公司、調解委員會或法院最終決定為準。
> - 本工具**未經**金管會、保險公司或律師公會認證。
> - 使用本工具所生任何爭議，**開發者不負任何責任**。
> - 涉及**訴訟**請洽執業律師；涉及**保險理賠爭議**可向財團法人金融消費評議中心申訴。

---

## iPAS 練習目的

這個專案是**刺刺**準備 **iPAS AI 應用規劃師**（初級）認證的練習作品，重點在練習：

- **AI 應用規劃**：把法律規則翻成可計算的規則引擎
- **資料治理**：3 個外部資料來源的介面設計（mock → 真 API 的可替換性）
- **領域知識整合**：法律 + 醫療 + 保險 + 地區實務
- **前端即時運算**：不靠後端，前端 React 算完即時呈現
- **可測試性**：7 個測試檔、79 個測試，規則變更時自動驗證

> 學習筆記同步收錄在 [[Obsidian 個人知識庫]]（本機端，非本專案範圍）。

---

## License

個人練習作品，未授權商業使用。
