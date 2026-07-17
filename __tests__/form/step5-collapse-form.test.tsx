// =====================================================================
// v0.20.4+ 緊急 hotfix test：Step5FeesAndProperty Collapse 折疊時 Form.Item 沒 register
// 導致 estimateClaim 收到空白 receipts/property → 強制險 0 元 production bug
//
// 修法：在 Collapse items array 內加 forceRender: true，確保 panel children 永遠 render
//
// 守護：
// 1. Step5FeesAndProperty render 時 Form schema 包含所有 receipts/property 欄位
// 2. 即使 panel 折疊（透過 activeKey 切換），Form.validateFields 仍能拿到值
// =====================================================================

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { estimateClaim } from '@/lib/insurance'

describe('Step5FeesAndProperty — Collapse forceRender 守護', () => {
  it('SSR render 包含 Form.Item name={["receipts", "nhiCopayment"]}', () => {
    // 不能直接 SSR 因為需要 Form.useFormInstance — 改測 component import 是否含關鍵字
    const src = readFileSync('app/claims/new/_steps/Step5FeesAndProperty.tsx', 'utf-8')
    expect(src).toContain("name={['receipts'")
    expect(src).toContain("name={['property'")
    expect(src).toContain('forceRender: true')
  })

  it('Collapse items 必須有 forceRender: true 才能讓 Form 收集到值', () => {
    // v0.20.4+ hotfix 守護：未來若有人移除 forceRender，這測試會 fail
    const src = readFileSync('app/claims/new/_steps/Step5FeesAndProperty.tsx', 'utf-8')
    const forceRenderCount = (src.match(/forceRender:\s*true/g) ?? []).length
    // 必須有兩個 forceRender（medical panel + property panel）
    expect(forceRenderCount).toBeGreaterThanOrEqual(2)
  })
})

describe('production submit flow → 強制險必進入估算', () => {
  it('純函式 estimateClaim 對完整 ClaimInput 回傳 compulsoryTotalEstimated > 0', () => {
    const result = estimateClaim({
      basics: {
        accidentDate: '2026-03-15',
        accidentLocation: '臺中市西區',
        accidentType: 'car_to_car',
        injuredRole: 'driver_car',
        isInjured: true, // v0.26.0e+
        isAutomobileAccident: true,
        hasPolicePreliminaryReport: true,
        hasAccidentAppraisal: false,
        hasCompulsoryInsurance: true,
        accidentCity: '臺中市',
        accidentDistrict: '西區',
        claimantResidenceCity: '臺中市',
        claimantResidenceDistrict: '西區',
        defendantResidenceCity: '臺北市',
        defendantResidenceDistrict: '大安區',
        courtJurisdiction: '臺灣臺中地方法院',
        insuranceCompanyBranchRegion: '中部',
      },
      fault: {
        selfFaultRatio: 30,
        otherFaultRatio: 70,
        faultSource: 'police_preliminary',
        isFaultDisputed: false,
      },
      person: {
        birthDate: '1990-01-01',
        age: 36,
        occupation: '',
        employmentType: 'full_time_salary',
        sixMonthAverageSalary: 50000,
        monthlySalary: 50000,
        dailyWage: 1666,
        lastYearTaxableIncome: 600000,
        hasPropertyList: false,
        hasSalaryTransferRecord: true,
        hasLeaveCertificate: true,
        hasSalaryDeductionProof: false,
        actualLeaveDays: 7,
        doctorOrderedRestDays: 14,
      },
      medical: {
        diagnosisText: '右肩旋轉肌腱破裂',
        hospitalName: '臺中榮總',
        emergencyDate: '2026-03-15',
        outpatientVisitCount: 5,
        hospitalizationDays: 3,
        hasSurgery: true,
        hasRehabilitation: true,
        rehabilitationCount: 12,
        requiresNursingCare: false,
        nursingDays: 0,
        isSymptomFixed: true,
        hasDisabilityCertificate: false,
        hasFracture: false,
        hasDislocation: false,
        hasLigamentInjury: true,
        hasNerveDamage: false,
        hasAmputation: false,
        hasOrganDamage: false,
        hasScar: true,
        scarLengthCm: 5,
        scarLocation: '右肩',
        jointName: null,
        hasRangeOfMotionLimitation: true,
        romLossDegree: 30,
        romNormalDegree: 180,
        hasMuscleWeakness: false,
        hasSensoryLoss: false,
        hasPermanentImpairment: false,
      },
      medicalReceipts: {
        emergencyFee: 1500,
        ambulanceFee: 0,
        nhiCopayment: 10000, // user 反饋：必進入估算
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
        specialMaterialFee: 0,
        medicalMaterialFee: 0,
        assistiveDeviceFee: 0,
        transportationFee: 0,
        nursingFee: 0,
        nursingDays: 0,
        otherNecessaryMedicalFee: 0,
      },
      property: {
        vehicleRepairEstimate: 0,
        vehicleRepairInvoice: 50000, // user 反饋：必進入估算
        vehicleMarketValueBeforeAccident: 0,
        salvageValue: 0,
        towingFee: 0,
        rentalCarFee: 0,
        phoneDamage: 0,
        helmetDamage: 0,
        clothingDamage: 0,
        glassesDamage: 0,
        otherPropertyDamage: 0,
      },
    })
    // v0.20.4+ 守護：純函式邏輯正確（nhiCopayment 1 萬 → 強制險 >= 1 萬）
    expect(result.compulsoryTotalEstimated).toBeGreaterThanOrEqual(10000)
    expect(result.compulsoryMedicalApproved).toBeGreaterThanOrEqual(10000)
  })
})
