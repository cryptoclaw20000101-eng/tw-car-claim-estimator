// =====================================================================
// 補件清單與風險提示產生器 — 測試
// 守護 SPEC §十六 #15「缺文件/風險必須明確標示，不可隱藏」鐵律
// =====================================================================

import { describe, it, expect } from 'vitest'
import { generateEvidence } from '@/lib/insurance/evidence'
import type {
  ClaimInput,
  DisabilityScreeningResult,
  PersonalIncome,
  AccidentBasics,
  FaultInfo,
  MedicalRecord,
  PropertyDamageInputs,
  CompulsoryMedicalInputs,
  PainAndSufferingResult,
} from '@/lib/insurance/types'
import type { WorkLossResult } from '@/lib/insurance/civil-damages'

// --- 測試資料工廠：給每個測試一個「最小可行」的 ClaimInput，覆寫要測的欄位 ---

function makeBasics(overrides: Partial<AccidentBasics> = {}): AccidentBasics {
  return {
    accidentDate: '2026-06-01',
    accidentLocation: '台中市西區',
    accidentType: 'car_to_car',
    injuredRole: 'driver_car',
    isInjured: true, // v0.26.0e+
    isAutomobileAccident: true,
    hasPolicePreliminaryReport: true,
    hasAccidentAppraisal: false,
    hasCompulsoryInsurance: true,
    accidentCity: '台中市',
    accidentDistrict: '西區',
    claimantResidenceCity: '台中市',
    claimantResidenceDistrict: '西區',
    defendantResidenceCity: '台中市',
    defendantResidenceDistrict: '西區',
    courtJurisdiction: '臺灣臺中地方法院',
    insuranceCompanyBranchRegion: '中區',
    ...overrides,
  }
}

function makeFault(overrides: Partial<FaultInfo> = {}): FaultInfo {
  return {
    selfFaultRatio: 30,
    otherFaultRatio: 70,
    faultSource: 'police_preliminary',
    isFaultDisputed: false,
    ...overrides,
  }
}

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

function makeMedical(overrides: Partial<MedicalRecord> = {}): MedicalRecord {
  return {
    diagnosisText: '右膝挫傷，需休養 30 日',
    hospitalName: '中國醫藥大學附設醫院',
    emergencyDate: '2026-06-01',
    outpatientVisitCount: 3,
    hospitalizationDays: 0,
    hasSurgery: false,
    hasRehabilitation: true,
    rehabilitationCount: 6,
    requiresNursingCare: false,
    nursingDays: 0,
    isSymptomFixed: true,
    hasDisabilityCertificate: false,
    hasClassADiagnosisCertificate: true,
    hasFracture: false,
    hasDislocation: false,
    hasLigamentInjury: false,
    hasNerveDamage: false,
    hasAmputation: false,
    hasOrganDamage: false,
    hasScar: false,
    scarLengthCm: 0,
    scarLocation: '',
    jointName: null,
    hasRangeOfMotionLimitation: false,
    romLossDegree: 0,
    romNormalDegree: 0,
    hasMuscleWeakness: false,
    hasSensoryLoss: false,
    hasPermanentImpairment: false,
    ...overrides,
  }
}

function makeReceipts(overrides: Partial<CompulsoryMedicalInputs> = {}): CompulsoryMedicalInputs {
  return {
    emergencyFee: 5000,
    ambulanceFee: 0,
    nhiCopayment: 0,
    registrationFee: 0,
    diagnosisCertificateFee: 0,
    nonNhiNecessaryMedicalFee: 0,
    wardFeeDifference: 0,
    wardFeeDays: 0,
    mealFee: 0,
    mealDays: 0,
    prosthesisFee: 0,
    dentureFee: 0,
    missingTeethCount: 0,
    artificialEyeFee: 0,
    medicalMaterialFee: 0,
    assistiveDeviceFee: 0,
    transportationFee: 0,
    nursingFee: 0,
    nursingDays: 0,
    otherNecessaryMedicalFee: 0,
    ...overrides,
  }
}

function makeProperty(overrides: Partial<PropertyDamageInputs> = {}): PropertyDamageInputs {
  return {
    vehicleRepairEstimate: 50000,
    vehicleRepairInvoice: 50000,
    vehicleMarketValueBeforeAccident: 300000,
    salvageValue: 0,
    towingFee: 0,
    rentalCarFee: 0,
    phoneDamage: 0,
    helmetDamage: 0,
    clothingDamage: 0,
    glassesDamage: 0,
    otherPropertyDamage: 0,
    ...overrides,
  }
}

