export const dynamic = 'force-static'

import type { MetadataRoute } from 'next'
import { CONTENT_LAST_REVIEWED, SITE_URL } from '@/lib/seo'
import { GUIDES } from '@/lib/guides'

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
  const lastModified = new Date(CONTENT_LAST_REVIEWED)

  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/guides`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    ...GUIDES.map((guide) => ({
      url: `${SITE_URL}${guide.href}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    {
      url: `${SITE_URL}/about`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ]
}
