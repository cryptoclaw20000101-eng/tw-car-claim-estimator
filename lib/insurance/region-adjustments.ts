// =====================================================================
// 地區係數表（v2 新增）
// 用於調整精神慰撫金、看護費行情、工作損失證據嚴格度、車損折舊嚴格度
//
// 重要守則：
// 1. 強制險本身是全國法定標準，本檔不影響強制險上限
// 2. 本檔只影響第三人責任險／民事損害賠償估算
// 3. 係數僅為 MVP 初始值，須透過判決資料庫持續校正
// 4. UI 不得宣稱為法院固定標準
// =====================================================================

export type RegionAdjustment = {
  courtName: string
  painAndSufferingMultiplier: number
  nursingDailyRateLow: number
  nursingDailyRateMid: number
  nursingDailyRateHigh: number
  workLossEvidenceStrictness: 'low' | 'medium' | 'high'
  vehicleDepreciationStrictness: 'low' | 'medium' | 'high'
  notes: string
  confidenceLevel: 'low' | 'medium' | 'high'
}

export const regionAdjustments: Record<string, RegionAdjustment> = {
  '臺灣臺北地方法院': {
    courtName: '臺灣臺北地方法院',
    painAndSufferingMultiplier: 1.10,
    nursingDailyRateLow: 2_200,
    nursingDailyRateMid: 2_400,
    nursingDailyRateHigh: 2_800,
    workLossEvidenceStrictness: 'high',
    vehicleDepreciationStrictness: 'high',
    notes: '都會區薪資、醫療與看護行情較高，但證據要求通常較嚴格。',
    confidenceLevel: 'medium',
  },
  '臺灣新北地方法院': {
    courtName: '臺灣新北地方法院',
    painAndSufferingMultiplier: 1.05,
    nursingDailyRateLow: 2_200,
    nursingDailyRateMid: 2_400,
    nursingDailyRateHigh: 2_600,
    workLossEvidenceStrictness: 'medium',
    vehicleDepreciationStrictness: 'medium',
    notes: '與大台北生活圈接近，慰撫金與看護行情可接近台北，但仍需依判決資料校正。',
    confidenceLevel: 'medium',
  },
  '臺灣臺中地方法院': {
    courtName: '臺灣臺中地方法院',
    painAndSufferingMultiplier: 1.00,
    nursingDailyRateLow: 2_000,
    nursingDailyRateMid: 2_400,
    nursingDailyRateHigh: 2_600,
    workLossEvidenceStrictness: 'medium',
    vehicleDepreciationStrictness: 'medium',
    notes: '中部地區基準，可作為一般車禍案件估算基準。',
    confidenceLevel: 'medium',
  },
  '臺灣高雄地方法院': {
    courtName: '臺灣高雄地方法院',
    painAndSufferingMultiplier: 0.95,
    nursingDailyRateLow: 2_000,
    nursingDailyRateMid: 2_200,
    nursingDailyRateHigh: 2_600,
    workLossEvidenceStrictness: 'medium',
    vehicleDepreciationStrictness: 'medium',
    notes: '南部都會區基準，須以實際判決資料修正。',
    confidenceLevel: 'medium',
  },
  '臺灣桃園地方法院': {
    courtName: '臺灣桃園地方法院',
    painAndSufferingMultiplier: 1.00,
    nursingDailyRateLow: 2_000,
    nursingDailyRateMid: 2_300,
    nursingDailyRateHigh: 2_500,
    workLossEvidenceStrictness: 'medium',
    vehicleDepreciationStrictness: 'medium',
    notes: '北桃園都會區，行情接近台北但略低。',
    confidenceLevel: 'medium',
  },
  '臺灣臺南地方法院': {
    courtName: '臺灣臺南地方法院',
    painAndSufferingMultiplier: 0.95,
    nursingDailyRateLow: 1_900,
    nursingDailyRateMid: 2_200,
    nursingDailyRateHigh: 2_400,
    workLossEvidenceStrictness: 'medium',
    vehicleDepreciationStrictness: 'medium',
    notes: '南部基準，行情略低於北部都會區。',
    confidenceLevel: 'low',
  },
  default: {
    courtName: '預設地區',
    painAndSufferingMultiplier: 1.00,
    nursingDailyRateLow: 2_000,
    nursingDailyRateMid: 2_400,
    nursingDailyRateHigh: 2_600,
    workLossEvidenceStrictness: 'medium',
    vehicleDepreciationStrictness: 'medium',
    notes: '尚未建立足夠地區資料時使用預設值，建議改選明確縣市以提高估算可信度。',
    confidenceLevel: 'low',
  },
}

/**
 * 依法院名稱取得地區係數，找不到回 default
 */
export function getRegionAdjustment(courtName: string): RegionAdjustment {
  return regionAdjustments[courtName] ?? regionAdjustments.default
}
