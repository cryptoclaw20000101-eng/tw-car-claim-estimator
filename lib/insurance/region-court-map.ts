// =====================================================================
// 地區 ↔ 地方法院對應表（v2 新增）
// 規範：依《法院組織法》§14 + 各級法院管轄區域
// 注意：實際管轄仍可能因被告住所、侵權行為地、保險契約而不同
//       → 結果頁必須顯示「法院轄區僅供估算參考」免責
// =====================================================================

export const regionCourtMap: Record<string, string> = {
  // 直轄市（支援台/臺 異體字）
  '台北市': '臺灣臺北地方法院',
  '臺北市': '臺灣臺北地方法院',
  '新北市': '臺灣新北地方法院',
  '桃園市': '臺灣桃園地方法院',
  '台中市': '臺灣臺中地方法院',
  '臺中市': '臺灣臺中地方法院',
  '台南市': '臺灣臺南地方法院',
  '臺南市': '臺灣臺南地方法院',
  '高雄市': '臺灣高雄地方法院',

  // 省轄市 / 縣
  '基隆市': '臺灣基隆地方法院',
  '新竹市': '臺灣新竹地方法院',
  '新竹縣': '臺灣新竹地方法院',
  '苗栗縣': '臺灣苗栗地方法院',
  '彰化縣': '臺灣彰化地方法院',
  '南投縣': '臺灣南投地方法院',
  '雲林縣': '臺灣雲林地方法院',
  '嘉義市': '臺灣嘉義地方法院',
  '嘉義縣': '臺灣嘉義地方法院',
  '屏東縣': '臺灣屏東地方法院',
  '宜蘭縣': '臺灣宜蘭地方法院',
  '花蓮縣': '臺灣花蓮地方法院',
  '台東縣': '臺灣臺東地方法院',
  '臺東縣': '臺灣臺東地方法院',
  '澎湖縣': '臺灣澎湖地方法院',
  '金門縣': '福建金門地方法院',
  '連江縣': '福建連江地方法院',
}

/**
 * 從縣市名推算管轄法院名稱，找不到回 'default'
 */
export function lookupCourt(city: string): string {
  if (!city) return 'default'
  const normalized = city.trim()
  return regionCourtMap[normalized] ?? regionCourtMap[normalized.replace(/台/g, '臺')] ?? 'default'
}

/**
 * v0.2.9+ — 反向：給定法院名（"臺灣臺中地方法院"）→ 推回縣市（"臺中市"）
 * 用於 findRelatedPracticeCases 的「同縣市」配對
 *
 * 為什麼要這個？因為 precedents.json 的 court 欄位是「臺灣XX地方法院」，
 * 而使用者表單的 courtName 也是這個格式，cityOf 兩邊都要能解析。
 *
 * 涵蓋：
 *   - 全名：「臺灣臺中地方法院」→「臺中市」
 *   - 簡名：「新北地方法院（和解）」→ 也涵蓋（用 value 部分字串比對）
 *   - 法院代碼：「TCDV」/「CHDM」→ 不支援（資料問題，需 scrape 那邊補 COURT_CODE）
 *
 * 異體字過濾：regionCourtMap 同個法院有 2 個 key（「台北市」+「臺北市」），
 * 統一回傳「臺」字開頭的標準版本。
 */
export function courtToCity(courtName: string): string | null {
  if (!courtName) return null
  const normalized = courtName.trim()
  if (!normalized) return null
  // 收集所有匹配 key，去重後回標準「臺」字版
  const matches: string[] = []
  for (const [city, court] of Object.entries(regionCourtMap)) {
    // 1) exact match 法院名
    if (court === normalized) matches.push(city)
    // 2) includes 比對（court 去掉「臺灣」前綴後是 normalized 的子字串）
    else if (normalized.includes(court.replace('臺灣', ''))) matches.push(city)
  }
  if (matches.length === 0) return null
  // 優先回「臺」字版（標準化），沒有就回第一個
  return matches.find((c) => c.startsWith('臺')) ?? matches[0]
}
