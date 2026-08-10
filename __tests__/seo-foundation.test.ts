import { describe, expect, it } from 'vitest'
import { buildHomeJsonLd } from '@/app/page'
import { GET } from '@/app/llms.txt/route'
import robots from '@/app/robots'
import sitemap from '@/app/sitemap'
import { buildGuideJsonLd, OFFICIAL_SOURCES } from '@/lib/guides'

describe('SEO foundation', () => {
  it('publishes WebSite and WebApplication structured data without fabricated ratings', () => {
    const jsonLd = buildHomeJsonLd('https://example.com')
    const serialized = JSON.stringify(jsonLd)

    expect(jsonLd['@graph'].map((entry) => entry['@type'])).toEqual(['WebSite', 'WebApplication'])
    expect(serialized).toContain('https://example.com/#application')
    expect(serialized).toContain('2026-08-10')
    expect(serialized).not.toContain('aggregateRating')
  })

  it('keeps noindex pages crawlable while blocking private application surfaces', () => {
    const output = robots()
    const rules = Array.isArray(output.rules) ? output.rules : [output.rules]
    const wildcardRule = rules.find((rule) => rule.userAgent === '*')

    expect(wildcardRule?.disallow).toEqual(['/admin', '/api/'])
    expect(wildcardRule?.disallow).not.toContain('/claims/new')
    expect(wildcardRule?.disallow).not.toContain('/claims/result')
  })

  it('publishes only canonical public pages with a stable reviewed date', () => {
    const entries = sitemap()

    expect(entries.map((entry) => new URL(entry.url).pathname)).toEqual([
      '/',
      '/guides',
      '/guides/compulsory-insurance',
      '/guides/pain-and-suffering',
      '/guides/work-loss',
      '/about',
      '/privacy',
      '/terms',
    ])
    expect(
      entries.every(
        (entry) => entry.lastModified?.toString() === new Date('2026-08-10').toString(),
      ),
    ).toBe(true)
  })

  it('uses Article and BreadcrumbList schema for sourced guides without FAQ markup', () => {
    const jsonLd = buildGuideJsonLd({
      path: '/guides/work-loss',
      title: '工作損失指南',
      description: '測試描述',
      citations: [OFFICIAL_SOURCES.civil193],
    })
    const serialized = JSON.stringify(jsonLd)

    expect(jsonLd['@graph'].map((entry) => entry['@type'])).toEqual(['Article', 'BreadcrumbList'])
    expect(serialized).toContain(OFFICIAL_SOURCES.civil193)
    expect(serialized).not.toContain('FAQPage')
  })

  it('serves a plain-text AI discovery file with limitations and official sources', async () => {
    const response = GET()
    const body = await response.text()

    expect(response.headers.get('content-type')).toContain('text/plain')
    expect(body).toContain('試算結果不構成法律意見')
    expect(body).toContain('law.moj.gov.tw')
    expect(body).toContain('opendata.judicial.gov.tw')
  })
})
