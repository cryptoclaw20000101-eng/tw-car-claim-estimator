import { describe, expect, it } from 'vitest'
import {
  DISABILITY_STANDARD_ITEMS,
  getDisabilityStandardItem,
} from '@/lib/insurance/disability-standard'

describe('現行強制險失能給付標準表', () => {
  it('完整收錄 12 個障害系列、204 個正式附表項次', () => {
    expect(DISABILITY_STANDARD_ITEMS).toHaveLength(204)
    expect(new Set(DISABILITY_STANDARD_ITEMS.map((item) => item.series)).size).toBe(12)
    expect(new Set(DISABILITY_STANDARD_ITEMS.map((item) => item.id)).size).toBe(204)
  })

  it('可正確查得關節、截肢、精神、神經、眼耳鼻口、臟器、脊柱、瘢痕及皮膚等系列', () => {
    expect(getDisabilityStandardItem('1-1')).toMatchObject({ series: '精神障害', level: 1 })
    expect(getDisabilityStandardItem('2-5')).toMatchObject({ series: '神經障害', level: 13 })
    expect(getDisabilityStandardItem('3-1')).toMatchObject({ series: '眼障害', level: 2 })
    expect(getDisabilityStandardItem('4-1')).toMatchObject({ series: '耳障害', level: 5 })
    expect(getDisabilityStandardItem('5-2')).toMatchObject({ series: '鼻障害', level: 13 })
    expect(getDisabilityStandardItem('6-1')).toMatchObject({ series: '口腔障害', level: 2 })
    expect(getDisabilityStandardItem('7-1')).toMatchObject({ series: '胸腹部臟器障害', level: 1 })
    expect(getDisabilityStandardItem('8-1')).toMatchObject({ series: '軀幹障害', level: 7 })
    expect(getDisabilityStandardItem('9-1')).toMatchObject({ level: 8 })
    expect(getDisabilityStandardItem('10-10')).toMatchObject({ series: '皮膚障害', level: 13 })
    expect(getDisabilityStandardItem('11-61')).toMatchObject({ series: '上肢障害', level: 15 })
    expect(getDisabilityStandardItem('12-48')).toMatchObject({ series: '下肢障害', level: 15 })
  })
})
