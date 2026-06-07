// =====================================================================
// 法律條文常數（spec §六 + §七 + §八）
// MVP：引用 metadata，未來接 legal-reference API
// 重點：給前端「法源依據」頁面 / 「免責聲明」用
// =====================================================================

import type { LegalReference, LegalDocumentKey } from './types'

// --- 法源資料庫 -------------------------------------------------------

const REFERENCES: LegalReference[] = [
  {
    key: 'compulsory_insurance_act',
    title: '強制汽車責任保險法',
    effectiveDate: '1996-12-13',
    sourceUrl: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=G0390029',
    summary:
      '本法旨在使汽車交通事故之受害人能獲得基本保障，採無過失主義，' +
      '不論肇事責任，只要符合強制險承保範圍即可請領。',
    relevantArticles: ['§7 投保義務', '§27 給付項目', '§28 請求權時效'],
    lastReviewed: '2026-06-07',
  },
  {
    key: 'compulsory_payment_standard',
    title: '強制汽車責任保險給付標準',
    effectiveDate: '2026-07-01',  // 新制生效日
    sourceUrl: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=G0390051',
    summary:
      '規範強制險醫療費用、失能給付、死亡給付之細項上限。新制 2026-07-01 生效，' +
      '失能等級 1 等由 200 萬調高為 300 萬，其餘等級依比例調升。',
    relevantArticles: ['§2 醫療費用上限', '§3 看護費', '§4 失能等級表', '附表 失能等級'],
    lastReviewed: '2026-06-07',
  },
  {
    key: 'civil_code_184_196',
    title: '民法 §184-196 侵權行為損害賠償',
    effectiveDate: '1929-05-23',
    sourceUrl: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=B0000001',
    summary:
      '§184 侵權行為一般條款；§193 物之毀損 + 身體健康侵害之財產上損害賠償；' +
      '§194 侵害生命之非財產上損害賠償（慰撫金）；§195 身體權、健康權、名譽權之精神慰撫金。',
    relevantArticles: ['§184', '§193', '§194', '§195', '§197 請求權時效 2 年'],
    lastReviewed: '2026-06-07',
  },
  {
    key: 'disability_level_table',
    title: '強制汽車責任保險失能等級表（附表）',
    effectiveDate: '2026-07-01',
    sourceUrl: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=G0390051',
    summary:
      '失能等級 1-15 等對照給付金額。1 等 300 萬（新制），15 等 8 萬（新制）。' +
      '失能認定需由醫師開立「失能診斷書」並符合等級表描述。',
    relevantArticles: ['附表 失能等級 1-15'],
    lastReviewed: '2026-06-07',
  },
  {
    key: 'pain_and_suffering_guideline',
    title: '精神慰撫金估算規則（法院實務）',
    effectiveDate: '2010-01-01',  // 民法 §195 修正後
    sourceUrl: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=B0000001',
    summary:
      '精神慰撫金無固定公式，由法院斟酌：兩造身分、地位、經濟狀況、傷勢程度、' +
      '對生活之影響。實務常見區間 5 萬-90 萬，本系統依傷勢分 5 級評分。',
    relevantArticles: ['民法 §194', '民法 §195'],
    lastReviewed: '2026-06-07',
  },
  {
    key: 'foi_evaluation_principles',
    title: '金融消費評議中心評議原則',
    effectiveDate: '2012-01-01',  // 評議中心成立
    sourceUrl: 'https://www.foi.org.tw/',
    summary:
      '金融消費評議中心處理金融消費爭議，評議結果對保險公司有拘束力（除訴訟外）。' +
      '車禍理賠爭議常見類別：因果關係認定、必要醫療費、失能認定。',
    relevantArticles: ['金融消費者保護法 §13-25'],
    lastReviewed: '2026-06-07',
  },
]

// --- 對外 API --------------------------------------------------------

/** 取得所有法源 metadata（給前端「法源依據」頁面用） */
export function listLegalReferences(): LegalReference[] {
  return [...REFERENCES]
}

/** 依 key 查詢單一法源 */
export function getLegalReference(key: LegalDocumentKey): LegalReference | null {
  return REFERENCES.find((r) => r.key === key) ?? null
}

/** 取得主要法源（強制險法 + 給付標準 + 民法侵權） */
export function getPrimaryLegalReferences(): LegalReference[] {
  const primaryKeys: LegalDocumentKey[] = [
    'compulsory_insurance_act',
    'compulsory_payment_standard',
    'civil_code_184_196',
  ]
  return REFERENCES.filter((r) => primaryKeys.includes(r.key))
}

/** 取得強制險相關法源（用於結果頁強制險區塊底下的法源引註） */
export function getCompulsoryInsuranceReferences(): LegalReference[] {
  return REFERENCES.filter(
    (r) =>
      r.key === 'compulsory_insurance_act' || r.key === 'compulsory_payment_standard',
  )
}

/** 取得民事損害賠償法源（用於第三人險區塊） */
export function getCivilDamagesReferences(): LegalReference[] {
  return REFERENCES.filter(
    (r) => r.key === 'civil_code_184_196' || r.key === 'pain_and_suffering_guideline',
  )
}

/** 檢查某法源是否過期（effectiveDate 超過 10 年未更新） */
export function isLegalReferenceStale(ref: LegalReference): boolean {
  const lastReviewed = new Date(ref.lastReviewed)
  const now = new Date('2026-06-07')
  const ageInYears = (now.getTime() - lastReviewed.getTime()) / (1000 * 60 * 60 * 24 * 365)
  return ageInYears > 1  // 1 年未檢視 = stale
}
