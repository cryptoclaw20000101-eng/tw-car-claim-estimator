/**
 * tw-car-claim-estimator — Design Tokens (TypeScript)
 *
 * Single source of truth for runtime values (AntD ConfigProvider, manifest, viewport).
 * Mirrors `app/globals.css` `:root` and `@theme inline` declarations.
 *
 * 為什麼要有這個模組：
 * - 原本 #be123c 在 4 個地方硬編（globals.css / layout viewport / ConfigProvider / manifest）
 * - 改色要動 4 檔，容易漏
 * - AntD ConfigProvider / manifest / viewport 都不能直接吃 CSS var
 *   → 需要 TS runtime 常數作為 fallback source
 *
 * 對應 globals.css 規則：
 * - 中性色走 zinc（避 AI 紫藍）
 * - 強調色 rose-700（單一，飽和 < 80%）
 * - 數據色 4 色分明（不用彩虹）
 *
 * ⚠️ 對齊 AGENTS.md §2.1 LSP 規則：使用 `import type` 別名避免 type-only import 陷阱
 *
 * 對齊 globals.css 不要 drift 的方法：CI 之後可加一個 script 比對兩邊硬編（未來 v0.12.x）
 *
 * @see app/globals.css
 * @see app/layout.tsx
 * @see app/manifest.ts
 */

export const COLORS = {
  // 中性色
  background: '#fafaf9', // stone-50
  foreground: '#18181b', // zinc-900
  muted: '#71717a', // zinc-500
  surface: '#ffffff',
  surfaceSubtle: '#f4f4f5', // zinc-100
  border: '#e4e4e7', // zinc-200
  borderStrong: '#d4d4d8', // zinc-300

  // 強調色（單一）— v0.16.x：保險公司深藍（從 rose-700 改 navy-700）
  accent: '#1e40af', // navy-700（保險公司深藍）
  accentSoft: '#dbeafe', // blue-100
  accentForeground: '#ffffff',

  // 數據色（Stat / Tag 用）
  positive: '#166534', // green-800
  warning: '#b45309', // amber-700
  negative: '#991b1b', // red-800
  neutral: '#1f2937', // gray-800

  // AntD 配色擴充（跟 ConfigProvider 對齊）
  antInfo: '#0e7490', // cyan-700
} as const

// 別名（語意化）
export const ACCENT = COLORS.accent
export const BACKGROUND = COLORS.background
export const FOREGROUND = COLORS.foreground

// 型別 export（給 strict mode 用）
export type DesignColor = (typeof COLORS)[keyof typeof COLORS]
export type ColorKey = keyof typeof COLORS

/**
 * 驗證：所有顏色都是合法 hex
 */
export function isValidHex(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value)
}

/**
 * 驗證所有 token 是否為合法 hex（CI smoke test 用）
 * Phase 4 完成後可加 unit test
 */
export function validateTokens(): { ok: boolean; invalid: string[] } {
  const invalid: string[] = []
  for (const [key, value] of Object.entries(COLORS)) {
    if (!isValidHex(value)) {
      invalid.push(`${key}=${value}`)
    }
  }
  return { ok: invalid.length === 0, invalid }
}
