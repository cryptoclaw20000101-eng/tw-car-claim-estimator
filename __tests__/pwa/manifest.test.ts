import { describe, it, expect } from 'vitest'
import manifestFn from '@/app/manifest'

/**
 * S1.5 PWA Manifest 結構測試
 *
 * 驗證 manifest 欄位符合 PWA spec + 對齊 v0.2.18 設計語彙：
 * - 必要欄位：name / short_name / start_url / display / icons[]
 * - 設計一致性：theme_color 跟 ConfigProvider colorPrimary = #be123c
 * - 必要 icons 尺寸：192 + 512
 * - 必要 icon purpose：any maskable（macOS 啟動畫面 / 桌面 launchpad 用 maskable）
 *
 * 為什麼要測 manifest：Next 16 自動把 app/manifest.ts 生成 /manifest.webmanifest，
 * 如果欄位錯或缺，PWA install 會直接壞掉，沒測試 catch 不到。
 *
 * 為什麼呼叫 manifestFn()：Next 16 file convention 是 `function manifest() { return {...} }`
 * （不是 export const = {...}），所以測試要呼叫才拿到物件。
 */
const manifest = manifestFn()

describe('S1.5 PWA Manifest', () => {
  it('必要欄位都有', () => {
    expect(manifest.name).toBeTruthy()
    expect(manifest.short_name).toBeTruthy()
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')
    expect(manifest.display).toBe('standalone')
  })

  it('theme_color 對齊 ConfigProvider colorPrimary', () => {
    // 對齊 app/layout.tsx ConfigProvider colorPrimary = #be123c (rose-700)
    // 若改 layout 的色，記得同步改這裡
    expect(manifest.theme_color).toBe('#be123c')
  })

  it('zh-Hant 語系標記', () => {
    expect(manifest.lang).toBe('zh-Hant')
  })

  it('icons 至少 3 個（favicon.ico + 192 + 512）', () => {
    expect(manifest.icons).toBeDefined()
    expect(manifest.icons!.length).toBeGreaterThanOrEqual(3)
  })

  it('每個 icon 都有 src + sizes + type', () => {
    for (const icon of manifest.icons ?? []) {
      expect(icon.src).toBeTruthy()
      expect(icon.sizes).toBeTruthy()
      expect(icon.type).toBeTruthy()
    }
  })

  it('192 + 512 PNG 都有 purpose=any（保證瀏覽器一定接受）', () => {
    // Next 16 MetadataRoute.Manifest type 的 purpose 是 union
    // 'any' | 'maskable' | 'monochrome'（不接受空白分隔 space-separated string）
    // 視覺：玫瑰紅 #be123c icon 在淺/深色背景下都清楚，'any' 即可
    const png192 = manifest.icons!.find((i) => i.sizes === '192x192')
    const png512 = manifest.icons!.find((i) => i.sizes === '512x512')
    expect(png192).toBeDefined()
    expect(png512).toBeDefined()
    expect(png192!.purpose).toBe('any')
    expect(png512!.purpose).toBe('any')
  })

  it('不啟用 PWA push（iOS 17+ 不支援）', () => {
    // 對齊 manifest.ts 註解：iOS 17+ 仍不支援 PWA push，推遲 S2 Capacitor
    // 這個測試是「保險」 — 若未來有人手滑加 gcm_sender_id / push 會被擋
    const m = manifest as unknown as Record<string, unknown>
    expect(m.gcm_sender_id).toBeUndefined()
  })

  it('categories 含 finance / productivity / utilities', () => {
    expect(manifest.categories).toContain('finance')
    expect(manifest.categories).toContain('productivity')
    expect(manifest.categories).toContain('utilities')
  })

  it('orientation 鎖直立（手機單手操作為主）', () => {
    expect(manifest.orientation).toBe('portrait')
  })
})
