import type { Metadata } from 'next'
import { GuideArticle } from '@/components/GuideArticle'
import { buildGuideJsonLd, OFFICIAL_SOURCES } from '@/lib/guides'

const path = '/guides/compulsory-insurance'
const title = '強制險理賠項目有哪些？2026 給付上限與文件整理'
const description =
  '整理2026年7月1日起台灣強制汽車責任保險的傷害醫療、失能與死亡給付，說明20萬元醫療上限、320萬元合計上限、細項限額與申請文件。'
const citations = [OFFICIAL_SOURCES.compulsoryAct, OFFICIAL_SOURCES.compulsoryStandard]

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: { title, description, type: 'article', locale: 'zh_TW', url: path },
  twitter: { card: 'summary_large_image', title, description },
}

export default function CompulsoryInsuranceGuidePage() {
  const jsonLd = buildGuideJsonLd({ path, title, description, citations })

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <GuideArticle
        path={path}
        title="強制險理賠項目有哪些？先看事故日、給付種類與細項限額"
        summary="強制險不是把所有醫療支出加總後照單全付。它提供傷害醫療、失能與死亡基本保障；醫療費用還要符合必要、合理、實際支出及各細項限制。"
        sources={[
          { label: '全國法規資料庫：強制汽車責任保險法', href: OFFICIAL_SOURCES.compulsoryAct },
          {
            label: '金融監督管理委員會：強制汽車責任保險給付標準（115年5月29日修正）',
            href: OFFICIAL_SOURCES.compulsoryStandard,
          },
        ]}
      >
        <h2>強制險主要有三類給付</h2>
        <p>
          依強制汽車責任保險法與給付標準，受害人因汽車交通事故受傷、失能或死亡時，可依條件申請相應給付。這是人身基本保障，不包含精神慰撫金、工作收入損失或車輛修復費。
        </p>

        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>給付種類</th>
                <th>2026年7月1日起標準</th>
                <th>判斷重點</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>傷害醫療費用</td>
                <td>每一受害人、每一事故合計最高 20 萬元</td>
                <td>必須且合理的實際支出，並受細項限額約束</td>
              </tr>
              <tr>
                <td>失能給付</td>
                <td>15 個等級，8 萬元至 300 萬元</td>
                <td>治療後症狀固定，符合失能標準表與診斷要求</td>
              </tr>
              <tr>
                <td>死亡給付</td>
                <td>每人 300 萬元</td>
                <td>由法定請求權人依規定申請</td>
              </tr>
              <tr>
                <td>每人合計上限</td>
                <td>最高 320 萬元</td>
                <td>死亡或失能給付加傷害醫療費用的合計上限</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          上表適用於2026年7月1日起施行的新標準。事故發生在施行日前時，不能只看現在的金額，應先依事故日確認適用版本。估算器會把事故日當成必要欄位，就是為了避免把新舊標準混用。
        </p>

        <h2>20萬元醫療上限，不代表20萬元內都會全額給付</h2>
        <p>
          給付標準要求費用必須是治療所需、合理且實際支出。醫療給付範圍包括急救、診療、接送與看護，但部分項目另有每日、單項或期間上限。例如接送費用最高2萬元；看護費每日最高1,200元且最多30日，居家看護還需要合格醫師證明必要性。
        </p>
        <p>
          病房差額、膳食、義肢、義齒、義眼及部分醫療材料也有各自標準。因此，申請時不能只交一張總額收據；最好把費用按日期與類別整理，並保留診斷書、醫囑、收據正本或保險公司接受的證明。
        </p>

        <h2>失能給付不是有傷就能直接套等級</h2>
        <p>
          強制險所稱失能，重點在治療後症狀已固定，再治療仍不能期待改善，並由合格醫師依失能給付標準表診斷。第1級至第15級的給付金額不同，多項障害同時存在時，也有升級與合計額限制規則，不能單純把各部位金額直接相加。
        </p>
        <ul>
          <li>先確認治療是否已達症狀固定，而不是只看事故後經過多久。</li>
          <li>確認診斷書的醫院層級、醫師資格與記載內容是否符合標準表要求。</li>
          <li>多項障害需依給付標準的合併規則審核，不宜自行逐項相加。</li>
          <li>原有失能因事故加重時，給付會涉及加重前後等級差額。</li>
        </ul>

        <h2>肇責比例應與民事賠償分開處理</h2>
        <p>
          本工具不把肇責比例直接乘入強制險試算，因為強制險是受害人的基本人身保障；肇責主要在民事損害與第三人責任險區塊另外處理。但故意行為、法定除外或請求權資格等情形仍應依法律與個案審查，不能把「不乘肇責」理解成任何情況都一定給付。
        </p>

        <h2>申請前的文件清單</h2>
        <ul>
          <li>交通事故資料、當事人與事故車輛資訊。</li>
          <li>診斷證明書、病歷摘要或醫囑。</li>
          <li>醫療、交通、看護、輔具等收據與明細。</li>
          <li>居家看護或特殊醫材的醫療必要性證明。</li>
          <li>失能案件所需的失能診斷書與檢查資料。</li>
          <li>已向其他單位申請或領取給付的紀錄，避免重複或遺漏抵扣。</li>
        </ul>

        <h2>常見誤算</h2>
        <ul>
          <li>把精神慰撫金、工作損失或車損放進強制險。</li>
          <li>只看20萬元總上限，忽略病房、接送、看護等細項限制。</li>
          <li>用申請日而不是事故日選擇新舊給付標準。</li>
          <li>看到傷勢名稱就自行認定失能等級，沒有確認症狀固定與診斷資格。</li>
          <li>把多項失能金額直接相加，忽略合併與升級規則。</li>
        </ul>
      </GuideArticle>
    </>
  )
}
