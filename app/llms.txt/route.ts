import { SITE_URL } from '@/lib/seo'

export const dynamic = 'force-static'

export function GET() {
  const body = `# 台灣車禍理賠金額估算器

> 免費的臺灣車禍體傷理賠初步試算工具，依事故、醫療、收入與法院公開資料整理可主張項目、估算範圍與補件清單。

## 主要頁面
- [首頁與工具說明](${SITE_URL}/)
- [開始初步試算](${SITE_URL}/claims/new)
- [車禍理賠完整指南](${SITE_URL}/guides)
- [強制險理賠項目與給付上限](${SITE_URL}/guides/compulsory-insurance)
- [車禍精神慰撫金整理](${SITE_URL}/guides/pain-and-suffering)
- [車禍工作損失計算與證明](${SITE_URL}/guides/work-loss)
- [關於工具與資料方法](${SITE_URL}/about)
- [隱私權政策](${SITE_URL}/privacy)
- [服務條款與免責聲明](${SITE_URL}/terms)

## 使用限制
- 試算結果不構成法律意見、法院判決或保險理賠承諾。
- 實際結果仍須依醫療證明、肇事責任、保單條款、保險公司審核、調解或法院認定。
- 資料不足的項目會回傳補件提示，不會憑空填值。

## 主要公開來源
- [強制汽車責任保險法](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=G0390060)
- [民法](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=B0000001)
- [司法院資料開放平台](https://opendata.judicial.gov.tw/)
`

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
