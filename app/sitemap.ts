export const dynamic = 'force-static'

import type { MetadataRoute } from 'next'

/**
 * sitemap.xml（v0.9.0+ 新增）
 * - 只列可被索引的頁面
 * - /claims/new 與 /claims/result 已在 page metadata 設 robots: { index: false }
 *   → 不放進 sitemap
 * - lastModified 對齊 package.json 版本號發布日
 *
 * AGENTS §2.4：Next.js 16 native sitemap.ts (MetadataRoute.Sitemap)
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://tw-car-claim-estimator.vercel.app'

  // v0.9.0 發布日：scaffold-time stamp，後續 release 時手動更新
  const lastModified = new Date()

  return [
    {
      url: `${siteUrl}/`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
  ]
}