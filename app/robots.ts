export const dynamic = 'force-static'

import type { MetadataRoute } from 'next'

/**
 * robots.txt（v0.9.0+ 新增）
 * - Allow 全站
 * - Disallow /claims/new 與 /claims/result（內部流程，不該被索引）
 * - 指向 sitemap.xml
 *
 * AGENTS §2.4：Next.js 16 native robots.ts (MetadataRoute.Robots)
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://tw-car-claim-estimator.vercel.app'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/claims/new', '/claims/result', '/api/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
