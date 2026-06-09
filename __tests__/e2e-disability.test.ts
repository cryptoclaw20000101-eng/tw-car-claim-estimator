// 失能保典解析 E2E：通用 precedent loader + 失能合併 / 治療觀察期 / 強制險排除
import { describe, it, expect } from 'vitest'
import {
  findDisabilityMergingPrecedents,
  findTreatmentPeriodPrecedents,
  findCompulsoryExclusionPrecedents,
  getDisabilityTaxonomy,
  getGeneralPrecedentCount,
} from '@/lib/estimate/precedents'

describe('失能保典 E2E：通用判例載入器', () => {
  it('總件數 ≥ 4（含 disability-merging.json 4 筆）', () => {
    const n = getGeneralPrecedentCount()
    expect(n).toBeGreaterThanOrEqual(4)
  })

  it('findDisabilityMergingPrecedents → 1 筆失能保典併存升等規則', () => {
    const arr = findDisabilityMergingPrecedents(2)
    expect(arr.length).toBeGreaterThan(0)
    expect(arr[0].id).toBe('tw-disability-merging-1112')
    // 規則關鍵字必須在 gist 內
    expect(String(arr[0].gist)).toContain('從優')
    expect(String(arr[0].gist)).toContain('升等')
  })

  it('findTreatmentPeriodPrecedents → 治療觀察期規則', () => {
    const arr = findTreatmentPeriodPrecedents(1)
    expect(arr.length).toBe(1)
    expect(arr[0].id).toBe('tw-disability-treatment-period-mental')
    // 1 年 / 2 年
    expect(String(arr[0].gist)).toContain('1 年')
    expect(String(arr[0].gist)).toContain('2 年')
  })

  it('findCompulsoryExclusionPrecedents → 黃底 = 強制險不給付', () => {
    const arr = findCompulsoryExclusionPrecedents(1)
    expect(arr.length).toBe(1)
    expect(arr[0].id).toBe('tw-disability-yellow-bg-not-paid')
    // 心臟移植 7-10
    expect(String(arr[0].gist)).toContain('7-10')
  })

  it('getDisabilityTaxonomy → 12 大類失能種類（從 notes 取）', () => {
    const tax = getDisabilityTaxonomy()
    expect(tax).not.toBeNull()
    const notesStr = JSON.stringify(tax!.notes ?? [])
    for (const cat of ['精神', '神經', '眼', '耳', '鼻', '口', '胸腹部臟器', '軀幹', '頭臉頸', '皮膚', '上肢', '下肢']) {
      expect(notesStr).toContain(cat)
    }
  })
})
