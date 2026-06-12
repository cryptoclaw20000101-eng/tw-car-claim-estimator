import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * S1.5 PWA Service Worker 行為測試
 *
 * 為什麼測 SW 而非靠瀏覽器 E2E：
 * - SW 在 Node vitest 環境跑不起來（沒有 ServiceWorkerGlobalScope）
 * - 但 SW 行為是「source 邏輯」，可以靜態掃 source code 驗證關鍵決策
 * - 抓出最常犯的錯：cache 全部東西（含 /data/precedents/*.json 過期資料）
 *                  沒列 APP_SHELL（首次 install 失敗）
 *                  沒處理 activate 清理舊 cache（使用者永遠拿到舊版）
 *
 * 限制：這不是 E2E 測試，不驗證 runtime 行為。瀏覽器實機測請用 Chrome DevTools
 * → Application → Service Workers 觀察。
 */

const swPath = resolve(__dirname, '../../public/sw.js')
const swSource = readFileSync(swPath, 'utf-8')

describe('S1.5 PWA Service Worker', () => {
  it('sw.js 存在且可讀取', () => {
    expect(swSource).toBeTruthy()
    expect(swSource.length).toBeGreaterThan(100)
  })

  it('CACHE_VERSION 是字串（含版本號）', () => {
    // 版本號格式：tw-claim-vX.Y.Z-YYYYMMDD
    expect(swSource).toMatch(/const CACHE_VERSION = ['"]tw-claim-v[\d.]+-/)
  })

  it('APP_SHELL 包含所有 3 個 app routes', () => {
    // 對齊 app/page.tsx + app/claims/new/page.tsx + app/claims/result/page.tsx
    expect(swSource).toMatch(/APP_SHELL = \[/)
    expect(swSource).toMatch(/'\/'/)
    expect(swSource).toMatch(/'\/claims\/new'/)
    expect(swSource).toMatch(/'\/claims\/result'/)
  })

  it('APP_SHELL 包含 manifest + icons + favicon', () => {
    expect(swSource).toMatch(/'\/manifest\.webmanifest'/)
    expect(swSource).toMatch(/'\/icons\/icon-192\.png'/)
    expect(swSource).toMatch(/'\/icons\/icon-512\.png'/)
    expect(swSource).toMatch(/'\/favicon\.ico'/)
  })

  it('install 事件會預先 cache APP_SHELL', () => {
    expect(swSource).toMatch(/addEventListener\(['"]install['"]/)
    expect(swSource).toMatch(/cache\.addAll\(APP_SHELL\)/)
    expect(swSource).toMatch(/self\.skipWaiting\(\)/)
  })

  it('activate 事件會清掉舊 cache（避免 stale shell）', () => {
    expect(swSource).toMatch(/addEventListener\(['"]activate['"]/)
    // 過濾條件：key !== CACHE_VERSION 才刪
    expect(swSource).toMatch(/filter\(\(key\) => key !== CACHE_VERSION\)/)
    expect(swSource).toMatch(/caches\.delete\(key\)/)
    expect(swSource).toMatch(/self\.clients\.claim\(\)/)
  })

  it('fetch 處理 GET only（POST/PUT 不進 SW）', () => {
    expect(swSource).toMatch(/request\.method !== ['"]GET['"]/)
  })

  it('不 cache /data/ 開頭（避免司法院判例資料 stale）', () => {
    // 對齊 sw.js 註解：data 走 network 永遠拿最新
    expect(swSource).toMatch(/url\.pathname\.startsWith\(['"]\/data\//)
  })

  it('不 cache /api/ 開頭（未來 API 路由留彈性）', () => {
    expect(swSource).toMatch(/url\.pathname\.startsWith\(['"]\/api\//)
  })

  it('只 cache 200 + basic type response（避免 opaque/error 污染）', () => {
    expect(swSource).toMatch(/response\.status === 200/)
    expect(swSource).toMatch(/response\.type === ['"]basic['"]/)
  })

  it('離線時 navigate 請求 fallback 回 /', () => {
    expect(swSource).toMatch(/request\.mode === ['"]navigate['"]/)
    expect(swSource).toMatch(/caches\.match\(['"]\/['"]\)/)
  })

  it('只處理同源請求（不代理第三方 CDN）', () => {
    expect(swSource).toMatch(/url\.origin !== location\.origin/)
  })
})