function makeInput(overrides: Partial<ClaimInput> = {}): ClaimInput {
  return {
    basics: makeBasics(),
    fault: makeFault(),
    person: makePerson(),
    medical: makeMedical(),
    medicalReceipts: makeReceipts(),
    property: makeProperty(),
    ...overrides,
  }
}

function makeDisability(
  overrides: Partial<DisabilityScreeningResult> = {},
): DisabilityScreeningResult {
  return {
    screening: 'A',
    signals: [],
    possibleLevel: null,
    possibleAmount: 0,
    confidenceScore: 0,
    romLossPercent: null,
    jointName: null,
    notes: [],
    needsSupplement: [],
    ...overrides,
  }
}

function makeWorkLoss(overrides: Partial<WorkLossResult> = {}): WorkLossResult {
  return {
    amount: 0,
    dailyIncome: 2000,
    reasonableRestDays: 30,
    evidenceStrength: 'medium',
    notes: [],
    ...overrides,
  }
}

function makePas(overrides: Partial<PainAndSufferingResult> = {}): PainAndSufferingResult {
  return {
    baseLow: 0,
    baseMid: 0,
    baseHigh: 0,
    regionalMultiplier: 1.0,
    regionalLow: 0,
    regionalMid: 0,
    regionalHigh: 0,
    severityLevel: 'minor',
    severityScore: 0,
    breakdown: {
      hospitalizationDays: 0,
      rehabilitationCount: 0,
      scarLengthCm: 0,
      hasPermanentImpairment: false,
      hasDisability: false,
    },
    ...overrides,
  }
}

// =====================================================================
// 1. 診斷書相關
// =====================================================================

describe('generateEvidence — 診斷書補件', () => {
  it('完全沒填診斷書 → 提示補診斷證明書', () => {
    const input = makeInput({
      medical: makeMedical({ diagnosisText: '' }),
    })
    const result = generateEvidence(input, makeDisability(), makeWorkLoss(), makePas())
    expect(result.missingDocuments).toContain(
      '補診斷證明書（須記載傷勢部位、醫囑休養天數、需否看護）',
    )
  })

  it('有診斷書但醫囑標需看護又沒填看護天數 → 提示補看護天數', () => {
    const input = makeInput({
      medical: makeMedical({
        diagnosisText: '右膝骨折，需專人看護',
        requiresNursingCare: true,
        nursingDays: 0, // ← 缺
      }),
    })
    const result = generateEvidence(input, makeDisability(), makeWorkLoss(), makePas())
    expect(result.missingDocuments).toContain('補診斷書看護期間記載（需載明「需專人看護」與天數）')
  })

  it('有診斷書但缺醫囑休養天數 → 提示補', () => {
    const input = makeInput({
      person: makePerson({ doctorOrderedRestDays: 0 }),
    })
    const result = generateEvidence(input, makeDisability(), makeWorkLoss(), makePas())
    expect(result.missingDocuments).toContain('補診斷書醫囑休養天數')
  })

  it('診斷書完整、醫囑休養天數也有、看護不需 → 不應再出現診斷書相關補件', () => {
    const result = generateEvidence(makeInput(), makeDisability(), makeWorkLoss(), makePas())
    const hasDiagMissing = result.missingDocuments.some((d) => d.startsWith('補診斷'))
    expect(hasDiagMissing).toBe(false)
  })
})

// =====================================================================
// 2. 失能初篩帶入 needsSupplement
// =====================================================================

describe('generateEvidence — 失能初篩帶入補件', () => {
  it('disability.needsSupplement 帶入補件清單', () => {
    const disability = makeDisability({
      needsSupplement: ['補關節量測記錄', '補骨科回診紀錄'],
    })
    const result = generateEvidence(makeInput(), disability, makeWorkLoss(), makePas())
    expect(result.missingDocuments).toContain('補關節量測記錄')
    expect(result.missingDocuments).toContain('補骨科回診紀錄')
  })

  it('不會重複加同一筆補件', () => {
    const disability = makeDisability({
      needsSupplement: ['補關節量測記錄', '補關節量測記錄'], // 重複
    })
    const result = generateEvidence(makeInput(), disability, makeWorkLoss(), makePas())
    const count = result.missingDocuments.filter((d) => d === '補關節量測記錄').length
    expect(count).toBe(1)
  })
})

