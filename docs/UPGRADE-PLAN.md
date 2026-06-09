# 車禍理賠估算器 — 完整升級計畫

> **目標**：從「單一網站」升級成「多平台 + 真實資料庫」產品
> **觸發**：使用者訊息「macOS 桌面小工具 + 手機 app + 爬蟲司法院」

---

## 現況盤點

| 項目 | 現況 | 評估 |
|---|---|---|
| **Web app** | Next.js 16 + AntD 6 + Tailwind 4，4 路由，6/6 prerender，179 測試 | ✅ 已上線 https://flowtracelabs.com |
| **計算引擎** | 8 個 TS 檔、~1,500 LOC：強制險 / 失能 / 民事 / 第三人 / 地區 | ✅ 紮實、可復用 |
| **資料庫** | 無 | ❌ 缺 |
| **桌面 app** | 只有 `public/widget.html`（HTML 捷徑） | ❌ 使用者不滿意 |
| **手機 app** | 無 | ❌ 缺 |
| **真實判決資料** | 無 | ❌ 缺 |

---

## 完整升級架構（3 條工作流）

### 工作流 1：多平台打包

**單一 codebase + 跨平台輸出**：

```
現有 Next.js 16 app
  │
  ├──→ Web (next start)            ← 現有
  ├──→ macOS .app (Electron)        ← 新
  ├──→ iOS .ipa (Capacitor)         ← 新
  ├──→ Android .apk (Capacitor)     ← 新
  └──→ PWA (manifest.json + SW)     ← 補強
```

**選 Capacitor.js 而非 React Native / Flutter**：
- ✅ **完全復用現有 Next.js**（無重寫）
- ✅ Capacitor.js ~ 100KB runtime（vs RN 50MB+ / Flutter 30MB+）
- ✅ 一份 codebase 出 4 平台
- ⚠️ Capacitor 需要原生 IDE 收尾（Xcode build iOS / Android Studio build Android）
- ⚠️ 上架需 Apple Developer (USD 99/年) + Google Play (USD 25)

### 工作流 2：司法院爬蟲 + NLP 抽取

**資料流**：

```
司法院法學資料檢索系統 (law.judicial.gov.tw)
  │
  ↓ 爬蟲（python + requests + BeautifulSoup + Selenium for 驗證碼）
  │
司法判決書（HTML/PDF）— 約 50,000 筆/年的車禍民事判決
  │
  ↓ 去識別化（移除當事人姓名/身分證字號）
  ↓
結構化 JSON（main.ts / lib/parser/）
  {
    id, court, date, caseNo, type,
    facts: [...],           // 事實摘要
    issues: [...],          // 爭點
    holdings: [...],        // 判決要旨
    damages: {              // 損害項目
      medical, nursing, workLoss, pas, vehicle, ...
    },
    ratios: {               // 肇責比例
      plaintiff, defendant
    },
    compensation: number,   // 賠償金額
  }
  │
  ↓ 載入到 SQLite / PostgreSQL
  │
  ├──→ 給 ML 模型（fine-tune 預測模型）
  ├──→ 給規則引擎（補上經驗值）
  └──→ 給使用者查詢（相似案例檢索）
```

**技術堆疊**：
- **爬蟲**：`requests` + `cloudscraper`（繞 Cloudflare）+ `selenium`（處理驗證碼） + proxy pool
- **解析**：`pdfplumber` / `PyMuPDF` + NLP（`CKIP` 中文斷詞、`spaCy zh`）
- **去識別化**：regex + NER（`CKIP` 內建人名偵測）
- **資料庫**：SQLite（開發）/ PostgreSQL（生產）
- **API**：FastAPI 包成 `/api/cases/search` / `/api/cases/{id}` / `/api/predict`

**法務風險評估**（必看）：
- 🚨 **司法院判決書有著作權**（依「著作權法第 9 條」政府機關文件不適用）— 引用 OK，整篇重製需標出處
- 🚨 **當事人個資** = 個資法管轄，**未去識別化儲存 = 違規**
- 🚨 **司法院「開放 API」**：有 `https://data.judicial.gov.tw/jdg/` 開放判決書（每日 1,000 筆上限）— 這條比較安全
- 🚨 **若要商業化引用判決**：建議簽署司法院「加值應用」授權

**建議路徑**：
1. **先爬「臺中地方法院」車禍民事判決 2024 年 100 筆**（單一法院、單一年份、~1-2 天）
2. **解析 + 去識別化 + 結構化**（~1-2 天）
3. **寫 1 個 query API** + 跟現有 `estimateClaim()` 整合（用真實案件的 `ratios` / `damages` 驗證程式）
4. **決定要不要擴展到全台 + 多年份**（~1-3 個月）

### 工作流 3：ML 預測模型（可選進階）

```
司法院判決書 + 結構化 features
  │
  ↓ 特徵工程（age, region, injury_severity, fault_ratio, ...）
  ↓
XGBoost / LightGBM / Neural Net
  │
  ├──→ 預測「建議肇責比例」
  ├──→ 預測「建議慰撫金區間」
  └──→ 預測「建議和解金額區間」
```

**評估**：這個**是過度工程**，**先不做**。**先驗證資料流**，**等資料量 > 1,000 筆再談 ML**。

---

## 執行排程（建議）

| Sprint | 工作 | 工作量 | 依賴 |
|---|---|---|---|
| **S0** | 上面這份計畫 review | 0.5 小時 | — |
| **S1** | macOS .app（Electron 包現有） | 1-2 小時 | — |
| **S2** | iOS .ipa（Capacitor） | 2-3 小時 + Xcode build | 需 Apple Developer 帳號 |
| **S3** | Android .apk（Capacitor） | 2-3 小時 + Android Studio build | 需 Google Play 帳號 |
| **S4** | 司法院爬蟲 demo（單一法院 100 筆） | 1-2 天 | — |
| **S5** | NLP 抽取 + 結構化 + 去識別化 | 2-3 天 | 需 S4 |
| **S6** | 跟現有 `estimateClaim()` 整合 | 1 天 | 需 S5 |
| **S7** | 擴展爬蟲（全台 + 多年份）| 1-3 個月 | 需 S6 驗證 |
| **S8** | ML 預測模型（可選）| 1 個月 | 需 S7 |

**MVP 建議順序**：S1（macOS app）→ S4-6（爬蟲 + 整合）→ 再決定 S2/S3。

---

## 風險與對策

| 風險 | 對策 |
|---|---|
| Apple Developer 帳號（USD 99/年）| 先做 macOS 免簽名（給自己用），**不急著上架** |
| Google Play 帳號（USD 25）| 同上 |
| 司法院反爬 | 用「開放 API」(`https://data.judicial.gov.tw/jdg/`) 1,000 筆/日 |
| 個資法風險 | 全部去識別化 + 摘要存特徵，**不存原始判決全文** |
| 商業化引用判決 | 走「加值應用」授權（司法院有窗口）|
| 時程過長 | 先 S1（macOS）給可見成果 → 你滿意再投 S4-6 |

---

## 現階段 pending 決策

使用者選哪個 sprint 開工？每個 sprint 都是「獨立可交付」：

- [ ] **S1 macOS .app**（推薦優先，2-3 個 tool call 起步）
- [ ] S2 iOS .ipa
- [ ] S3 Android .apk
- [ ] S4 司法院爬蟲 demo
- [ ] S5 NLP 抽取
- [ ] S6 跟 estimateClaim 整合
- [ ] S7 全台爬蟲
- [ ] S8 ML 模型

