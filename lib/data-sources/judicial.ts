// =====================================================================
// 司法院法學資料（judicial.gov.tw）— 判決案例 mock
// 用途：精神慰撫金、看護費、工作損失、車損、失能補償、因果關係區間
// 規範：spec §三 + §九-2
// MVP：全 mock，未來改打 judicial.gov.tw API
// 重點：focus 在「區間參考」，不預測單一判決金額
// =====================================================================

import type {
  CourtCaseReference,
  CourtCompensationCase,
  CourtCaseCategory,
} from './types'

// --- 6 個直轄市/分院下肢傷害判決區間（mock，彙整自常見民事判決）-------
// 注意：金額為示意，依實際法院統計可能 ±20% 波動

const COMPENSATION_TABLE: CourtCompensationCase[] = [
  {
    courtName: '臺灣臺北地方法院',
    category: 'pain_and_suffering',
    sampleSize: 50,
    amountLow: 80_000,
    amountMid: 250_000,
    amountHigh: 600_000,
    notes: '都會區，下肢擦挫傷常見區間，骨折可達 60 萬',
  },
  {
    courtName: '臺灣新北地方法院',
    category: 'pain_and_suffering',
    sampleSize: 45,
    amountLow: 60_000,
    amountMid: 200_000,
    amountHigh: 500_000,
    notes: '大台北生活圈，區間略低於台北地院',
  },
  {
    courtName: '臺灣臺中地方法院',
    category: 'pain_and_suffering',
    sampleSize: 60,
    amountLow: 50_000,
    amountMid: 150_000,
    amountHigh: 400_000,
    notes: '中部基準，骨折 + 手術常見 30-40 萬',
  },
  {
    courtName: '臺灣臺南地方法院',
    category: 'pain_and_suffering',
    sampleSize: 40,
    amountLow: 50_000,
    amountMid: 140_000,
    amountHigh: 350_000,
    notes: '南部區間',
  },
  {
    courtName: '臺灣高雄地方法院',
    category: 'pain_and_suffering',
    sampleSize: 55,
    amountLow: 50_000,
    amountMid: 130_000,
    amountHigh: 350_000,
    notes: '南部都會區',
  },
  {
    courtName: '臺灣桃園地方法院',
    category: 'pain_and_suffering',
    sampleSize: 35,
    amountLow: 50_000,
    amountMid: 150_000,
    amountHigh: 400_000,
    notes: '桃竹苗區域',
  },

  // === 看護費（日額，元/日）===
  {
    courtName: '臺灣臺北地方法院',
    category: 'nursing_fee',
    sampleSize: 80,
    amountLow: 2_200,
    amountMid: 2_400,
    amountHigh: 2_800,
    notes: '台北行情，家屬看護折半',
  },
  {
    courtName: '臺灣臺中地方法院',
    category: 'nursing_fee',
    sampleSize: 70,
    amountLow: 2_000,
    amountMid: 2_400,
    amountHigh: 2_600,
    notes: '中部行情',
  },
  {
    courtName: '臺灣高雄地方法院',
    category: 'nursing_fee',
    sampleSize: 60,
    amountLow: 2_000,
    amountMid: 2_200,
    amountHigh: 2_600,
    notes: '南部行情',
  },

  // === 工作損失（單月，元）===
  {
    courtName: '臺灣臺北地方法院',
    category: 'work_loss',
    sampleSize: 65,
    amountLow: 35_000,
    amountMid: 50_000,
    amountHigh: 80_000,
    notes: '以傷者實際薪資為準，無證明者以基本工資',
  },
  {
    courtName: '臺灣臺中地方法院',
    category: 'work_loss',
    sampleSize: 55,
    amountLow: 28_000,
    amountMid: 40_000,
    amountHigh: 60_000,
    notes: '以基本工資 28,590 元為下限',
  },
]

// --- 個別案件參考（mock 6 件代表性案件）----------------------------

