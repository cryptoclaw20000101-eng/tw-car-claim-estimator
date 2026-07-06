'use strict'
// =====================================================================
// 三大關節 × 3 種狀態 → 條號/等級 對照表
//
// 法源：強制汽車責任保險失能給付標準表（民國 115-05-29 修正，115-07-01 施行）
// 來源 PDF：CALI 法規資料庫 doc_48f88159057e_附表-強制汽車責任保險失能給付標準表.pdf
//
// 重要定義（法源條文）：
//   - 「喪失機能」= 關節完全強直或完全麻痺狀態
//   - 「顯著運動障害」= 喪失生理運動範圍 1/2 以上（≥ 50%）
//   - 「運動障害」= 喪失生理運動範圍 1/3 以上（≥ 33%，< 50%）
//
// 對照表結構：
//   - 上肢：11-23 ~ 11-44（肩 + 肘 + 腕 三大關節）
//   - 下肢：12-18 ~ 12-37（髖 + 膝 + 踝 三大關節）
//
// 每張表都是「兩側肢體狀態」組合 → 等級：
//   - 兩肢體均 X → 等級 N
//   - 兩肢體三大關節各有 X 大關節 → 等級 N
//   - 一肢體 X → 等級 N
//   - 一肢體三大關節有 X 大關節 → 等級 N（X=2 大關節 = 中度；X=1 大關節 = 輕度）
// =====================================================================
Object.defineProperty(exports, '__esModule', { value: true })
exports.classifyJointDisorder = classifyJointDisorder
exports.lookupUpperLimbLevel = lookupUpperLimbLevel
exports.lookupLowerLimbLevel = lookupLowerLimbLevel
exports.levelFromRomLossOldLaw = levelFromRomLossOldLaw
exports.lookupDisabilityLevelByDate = lookupDisabilityLevelByDate
const regulation_cutoff_1 = require('../data-sources/regulation-cutoff')
/**
 * 從 ROM 喪失比例 → 障害程度（真實附表定義）
 *
 * @param lossPercent - 喪失比例 0-100（0 = 無喪失，100 = 完全喪失）
 * @returns JointDisorderSeverity
 *   - 'none'      : 喪失 < 33%（客觀上不構成明顯障害）
 *   - 'motion'    : 33% ≤ 喪失 < 50%（運動障害 — 最輕）
 *   - 'significant': 50% ≤ 喪失 < 100%（顯著運動障害 — 中度）
 *   - 'lost'      : 完全喪失（強直/麻痺 — 最重；此處 lossPercent === 100 視為 lost）
 */
function classifyJointDisorder(lossPercent) {
  if (lossPercent < 0) return 'none'
  if (lossPercent >= 100) return 'lost'
  if (lossPercent >= 50) return 'significant'
  if (lossPercent >= 33) return 'motion'
  return 'none'
}
// --- 對照表（key = 兩側障害程度 + 大關節數）---
/**
 * 上肢障害對照表（11-23 ~ 11-44）
 *
 * key 格式：`${leftSeverity}|${leftJointCount}|${rightSeverity}|${rightJointCount}`
 *   - severity: 'none' | 'motion' | 'significant' | 'lost'
 *   - jointCount: 'full' = 整肢（三關節都障害），'2' = 三大關節中有二大關節障害，'1' = 三大關節中有一大關節障害
 *
 * value: { articleId: '11-23', level: 2 }
 */
