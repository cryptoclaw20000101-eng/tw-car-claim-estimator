/**
 * 失能 12 大類（失能保典 2019 年版，現代保險出版）
 * 來源：data/precedents/disability-merging.json（category=disability_taxonomy）
 *
 * 用法：
 *   <Select options={DISABILITY_CATEGORIES} />
 *   表單選大類 → 自動帶出**最保守預設**等級（v0.6.6 統一為 13 級）
 *
 * v0.6.6 重大改動：
 *   defaultLevel 全部統一為 13 級（最輕），不再用猜測的 9/7/11 等。
 *   原因：v0.6.5 之前 defaultLevel=9（下肢）會自動覆蓋 ROM 細算結果，
 *   導致「踝關節 ROM 20°」被誤判為 9 級，實際應為 13 級（12-35）。
 *
 *   表單現在帶 13 級「讓 user 知道要補 ROM 量測」，等真實附表對照表
 *   （disability-joint-mapping.ts）算出更精確的等級時，會自動覆蓋。
 *   真正的等級計算路徑：
 *     1. user 填 ROM 量測 → disability.ts 算 romLossPercent
 *     2. 真實附表三分類 → lookupUpperLimbLevel / lookupLowerLimbLevel
 *     3. 結果 → disability.possibleLevel（最精確）
 *     4. 表單 defaultLevel 只是 initial 提示，最終由 ROM 細算覆蓋
 */

export const DISABILITY_CATEGORIES = [
  { value: '01_mental', label: '01 精神（須治療 1-2 年）', defaultLevel: 13, needsMMSE: true },
  { value: '02_neural', label: '02 神經（中樞/周邊）', defaultLevel: 13, needsMMSE: true },
  { value: '03_eye', label: '03 眼（視力/眼瞼）', defaultLevel: 13 },
  { value: '04_ear', label: '04 耳（聽力/前庭）', defaultLevel: 13 },
  { value: '05_nose', label: '05 鼻（嗅覺/外觀）', defaultLevel: 13 },
  { value: '06_mouth', label: '06 口（咀嚼/言語）', defaultLevel: 13 },
  {
    value: '07_thoracic_organ',
    label: '07 胸腹部臟器（心/肝/腎/肺）',
    defaultLevel: 13,
    compulsoryExclusion: true,
  },
  { value: '08_trunk', label: '08 軀幹（脊柱/骨盆/胸部）', defaultLevel: 13 },
  { value: '09_head_face_neck', label: '09 頭臉頸（外觀/疤痕）', defaultLevel: 13 },
  { value: '10_skin', label: '10 皮膚（含疤痕/燒燙）', defaultLevel: 13 },
  { value: '11_upper_limb', label: '11 上肢（手臂/手指）', defaultLevel: 13 },
  { value: '12_lower_limb', label: '12 下肢（腿部/足趾）', defaultLevel: 13 },
] as const

export type DisabilityCategory = (typeof DISABILITY_CATEGORIES)[number]['value']

/** 失能保典 + 強制險失能給付標準 1-15 等 */
export const DISABILITY_LEVELS = [
  { value: 1, label: '1 等（最重 — 100% 勞減）' },
  { value: 2, label: '2 等（95%）' },
  { value: 3, label: '3 等（90%）' },
  { value: 4, label: '4 等（85%）' },
  { value: 5, label: '5 等（80%）' },
  { value: 6, label: '6 等（75%）' },
  { value: 7, label: '7 等（70%）' },
  { value: 8, label: '8 等（65%）' },
  { value: 9, label: '9 等（60%）' },
  { value: 10, label: '10 等（55%）' },
  { value: 11, label: '11 等（45%）' },
  { value: 12, label: '12 等（35%）' },
  { value: 13, label: '13 等（25%）' },
  { value: 14, label: '14 等（15%）' },
  { value: 15, label: '15 等（最輕 — 5% 勞減）' },
] as const

export type DisabilityLevelValue = (typeof DISABILITY_LEVELS)[number]['value']

/** 從 12 大類 value 查 defaultLevel */
export function getDefaultLevel(category: DisabilityCategory | null | undefined): number | null {
  if (!category) return null
  const found = DISABILITY_CATEGORIES.find((c) => c.value === category)
  return found?.defaultLevel ?? null
}

/** 12 大類是否為「強制險不給付」類別（黃底）*/
export function isCompulsoryExclusion(category: DisabilityCategory | null | undefined): boolean {
  if (!category) return false
  const found = DISABILITY_CATEGORIES.find((c) => c.value === category)
  // `as const` 後未宣告的 optional 欄位不存在，c 直接 optional
  return (found as { compulsoryExclusion?: boolean } | undefined)?.compulsoryExclusion === true
}

/** 12 大類是否需要心理衡鑑（精神/神經）*/
export function needsMMSE(category: DisabilityCategory | null | undefined): boolean {
  if (!category) return false
  const found = DISABILITY_CATEGORIES.find((c) => c.value === category)
  return (found as { needsMMSE?: boolean } | undefined)?.needsMMSE === true
}
