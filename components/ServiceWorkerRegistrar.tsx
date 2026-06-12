'use client'

import { useEffect } from 'react'

/**
 * S1.5 PWA Service Worker 註冊
 *
 * 為什麼需要 'use client'：navigator.serviceWorker 是瀏覽器 API，
 * SSR prerender 沒有 navigator，必須 client-only。
 *
 * 註冊策略：
 * - 開發模式（NODE_ENV !== 'production'）不註冊 — 避免 HMR 跟 SW 衝突
 * - 註冊失敗不 throw，只 console.warn — 網站功能不依賴 SW
 * - 註冊成功時檢查更新（onupdatefound 提示，但 v0.2.18 不主動顯示更新提示）
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          // v0.2.18: 不主動提示更新，等下次啟動自然更新
          console.info('[PWA] service worker registered:', reg.scope)
        })
        .catch((err) => {
          console.warn('[PWA] service worker registration failed:', err)
        })
    }

    if (document.readyState === 'complete') {
      onLoad()
    } else {
      window.addEventListener('load', onLoad, { once: true })
    }
  }, [])

  // 無 UI 渲染
  return null
}
