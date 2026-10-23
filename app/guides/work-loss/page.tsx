import type { Metadata } from 'next'
import { GuideArticle } from '@/components/GuideArticle'
import { buildGuideJsonLd, OFFICIAL_SOURCES } from '@/lib/guides'

const path = '/guides/work-loss'
const title = '車禍工作損失怎麼算？受僱、自營業證明與休養期間'
const description =
  '整理台灣車禍不能工作損失的計算邏輯，說明診斷休養期間、薪資與扣薪證明、自營業所得資料，以及工作損失和勞動能力減損的差別。'
const citations = [
  OFFICIAL_SOURCES.civil184,
  OFFICIAL_SOURCES.civil193,
  OFFICIAL_SOURCES.judicialData,
]

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: { title, description, type: 'article', locale: 'zh_TW', url: path },
  twitter: { card: 'summary_large_image', title, description },
}

export default function WorkLossGuidePage() {
  const jsonLd = buildGuideJsonLd({ path, title, description, citations })

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <GuideArticle
        path={path}
        title="車禍工作損失怎麼算？收入、不能工作期間都要有證明"
        summary="工作損失不是用受傷天數直接乘月薪。通常要同時證明事故造成不能工作、醫療上需要休養的期間，以及這段期間實際減少的收入。"
        sources={[
          { label: '全國法規資料庫：民法第184條', href: OFFICIAL_SOURCES.civil184 },
          { label: '全國法規資料庫：民法第193條', href: OFFICIAL_SOURCES.civil193 },
          { label: '司法院資料開放平台', href: OFFICIAL_SOURCES.judicialData },
          { label: '法院：車禍損害賠償事件審理參考事項', href: OFFICIAL_SOURCES.courtReference },
        ]}
      >
        <h2>先區分兩種不同損失</h2>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>項目</th>
                <th>核心問題</th>
                <th>常見期間</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>不能工作損失</td>
                <td>治療或休養期間，實際少了多少收入</td>
                <td>事故後至合理復工期間</td>
              </tr>
              <tr>
                <td>勞動能力減損</td>
                <td>症狀固定後，未來工作能力是否持續降低</td>
                <td>可能延伸至工作年限，需另行評估</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          民法第193條涵蓋因身體或健康受侵害而喪失或減少勞動能力的損害。短期不能工作與長期能力減損在證明方式、期間與計算上不同，不應把同一期間重複計入。
        </p>

        <h2>基本計算邏輯：可證明的收入損失 × 合理期間</h2>
        <p>
          試算時可以先用「平均可證明收入 ÷ 對應日數 ×
          不能工作日數」建立初步範圍，但這不是法院必然採用的公式。最後仍要確認雇主是否扣薪、請假性質、收入是否固定、醫師建議的休養期間，以及傷勢是否真的讓當事人無法從事原工作。
        </p>
        <p>
          例如使用特休或雇主仍全額發薪時，是否存在可請求的實際損害，不能只看沒有上班；有績效獎金、輪班津貼或佣金者，也要證明這些收入具有規律性及確因事故減少。
        </p>

        <h2>受僱者應準備哪些文件</h2>
        <ul>
          <li>診斷證明書，最好明確記載建議休養或不能從事工作的期間。</li>
          <li>請假證明、出勤紀錄及假別。</li>
          <li>雇主出具的扣薪或收入減少證明。</li>
          <li>事故前數月的薪資單、薪轉紀錄、扣繳憑單與勞保投保資料。</li>
          <li>固定津貼、佣金或獎金的計算規則及歷史紀錄。</li>
          <li>復工日期、調職、減少工時或工作內容改變的紀錄。</li>
        </ul>
        <p>
          只有一張「休養三個月」診斷書，未必足以證明三個月全部收入都消失；只有薪資單，也不能單獨證明這段期間在醫療上確實不能工作。兩類證據必須互相對得起來。
        </p>

        <h2>自營業、接案與現金收入怎麼整理</h2>
        <p>
          自營業者最容易把營業額直接當成所得。營業收入通常還要扣除原料、人事、租金等成本；事故期間店面仍營業，也需要說明本人缺席造成的實際差額。可使用的資料包括報稅所得、帳簿、發票、平台對帳單、銀行入帳、固定客戶合約及事故前後同期比較。
        </p>
        <ul>
          <li>比較事故前後相同月份或合理期間，避免只挑最高月份。</li>
          <li>把營業額、毛利與個人所得分開，不用同一數字代表全部。</li>
          <li>若聘請代班人員，保留代班費與付款證明。</li>
          <li>接案者可整理已取消案件、合約、報價與過往穩定成交紀錄。</li>
          <li>現金收入缺少外部紀錄時，證明力通常較弱，不應憑口述硬填。</li>
        </ul>

        <h2>休養期間不是越長越好，而是要與傷勢及工作相符</h2>
        <p>
          同樣的骨折，辦公室工作、搬運工作與需要長時間駕駛的職業，復工條件可能不同。法院或保險公司會看診斷、治療進度、工作內容與實際復工情形。若休養期間延長，應有後續門診、復健或醫囑支持，而不是只沿用事故當天的初診證明。
        </p>

        <h2>工作損失不進強制險</h2>
        <p>
          強制險的給付範圍是傷害醫療、失能與死亡基本保障，不能工作損失屬於民事損害範圍。本工具會把它放在民事損害與第三人責任險試算，不會塞進強制險20萬元醫療上限。
        </p>

        <h2>常見被刪減的原因</h2>
        <ul>
          <li>請求期間超過診斷或治療紀錄可支持的期間。</li>
          <li>沒有扣薪、收入減少或營業損失的客觀資料。</li>
          <li>用營業額代替扣除成本後的實際所得。</li>
          <li>以最低工資或同業行情取代本人原有收入，卻沒有說明原因。</li>
          <li>短期工作損失與長期勞動能力減損重複計算。</li>
          <li>沒有處理肇責比例或已領取的相關給付。</li>
        </ul>

        <h2>送出試算前的交叉檢查</h2>
        <ol>
          <li>診斷建議休養期間與實際請假日期是否一致。</li>
          <li>薪資、扣繳與銀行資料是否指向相近的平均收入。</li>
          <li>雇主是否全額給薪，假別是否真的造成財產損失。</li>
          <li>自營業收入是否已扣除仍會發生的必要成本。</li>
          <li>是否把永久能力減損與短期不能工作分開。</li>
        </ol>
      </GuideArticle>
    </>
  )
}
