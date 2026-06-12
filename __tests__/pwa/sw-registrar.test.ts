import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * S1.5 PWA ServiceWorkerRegistrar 原始碼結構測試
 *
 * 為什麼不用 React Testing Library render 跑：
 * - vitest config 用 environment: 'node'（不是 jsdom）
 * - 即使改 jsdom，navigator.serviceWorker mock + NODE_ENV 切換
 *   在 vitest TS 嚴格模式下要一堆 @ts-expect-error
 * - 重點不是「瀏覽器執行正確」，是「source code 邏輯沒被改壞」
 *
 * 對齊 CLAUDE.md §2.1：LSP 報紅先跑 tsc，但這裡 source 結構比 runtime 行為更值得守
 *
 * 限制：仍是靜態掃 source code，不驗證 runtime 行為。瀏覽器實機測
 * 用 Chrome DevTools → Application → Service Workers 觀察。
 */

const sourcePath = resolve(__dirname, '../../components/ServiceWorkerRegistrar.tsx')
const source = readFileSync(sourcePath, 'utf-8')

describe('S1.5 PWA ServiceWorkerRegistrar', () => {
  it('元件存在且有 export', () => {
    expect(source).toMatch(/export (function|const) ServiceWorkerRegistrar/)
  })

  it("'use client' directive（瀏覽器 API 必須 client-only）", () => {
    // 對齊 v0.2.18 設計：navigator.serviceWorker 在 SSR prerender 沒 navigator
    expect(source).toMatch(/['"]use client['"]/)
  })

  it('dev mode（NODE_ENV !== production）不註冊 SW', () => {
    // 對齊 sw-registrar.tsx 註解：避免 HMR 跟 SW 衝突
    expect(source).toMatch(/process\.env\.NODE_ENV !== ['"]production['"]/)
  })

  it('檢查 navigator 存在（SSR 保護）', () => {
    expect(source).toMatch(/typeof window === ['"]undefined['"]/)
  })

  it('檢查 serviceWorker API 存在（不支援瀏覽器保護）', () => {
    expect(source).toMatch(/['"]serviceWorker['"] in navigator/)
  })

  it('呼叫 register 時用 /sw.js + scope: /', () => {
    expect(source).toMatch(/register\(['"]\/sw\.js['"],\s*\{\s*scope:\s*['"]\/['"]\s*\}\)/)
  })

  it('註冊失敗不 throw（網站功能不依賴 SW）', () => {
    // 對齊 sw-registrar.tsx 設計：PWA 是漸進增強
    expect(source).toMatch(/\.catch\(/)
    expect(source).toMatch(/console\.warn/)
  })

  it('無 UI 渲染（return null）', () => {
    expect(source).toMatch(/return null/)
  })

  it('等 window load 後才註冊（避免跟首次 render 競爭）', () => {
    // 對齊 sw-registrar.tsx 註解：document.readyState === 'complete' 直接跑，
    // 否則 addEventListener('load', ...)
    expect(source).toMatch(/document\.readyState === ['"]complete['"]/)
    expect(source).toMatch(/addEventListener\(['"]load['"]/)
  })
})
