import { describe, expect, it } from 'vitest'
import { estimateClaim } from '@/lib/insurance'
import { SAMPLE_INPUT } from '@/lib/insurance/sample'
import { computeVehicleDamage } from '@/lib/insurance/third-party'

describe('缺少事故前車價不代表零車損', () => {
  it.each(['vehicleRepairEstimate', 'vehicleRepairInvoice'] as const)(
    '%s 有金額但無車價，回傳待估',
    (key) => {
      const property = {
        ...SAMPLE_INPUT.property,
        vehicleRepairEstimate: 0,
        vehicleRepairInvoice: 0,
        [key]: 10000,
        vehicleMarketValueBeforeAccident: 0,
      }
      expect(computeVehicleDamage(property)).toBeNull()
      const result = estimateClaim({ ...SAMPLE_INPUT, property })
      expect(result.vehicleDamage).toBeNull()
      expect(result.missingDocuments.join(' ')).toContain('事故前車價')
    },
  )
  it('無維修費時仍為零，而非待估', () => {
    expect(
      computeVehicleDamage({
        ...SAMPLE_INPUT.property,
        vehicleRepairEstimate: 0,
        vehicleRepairInvoice: 0,
        vehicleMarketValueBeforeAccident: 0,
      }),
    ).toBe(0)
  })
})
