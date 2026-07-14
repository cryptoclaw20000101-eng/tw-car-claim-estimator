// =====================================================================
// 失能初篩規則引擎（spec §七 + 完整規則引擎）
//
// 規則：
// 1. 關節角度喪失 → 失能等級（真實附表三分類，v0.6.6）
// 2. 截肢 → 直接第 1 級
// 3. 神經損傷 / 肌力 / 感覺喪失 → 等級加成
// 4. 症狀固定 + 永久障害 → confidence 提升
//
// 4 級初篩分級：
//   A. 無明顯失能線索
//   B. 有失能線索，但資料不足
//   C. 高度可能需要申請失能診斷
//   D. 已具失能申請基礎
//
// 重要：關節角度喪失 ≠ 失能！必須提醒補件。
// =====================================================================

import type {
  MedicalRecord,
  DisabilityScreeningResult,
  DisabilityLevel,
  JointName,
  DisabilityScreening,
} from './types'
import { jointLabelZh, resolveNormalRom, levelFromRomLoss } from './joint-rom'
import { pickDisabilityTable, lookupDisabilityAmount } from './disability-tables'
import {
  lookupUpperLimbLevel,
  lookupLowerLimbLevel,
  type JointDisorderSeverity,
  type LimbDisorderSummary,
} from './disability-joint-mapping'

// 失能給付初篩的觸發關鍵字（spec §六 Step 4）
const DISABILITY_TRIGGER_KEYWORDS = [
  '症狀固定',
  '永久',
  '不能恢復',
  '失能',
  '障害',
  '關節活動受限',
  '角度喪失',
  '截肢',
  '神經損傷',
  '器官缺損',
  '明顯疤痕',
  '肌力下降',
  '感覺喪失',
]

interface RuleEngineInput {
  medical: MedicalRecord
  accidentDate: string
}

interface RuleEngineOutput {
  romLossPercent: number | null
  jointName: JointName | null
  baseLevel: DisabilityLevel | null
  finalLevel: DisabilityLevel | null
  confidenceScore: number
  signals: string[]
  notes: string[]
  needsSupplement: string[]
  screening: DisabilityScreening
}

// --- 關鍵字掃描 ------------------------------------------------------

function scanKeywords(text: string): string[] {
  if (!text) return []
  const hits: string[] = []
  for (const kw of DISABILITY_TRIGGER_KEYWORDS) {
    if (text.includes(kw)) hits.push(kw)
  }
  return hits
}

// --- 等級加成規則 -----------------------------------------------------

interface LevelAdjustment {
  trigger: boolean
  levelOverride?: DisabilityLevel
  levelShift?: number // 負數 = 等級降低（更嚴重）；正數 = 減輕
  confidenceBoost: number
  note: string
}

function computeAdjustments(medical: MedicalRecord): LevelAdjustment[] {
  return [
    {
      trigger: medical.hasAmputation,
      levelOverride: 1,
      confidenceBoost: 0.3,
      note: '已截肢，依強制險失能等級表直接列第 1 級（最重）',
    },
    {
      trigger: medical.hasOrganDamage,
      levelShift: -3,
      confidenceBoost: 0.2,
      note: '器官缺損 → 等級加重 3 級',
    },
    {
      trigger: medical.hasNerveDamage,
      levelShift: -2,
      confidenceBoost: 0.15,
      note: '神經損傷 → 等級加重 2 級',
    },
    {
      trigger: medical.hasMuscleWeakness,
      levelShift: -1,
      confidenceBoost: 0.1,
      note: '肌力下降 → 等級加重 1 級',
    },
    {
      trigger: medical.hasSensoryLoss,
      levelShift: -1,
      confidenceBoost: 0.1,
      note: '感覺喪失 → 等級加重 1 級',
    },
    {
      trigger: medical.hasPermanentImpairment,
      confidenceBoost: 0.1,
      note: '醫師記載永久障害，提升 confidence',
    },
  ]
}

function applyAdjustments(
  baseLevel: DisabilityLevel,
  adjustments: LevelAdjustment[],
): { level: DisabilityLevel; confidenceBoost: number; notes: string[] } {
  let level = baseLevel
  let totalBoost = 0
  const notes: string[] = []
  let overridden = false

  for (const adj of adjustments) {
    if (!adj.trigger) continue
    totalBoost += adj.confidenceBoost
    notes.push(adj.note)
    if (adj.levelOverride !== undefined && !overridden) {
      level = adj.levelOverride
      overridden = true
    }
    if (adj.levelShift !== undefined) {
      // 等級降低（數字變小 = 更嚴重）；override 與 shift 皆可累加
      const shifted = (level + adj.levelShift) as DisabilityLevel
      if (shifted >= 1 && shifted <= 15) {
        level = shifted
      } else if (shifted < 1) {
        level = 1 // clamp 1（最重）
      } else {
        level = 15 // clamp 15（最輕）
      }
    }
  }

  return { level, confidenceBoost: totalBoost, notes }
}

