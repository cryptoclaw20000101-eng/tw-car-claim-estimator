import { CONTENT_LAST_REVIEWED, SITE_URL } from '@/lib/seo'

export const GUIDES = [
  {
    href: '/guides/compulsory-insurance',
    title: '強制險理賠項目與給付上限',
    description: '釐清傷害醫療、失能與死亡給付，以及事故日與細項限額為何重要。',
  },
  {
    href: '/guides/pain-and-suffering',
    title: '車禍精神慰撫金怎麼整理',
    description: '說明法院常見審酌因素、證明資料，以及為什麼不能只套固定公式。',
  },
  {
    href: '/guides/work-loss',
    title: '車禍工作損失怎麼計算',
    description: '區分不能工作損失與勞動能力減損，整理受僱者、自營業者的舉證文件。',
  },
] as const

export const OFFICIAL_SOURCES = {
  compulsoryAct: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=G0390060',
  compulsoryStandard: 'https://law.fsc.gov.tw/LawContent.aspx?id=FL006901',
  civilCode: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=B0000001',
  civil184: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=B0000001&flno=184',
  civil193: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=B0000001&flno=193',
  civil195: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=B0000001&flno=195',
  judicialData: 'https://opendata.judicial.gov.tw/',
  courtReference: 'https://scd.judicial.gov.tw/tw/dl-27084-e60d841e977d4292bd70f9004ca22dee.html',
} as const

export function buildGuideJsonLd({
  path,
  title,
  description,
  citations,
}: {
  path: string
  title: string
  description: string
  citations: readonly string[]
}) {
  const url = `${SITE_URL}${path}`

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: title,
        description,
        mainEntityOfPage: url,
        inLanguage: 'zh-Hant',
        datePublished: CONTENT_LAST_REVIEWED,
        dateModified: CONTENT_LAST_REVIEWED,
        author: { '@type': 'Person', name: '理賠顧問小鄭' },
        publisher: { '@type': 'Person', name: '理賠顧問小鄭' },
        citation: citations,
        isPartOf: { '@id': `${SITE_URL}/guides#collection` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '首頁', item: `${SITE_URL}/` },
          {
            '@type': 'ListItem',
            position: 2,
            name: '車禍理賠指南',
            item: `${SITE_URL}/guides`,
          },
          { '@type': 'ListItem', position: 3, name: title, item: url },
        ],
      },
    ],
  }
}