const UPPER_LIMB_TABLE = {
  // 兩上肢均喪失機能
  'lost|full|lost|full': { articleId: '11-23', level: 2 },
  // 兩上肢三大關節各有二大關節喪失機能
  'lost|2|lost|2': { articleId: '11-24', level: 3 },
  // 兩上肢三大關節各有一大關節喪失機能
  'lost|1|lost|1': { articleId: '11-25', level: 6 },
  // 一上肢喪失機能（不限對側）
  'lost|full|none|0': { articleId: '11-26', level: 6 },
  'none|0|lost|full': { articleId: '11-26', level: 6 },
  // 一上肢三大關節有二大關節喪失機能
  'lost|2|none|0': { articleId: '11-27', level: 7 },
  'none|0|lost|2': { articleId: '11-27', level: 7 },
  // 一上肢三大關節有一大關節喪失機能
  'lost|1|none|0': { articleId: '11-28', level: 9 },
  'none|0|lost|1': { articleId: '11-28', level: 9 },
  // 兩上肢均遺存顯著運動障害
  'significant|full|significant|full': { articleId: '11-29', level: 4 },
  // 兩上肢三大關節各有二大關節遺存顯著運動障害
  'significant|2|significant|2': { articleId: '11-30', level: 5 },
  // 兩上肢三大關節各有一大關節遺存顯著運動障害
  'significant|1|significant|1': { articleId: '11-31', level: 7 },
  // 一上肢遺存顯著運動障害
  'significant|full|none|0': { articleId: '11-32', level: 7 },
  'none|0|significant|full': { articleId: '11-32', level: 7 },
  // 一上肢三大關節有二大關節遺存顯著運動障害
  'significant|2|none|0': { articleId: '11-33', level: 8 },
  'none|0|significant|2': { articleId: '11-33', level: 8 },
  // 一上肢三大關節有一大關節遺存顯著運動障害
  'significant|1|none|0': { articleId: '11-34', level: 11 },
  'none|0|significant|1': { articleId: '11-34', level: 11 },
  // 兩上肢均遺存運動障害
  'motion|full|motion|full': { articleId: '11-35', level: 6 },
  // 兩上肢三大關節各有二大關節遺存運動障害
  'motion|2|motion|2': { articleId: '11-36', level: 9 },
  // 兩上肢三大關節各有一大關節遺存運動障害
  'motion|1|motion|1': { articleId: '11-37', level: 11 },
  // 一上肢遺存運動障害
  'motion|full|none|0': { articleId: '11-38', level: 9 },
  'none|0|motion|full': { articleId: '11-38', level: 9 },
  // 一上肢三大關節有二大關節遺存運動障害
  'motion|2|none|0': { articleId: '11-39', level: 11 },
  'none|0|motion|2': { articleId: '11-39', level: 11 },
  // 一上肢三大關節有一大關節遺存運動障害
  'motion|1|none|0': { articleId: '11-40', level: 13 },
  'none|0|motion|1': { articleId: '11-40', level: 13 },
}
/**
 * 下肢障害對照表（12-18 ~ 12-37）
 * 三大關節：髖 + 膝 + 踝
 */
const LOWER_LIMB_TABLE = {
  // 兩下肢均喪失機能
  'lost|full|lost|full': { articleId: '12-18', level: 2 },
  // 兩下肢三大關節各有二大關節喪失機能
  'lost|2|lost|2': { articleId: '12-19', level: 3 },
  // 兩下肢三大關節各有一大關節喪失機能
  'lost|1|lost|1': { articleId: '12-20', level: 6 },
  // 一下肢喪失機能
  'lost|full|none|0': { articleId: '12-21', level: 6 },
  'none|0|lost|full': { articleId: '12-21', level: 6 },
  // 一下肢三大關節有二大關節喪失機能
  'lost|2|none|0': { articleId: '12-22', level: 7 },
  'none|0|lost|2': { articleId: '12-22', level: 7 },
  // 一下肢三大關節有一大關節喪失機能
  'lost|1|none|0': { articleId: '12-23', level: 9 },
  'none|0|lost|1': { articleId: '12-23', level: 9 },
  // 兩下肢均遺存顯著運動障害
  'significant|full|significant|full': { articleId: '12-24', level: 4 },
  // 兩下肢三大關節各有二大關節遺存顯著運動障害
  'significant|2|significant|2': { articleId: '12-25', level: 5 },
  // 兩下肢三大關節各有一大關節遺存顯著運動障害
  'significant|1|significant|1': { articleId: '12-26', level: 7 },
  // 一下肢遺存顯著運動障害
  'significant|full|none|0': { articleId: '12-27', level: 7 },
  'none|0|significant|full': { articleId: '12-27', level: 7 },
  // 一下肢三大關節有二大關節遺存顯著運動障害
  'significant|2|none|0': { articleId: '12-28', level: 8 },
  'none|0|significant|2': { articleId: '12-28', level: 8 },
  // 一下肢三大關節有一大關節遺存顯著運動障害
  'significant|1|none|0': { articleId: '12-29', level: 11 },
  'none|0|significant|1': { articleId: '12-29', level: 11 },
  // 兩下肢均遺存運動障害
  'motion|full|motion|full': { articleId: '12-30', level: 6 },
  // 兩下肢三大關節各有二大關節遺存運動障害
  'motion|2|motion|2': { articleId: '12-31', level: 9 },
  // 兩下肢三大關節各有一大關節遺存運動障害
  'motion|1|motion|1': { articleId: '12-32', level: 11 },
  // 一下肢遺存運動障害
  'motion|full|none|0': { articleId: '12-33', level: 9 },
  'none|0|motion|full': { articleId: '12-33', level: 9 },
  // 一下肢三大關節有二大關節遺存運動障害
  'motion|2|none|0': { articleId: '12-34', level: 11 },
  'none|0|motion|2': { articleId: '12-34', level: 11 },
  // 一下肢三大關節有一大關節遺存運動障害 — user 案例：踝關節 ROM 20° → 第 13 級
  'motion|1|none|0': { articleId: '12-35', level: 13 },
  'none|0|motion|1': { articleId: '12-35', level: 13 },
}
/**
 * 查詢上肢障害等級
 *
 * @param left - 左上肢障害摘要
 * @param right - 右上肢障害摘要
 * @returns { articleId, level } | null（找不到對應條號時）
 */
