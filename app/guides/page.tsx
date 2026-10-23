import type { Metadata } from 'next'
import Link from 'next/link'
import { CONTENT_LAST_REVIEWED, SITE_URL } from '@/lib/seo'
import { GUIDES, OFFICIAL_SOURCES } from '@/lib/guides'

const title = '車禍理賠怎麼算？台灣理賠項目、文件與試算指南'
const description =
  '整理台灣車禍後常見的強制險、醫療費、看護費、工作損失、勞動能力減損、精神慰撫金與車損，說明肇責、證明文件和試算順序。'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/guides' },
  openGraph: {
    title,
    description,
    type: 'article',
    locale: 'zh_TW',
    url: '/guides',
  },
  twitter: { card: 'summary_large_image', title, description },
}

function buildGuidesJsonLd() {
  const url = `${SITE_URL}/guides`
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${url}#collection`,
        url,
        name: title,
        description,
        inLanguage: 'zh-Hant',
        dateModified: CONTENT_LAST_REVIEWED,
        author: { '@type': 'Person', name: '理賠顧問小鄭' },
        hasPart: GUIDES.map((guide) => ({
          '@type': 'Article',
          name: guide.title,
          url: `${SITE_URL}${guide.href}`,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '首頁', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: '車禍理賠指南', item: url },
        ],
      },
    ],
  }
}

export default function GuidesPage() {
  const jsonLd = buildGuidesJsonLd()

  return (
    <main id="main-content" className="flex-1 bg-surface-subtle">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <article className="mx-auto w-full max-w-5xl px-6 py-10 md:py-16">
        <nav aria-label="麵包屑" className="mb-8 text-sm text-muted">
          <Link href="/" className="hover:text-accent">
            首頁
          </Link>
          <span aria-hidden="true"> / </span>
          車禍理賠指南
        </nav>

        <header className="max-w-4xl">
          <p className="mb-3 text-sm font-semibold tracking-wide text-accent">
            2026 臺灣車禍理賠指南
          </p>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground md:text-5xl">
            車禍理賠怎麼算？先把保障、損害與證明分開
          </h1>
          <p className="mt-5 text-lg leading-8 text-muted">
            車禍後沒有一個金額可以直接套公式。比較可靠的做法，是先區分強制險與民事損害，再把每一項實際支出、不能工作的期間、失能狀態與肇責資料逐項整理。
          </p>
          <p className="mt-5 text-sm text-muted">
            內容整理：理賠顧問小鄭 · 最後檢視：
            <time dateTime={CONTENT_LAST_REVIEWED}>{CONTENT_LAST_REVIEWED}</time>
          </p>
        </header>

        <section className="guide-content mt-12">
          <h2>先記住：強制險與民事賠償不是同一張表</h2>
          <p>
            強制汽車責任保險提供基本的人身保障，給付範圍集中在傷害醫療、失能與死亡；民事損害則處理因他人故意或過失造成的實際損失，例如醫療差額、看護、工作收入減少、勞動能力減損、精神慰撫金與財物損害。把兩者混在一起，容易重複計算或誤以為所有支出都能由強制險支付。
          </p>

          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>整理區塊</th>
                  <th>常見項目</th>
                  <th>先準備什麼</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>強制險</td>
                  <td>傷害醫療、失能、死亡給付</td>
                  <td>事故資料、診斷書、醫療收據、失能診斷</td>
                </tr>
                <tr>
                  <td>民事人身損害</td>
                  <td>醫療差額、看護、交通、工作損失、慰撫金</td>
                  <td>必要性證明、支出憑證、收入與請假紀錄</td>
                </tr>
                <tr>
                  <td>財物損害</td>
                  <td>車輛修復、拖吊與其他必要費用</td>
                  <td>估價單、發票、車齡與受損照片</td>
                </tr>
                <tr>
                  <td>責任與抵扣</td>
                  <td>肇責比例、已領保險金、和解付款</td>
                  <td>初判表、鑑定資料、理賠與付款紀錄</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>車禍理賠的六步整理順序</h2>
          <ol>
            <li>
              <strong>固定事故事實：</strong>保留事故聯單、現場照片、行車紀錄器、報案與就醫時間。
            </li>
            <li>
              <strong>建立醫療時間軸：</strong>按日期整理診斷、門診、住院、手術、復健與醫囑。
            </li>
            <li>
              <strong>逐項保存支出：</strong>
              醫療、交通、看護與輔具都應保留收據，並確認是否有醫療必要性。
            </li>
            <li>
              <strong>證明收入影響：</strong>把診斷建議休養期間，對照請假、扣薪、薪資或營業資料。
            </li>
            <li>
              <strong>分開計算保障：</strong>
              先看強制險可給付項目，再整理民事損害與任意第三人責任險可能處理的範圍。
            </li>
            <li>
              <strong>最後才套肇責與扣除：</strong>
              民事請求需處理過失比例及已領取款項；不要先把肇責直接乘進每一個欄位。
            </li>
          </ol>

          <h2>資料不足時，不應硬填一個看似精確的金額</h2>
          <p>
            理賠試算最常見的錯誤，是用最低工資猜收入、用住院天數猜看護需求，或用傷勢名稱直接猜慰撫金。這些數字看起來完整，卻未必能由文件支持。本工具遇到缺少診斷、收入或費用資料時，會標示資料不足並列出補件，而不是自行補值。
          </p>
        </section>

        <section className="mt-12" aria-labelledby="guide-topics">
          <h2 id="guide-topics" className="text-3xl font-semibold text-foreground">
            依理賠項目深入閱讀
          </h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {GUIDES.map((guide) => (
              <Link
                key={guide.href}
                href={guide.href}
                className="rounded-2xl border border-border bg-background p-6 text-foreground hover:border-accent hover:shadow-sm"
              >
                <h3 className="text-lg font-semibold">{guide.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted">{guide.description}</p>
                <span className="mt-5 inline-block text-sm font-semibold text-accent">
                  閱讀指南 →
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="guide-content mt-12">
          <h2>官方依據與資料責任</h2>
          <p>
            本指南依現行法規與法院公開資料整理。強制險細項與限額應以金管會最新給付標準為準；民事損害的成立與金額則依個案證據、過失比例、調解或法院判斷。法規或給付標準更新後，頁面上的檢視日期也必須同步更新。
          </p>
          <ul>
            <li>
              <a
                href={OFFICIAL_SOURCES.compulsoryStandard}
                target="_blank"
                rel="noreferrer noopener"
              >
                金融監督管理委員會：強制汽車責任保險給付標準
              </a>
            </li>
            <li>
              <a href={OFFICIAL_SOURCES.civilCode} target="_blank" rel="noreferrer noopener">
                全國法規資料庫：民法
              </a>
            </li>
            <li>
              <a href={OFFICIAL_SOURCES.judicialData} target="_blank" rel="noreferrer noopener">
                司法院資料開放平台
              </a>
            </li>
          </ul>
        </section>

        <aside className="mt-12 rounded-2xl border border-amber-300 bg-amber-50 p-6 text-stone-800">
          <h2 className="text-lg font-semibold">本指南不是個案法律意見</h2>
          <p className="mt-2 leading-7">
            試算與內容只協助整理資料，不保證理賠或判決結果。重大傷害、責任爭議、時效或高額請求，應攜帶完整文件向保險經紀人或律師確認。
          </p>
        </aside>

        <div className="mt-10">
          <Link
            href="/claims/new"
            className="inline-block rounded-lg bg-accent px-5 py-3 font-semibold text-white hover:opacity-90"
          >
            開始車禍理賠初步試算
          </Link>
        </div>
      </article>
    </main>
  )
}
