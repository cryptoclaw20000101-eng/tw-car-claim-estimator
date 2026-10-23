import { describe, expect, it } from 'vitest'
import { restoreClaimDraft } from '@/app/claims/new/_form'

const now = Date.parse('2026-10-20T12:00:00Z')
describe('完整表單草稿還原', () => {
  it('舊草稿僅有費用看護日數時，帶入唯一的醫療看護欄位', () => {
    const restored = restoreClaimDraft(
      JSON.stringify({ ts: now, data: { receipts: { nursingDays: 8 } } }),
      now,
    )
    expect(restored.medical.nursingDays).toBe(8)
    expect(restored.receipts.nursingDays).toBe(8)
  })
  it('新案件不預設已有警方文件或已確認肇責，核對狀態不從草稿還原', () => {
    const fresh = restoreClaimDraft(null, now)
    expect(fresh.basics.hasPolicePreliminaryReport).toBe(false)
    expect(fresh.fault.faultSource).toBe('unclear')
    const restored = restoreClaimDraft(
      JSON.stringify({ ts: now, data: { _reviewConfirmed: true } }),
      now,
    )
    expect(restored).not.toHaveProperty('_reviewConfirmed')
  })
  it('還原七天內資料，補上舊草稿缺少的欄位', () => {
    const result = restoreClaimDraft(
      JSON.stringify({
        ts: now - 6 * 86400000,
        data: { basics: { isInjured: false, accidentDate: '2026-10-01' } },
      }),
      now,
    )
    expect(result.basics.isInjured).toBe(false)
    expect(result.basics.accidentDate).toBe('2026-10-01')
    expect(result.property.vehicleRepairInvoice).toBe(0)
    expect(result.medical).toBeDefined()
  })
  it.each([
    null,
    '{bad',
    '{}',
    '{"data":null}',
    JSON.stringify({ ts: now, data: [] }),
    JSON.stringify({ ts: now - 7 * 86400000, data: { basics: { isInjured: false } } }),
    JSON.stringify({ ts: now + 1, data: { basics: { isInjured: false } } }),
  ])('損壞、過期或未來時間的草稿回到安全預設：%s', (raw) => {
    expect(() => restoreClaimDraft(raw, now)).not.toThrow()
    expect(restoreClaimDraft(raw, now).basics.isInjured).toBe(true)
  })
  it('忽略損壞的 section，保留其他 section', () => {
    const result = restoreClaimDraft(
      JSON.stringify({
        ts: now,
        data: { basics: null, receipts: [], property: { towingFee: 500 } },
      }),
      now,
    )
    expect(result.basics.isInjured).toBe(true)
    expect(result.receipts.registrationFee).toBe(0)
    expect(result.property.towingFee).toBe(500)
    expect(restoreClaimDraft(null, now).property.towingFee).toBe(0)
  })
})
