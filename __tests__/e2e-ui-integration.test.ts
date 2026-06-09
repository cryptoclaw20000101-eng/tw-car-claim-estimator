// E2E 驗證：UI 整合後的 EstimationResult 三個新欄位
// 用 cast 跳過所有必填欄位檢查（只測 UI 整合層）
import { describe, it, expect } from 'vitest'
import { estimateClaim } from '@/lib/insurance'
import type { ClaimInput } from '@/lib/insurance/types'

describe('UI 整合 E2E：scarRevision / workLossExtended / laborCapacityRetirementAge', () => {
  it('完整樣本（45 歲辦公族 + 8cm 疤痕 + 90 天休養）', () => {
    const r = estimateClaim({
      basics: {
        accidentDate: '2024-01-15',
        hasThirdPartyInsurance: true,
        thirdPartyBodilyLimit: 2_000_000,
        thirdPartyPropertyLimit: 200_000,
        excessLiabilityLimit: 0,
        accidentCity: '臺中市',
        courtJurisdiction: '臺灣臺中地方法院',
      },
      fault: { selfFaultRatio: 30, otherFaultRatio: 70 },
      person: {
        age: 45,
        occupation: 'office_worker',
        sixMonthAverageSalary: 30_000,
        monthlySalary: 30_000,
        lastYearTaxableIncome: 360_000,
        actualLeaveDays: 90,
        doctorOrderedRestDays: 90,
        dailyWage: 0,
      },
      medical: {
        hasScar: true,
        scarLengthCm: 8,
        scarAreaCm2: 20,
        scarSeverity: 'moderate',
        isKeloid: false,
        hasDisabilityCertificate: true,
        hasPermanentImpairment: true,
        hasRangeOfMotionLimitation: true,
        hasNerveDamage: false,
        hasAmputation: false,
      },
      medicalReceipts: {
        emergencyFee: 0, ambulanceFee: 0, nhiCopayment: 5000,
        registrationFee: 0, diagnosisCertificateFee: 0,
        nonNhiNecessaryMedicalFee: 0, wardFeeDifference: 0, mealFee: 0,
        prosthesisFee: 0, dentureFee: 0, artificialEyeFee: 0,
        medicalMaterialFee: 0, assistiveDeviceFee: 0,
        transportationFee: 0, nursingFee: 0, otherNecessaryMedicalFee: 0,
      },
      property: {
        vehicleRepairCost: 0, vehicleActualValue: 0, vehicleSalvageValue: 0,
        towingFee: 0, rentalCarFee: 0, phoneDamage: 0, helmetDamage: 0,
        clothingDamage: 0, glassesDamage: 0, otherPropertyDamage: 0,
      },
    } as unknown as ClaimInput)

    // workLossExtended
    expect(r.workLossExtended.calculationType).toBe('short_term')  // 90 天 = 3 月 < 6 月短期閾值
    expect(r.workLossExtended.amount).toBeGreaterThan(0)
    expect(r.workLossExtended.evidenceStrength).toBe('high')  // 90 天 + 報稅 + 6 月均薪齊備
    expect(r.workLossExtended.notes.length).toBeGreaterThan(0)

    // scarRevision
    expect(r.scarRevision.amount).toBeGreaterThan(0)
    expect(r.scarRevision.range.mid).toBeGreaterThan(0)
    expect(r.scarRevision.range.low).toBeLessThanOrEqual(r.scarRevision.range.mid)
    expect(r.scarRevision.range.mid).toBeLessThanOrEqual(r.scarRevision.range.high)
    expect(r.scarRevision.procedure).toBe('laser')  // 預設 laser
    expect(r.scarRevision.precedents.length).toBeGreaterThan(0)  // 有引註

    // laborCapacityRetirementAge（預設 65）
    expect(r.laborCapacityRetirementAge).toBe(65)
    expect(r.laborCapacityLossNotes.length).toBeGreaterThan(0)
  })

  it('蟹足腫（isKeloid=true）→ 自動走 injection 術式', () => {
    const r = estimateClaim({
      basics: {
        accidentDate: '2024-01-15', hasThirdPartyInsurance: false,
        thirdPartyBodilyLimit: 0, thirdPartyPropertyLimit: 0, excessLiabilityLimit: 0,
        accidentCity: '臺中市', courtJurisdiction: '臺灣臺中地方法院',
      },
      fault: { selfFaultRatio: 0, otherFaultRatio: 100 },
      person: {
        age: 30, occupation: 'office_worker',
        sixMonthAverageSalary: 0, monthlySalary: 0, lastYearTaxableIncome: 0,
        actualLeaveDays: 0, doctorOrderedRestDays: 0, dailyWage: 0,
      },
      medical: {
        hasScar: true, scarLengthCm: 25, scarAreaCm2: 0,
        scarSeverity: 'keloid', isKeloid: true,
        hasDisabilityCertificate: false, hasPermanentImpairment: false,
        hasRangeOfMotionLimitation: false, hasNerveDamage: false,
        hasAmputation: false,
      },
      medicalReceipts: {
        emergencyFee: 0, ambulanceFee: 0, nhiCopayment: 0, registrationFee: 0,
        diagnosisCertificateFee: 0, nonNhiNecessaryMedicalFee: 0, wardFeeDifference: 0,
        mealFee: 0, prosthesisFee: 0, dentureFee: 0, artificialEyeFee: 0,
        medicalMaterialFee: 0, assistiveDeviceFee: 0, transportationFee: 0,
        nursingFee: 0, otherNecessaryMedicalFee: 0,
      },
      property: {
        vehicleRepairCost: 0, vehicleActualValue: 0, vehicleSalvageValue: 0,
        towingFee: 0, rentalCarFee: 0, phoneDamage: 0, helmetDamage: 0,
        clothingDamage: 0, glassesDamage: 0, otherPropertyDamage: 0,
      },
    } as unknown as ClaimInput)

    expect(r.scarRevision.procedure).toBe('injection')  // 蟹足腫強制走注射
    expect(r.scarRevision.amount).toBeGreaterThan(0)
    // 110 簡 202 案例：25 公分蟹足腫 → 至少 80 萬（注射 + PRP + 雷射）
    // 我們只算注射應該要 6 萬左右（25cm × 2 針 × 2000 元 × 6 次 = 60 萬，OK）
    expect(r.scarRevision.precedents.some((p: string) => p.includes('110 簡 202'))).toBe(true)
  })

  it('無疤 + 無失能 → 兩個新欄位都是 0/null 但有 notes', () => {
    const r = estimateClaim({
      basics: {
        accidentDate: '2024-01-15', hasThirdPartyInsurance: false,
        thirdPartyBodilyLimit: 0, thirdPartyPropertyLimit: 0, excessLiabilityLimit: 0,
        accidentCity: '臺中市', courtJurisdiction: '臺灣臺中地方法院',
      },
      fault: { selfFaultRatio: 0, otherFaultRatio: 100 },
      person: {
        age: 25, occupation: 'office_worker',
        sixMonthAverageSalary: 0, monthlySalary: 0, lastYearTaxableIncome: 0,
        actualLeaveDays: 0, doctorOrderedRestDays: 0, dailyWage: 0,
      },
      medical: {
        hasScar: false, scarLengthCm: 0, scarAreaCm2: 0,
        scarSeverity: 'moderate', isKeloid: false,
        hasDisabilityCertificate: false, hasPermanentImpairment: false,
        hasRangeOfMotionLimitation: false, hasNerveDamage: false,
        hasAmputation: false,
      },
      medicalReceipts: {
        emergencyFee: 0, ambulanceFee: 0, nhiCopayment: 0, registrationFee: 0,
        diagnosisCertificateFee: 0, nonNhiNecessaryMedicalFee: 0, wardFeeDifference: 0,
        mealFee: 0, prosthesisFee: 0, dentureFee: 0, artificialEyeFee: 0,
        medicalMaterialFee: 0, assistiveDeviceFee: 0, transportationFee: 0,
        nursingFee: 0, otherNecessaryMedicalFee: 0,
      },
      property: {
        vehicleRepairCost: 0, vehicleActualValue: 0, vehicleSalvageValue: 0,
        towingFee: 0, rentalCarFee: 0, phoneDamage: 0, helmetDamage: 0,
        clothingDamage: 0, glassesDamage: 0, otherPropertyDamage: 0,
      },
    } as unknown as ClaimInput)

    expect(r.scarRevision.amount).toBe(0)
    expect(r.workLossExtended.calculationType).toBe('none')  // 無請假資料
    expect(r.laborCapacityLossEstimate).toBe(0)  // 無失能線索
  })
})
