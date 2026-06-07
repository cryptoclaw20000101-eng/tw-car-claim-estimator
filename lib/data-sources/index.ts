// =====================================================================
// 統一對外 API：資料來源層
// 把 foi + judicial + legal-reference 整合成一個入口
// =====================================================================

export * from './types'

// 金融評議中心
export {
  listFoiDisputeCases,
  getFoiCasesByCategory,
  getFoiCasesByOutcome,
  getFoiCaseById,
  getAverageFoiCompensation,
  getFoiCaseCount,
} from './foi'

// 司法院
export {
  getCourtCompensation,
  listAllCompensationTable,
  getCaseReferencesByCategory,
  getCaseReferenceById,
  getMedianCourtCompensation,
  getSupportedCourts,
  getCourtCaseCount,
} from './judicial'

// 法源
export {
  listLegalReferences,
  getLegalReference,
  getPrimaryLegalReferences,
  getCompulsoryInsuranceReferences,
  getCivilDamagesReferences,
  isLegalReferenceStale,
} from './legal-reference'
