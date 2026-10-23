import type { Metadata } from 'next'
import { GuideArticle } from '@/components/GuideArticle'
import { buildGuideJsonLd, OFFICIAL_SOURCES } from '@/lib/guides'

const path = '/guides/pain-and-suffering'
const title = '車禍精神慰撫金怎麼算？法院因素、證明與判例整理'
const description =
  '說明台灣車禍精神慰撫金依民法第195條主張時，法院會考量的傷勢、治療、雙方身分資力、加害情節與證明資料，以及判例區間的正確用法。'
const citations = [
  OFFICIAL_SOURCES.civil184,
  OFFICIAL_SOURCES.civil195,
  OFFICIAL_SOURCES.judicialData,
]

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: path },
  openGraph: { title, description, type: 'article', locale: 'zh_TW', url: path },
  twitter: { card: 'summary_large_image', title, description },
}

export default function PainAndSufferingGuidePage() {
  const jsonLd = buildGuideJsonLd({ path, title, description, citations })

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <GuideArticle
        path={path}
        title="車禍精神慰撫金怎麼算？沒有固定公式，先整理法院會看的事實"
        summary="精神慰撫金是非財產上損害，不是醫療費的倍數，也沒有全國統一價目表。傷勢與治療經過很重要，但法院還會綜合加害情節、雙方身分資力及個案痛苦程度。"
        sources={[
          { label: '全國法規資料庫：民法第184條', href: OFFICIAL_SOURCES.civil184 },
          { label: '全國法規資料庫：民法第195條', href: OFFICIAL_SOURCES.civil195 },
          { label: '司法院資料開放平台', href: OFFICIAL_SOURCES.judicialData },
          { label: '法院：車禍損害賠償事件審理參考事項', href: OFFICIAL_SOURCES.courtReference },
        ]}
      >
        <h2>精神慰撫金在補償什麼</h2>
        <p>
          民法第195條處理的是身體、健康等人格權遭不法侵害所生的非財產上損害。它補償的是傷勢、治療、生活受限等造成的精神痛苦，不等同醫療費、薪資損失或勞動能力減損，也不能把這些項目重複包進同一筆金額。
        </p>
        <p>
          車禍只有財物受損而沒有人身權益受侵害時，通常不能只因修車不便就直接套用人身傷害的慰撫金邏輯。是否符合請求要件，仍需回到侵權事實、受侵害權利與證據判斷。
        </p>

        <h2>法院通常會綜合哪些因素</h2>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>因素</th>
                <th>可整理的事實</th>
                <th>常見證明</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>傷勢與治療</td>
                <td>骨折、手術、住院、復健、疼痛、後遺症</td>
                <td>診斷書、病歷、手術與復健紀錄</td>
              </tr>
              <tr>
                <td>生活影響</td>
                <td>行動受限、需要照顧、睡眠或日常功能受影響</td>
                <td>醫囑、看護證明、生活紀錄</td>
              </tr>
              <tr>
                <td>加害情節</td>
                <td>過失程度、事故經過、事後處理態度</td>
                <td>事故資料、判決或調解紀錄</td>
              </tr>
              <tr>
                <td>雙方情況</td>
                <td>身分、職業、教育、收入與經濟狀況</td>
                <td>個案卷證與法院調查資料</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          這些因素不是一張打分表。相同傷名可能因手術次數、復原期間、永久影響與個人情況不同而得到不同結果；不同法院與不同年份的案件，也不能只看最後金額而忽略案情。
        </p>

        <h2>判例區間應該怎麼用</h2>
        <p>
          判例適合用來檢查請求是否明顯偏離相似案件，而不是直接複製金額。至少應比對傷勢程度、治療方式、是否失能、事故年份、法院、肇責與判決中實際認定的慰撫金欄位。
        </p>
        <ol>
          <li>先排除只有總賠償額、沒有拆出慰撫金的案件。</li>
          <li>確認比對的是法院認定金額，不只是原告請求金額。</li>
          <li>優先選擇傷勢與治療經過接近的案件，而不是只比同一縣市。</li>
          <li>把舊年度案件視為背景資料，不直接當成現值。</li>
          <li>案件數不足或差異太大時，只顯示寬區間並提醒人工複核。</li>
        </ol>
        <p>
          本估算器用規則區間、歷史判決統計與相似案件交叉檢查，目的在揭露不同推理來源是否一致。當資料分散時，系統不會把某一個模型的數字包裝成確定答案。
        </p>

        <h2>準備資料時，重點是可核對的影響</h2>
        <ul>
          <li>完整診斷名稱、手術與住院日期。</li>
          <li>醫師建議休養、復健、使用輔具或需要照顧的期間。</li>
          <li>疤痕、活動角度、慢性疼痛或永久後遺症的後續紀錄。</li>
          <li>事故前後日常活動、工作與家庭照顧功能的具體變化。</li>
          <li>已接受心理或身心科治療者，保留正式醫療紀錄；不要為了求償自行誇大。</li>
        </ul>

        <h2>三種常見錯誤</h2>
        <h3>把醫療費乘上固定倍數</h3>
        <p>醫療費反映實際支出，慰撫金反映非財產上痛苦；兩者可能相關，但不存在通用的固定倍數。</p>
        <h3>只挑最高額判決</h3>
        <p>
          高額案件往往伴隨重傷、多次手術、永久失能或特殊加害情節。沒有比對完整事實，就不能當作自己的直接基準。
        </p>
        <h3>把總和解金當成慰撫金</h3>
        <p>
          和解總額可能包含醫療、工作、看護、車損或其他讓步。若資料沒有拆項，就不適合拿來訓練或校驗慰撫金模型。
        </p>

        <h2>何時應該人工複核</h2>
        <p>
          有永久失能、重大手術、長期照護、未成年或高齡受害人、責任比例爭議、既往病史或判例差異很大時，單靠線上試算不足以處理。應把計算表、醫療時間軸與證據清單交由熟悉理賠或侵權案件的專業人士檢視。
        </p>
      </GuideArticle>
    </>
  )
}
