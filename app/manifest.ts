export const dynamic = "force-static";

import type { MetadataRoute } from 'next'
import { ACCENT, BACKGROUND } from '@/lib/design/tokens'

/**
 * PWA Manifest — S1.5 PWA 補強（v0.12.0+ 從硬編改 import tokens）
 *
 * 對齊 v0.2.18 設計語彙：
 * - 強調色 rose-700 從 lib/design/tokens.ts 引用（單一來源）
 * - zh-Hant 為主名、English 為副
 * - display: standalone = 隱藏網址列，像原生 app
 * - 不啟用 gcm/push — iOS 17+ 仍不支援 PWA push，推遲到 S2/Capacitor 整合
 * - 不啟用 install prompt 自訂按鈕（瀏覽器原生 UI 即可）
 *
 * 檔案位置：app/manifest.ts (Next 16 原生支援，自動生成 /manifest.webmanifest)
 * 參考：https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest
 *
 * v0.12.0+ 改動：
 * - 改從 tokens.ts import（ACCENT / BACKGROUND），不再硬編 #be123c / #fafaf9
 * - 換色只需改 tokens.ts + globals.css 兩處
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '台灣車禍理賠金額估算器',
    short_name: '車禍理賠',
    description:
      '依強制汽車責任保險法、民法侵權行為及 6 直轄市地方法院實務，快速估算體傷理賠金額',
    lang: 'zh-Hant',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    // v0.12.0+：從 tokens 引用（不再硬編）
    background_color: BACKGROUND,
    theme_color: ACCENT,
    categories: ['finance', 'productivity', 'utilities'],
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
        purpose: 'any',
      },
      // 192/512 PNG 來自 public/icons/（避免首次部署 Next 16 file convention 自動生成失敗）
      // purpose 不寫，default = 'any'（Next MetadataRoute.Manifest type 是 union
      // 'any' | 'maskable' | 'monochrome'，不接受空白分隔 space-separated string）
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}