// =====================================================================
// 3. 工作損失相關
// =====================================================================

describe('generateEvidence — 工作損失補件', () => {
  it('有工作損失但缺薪轉紀錄 → 提示補', () => {
    const input = makeInput({
      person: makePerson({ hasSalaryTransferRecord: false }),
    })
    const workLoss = makeWorkLoss({ amount: 50000 })
    const result = generateEvidence(input, makeDisability(), workLoss, makePas())
    expect(result.missingDocuments).toContain('補薪轉帳戶紀錄（事故前 6 個月）')
  })

  it('有工作損失但缺請假證明 → 提示補', () => {
    const input = makeInput({
      person: makePerson({ hasLeaveCertificate: false }),
    })
    const workLoss = makeWorkLoss({ amount: 50000 })
    const result = generateEvidence(input, makeDisability(), workLoss, makePas())
    expect(result.missingDocuments).toContain('補請假證明（公司開立）')
  })

  it('有工作損失但缺扣薪證明 → 提示補', () => {
    const input = makeInput({
      person: makePerson({ hasSalaryDeductionProof: false }),
    })
    const workLoss = makeWorkLoss({ amount: 50000 })
    const result = generateEvidence(input, makeDisability(), workLoss, makePas())
    expect(result.missingDocuments).toContain('補扣薪證明（請假期間扣款明細）')
  })

  it('有工作損失但去年度所得為 0 → 提示補所得稅申報', () => {
    const input = makeInput({
      person: makePerson({ lastYearTaxableIncome: 0 }),
    })
    const workLoss = makeWorkLoss({ amount: 50000 })
    const result = generateEvidence(input, makeDisability(), workLoss, makePas())
    expect(result.missingDocuments).toContain('補去年綜合所得稅申報資料（作為收入佐證）')
  })

  it('沒工作損失但有請假/醫囑休養天數 → 仍提示補請假單', () => {
    const input = makeInput({
      person: makePerson({ actualLeaveDays: 7, doctorOrderedRestDays: 14 }),
    })
    const workLoss = makeWorkLoss({ amount: 0 }) // 沒工作損失
    const result = generateEvidence(input, makeDisability(), workLoss, makePas())
    expect(result.missingDocuments).toContain('補請假單、扣薪證明以利工作損失估算')
  })

  it('沒工作損失且無請假 → 不應出現工作損失補件', () => {
    const input = makeInput({
      person: makePerson({ actualLeaveDays: 0, doctorOrderedRestDays: 0 }),
    })
    const workLoss = makeWorkLoss({ amount: 0 })
    const result = generateEvidence(input, makeDisability(), workLoss, makePas())
    const hasWorkLossMissing = result.missingDocuments.some(
      (d) =>
        d.includes('薪轉') || d.includes('請假單') || d.includes('扣薪') || d.includes('所得稅'),
    )
    expect(hasWorkLossMissing).toBe(false)
  })
})

// =====================================================================
// 4. 車損財損
// =====================================================================

describe('generateEvidence — 車損財損', () => {
  it('有估價單沒發票 → 提示補修車發票', () => {
    const input = makeInput({
      property: makeProperty({
        vehicleRepairEstimate: 50000,
        vehicleRepairInvoice: 0, // ← 缺
      }),
    })
    const result = generateEvidence(input, makeDisability(), makeWorkLoss(), makePas())
    expect(result.missingDocuments).toContain('車損已有估價單，建議補修車發票（實際修復費）')
  })

  it('有估價單但缺事故前車價 → 風險提示', () => {
    const input = makeInput({
      property: makeProperty({
        vehicleRepairEstimate: 50000,
        vehicleMarketValueBeforeAccident: 0, // ← 缺
      }),
    })
    const result = generateEvidence(input, makeDisability(), makeWorkLoss(), makePas())
    expect(result.riskNotes).toContain(
      '車損估算需事故前車價以避免超估，建議補車輛殘值或市場行情資料',
    )
  })

  it('有拖吊費但無車損資料 → 提示補', () => {
    const input = makeInput({
      property: makeProperty({
        vehicleRepairInvoice: 0,
        vehicleRepairEstimate: 0,
        towingFee: 3000,
      }),
    })
    const result = generateEvidence(input, makeDisability(), makeWorkLoss(), makePas())
    expect(result.missingDocuments).toContain('已有拖吊費，建議補車損估價單或照片')
  })
})

