// =====================================================================
// 工作損失證據強度 — 邊界測試
// 補 civil-damages.ts:269,272,274,279 邊界守護
// 規則：6 個 evidence flags（hasPropertyList / hasSalaryTransferRecord /
//      hasLeaveCertificate / hasSalaryDeductionProof / sixMonthAvg > 0 /
//      lastYearTaxable > 0）
//   >= 5 = high
//   >= 3 = medium
//   <  3 = low
// =====================================================================

import { describe, it, expect } from 'vitest'
import { computeWorkLoss } from '@/lib/insurance/civil-damages'
import type { PersonalIncome } from '@/lib/insurance/types'

// 工廠：給「合法請假 + 醫囑休養」但所有 flags 由 override 控制
function makePerson(overrides: Partial<PersonalIncome> = {}): PersonalIncome {
  return {
    birthDate: '1980-01-01',
    age: 46,
    occupation: '工程師',
    employmentType: 'full_time_salary',
    sixMonthAverageSalary: 600000,
    monthlySalary: 60000,
    dailyWage: 2000,
    lastYearTaxableIncome: 600000,
    hasPropertyList: true,
    hasSalaryTransferRecord: true,
    hasLeaveCertificate: true,
    hasSalaryDeductionProof: true,
    actualLeaveDays: 14,
    doctorOrderedRestDays: 30,
    ...overrides,
  }
}

describe('computeWorkLoss — 證據強度邊界', () => {
  // 6 flags 設計：all true (6 個) → 6 → high
  //                5 → high
  //                4 → medium
  //                3 → medium
  //                2 → low
  //                1 → low
  //                0 → low

  it('6 個 flags 全 true → strength = high', () => {
    const result = computeWorkLoss(makePerson(), '臺灣臺中地方法院')
    expect(result.evidenceStrength).toBe('high')
    expect(result.notes).not.toContain('⚠️ 缺乏薪轉、扣薪、報稅、請假等佐證，工作損失證據強度不足')
    expect(result.notes).not.toContain('建議補齊：薪轉證明、扣薪證明、醫囑休養期間')
  })

  it('5 個 flags → strength = high（>= 5 邊界）', () => {
    const result = computeWorkLoss(
      makePerson({ hasPropertyList: false }),
      '臺灣臺中地方法院',
    )
    expect(result.evidenceStrength).toBe('high')
  })

  it('4 個 flags → strength = medium', () => {
    const result = computeWorkLoss(
      makePerson({ hasPropertyList: false, hasSalaryTransferRecord: false }),
      '臺灣臺中地方法院',
    )
    expect(result.evidenceStrength).toBe('medium')
    expect(result.notes).toContain('建議補齊：薪轉證明、扣薪證明、醫囑休養期間')
  })

  it('3 個 flags → strength = medium（>= 3 邊界）', () => {
    const result = computeWorkLoss(
      makePerson({
        hasPropertyList: false,
        hasSalaryTransferRecord: false,
        hasLeaveCertificate: false,
      }),
      '臺灣臺中地方法院',
    )
    expect(result.evidenceStrength).toBe('medium')
  })

  it('2 個 flags → strength = low（觸發 line 272 補件提示）', () => {
    const result = computeWorkLoss(
      makePerson({
        hasPropertyList: false,
        hasSalaryTransferRecord: false,
        hasLeaveCertificate: false,
        hasSalaryDeductionProof: false,
      }),
      '臺灣臺中地方法院',
    )
    expect(result.evidenceStrength).toBe('low')
    expect(result.notes).toContain('⚠️ 缺乏薪轉、扣薪、報稅、請假等佐證，工作損失證據強度不足')
  })

  it('0 個 flags → strength = low', () => {
    const result = computeWorkLoss(
      makePerson({
        hasPropertyList: false,
        hasSalaryTransferRecord: false,
        hasLeaveCertificate: false,
        hasSalaryDeductionProof: false,
        sixMonthAverageSalary: 0,
        lastYearTaxableIncome: 0,
      }),
      '臺灣臺中地方法院',
    )
    expect(result.evidenceStrength).toBe('low')
  })
})

describe('computeWorkLoss — 地區嚴格度提示', () => {
  it('高嚴格度地區（臺北地院）→ 補額外提示', () => {
    const result = computeWorkLoss(makePerson(), '臺灣臺北地方法院')
    expect(result.notes.some((n) => n.includes('臺灣臺北地方法院') && n.includes('要求較嚴'))).toBe(true)
  })

  it('中嚴格度地區（高雄地院）→ 補中等提示', () => {
    const result = computeWorkLoss(makePerson(), '臺灣高雄地方法院')
    expect(result.notes).toContain('建議補：薪資證明、請假單、扣薪證明、醫囑休養期間')
  })

  it('未對應地區 → 走 medium fallback（不應觸發 high 提示）', () => {
    const result = computeWorkLoss(makePerson(), '無此地院')
    expect(result.notes.some((n) => n.includes('要求較嚴'))).toBe(false)
  })
})

describe('computeWorkLoss — 短路返回', () => {
  it('無請假無醫囑休養 → 早返回，evidenceStrength 強制 low', () => {
    const result = computeWorkLoss(
      makePerson({ actualLeaveDays: 0, doctorOrderedRestDays: 0 }),
      '臺灣臺中地方法院',
    )
    expect(result.amount).toBe(0)
    expect(result.evidenceStrength).toBe('low')
    expect(result.notes).toContain('未輸入請假或醫囑休養日數，無法估算工作損失')
  })
})
