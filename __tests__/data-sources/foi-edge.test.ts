// =====================================================================
// 金融消費評議中心 (foi) — 邊界測試
// 補 line 199-200「該類別 0 案例」分支守護
// =====================================================================

import { describe, it, expect } from 'vitest'
import { getAverageFoiCompensation } from '@/lib/data-sources/foi'
import type { FoiDisputeCategory } from '@/lib/data-sources/types'

describe('foi — getAverageFoiCompensation 邊界', () => {
  it('該類別有案例時回傳正整數（基本情境）', () => {
    // causation 類別 CASES 內有 3 筆
    const avg = getAverageFoiCompensation('causation')
    expect(avg).not.toBeNull()
    expect(avg).toBeGreaterThan(0)
  })

  it('該類別 0 案例時回傳 null（不爆掉、不回傳 0）', () => {
    // 故意 cast 一個不存在於 CASES 的假類別，觸發 line 199 邊界
    // 註：TS type 是 closed union，這裡是 runtime 防呆測試
    const fakeCategory = 'not_existed_category' as unknown as FoiDisputeCategory
    expect(getAverageFoiCompensation(fakeCategory)).toBeNull()
  })

  it('所有 6 個合法類別呼叫都不爆', () => {
    const categories: FoiDisputeCategory[] = [
      'causation',
      'necessary_medical',
      'disability',
      'nursing_fee',
      'work_loss',
      'overlap_compulsory',
    ]
    for (const cat of categories) {
      const avg = getAverageFoiCompensation(cat)
      // 要嘛 null、要嘛正整數，絕對不能是負數或 NaN
      if (avg !== null) {
        expect(Number.isFinite(avg)).toBe(true)
        expect(avg).toBeGreaterThanOrEqual(0)
      }
    }
  })
})
