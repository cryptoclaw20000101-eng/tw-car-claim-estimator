// =====================================================================
// 關節活動度（ROM）資料庫
// 規範來源：American Medical Association (AMA) Guides to the Evaluation
//           of Permanent Impairment + 強制險失能等級表附表
//
// 規則引擎流程：
// 1. 取得該關節的正常 ROM 上限
// 2. 計算喪失比例 = romLossDegree / normalDegree
// 3. 依喪失比例對應到失能等級（見 levelFromRomLoss）
// 4. 加上其他線索（截肢、神經、肌力）做加成
// =====================================================================

import type { JointName } from './types'

// 關節正常 ROM（度），採用「主動屈曲 + 伸展 + 旋轉」常見上限
// 註：精確 ROM 量測須由骨科/復健科執行，這裡是 MVP 預設值
export const jointNormalRom: Record<JointName, number> = {
  shoulder: 180,  // 肩：屈曲 + 伸展
  elbow: 145,     // 肘：屈曲
  wrist: 150,     // 腕：屈曲 + 伸展
  hip: 120,       // 髖：屈曲 + 伸展
  knee: 135,      // 膝：屈曲
  ankle: 50,      // 踝：背屈 + 蹠屈
  finger: 90,     // 指：屈曲（每指）
  toe: 30,        // 趾：屈曲
  cervical: 50,   // 頸椎：屈曲 + 伸展 + 側彎
  lumbar: 60,     // 腰椎：屈曲 + 伸展
}

export const jointLabelZh: Record<JointName, string> = {
  shoulder: '肩關節',
  elbow: '肘關節',
  wrist: '腕關節',
  hip: '髖關節',
  knee: '膝關節',
  ankle: '踝關節',
  finger: '手指關節',
  toe: '腳趾關節',
  cervical: '頸椎',
  lumbar: '腰椎',
}

/**
 * 從使用者輸入取得該關節的正常 ROM
 * 優先採用使用者提供的 romNormalDegree，否則查表
 */
export function resolveNormalRom(joint: JointName, override: number): number {
  if (override && override > 0) return override
  return jointNormalRom[joint]
}

/**
 * 依關節活動度喪失比例 → 障害程度（v0.6.6 真實附表版）
 *
 * 法源依據：強制汽車責任保險失能給付標準 §3 / §6 審核基準
 *   - 「喪失機能」= 完全強直 / 完全麻痺
 *   - 「顯著運動障害」= 喪失生理運動範圍 1/2 以上（≥ 50%）
 *   - 「運動障害」= 喪失生理運動範圍 1/3 以上（33% ≤ loss < 50%）
 *   - 33% 以下 → 無明顯障害
 *
 * 注意：這只給單一關節的障害程度。要算整肢等級還需：
 *   1. 知道該關節屬於哪個三大關節組（上肢：肩/肘/腕；下肢：髖/膝/踝）
 *   2. 整肢三大關節中有幾個落入同一障害程度（由 disability.ts 處理）
 *
 * 回傳的「推定等級」是「該關節獨立推定」對應的最低條號：
 *   - 單一關節 motion (40%) → 12-35 第 13 級（user 案例）
 *   - 單一關節 significant (60%) → 12-29 第 11 級
 *   - 單一關節 lost (100%) → 12-23 第 9 級
 *
 * 這只是「初判」，最終等級須依整肢三大關節狀態組合 + 對側肢體狀態決定
 * （見 disability-joint-mapping.ts）
 */
export function levelFromRomLoss(lossPercent: number): {
  level: import('./types').DisabilityLevel
  confidence: number
  /** v0.6.6 新增：真實附表的障害程度三分類 */
  severity: 'none' | 'motion' | 'significant' | 'lost'
} {
  // 重用 disability-joint-mapping 的三分類邏輯（避免重複實作）
  // 這裡 inline 是因為 joint-rom.ts 在 disability-joint-mapping 之前
  // 載入，且舊測試可能依賴這個函式
  let severity: 'none' | 'motion' | 'significant' | 'lost'
  if (lossPercent < 0) {
    return { level: 15, confidence: 0, severity: 'none' }
  } else if (lossPercent >= 100) {
    severity = 'lost'
  } else if (lossPercent >= 50) {
    severity = 'significant'
  } else if (lossPercent >= 33) {
    severity = 'motion'
  } else {
    severity = 'none'
  }

  // 對應單一關節獨立推定的「最低條號」（= 三關節中只有 1 個關節障害）
  // 真實附表（v0.6.6）：
  //   - motion + 1 大關節 → 12-35 第 13 級 / 11-40 第 13 級
  //   - significant + 1 大關節 → 12-29 第 11 級 / 11-34 第 11 級
  //   - lost + 1 大關節 → 12-23 第 9 級 / 11-28 第 9 級
  //   - < 33% → 第 15 級（無明顯障害）
  switch (severity) {
    case 'none':
      return { level: 15, confidence: 0.3, severity }
    case 'motion':
      return { level: 13, confidence: 0.6, severity }
    case 'significant':
      return { level: 11, confidence: 0.75, severity }
    case 'lost':
      return { level: 9, confidence: 0.8, severity }
  }
}