// --- 規則引擎主函式 ---------------------------------------------------

export function runDisabilityRuleEngine(input: RuleEngineInput): RuleEngineOutput {
  const { medical, accidentDate } = input
  const signals: string[] = []
  const notes: string[] = []
  const needsSupplement: string[] = []

  // 1) 關鍵字掃描
  const textHits = scanKeywords(medical.diagnosisText)
  signals.push(...textHits)

  // 2) 傷勢標記
  if (medical.hasFracture) signals.push('骨折')
  if (medical.hasDislocation) signals.push('脫臼')
  if (medical.hasLigamentInjury) signals.push('韌帶損傷')
  if (medical.hasNerveDamage) signals.push('神經損傷')
  if (medical.hasAmputation) signals.push('截肢')
  if (medical.hasOrganDamage) signals.push('器官缺損')
  if (medical.hasMuscleWeakness) signals.push('肌力下降')
  if (medical.hasSensoryLoss) signals.push('感覺喪失')
  if (medical.hasPermanentImpairment) signals.push('永久障害')
  if (medical.isSymptomFixed) signals.push('症狀固定')
  if (medical.hasDisabilityCertificate) signals.push('已持失能診斷書')
  if (medical.hasRangeOfMotionLimitation) signals.push('關節活動受限')

  // 3) ROM 比例計算（v0.6.6 真實附表版）
  let romLossPercent: number | null = null
  let jointName: JointName | null = null
  let baseLevel: DisabilityLevel | null = null
  let baseConfidence = 0
  let articleId: string | null = null // v0.6.6 新增：條號追蹤

  if (medical.jointName && medical.hasRangeOfMotionLimitation && medical.romLossDegree > 0) {
    jointName = medical.jointName
    const normalRom = resolveNormalRom(jointName, medical.romNormalDegree)
    romLossPercent = (medical.romLossDegree / normalRom) * 100
    const result = levelFromRomLoss(romLossPercent)
    baseLevel = result.level
    baseConfidence = result.confidence
    const severity: JointDisorderSeverity = result.severity

    notes.push(
      `${jointLabelZh[jointName]}喪失 ${medical.romLossDegree} 度 / 正常 ${normalRom} 度 = ${romLossPercent.toFixed(1)}% 活動度喪失`,
    )

    // v0.6.6 新增：用真實附表對照三大關節組合
    // 上肢三大關節：肩 + 肘 + 腕（finger 不算）
    // 下肢三大關節：髖 + 膝 + 踝（toe 不算）
    // 中軸：cervical/lumbar 屬軀幹障害，不適用本對照
    const UPPER_LIMB_JOINTS: JointName[] = ['shoulder', 'elbow', 'wrist']
    const LOWER_LIMB_JOINTS: JointName[] = ['hip', 'knee', 'ankle']

    if (UPPER_LIMB_JOINTS.includes(jointName)) {
      // 簡化：只記錄單一關節障害，三大關節中 count='1'
      // （未來可擴充支援多關節輸入）
      const summary: LimbDisorderSummary = {
        count: '1', // 三大關節中有一大關節障害
        severity,
      }
      const otherLimb: LimbDisorderSummary = { count: '0', severity: 'none' }
      const matched = lookupUpperLimbLevel(summary, otherLimb)
      if (matched) {
        baseLevel = matched.level
        articleId = matched.articleId
        notes.push(
          `強制險附表 ${matched.articleId}：第 ${matched.level} 級（單一關節 ${severity}）`,
        )
      }
    } else if (LOWER_LIMB_JOINTS.includes(jointName)) {
      const summary: LimbDisorderSummary = {
        count: '1',
        severity,
      }
      const otherLimb: LimbDisorderSummary = { count: '0', severity: 'none' }
      const matched = lookupLowerLimbLevel(summary, otherLimb)
      if (matched) {
        baseLevel = matched.level
        // AGENTS §2.1：articleId 是條號追蹤佔位變數（v0.6.6 新增，暫時寫入未讀取）
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        articleId = matched.articleId
        notes.push(
          `強制險附表 ${matched.articleId}：第 ${matched.level} 級（單一關節 ${severity}）`,
        )
      }
    } else {
      // 中軸或手指/腳趾：用舊的 levelFromRomLoss 結果
      notes.push(`ROM 規則引擎初判：第 ${result.level} 級（中軸/手指/腳趾不適用三大關節對照）`)
    }

    if (baseLevel === null) {
      notes.push(
        `ROM 規則引擎初判：第 ${result.level} 級（confidence ${(result.confidence * 100).toFixed(0)}%）`,
      )
    }

    // ROM 缺資料提醒
    if (romLossPercent < 5) {
      notes.push('角度喪失比例 < 5%，客觀上不構成明顯失能')
      needsSupplement.push('若仍有不適，建議保留復健科完整量測記錄')
    }
  }

  // 4) 套用加成（截肢/神經/肌力/感覺/器官）
  let finalLevel: DisabilityLevel | null = baseLevel
  let finalConfidence = baseConfidence
  const adjNotes: string[] = []

  const adjustments = computeAdjustments(medical)
  if (baseLevel !== null) {
    const result = applyAdjustments(baseLevel, adjustments)
    finalLevel = result.level
    finalConfidence = Math.min(result.confidenceBoost + baseConfidence, 1.0)
    adjNotes.push(...result.notes)
  } else {
    // 沒有 ROM 線索，純看其他標記
    const triggered = adjustments.filter((a) => a.trigger)
    if (triggered.length > 0) {
      // 取最嚴重者
      const firstOverride = triggered.find((a) => a.levelOverride !== undefined)
      if (firstOverride) {
        finalLevel = firstOverride.levelOverride!
      } else {
        const totalShift = triggered.reduce((sum, a) => sum + (a.levelShift ?? 0), 0)
        const inferred = Math.max(1, 10 + totalShift) as DisabilityLevel
        finalLevel = inferred
      }
      finalConfidence = Math.min(
        triggered.reduce((sum, a) => sum + a.confidenceBoost, 0),
        0.6, // 沒 ROM 資料 confidence 上限 0.6
      )
      adjNotes.push(...triggered.map((a) => a.note))
    }
  }

  notes.push(...adjNotes)

  // 5) 4 級初篩判定
  let screening: DisabilityScreening = 'A'
  if (signals.length === 0 && !medical.hasAmputation && !medical.hasPermanentImpairment) {
    screening = 'A' // 無明顯失能線索
  } else if (
    medical.hasAmputation ||
    medical.hasPermanentImpairment ||
    (medical.isSymptomFixed &&
      medical.hasRangeOfMotionLimitation &&
      romLossPercent !== null &&
      romLossPercent >= 30) ||
    (medical.hasDisabilityCertificate && finalLevel !== null)
  ) {
    screening = 'D' // 已具失能申請基礎
  } else if (
    medical.isSymptomFixed ||
    medical.hasRangeOfMotionLimitation ||
    medical.hasNerveDamage ||
    medical.hasAmputation ||
    romLossPercent !== null
  ) {
    screening = 'C' // 高度可能
  } else {
    screening = 'B' // 有線索但資料不足
  }

  // 6) 補件建議
  if (medical.hasRangeOfMotionLimitation) {
    if (!medical.isSymptomFixed)
      needsSupplement.push('補「症狀固定」證明（需 6 個月以上治療後由醫師評估）')
    if (!medical.hasDisabilityCertificate)
      needsSupplement.push('補合格失能診斷書（由指定醫療機構開立）')
    if (romLossPercent !== null && romLossPercent >= 5) {
      needsSupplement.push(
        `補 ${jointLabelZh[medical.jointName!]} 關節活動度完整量測（被動 ROM、健側對比）`,
      )
    }
  }
  if (medical.hasNerveDamage && !medical.hasDisabilityCertificate) {
    needsSupplement.push('補神經傳導或肌電圖（NCV/EMG）檢查報告')
  }
  if (textHits.length > 0 && !medical.hasDisabilityCertificate) {
    needsSupplement.push('依診斷書關鍵字建議向骨科/復健科申請失能鑑定')
  }
  if (medical.hasPermanentImpairment && !medical.hasClassADiagnosisCertificate) {
    needsSupplement.push('建議申請甲種診斷證明書（記載較完整）')
  }

  // 重要提醒：ROM 喪失 ≠ 失能
  if (romLossPercent !== null && screening !== 'D') {
    notes.push('⚠️ 關節角度喪失是失能初篩線索，但「角度喪失」≠「失能」')
    notes.push('需確認：① 哪個關節 ② 正常活動範圍 ③ 喪失比例 ④ 是否症狀固定 ⑤ 是否有合格失能診斷書')
  }

  // 靜音未使用變數 warning 抑制
  void accidentDate // 用於金額表選擇，由 caller 處理

  return {
    romLossPercent,
    jointName,
    baseLevel,
    finalLevel,
    confidenceScore: finalConfidence,
    signals,
    notes,
    needsSupplement,
    screening,
  }
}

// --- 對外介面：把規則引擎結果 + 金額表組合成最終輸出 -----------------

export function computeDisability(
  medical: MedicalRecord,
  accidentDate: string,
): DisabilityScreeningResult {
  const engine = runDisabilityRuleEngine({ medical, accidentDate })
  const table = pickDisabilityTable(accidentDate)
  const amount = engine.finalLevel ? lookupDisabilityAmount(engine.finalLevel, table) : 0

  return {
    screening: engine.screening,
    signals: engine.signals,
    possibleLevel: engine.finalLevel,
    possibleAmount: amount,
    confidenceScore: engine.confidenceScore,
    romLossPercent: engine.romLossPercent,
    jointName: engine.jointName,
    notes: engine.notes,
    needsSupplement: engine.needsSupplement,
  }
}
