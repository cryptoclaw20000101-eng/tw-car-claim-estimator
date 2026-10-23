export const dynamic = 'force-static'

import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

/**
 * robots.txt（v0.9.0+ 新增）
 * - Allow 全站
 * - 表單、結果、登入與驗證頁保持可抓取，讓搜尋引擎讀取頁面的 noindex
 * - 只封鎖 API 與管理後台等不應由 crawler 存取的路徑
 * - 指向 sitemap.xml
 *
 * AGENTS §2.4：Next.js 16 native robots.ts (MetadataRoute.Robots)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