function lookupUpperLimbLevel(left, right) {
  var _a
  const key = `${left.severity}|${left.count}|${right.severity}|${right.count}`
  return (_a = UPPER_LIMB_TABLE[key]) !== null && _a !== void 0 ? _a : null
}
/**
 * 查詢下肢障害等級
 *
 * @param left - 左下肢障害摘要
 * @param right - 右下肢障害摘要
 * @returns { articleId, level } | null
 */
function lookupLowerLimbLevel(left, right) {
  var _a
  const key = `${left.severity}|${left.count}|${right.severity}|${right.count}`
  return (_a = LOWER_LIMB_TABLE[key]) !== null && _a !== void 0 ? _a : null
}
// =====================================================================
// v0.8.2 法規版本切換（新法 / 舊法）
// 強制汽車責任保險失能給付標準表（民國 115-05-29 修正，115-07-01 施行）
//
// 新法：先用 classifyJointDisorder 判定三分類 → 再查 UPPER/LOWER 對照表
// 舊法：百分比段 5/15/30/50/70% 對應單一失能等級（v0.6.6 commit 之前邏輯）
// =====================================================================
/**
 * 舊法版（事故日 < 2026-07-01）：ROM 喪失百分比 → 失能等級
 * 法源：強制汽車責任保險失能給付標準表 修法前（民國 105 年以前常用對照）
 *
 * 5/15/30/50/70% 五層閾值：
 *   ≥ 70% → 第 2 級（嚴重機能喪失）
 *   ≥ 50% → 第 7 級（中度機能障害）
 *   ≥ 30% → 第 9 級（輕度機能障害）
 *   ≥ 15% → 第 11 級（輕微機能障害）
 *   ≥ 5%  → 第 13 級（極輕微機能障害）
 *   < 5%  → 第 15 級（無明顯障害）
 */
function levelFromRomLossOldLaw(percent) {
  if (percent < 0) return 15
  if (percent >= 70) return 2
  if (percent >= 50) return 7
  if (percent >= 30) return 9
  if (percent >= 15) return 11
  if (percent >= 5) return 13
  return 15
}
/**
 * 依事故日自動切換新/舊法 + 整肢三大關節障害摘要 → 失能等級（單側基準）
 *
 * @param joint 'upper' | 'lower'（上肢 / 下肢）
 * @param percent ROM 喪失百分比 0-100（單一關節或整肢平均）
 * @param accidentDate 事故日（YYYY-MM-DD）；null/undefined 視為新法
 * @returns DisabilityLevel 1-15
 *
 * @example
 * // 踝關節 ROM 20°（40%），事故日 2024
 * lookupDisabilityLevelByDate('lower', 40, '2024-01-01') // → 9（舊法 30% ≤ 40% < 50%）
 *
 * // 踝關節 ROM 20°（40%），事故日 2026-07-01
 * // 須先 classifyJointDisorder(40) → 'motion' → 查 LOWER 對照表
 * lookupDisabilityLevelByDate('lower', 40, '2026-07-01') // → 13（user 真實案例）
 */
function lookupDisabilityLevelByDate(joint, percent, accidentDate) {
  var _a
  if (!(0, regulation_cutoff_1.isNewLaw)(accidentDate)) {
    // 舊法：百分比段直接對應單一等級
    return levelFromRomLossOldLaw(percent)
  }
  // 新法：三分類 → 查表（單關節障害，視為 motion|1|none|0 → 對應 article 11-40 上肢 / 12-35 下肢 = 13）
  const severity = classifyJointDisorder(percent)
  // 預設單關節障害：summary.count = '1'，對側無障害
  const left = { count: '1', severity }
  const right = { count: '0', severity: 'none' }
  const result =
    joint === 'upper' ? lookupUpperLimbLevel(left, right) : lookupLowerLimbLevel(left, right)
  return (_a = result === null || result === void 0 ? void 0 : result.level) !== null &&
    _a !== void 0
    ? _a
    : 15
}
