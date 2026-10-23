import { describe, expect, it } from 'vitest'
import { estimateClaim } from '@/lib/insurance'
import { SAMPLE_INPUT } from '@/lib/insurance/sample'

describe('未受傷的補件提醒', () => {
  it('歷史人傷資料不計入未受傷案件的第三人民事責任總額', () => {
    const input = structuredClone(SAMPLE_INPUT)
    input.basics.isInjured = false
    const result = estimateClaim(input)
    const property = (result.vehicleDamage ?? 0) + result.propertyDamage
    expect(result.thirdParty.civilDamageTotalLow).toBe(property)
    expect(result.thirdParty.civilDamageTotalMid).toBe(property)
    expect(result.thirdParty.civilDamageTotalHigh).toBe(property)
    expect(result.thirdParty.liableAmountMid).toBe(
      Math.round((property * input.fault.otherFaultRatio) / 100),
    )
  })
  it('只有車損不要求醫療、休養或失能證明', () => {
    const input = structuredClone(SAMPLE_INPUT)
    input.basics.isInjured = false
    input.property.vehicleRepairEstimate = 20000
    input.property.vehicleRepairInvoice = 0
    const result = estimateClaim(input)
    expect(result.missingDocuments.some((text) => /診斷|失能|休養|薪轉|請假|扣薪/.test(text))).toBe(
      false,
    )
    expect(result.missingDocuments).toContain('車損已有估價單，建議補修車發票（實際修復費）')
    expect(result.riskNotes.some((text) => /失能初篩|首次就醫/.test(text))).toBe(false)
  })
})
