// =====================================================================
// 金融消費評議中心（FinTech Ombudsman Institution, foi.tw）— 案例 mock
// 用途：因果關係認定、必要醫療費、失能認定、看護費、工作損失爭議
// 規範：spec §三 + §九-1
// MVP：全 mock，未來改打 foi.tw API（其實目前 foi 沒對外開放 API）
// =====================================================================

import type { FoiDisputeCase, FoiDisputeCategory, FoiOutcome } from './types'

// --- 案例資料庫（mock）-----------------------------------------------
// 6 大類各放 2-3 個代表性案件
// 注意：金額數字為示意，非真實評議中心案件

const CASES: FoiDisputeCase[] = [
  // ============= 因果關係認定 =============
  {
    caseId: '110-評字第0823號',
    category: 'causation',
    caseYear: 2021,
    caseDate: '2021-08-15',
    courtName: '臺灣臺北地方法院',
    summary: '被保人主張車禍後 3 個月出現頸椎椎間盤突出，疑與事故因果關係存疑',
    keyReasoning: '事故當日就醫病歷雖未記載頸椎不適，但 2 週內持續回診，影像學顯示 C5-C6 椎間盤突出為新發生，認定與事故具相當因果關係',
    outcome: 'consumer_favor',
    compensationAmount: 380_000,
    referenceNote: '因果關係爭議：事故後 2 週內有就醫記錄 + 影像學佐證 → 較易認定因果',
  },
  {
    caseId: '111-評字第1456號',
    category: 'causation',
    caseYear: 2022,
    caseDate: '2022-11-20',
    courtName: null,
    summary: '車禍後 6 個月才就醫，無法證明腰傷與事故相關',
    keyReasoning: '事故後均無就醫紀錄，6 個月後始因腰痛就醫，期間另有搬家負重紀錄，難認事故為唯一肇因',
    outcome: 'insurer_favor',
    compensationAmount: 0,
    referenceNote: '因果關係爭議：事故後超過 3 個月才就醫 + 期間有其他外力介入 → 難認定因果',
  },
  {
    caseId: '112-評字第0301號',
    category: 'causation',
    caseYear: 2023,
    caseDate: '2023-04-10',
    courtName: '臺灣新北地方法院',
    summary: '事故後 10 日才就醫，但有鄰居證人可佐證當日即感不適',
    keyReasoning: '雖延遲就醫，但證人證述與醫師病歷相互勾稽，認定因果關係成立',
    outcome: 'partial',
    compensationAmount: 120_000,
    referenceNote: '因果關係爭議：有第三人證人 + 病歷可佐證 → 部分認定',
  },

  // ============= 必要醫療費 =============
  {
    caseId: '111-評字第2103號',
    category: 'necessary_medical',
    caseYear: 2022,
    caseDate: '2022-12-05',
    courtName: null,
    summary: '爭議：自費推拿、整脊、PRP 注射是否屬必要醫療',
    keyReasoning: '中醫推拿有醫師診斷證明且屬常規復健 → 認列；PRP 注射為高端自費療程，無實證支持為必要 → 不認列',
    outcome: 'partial',
    compensationAmount: 45_000,
    referenceNote: '自費項目認定：以「是否有醫師診斷 + 是否為常規醫療」為標準，高端自費療程通常不認列',
  },
  {
    caseId: '110-評字第1578號',
    category: 'necessary_medical',
    caseYear: 2021,
    caseDate: '2021-10-22',
    courtName: '臺灣臺中地方法院',
    summary: '健保已給付之自付額部分差額病房費認定',
    keyReasoning: '病房費差額 1,500 元/日為強制險給付標準上限以內，全額認列',
    outcome: 'consumer_favor',
    compensationAmount: 36_000,
    referenceNote: '病房差額：1,500 元/日以下 + 有醫囑 → 全額認列；超過上限需自費或第三人險處理',
  },

  // ============= 失能認定 =============
  {
    caseId: '112-評字第0912號',
    category: 'disability',
    caseYear: 2023,
    caseDate: '2023-07-18',
    courtName: '臺灣高雄地方法院',
    summary: '右膝半月板破裂術後，主張第 11 級失能',
    keyReasoning: '術後 6 個月 ROM 仍受限於伸展 -10°，有骨科失能診斷書，認列第 11 級',
    outcome: 'consumer_favor',
    compensationAmount: 400_000,
    referenceNote: '失能認定：以骨科/復健科失能診斷書為主，ROM 量測數字為輔',
  },
  {
    caseId: '111-評字第0289號',
    category: 'disability',
    caseYear: 2022,
    caseDate: '2022-03-30',
    courtName: null,
    summary: '軟組織受傷主張永久障害，但無失能診斷書',
    keyReasoning: '僅有一般診斷書，無合格失能鑑定報告，不認列失能等級',
    outcome: 'insurer_favor',
    compensationAmount: 0,
    referenceNote: '失能認定：無「失能診斷書」或「勞保失能等級」 → 無法請領失能給付',
  },

  // ============= 看護費 =============
  {
    caseId: '112-評字第1208號',
    category: 'nursing_fee',
    caseYear: 2023,
    caseDate: '2023-09-05',
    courtName: '臺灣臺北地方法院',
    summary: '住院 45 日，看護費實際支出每日 2,400 元',
    keyReasoning: '強制險看護上限 30 日 1,200 元/日，餘 15 日由第三人險按地區行情 2,400 元/日 認列',
    outcome: 'partial',
    compensationAmount: 72_000,
    referenceNote: '看護費：強制險只認 30 日 1,200 元/日；超過部分走第三人險，按地區 2,000-2,800 元/日',
  },
  {
    caseId: '110-評字第2001號',
    category: 'nursing_fee',
    caseYear: 2021,
    caseDate: '2021-12-12',
    courtName: null,
    summary: '家屬看護可否請領看護費',
    keyReasoning: '民法 §193 條不限「僱用」看護，家屬看護亦可請領，但需有醫囑證明必要性',
    outcome: 'consumer_favor',
    compensationAmount: 60_000,
    referenceNote: '家屬看護：需醫囑證明「需人看護」+ 無法自理 → 可請領，金額依地區行情',
  },

  // ============= 工作損失 =============
  {
    caseId: '111-評字第0567號',
    category: 'work_loss',
    caseYear: 2022,
    caseDate: '2022-05-08',
    courtName: '臺灣桃園地方法院',
    summary: '日領 1,800 元臨時工，請假 2 個月工作損失',
    keyReasoning: '有雇主開立扣薪證明 + 薪轉紀錄，2 個月工作損失 109,200 元全額認列',
    outcome: 'consumer_favor',
    compensationAmount: 109_200,
    referenceNote: '工作損失：需扣薪證明 + 薪轉證明；日領/按件計酬者以實際收入計算',
  },
  {
    caseId: '112-評字第0423號',
    category: 'work_loss',
    caseYear: 2023,
    caseDate: '2023-05-15',
    courtName: null,
    summary: '無薪轉證明，主張每月損失 5 萬元',
    keyReasoning: '無具體薪資證明，僅以報稅所得推算，認列金額打折',
    outcome: 'partial',
    compensationAmount: 45_000,
    referenceNote: '工作損失：無薪轉證明時以「去年報稅所得 / 12」為上限計算',
  },

  // ============= 強制險重複請領 =============
  {
    caseId: '110-評字第0078號',
    category: 'overlap_compulsory',
    caseYear: 2021,
    caseDate: '2021-01-30',
    courtName: null,
    summary: '同一醫療費同時申請強制險與第三人險，是否重複',
    keyReasoning: '強制險與第三人險屬填補原則，同一損失不得重複請領，但強制險優先給付',
    outcome: 'settled',
    compensationAmount: null,
    referenceNote: '強制險優先：先申請強制險 → 未獲填補部分再由第三人險補 → 不得重複',
  },
]

