/**
 * S1.5 PWA Service Worker — tw-car-claim-estimator v0.13.x
 *
 * 進階快取策略（v0.13.x 升級）：
 *
 * 1) HTML（首頁 / 表單 / 結果）— Stale-While-Revalidate：
 *    - 立刻回 cache（秒開）
 *    - 背景 fetch 新版本，更新 cache
 *    - 下次訪問自動用新版本
 *
 * 2) 靜態資源（JS / CSS chunks）— Cache-First with TTL：
 *    - 30 天 cache，命中率高
 *    - 自動 versioning 由 Next.js build hash 處理
 *
 * 3) OG image / apple-icon / Twitter image — Cache-First with long TTL：
 *    - 60 天 cache（圖片不會變）
 *
 * 4) 不 cache（永遠走 network）：
 *    - /data/precedents/*.json（資料要新）
 *    - /api/*（之後的 API）
 *
 * 升級策略：CACHE_VERSION bump 時自動清舊 cache。
 */
const CACHE_VERSION = 'tw-claim-v0.13.0-20260706'
const APP_SHELL = [
  '/',
  '/claims/new',
  '/claims/result',
  '/claims/batch',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/favicon.ico',
  '/apple-icon',
]

// 靜態資源 TTL（毫秒）
const STATIC_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 天
const IMAGE_TTL_MS = 60 * 24 * 60 * 60 * 1000 // 60 天

// 1) install：預先 cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

// 2) activate：刪除舊版本 cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

// 3) fetch：分層快取策略
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // 只處理同源
  if (url.origin !== location.origin) return

  // 不 cache 資料類 / API
  const isData =
    url.pathname.startsWith('/data/') || url.pathname.startsWith('/api/')
  if (isData) return // 走瀏覽器預設（network，無 cache）

  // 判斷資源類型
  const isImage = /\.(png|jpg|jpeg|svg|gif|webp|ico)$/i.test(url.pathname)
  const isHTML = request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')
  const isStaticAsset = /\/_next\/static\//.test(url.pathname)

  if (isHTML) {
    // HTML：Stale-While-Revalidate
    event.respondWith(staleWhileRevalidate(request))
  } else if (isImage || isStaticAsset) {
    // 靜態資源 / 圖片：Cache-First with TTL
    event.respondWith(cacheFirstWithTTL(request, isImage ? IMAGE_TTL_MS : STATIC_TTL_MS))
  } else {
    // 其他：Cache-First basic
    event.respondWith(cacheFirstBasic(request))
  }
})

/**
 * Stale-While-Revalidate：立刻回 cache（命中），背景 fetch 更新 cache
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION)
  const cached = await cache.match(request)
  // 不論有沒有命中，背景 fetch 新版本
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200 && response.type === 'basic') {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)

  // 有 cache 立刻回（背景更新），沒有 cache 等 network
  return cached || (await networkPromise) || offlineFallback(request)
}

/**
 * Cache-First with TTL：命中 + 未過期就回 cache，過期或未命中走 network
 */
async function cacheFirstWithTTL(request, ttlMs) {
  const cache = await caches.open(CACHE_VERSION)
  const cached = await cache.match(request)
  if (cached) {
    const dateHeader = cached.headers.get('sw-cache-date')
    const cachedAt = dateHeader ? parseInt(dateHeader, 10) : 0
    if (Date.now() - cachedAt < ttlMs) {
      return cached
    }
  }
  // 過期或沒命中：fetch
  try {
    const response = await fetch(request)
    if (response && response.status === 200) {
      // 加 sw-cache-date header 後存
      const cloned = response.clone()
      const headers = new Headers(cloned.headers)
      headers.set('sw-cache-date', String(Date.now()))
      const modified = new Response(await cloned.blob(), {
        status: cloned.status,
        statusText: cloned.statusText,
        headers,
      })
      cache.put(request, modified)
      return response
    }
    return cached || offlineFallback(request)
  } catch {
    return cached || offlineFallback(request)
  }
}

/**
 * Cache-First basic：命中就回，沒命中走 network
 */
async function cacheFirstBasic(request) {
  const cache = await caches.open(CACHE_VERSION)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response && response.status === 200 && response.type === 'basic') {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return cached || offlineFallback(request)
  }
}

/**
 * 離線 fallback：HTML 回首頁，其他回 503
 */
async function offlineFallback(request) {
  if (request.mode === 'navigate') {
    const cache = await caches.open(CACHE_VERSION)
    return (await cache.match('/')) || new Response('Offline', { status: 503 })
  }
  return new Response('Offline', { status: 503, statusText: 'Offline' })
}