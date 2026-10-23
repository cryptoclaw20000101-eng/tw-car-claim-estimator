import { NextResponse } from 'next/server'

/**
 * 防止 CDN 在新部署後仍提供舊的 App Router HTML / RSC payload。
 *
 * 頁面內引用的 Next.js chunk 名稱會隨 build 改變；若 HTML 被快取而 chunk
 * 已切換，就會在客戶端出現「module factory is not available」。帶內容雜湊的
 * `/_next/static` 檔案仍維持 Next.js 預設 immutable 快取，只有路由回應禁用
 * 跨部署快取。
 */
export function proxy() {
  const response = NextResponse.next()
  response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate')
  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)',
  ],
}