// --- 對外 API --------------------------------------------------------

/** 取得全部金融評議案例（給前端「評議案例參考」頁面用） */
export function listFoiDisputeCases(): FoiDisputeCase[] {
  return [...CASES]
}

/** 依類別篩選 */
export function getFoiCasesByCategory(category: FoiDisputeCategory): FoiDisputeCase[] {
  return CASES.filter((c) => c.category === category)
}

/** 依結果篩選（消費者有利 / 保險公司有利 / 部分） */
export function getFoiCasesByOutcome(outcome: FoiOutcome): FoiDisputeCase[] {
  return CASES.filter((c) => c.outcome === outcome)
}

/** 查詢單一案件 */
export function getFoiCaseById(caseId: string): FoiDisputeCase | null {
  return CASES.find((c) => c.caseId === caseId) ?? null
}

/** 計算某類別的平均評議金額（供估算參考用） */
export function getAverageFoiCompensation(category: FoiDisputeCategory): number | null {
  const filtered = CASES.filter(
    (c) => c.category === category && c.compensationAmount !== null,
  )
  if (filtered.length === 0) return null
  const sum = filtered.reduce((acc, c) => acc + (c.compensationAmount ?? 0), 0)
  return Math.round(sum / filtered.length)
}

/** 取得案例總數（給前端顯示「目前資料庫共 N 筆」用） */
export function getFoiCaseCount(): number {
  return CASES.length
}
