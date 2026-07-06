// =====================================================================
// 補件清單與風險提示產生器
// 依輸入欄位空缺 / 證據不足，自動列出應補文件與風險
// =====================================================================

import type { ClaimInput, DisabilityScreeningResult, PainAndSufferingResult } from './types'
import type { WorkLossResult } from './civil-damages'

export interface EvidenceResult {
  missingDocuments: string[]
  riskNotes: string[]
}

/**
 * 從表單輸入 + 失能結果 + 慰撫金結果，產生補件清單與風險提示
 */
export function generateEvidence(
  input: ClaimInput,
  disability: DisabilityScreeningResult,
  workLoss: WorkLossResult,
  pas: PainAndSufferingResult,
): EvidenceResult {
  const missing: string[] = []
  const risks: string[] = []

  // === 證據補強 ===

  // 1. 診斷書
  if (!input.medical.diagnosisText) {
    missing.push('補診斷證明書（須記載傷勢部位、醫囑休養天數、需否看護）')
  } else {
    if (input.medical.requiresNursingCare && !input.medical.nursingDays) {
      missing.push('補診斷書看護期間記載（需載明「需專人看護」與天數）')
    }
    if (!input.person.doctorOrderedRestDays) {
      missing.push('補診斷書醫囑休養天數')
    }
  }

  // 2. 失能相關（從 disability 結果帶入）
  for (const sup of disability.needsSupplement) {
    if (!missing.includes(sup)) missing.push(sup)
  }

  // 3. 工作損失
  if (workLoss.amount > 0) {
    if (!input.person.hasSalaryTransferRecord) {
      missing.push('補薪轉帳戶紀錄（事故前 6 個月）')
    }
    if (!input.person.hasLeaveCertificate) {
      missing.push('補請假證明（公司開立）')
    }
    if (!input.person.hasSalaryDeductionProof) {
      missing.push('補扣薪證明（請假期間扣款明細）')
    }
    if (input.person.lastYearTaxableIncome === 0) {
      missing.push('補去年綜合所得稅申報資料（作為收入佐證）')
    }
  } else if (input.person.actualLeaveDays > 0 || input.person.doctorOrderedRestDays > 0) {
    missing.push('補請假單、扣薪證明以利工作損失估算')
  }

  // 4. 車損財損
  if (input.property.vehicleRepairInvoice === 0 && input.property.vehicleRepairEstimate > 0) {
    missing.push('車損已有估價單，建議補修車發票（實際修復費）')
  }
  if (
    input.property.vehicleRepairEstimate > 0 &&
    input.property.vehicleMarketValueBeforeAccident === 0
  ) {
    risks.push('車損估算需事故前車價以避免超估，建議補車輛殘值或市場行情資料')
  }
  if (
    input.property.vehicleRepairEstimate === 0 &&
    input.property.vehicleRepairInvoice === 0 &&
    input.property.towingFee > 0
  ) {
    missing.push('已有拖吊費，建議補車損估價單或照片')
  }

  // 5. 肇責
  if (input.fault.isFaultDisputed) {
    risks.push('⚠️ 肇責比例有爭議，估算是暫定值。建議申請車輛行車事故鑑定')
  }
  if (input.fault.faultSource === 'unclear') {
    risks.push('肇責來源不明，估算需待警方初判或鑑定後再校正')
  }

  // 6. 因果關係
  if (input.medical.emergencyDate && input.basics.accidentDate) {
    const accident = new Date(input.basics.accidentDate)
    const emergency = new Date(input.medical.emergencyDate)
    const days = Math.floor((emergency.getTime() - accident.getTime()) / (1000 * 60 * 60 * 24))
    if (days > 7) {
      risks.push(`首次就醫距事故 ${days} 天，保險公司可能爭執因果關係`)
      missing.push('補急診紀錄、連續就醫紀錄、醫師因果關係說明')
    }
  }

  // 7. 保險狀態
  if (!input.basics.hasCompulsoryInsurance) {
    risks.push('⚠️ 未投保強制險，將由交通事故特別補償基金處理，請先確認加害人車輛是否有投保')
  }
  // v0.5.2: 拿掉「加害人未保第三人險」風險提示 — 估算永遠當有第三人險

  // 8. 強制險細項警示
  if (pas.severityScore >= 45) {
    risks.push('精神慰撫金不屬於強制險給付，須列入第三人責任險體傷或民事和解')
  }

  // 9. 失能
  if (disability.screening === 'B') {
    risks.push('失能初篩為 B 級（有線索但資料不足），建議補診斷書與關節量測')
  } else if (disability.screening === 'C') {
    risks.push('失能初篩為 C 級（高度可能），建議向骨科/復健科申請失能鑑定')
  } else if (disability.screening === 'D') {
    risks.push('失能初篩為 D 級（已具申請基礎），可向保險公司申請失能給付')
  }

  // 10. 慰撫金
  if (pas.severityScore >= 25) {
    risks.push('精神慰撫金估算涉及主觀評價，僅供談判與訴訟參考，非保證金額')
  }

  // 11. 補件清單去重
  const uniqueMissing = Array.from(new Set(missing))

  return {
    missingDocuments: uniqueMissing,
    riskNotes: Array.from(new Set(risks)),
  }
}