// =====================================================================
// 5. 肇責
// =====================================================================

describe('generateEvidence — 肇責風險', () => {
  it('肇責有爭議 → 風險提示', () => {
    const input = makeInput({
      fault: makeFault({ isFaultDisputed: true }),
    })
    const result = generateEvidence(input, makeDisability(), makeWorkLoss(), makePas())
    expect(result.riskNotes).toContain('⚠️ 肇責比例有爭議，估算是暫定值。建議申請車輛行車事故鑑定')
  })

  it('肇責來源不明 → 風險提示', () => {
    const input = makeInput({
      fault: makeFault({ faultSource: 'unclear' }),
    })
    const result = generateEvidence(input, makeDisability(), makeWorkLoss(), makePas())
    expect(result.riskNotes).toContain('肇責來源不明，估算需待警方初判或鑑定後再校正')
  })
})

// =====================================================================
// 6. 因果關係（首次就醫距事故天數）
// =====================================================================

describe('generateEvidence — 因果關係風險', () => {
  it('首次就醫距事故 7 天內 → 不應觸發因果風險', () => {
    const input = makeInput({
      basics: makeBasics({ accidentDate: '2026-06-01' }),
      medical: makeMedical({ emergencyDate: '2026-06-03' }), // 2 天後
    })
    const result = generateEvidence(input, makeDisability(), makeWorkLoss(), makePas())
    const hasCausalityRisk = result.riskNotes.some((r) => r.includes('首次就醫距事故'))
    expect(hasCausalityRisk).toBe(false)
  })

  it('首次就醫距事故超過 7 天 → 觸發因果風險 + 補件', () => {
    const input = makeInput({
      basics: makeBasics({ accidentDate: '2026-06-01' }),
      medical: makeMedical({ emergencyDate: '2026-06-15' }), // 14 天後
    })
    const result = generateEvidence(input, makeDisability(), makeWorkLoss(), makePas())
    expect(result.riskNotes.some((r) => r.includes('首次就醫距事故 14 天'))).toBe(true)
    expect(result.missingDocuments).toContain('補急診紀錄、連續就醫紀錄、醫師因果關係說明')
  })

  it('沒填事故日期或急診日期 → 不應觸發因果計算', () => {
    const input = makeInput({
      basics: makeBasics({ accidentDate: '' }),
    })
    const result = generateEvidence(input, makeDisability(), makeWorkLoss(), makePas())
    const hasCausalityRisk = result.riskNotes.some((r) => r.includes('首次就醫距事故'))
    expect(hasCausalityRisk).toBe(false)
  })
})

// =====================================================================
// 7. 保險狀態
// =====================================================================

describe('generateEvidence — 保險狀態風險', () => {
  it('未投保強制險 → 風險提示', () => {
    const input = makeInput({
      basics: makeBasics({ hasCompulsoryInsurance: false }),
    })
    const result = generateEvidence(input, makeDisability(), makeWorkLoss(), makePas())
    expect(result.riskNotes).toContain(
      '⚠️ 未投保強制險，將由交通事故特別補償基金處理，請先確認加害人車輛是否有投保',
    )
  })

  // v0.5.2: 拿掉「加害人未保第三人責任險」風險提示 — 永遠當有第三人險
})

// =====================================================================
// 8. 失能等級風險
// =====================================================================

describe('generateEvidence — 失能等級風險', () => {
  it('screening B → 提示補診斷與關節量測', () => {
    const disability = makeDisability({ screening: 'B' })
    const result = generateEvidence(makeInput(), disability, makeWorkLoss(), makePas())
    expect(result.riskNotes).toContain(
      '失能初篩為 B 級（有線索但資料不足），建議補診斷書與關節量測',
    )
  })

  it('screening C → 提示申請失能鑑定', () => {
    const disability = makeDisability({ screening: 'C' })
    const result = generateEvidence(makeInput(), disability, makeWorkLoss(), makePas())
    expect(result.riskNotes).toContain('失能初篩為 C 級（高度可能），建議向骨科/復健科申請失能鑑定')
  })

  it('screening D → 提示可申請失能給付', () => {
    const disability = makeDisability({ screening: 'D' })
    const result = generateEvidence(makeInput(), disability, makeWorkLoss(), makePas())
    expect(result.riskNotes).toContain('失能初篩為 D 級（已具申請基礎），可向保險公司申請失能給付')
  })

  it('screening A → 不應出現失能風險提示', () => {
    const disability = makeDisability({ screening: 'A' })
    const result = generateEvidence(makeInput(), disability, makeWorkLoss(), makePas())
    const hasDisabilityRisk = result.riskNotes.some((r) => r.startsWith('失能初篩為'))
    expect(hasDisabilityRisk).toBe(false)
  })
})