const CASE_REFERENCES: CourtCaseReference[] = [
  {
    caseId: '111年度訴字第4523號',
    courtName: '臺灣臺中地方法院',
    caseYear: 2022,
    category: 'pain_and_suffering',
    amount: 350_000,
    amountLow: 200_000,
    amountHigh: 500_000,
    summary: '右脛骨骨折 + 手術，住院 14 日，復健 6 個月',
    keyReasoning: '骨折 + 手術 + 長期復健，認列中重度慰撫金',
    referenceNote: '骨折 + 手術區間（中部法院）',
  },
  {
    caseId: '112年度訴字第1234號',
    courtName: '臺灣臺北地方法院',
    caseYear: 2023,
    category: 'pain_and_suffering',
    amount: 600_000,
    amountLow: 350_000,
    amountHigh: 900_000,
    summary: '右膝半月板破裂 + 永久障害第 11 級',
    keyReasoning: '永久障害 + 勞動能力減損，認列重度慰撫金',
    referenceNote: '永久障害區間（北部法院）',
  },
  {
    caseId: '111年度訴字第8765號',
    courtName: '臺灣高雄地方法院',
    caseYear: 2022,
    category: 'pain_and_suffering',
    amount: 150_000,
    amountLow: 100_000,
    amountHigh: 280_000,
    summary: '右踝扭傷 + 疤痕 8 公分，無失能',
    keyReasoning: '明顯疤痕 + 治療期長，認列中度慰撫金',
    referenceNote: '疤痕 + 復健區間（南部法院）',
  },
  {
    caseId: '110年度訴字第3344號',
    courtName: '臺灣新北地方法院',
    caseYear: 2021,
    category: 'nursing_fee',
    amount: 84_000,
    amountLow: 60_000,
    amountHigh: 120_000,
    summary: '住院 35 日，需全日看護',
    keyReasoning: '強制險 30 日上限 36,000 元，餘 5 日 2,400 元/日 走第三人險 = 12,000 元，合計 48,000 元 → 法院再調升為 84,000 元（家屬看護折半）',
    referenceNote: '看護費計算：強制險 30 日 cap + 第三人險補差額',
  },
  {
    caseId: '112年度訴字第5678號',
    courtName: '臺灣臺中地方法院',
    caseYear: 2023,
    category: 'work_loss',
    amount: 240_000,
    amountLow: 100_000,
    amountHigh: 350_000,
    summary: '日領 1,600 元臨時工，請假 5 個月',
    keyReasoning: '有雇主扣薪證明，5 個月工作損失 240,000 元全額認列',
    referenceNote: '日領/按件計酬：需雇主扣薪證明',
  },
  {
    caseId: '111年度訴字第9876號',
    courtName: '臺灣桃園地方法院',
    caseYear: 2022,
    category: 'vehicle_damage',
    amount: 180_000,
    amountLow: 150_000,
    amountHigh: 220_000,
    summary: '車輛市場價 30 萬，殘值 12 萬，維修估價 22 萬',
    keyReasoning: '取「維修估價 22 萬 vs 車價-殘值 18 萬」較低者 = 18 萬，再加拖吊費等',
    referenceNote: '車損：min(估價, 車價-殘值) + 拖吊/代步',
  },
]

// --- 對外 API --------------------------------------------------------

/** 取得某法院某類別的區間統計 */
export function getCourtCompensation(
  courtName: string,
  category: CourtCaseCategory,
): CourtCompensationCase | null {
  return (
    COMPENSATION_TABLE.find(
      (c) => c.courtName === courtName && c.category === category,
    ) ?? null
  )
}

/** 取得所有支援的法院+類別區間（給前端「地區實務參考」表格用） */
export function listAllCompensationTable(): CourtCompensationCase[] {
  return [...COMPENSATION_TABLE]
}

/** 取得代表性案件參考 */
export function getCaseReferencesByCategory(
  category: CourtCaseCategory,
): CourtCaseReference[] {
  return CASE_REFERENCES.filter((c) => c.category === category)
}

/** 查詢單一案件 */
export function getCaseReferenceById(caseId: string): CourtCaseReference | null {
  return CASE_REFERENCES.find((c) => c.caseId === caseId) ?? null
}

/** 計算某法院某類別的「中位數金額」 */
export function getMedianCourtCompensation(
  courtName: string,
  category: CourtCaseCategory,
): number | null {
  const data = getCourtCompensation(courtName, category)
  return data ? data.amountMid : null
}

/** 取得所有支援的法院名稱（給前端驗證用） */
export function getSupportedCourts(): string[] {
  const set = new Set(COMPENSATION_TABLE.map((c) => c.courtName))
  return Array.from(set)
}

/** 取得案例總數（給前端顯示「目前資料庫共 N 筆」用） */
export function getCourtCaseCount(): number {
  return CASE_REFERENCES.length
}
