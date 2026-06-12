/**
 * S1.5 PWA Service Worker — tw-car-claim-estimator v0.2.18
 *
 * 策略：cache-first for app shell, network-first for data/JSON
 *
 * App shell（永遠 cache）：
 *   /                       首頁
 *   /claims/new             新增估算
 *   /claims/result          估算結果
 *   /manifest.webmanifest   PWA manifest
 *   /icons/icon-192.png     PWA icon 192
 *   /icons/icon-512.png     PWA icon 512
 *   /favicon.ico            瀏覽器 tab icon
 *
 * 不 cache（永遠走 network，避免 stale data）：
 *   /data/precedents/*.json 司法院判例資料
 *   /api/*                  之後的 API
 *
 * 升級策略：版本號 bump 時自動清舊 cache。
 */
const CACHE_VERSION = 'tw-claim-v0.2.18-20260612'
const APP_SHELL = [
  '/',
  '/claims/new',
  '/claims/result',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/favicon.ico',
]

// 1) install：預先 cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  )
})

// 2) activate：刪除舊版本 cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

// 3) fetch：app shell cache-first，其他 network-first + cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // 只處理同源
  if (url.origin !== location.origin) return

  // 不 cache 資料類 / API
  const isData =
    url.pathname.startsWith('/data/') ||
    url.pathname.startsWith('/api/')
  if (isData) return  // 走瀏覽器預設（network，無 cache）

  // App shell：cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
        .then((response) => {
          // 只 cache 成功 + 基本的 response（避免 opaque / error 污染 cache）
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone()
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => {
          // 離線 fallback：返回 app shell 首頁
          if (request.mode === 'navigate') {
            return caches.match('/')
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' })
        })
    })
  )
})