// =====================================================================
// 9. 精神慰撫金風險
// =====================================================================

describe('generateEvidence — 精神慰撫金風險', () => {
  it('severityScore >= 45 → 提示慰撫金不屬於強制險', () => {
    const pas = makePas({ severityScore: 50 })
    const result = generateEvidence(makeInput(), makeDisability(), makeWorkLoss(), pas)
    expect(result.riskNotes).toContain(
      '精神慰撫金不屬於強制險給付，須列入第三人責任險體傷或民事和解',
    )
  })

  it('severityScore < 45 → 不應觸發該提示', () => {
    const pas = makePas({ severityScore: 30 })
    const result = generateEvidence(makeInput(), makeDisability(), makeWorkLoss(), pas)
    const hasRule = result.riskNotes.some((r) => r.includes('精神慰撫金不屬於強制險'))
    expect(hasRule).toBe(false)
  })

  it('severityScore >= 25 → 提示慰撫金主觀評價', () => {
    const pas = makePas({ severityScore: 30 })
    const result = generateEvidence(makeInput(), makeDisability(), makeWorkLoss(), pas)
    expect(result.riskNotes).toContain('精神慰撫金估算涉及主觀評價，僅供談判與訴訟參考，非保證金額')
  })

  it('severityScore < 25 → 不應觸發主觀評價提示', () => {
    const pas = makePas({ severityScore: 10 })
    const result = generateEvidence(makeInput(), makeDisability(), makeWorkLoss(), pas)
    const hasRule = result.riskNotes.some((r) => r.includes('主觀評價'))
    expect(hasRule).toBe(false)
  })
})

// =====================================================================
// 10. 輸出保證：去重 + 至少一個介面欄位
// =====================================================================

describe('generateEvidence — 輸出結構', () => {
  it('missingDocuments 與 riskNotes 都是陣列', () => {
    const result = generateEvidence(makeInput(), makeDisability(), makeWorkLoss(), makePas())
    expect(Array.isArray(result.missingDocuments)).toBe(true)
    expect(Array.isArray(result.riskNotes)).toBe(true)
  })

  it('正常情境下：肇責有爭議 → 至少會有風險提示（避免靜默失敗）', () => {
    const input = makeInput({
      fault: makeFault({ isFaultDisputed: true }),
    })
    const result = generateEvidence(input, makeDisability(), makeWorkLoss(), makePas())
    const totalCount = result.missingDocuments.length + result.riskNotes.length
    expect(totalCount).toBeGreaterThan(0)
  })

  it('空 input（所有欄位 0/空）→ 應回傳大量補件 + 風險（不會靜默通過）', () => {
    // 故意把 person + medical 全清空，模擬「剛出事還沒整理」的慘況
    const input = makeInput({
      person: makePerson({
        hasSalaryTransferRecord: false,
        hasLeaveCertificate: false,
        hasSalaryDeductionProof: false,
        lastYearTaxableIncome: 0,
        actualLeaveDays: 0,
        doctorOrderedRestDays: 0,
      }),
      medical: makeMedical({
        diagnosisText: '',
        emergencyDate: '',
      }),
    })
    const workLoss = makeWorkLoss({ amount: 50000 })
    const result = generateEvidence(input, makeDisability(), workLoss, makePas())
    // 至少要有 3 筆補件
    expect(result.missingDocuments.length).toBeGreaterThanOrEqual(3)
  })

  it('missingDocuments / riskNotes 內無重複字串', () => {
    const input = makeInput({
      fault: makeFault({ isFaultDisputed: true, faultSource: 'unclear' }),
    })
    const result = generateEvidence(input, makeDisability(), makeWorkLoss(), makePas())
    expect(new Set(result.missingDocuments).size).toBe(result.missingDocuments.length)
    expect(new Set(result.riskNotes).size).toBe(result.riskNotes.length)
  })
})
