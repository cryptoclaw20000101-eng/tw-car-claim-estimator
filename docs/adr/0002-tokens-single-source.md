# ADR 0002: Design Tokens 單一來源

## 狀態

已採用（v0.12.0）

## 背景

專案早期 `#be123c`（rose-700）硬編在 7 個地方：
- `app/globals.css` 的 `--accent` token
- `app/layout.tsx` 的 `viewport.themeColor`
- `app/layout.tsx` 的 `ConfigProvider.colorPrimary`
- `app/manifest.ts` 的 `theme_color` + `background_color`
- `app/apple-icon.tsx` 的背景色
- `app/opengraph-image.tsx` 的背景色
- `app/twitter-image.tsx` 的背景色

每次改色要動 7 個檔，**極易漏**。

## 選項

### A. 維持現狀（繼續硬編）
- 優：簡單
- 缺：易漏、易漂移、無法 type-safe

### B. CSS variable only
- 優：瀏覽器原生支援
- 缺：AntD ConfigProvider / ImageResponse 不吃 CSS var

### C. CSS variable + TS runtime tokens
- 優：兩層覆蓋（CSS + AntD + manifest + ImageResponse）
- 缺：要維護 2 個檔保持同步

## 決定

**選 C（CSS + TS tokens）**

理由：
- TS runtime 給 AntD ConfigProvider / manifest / ImageResponse 用（不能直接吃 CSS var）
- CSS variable 給 Tailwind / 客製 CSS 用
- 兩層用 `lib/design/tokens.ts` 統一 source
- 未來 CI script 可比對兩邊是否 drift（v0.13.x 規劃）

## 後果

- ✅ 改色只動 `lib/design/tokens.ts` + `app/globals.css` 兩處
- ✅ AntD ConfigProvider / manifest / ImageResponse 全部從 tokens import
- ✅ README 加「如何換色」SOP
- ⚠️ 兩處需手動同步（目前靠 code review 守護）
- ⚠️ TypeScript runtime 與 CSS var 沒有自動驗證

## 實作

```ts
// lib/design/tokens.ts
export const COLORS = {
  background: '#fafaf9',
  foreground: '#18181b',
  accent: '#be123c', // rose-700
  // ...
}
export const ACCENT = COLORS.accent
export const BACKGROUND = COLORS.background
```

```css
/* app/globals.css */
:root {
  --accent: #be123c;
  --background: #fafaf9;
  /* ... 對應 tokens.ts */
}
```

## 未來 v0.13.x 規劃

- CI script `scripts/check-token-drift.ts`：比對 tokens.ts 跟 globals.css 硬編值
- build 時若 drift 就 build fail

## 變更紀錄

- 2026-07-03 — 採用 tokens.ts 單一來源（v0.12.0）