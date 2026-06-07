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
 * 依關節活動度喪失比例推估失能等級
 *
 * 規則（保守對應 — MVP 採用比例切 8 段）：
 *   0-5%   → 推定無明顯失能（等級 15 或不適用）
 *   5-15%  → 推定第 12-13 級（輕度）
 *   15-30% → 推定第 9-11 級（中度）
 *   30-50% → 推定第 6-8 級（中重度）
 *   50-70% → 推定第 4-6 級（重度）
 *   70-100% → 推定第 1-3 級（極重度）
 *
 * 注意：這只是「規則引擎初篩」，實際失能等級仍須
 *   1. 症狀固定證明
 *   2. 合格失能診斷書
 *   3. 醫師量測佐證
 *   4. 強制險失能給付審核
 * 才得以認定。
 */
export function levelFromRomLoss(lossPercent: number): { level: import('./types').DisabilityLevel; confidence: number } {
  if (lossPercent < 0) return { level: 15, confidence: 0 }
  if (lossPercent < 5) return { level: 15, confidence: 0.3 }   // 不明顯
  if (lossPercent < 15) return { level: 12, confidence: 0.5 }
  if (lossPercent < 30) return { level: 9, confidence: 0.6 }
  if (lossPercent < 50) return { level: 6, confidence: 0.7 }
  if (lossPercent < 70) return { level: 4, confidence: 0.75 }
  return { level: 2, confidence: 0.8 }
}
