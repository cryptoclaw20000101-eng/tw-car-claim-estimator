// =====================================================================
// 地區 ↔ 法院 對應測試
// 涵蓋台/臺 異體字、省轄市、離島、外島（金門/連江走福建法院）
// =====================================================================

import { describe, it, expect } from 'vitest'
import { lookupCourt, regionCourtMap } from '@/lib/insurance/region-court-map'
import { getRegionAdjustment, regionAdjustments } from '@/lib/insurance/region-adjustments'

describe('lookupCourt — 縣市對應地方法院', () => {
  it('台中市 / 臺中市 都應對到臺灣臺中地方法院', () => {
    expect(lookupCourt('台中市')).toBe('臺灣臺中地方法院')
    expect(lookupCourt('臺中市')).toBe('臺灣臺中地方法院')
  })

  it('六都 + 主要縣市', () => {
    expect(lookupCourt('台北市')).toBe('臺灣臺北地方法院')
    expect(lookupCourt('新北市')).toBe('臺灣新北地方法院')
    expect(lookupCourt('桃園市')).toBe('臺灣桃園地方法院')
    expect(lookupCourt('台南市')).toBe('臺灣臺南地方法院')
    expect(lookupCourt('高雄市')).toBe('臺灣高雄地方法院')
  })

  it('省轄市 + 縣', () => {
    expect(lookupCourt('基隆市')).toBe('臺灣基隆地方法院')
    expect(lookupCourt('新竹市')).toBe('臺灣新竹地方法院')
    expect(lookupCourt('新竹縣')).toBe('臺灣新竹地方法院')
    expect(lookupCourt('彰化縣')).toBe('臺灣彰化地方法院')
    expect(lookupCourt('花蓮縣')).toBe('臺灣花蓮地方法院')
  })

  it('外島 — 金門、連江走福建法院', () => {
    expect(lookupCourt('金門縣')).toBe('福建金門地方法院')
    expect(lookupCourt('連江縣')).toBe('福建連江地方法院')
  })

  it('空字串 / 找不到 → default', () => {
    expect(lookupCourt('')).toBe('default')
    expect(lookupCourt('不存在的城市')).toBe('default')
  })

  it('regionCourtMap 應有 26 個縣市對應（含異體字）', () => {
    // 22 縣市 + 4 個常見異體字 = 26
    expect(Object.keys(regionCourtMap).length).toBeGreaterThanOrEqual(22)
  })
})

describe('getRegionAdjustment — 法院地區係數', () => {
  it('臺中為基準（multiplier = 1.0）', () => {
    const r = getRegionAdjustment('臺灣臺中地方法院')
    expect(r.painAndSufferingMultiplier).toBe(1.0)
    expect(r.courtName).toBe('臺灣臺中地方法院')
  })

  it('臺北 multiplier 1.10（最高）', () => {
    const r = getRegionAdjustment('臺灣臺北地方法院')
    expect(r.painAndSufferingMultiplier).toBe(1.1)
  })

  it('高雄 multiplier 0.95（南部略低）', () => {
    const r = getRegionAdjustment('臺灣高雄地方法院')
    expect(r.painAndSufferingMultiplier).toBe(0.95)
  })

  it('看護費行情：臺北 mid = 2,400、high = 2,800', () => {
    const r = getRegionAdjustment('臺灣臺北地方法院')
    expect(r.nursingDailyRateMid).toBe(2_400)
    expect(r.nursingDailyRateHigh).toBe(2_800)
  })

  it('未知法院 → default 區', () => {
    const r = getRegionAdjustment('火星地方法院')
    expect(r.courtName).toBe('預設地區')
    expect(r.painAndSufferingMultiplier).toBe(1.0)
  })

  it('default 區 confidence 應為 low', () => {
    expect(regionAdjustments.default.confidenceLevel).toBe('low')
  })

  it('六都法院 + default 至少 7 個 entry', () => {
    expect(Object.keys(regionAdjustments).length).toBeGreaterThanOrEqual(7)
  })
})
