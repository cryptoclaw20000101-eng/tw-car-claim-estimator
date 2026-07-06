'use strict'
// =====================================================================
// 法規版本切換判定（v0.8.2+）
//
// 用於判斷「事故日是否落在新法施行日（含）之後」，以決定計算引擎走新法或舊法邏輯。
//
// 強制汽車責任保險給付標準 §2 第 3 項第 6 款（醫療材料及輔具費）
//   修法日期：民國 115-05-29，施行日：2026-07-01
//   新法：特殊材料費 + 輔具費 各自 pro-rata 套 2 萬上限（拆 subItems）
//   舊法：醫材費 + 特殊材料費 + 輔具費 合併 1 個 2 萬上限
//
// 強制汽車責任保險失能給付標準表（民國 115-05-29 修正，115-07-01 施行）
//   新法：先 classifyJointDisorder 判定三分類 → 再查 UPPER/LOWER 對照表
//   舊法：百分比段 5/15/30/50/70% 對應單一失能等級（v0.6.6 commit 之前邏輯）
// =====================================================================
Object.defineProperty(exports, '__esModule', { value: true })
exports.NEW_LAW_CUTOFF = void 0
exports.isNewLaw = isNewLaw
exports.getLawVersionLabel = getLawVersionLabel
/**
 * 新法施行日（民國 115 年 7 月 1 日 = 西元 2026-07-01）
 * 強制險 §2.3.6 醫材 + 失能等級附表 同日施行
 */
exports.NEW_LAW_CUTOFF = '2026-07-01'
/**
 * 判斷事故日是否走新法邏輯
 *
 * 規則：
 *   - accidentDate 為 null / undefined / 空字串 → 視為新法（保守預設，向後相容 v0.8.2 前行為）
 *   - accidentDate >= 2026-07-01 → 新法
 *   - accidentDate <  2026-07-01 → 舊法
 *
 * 容錯：
 *   - 非標準日期格式 → 回傳 false（保守走舊法，避免誤判新法導致低估舊案件）
 *   - 純日期字串比對（不轉 Date 物件），避免時區/格式轉換錯
 *
 * @param accidentDate 事故日（YYYY-MM-DD 或 dayjs 可轉格式）
 * @returns boolean — true = 新法 / false = 舊法
 *
 * @example
 * isNewLaw('2026-06-30')            // false（舊法）
 * isNewLaw('2026-07-01')            // true（新法）
 * isNewLaw('2027-01-15')            // true（新法）
 * isNewLaw(null)                    // true（保守預設）
 * isNewLaw(undefined)               // true（保守預設）
 * isNewLaw('')                      // true（保守預設）
 * isNewLaw('invalid-date')          // false（無法解析走舊法，避免誤判）
 */
function isNewLaw(accidentDate) {
  if (!accidentDate) return true // null / undefined / '' → 保守預設為新法
  // 純字串前 10 碼比對 YYYY-MM-DD，避免 dayjs 物件 / Date 物件轉換的時區差
  const normalized = String(accidentDate).slice(0, 10)
  // YYYY-MM-DD 格式驗證
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return false
  // 字串比較（YYYY-MM-DD 字典序 == 時間序）
  return normalized >= exports.NEW_LAW_CUTOFF
}
/**
 * 取得當前事故日對應的法規版本標籤（給 UI 顯示用）
 *
 * @param accidentDate 事故日
 * @returns '新法 (2026-07-01 起)' | '舊法 (2026-07-01 前)'
 */
function getLawVersionLabel(accidentDate) {
  return isNewLaw(accidentDate)
    ? `新法 (${exports.NEW_LAW_CUTOFF} 起)`
    : `舊法 (${exports.NEW_LAW_CUTOFF} 前)`
}
