// =====================================================================
// 失能初篩規則引擎（spec §七 + 完整規則引擎）
//
// 規則：
// 1. 關節角度喪失 → 失能等級（真實附表三分類，v0.6.6）
// 2. 截肢、神經損傷、肌力或感覺異常 → 初篩與補件提示，不自動指定等級
// 3. 症狀固定 + 合格失能診斷書 + 附表項目，才可列入給付試算
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
import {
  combineDisabilityBenefits,
  lookupDisabilityAmount,
  pickDisabilityTable,
} from './disability-tables'
import {
  lookupDisabilityLevelByDate,
  lookupUpperLimbLevel,
  lookupLowerLimbLevel,
  type JointDisorderSeverity,
  type LimbDisorderSummary,
} from './disability-joint-mapping'
import { getDisabilityStandardItem } from './disability-standard'

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

// --- 初篩訊號規則 -----------------------------------------------------

interface LevelAdjustment {
  trigger: boolean
  confidenceBoost: number
  note: string
}

function computeAdjustments(medical: MedicalRecord): LevelAdjustment[] {
  return [
    {
      trigger: medical.hasAmputation,
      confidenceBoost: 0.3,
      note: '已截肢，但截肢部位與程度須依附表缺損障害項目認定，不能一律列第 1 級',
    },
    {
      trigger: medical.hasOrganDamage,
      confidenceBoost: 0.2,
      note: '器官缺損需依附表臟器障害項目與專科診斷認定',
    },
    {
      trigger: medical.hasNerveDamage,
      confidenceBoost: 0.15,
      note: '神經損傷需依受影響部位、檢查與專科診斷依附表認定',
    },
    {
      trigger: medical.hasMuscleWeakness,
      confidenceBoost: 0.1,
      note: '肌力下降是初篩線索，須有客觀檢查與附表項目才可認定等級',
    },
    {
      trigger: medical.hasSensoryLoss,
      confidenceBoost: 0.1,
      note: '感覺喪失是初篩線索，須有客觀檢查與附表項目才可認定等級',
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
  const level = baseLevel
  let totalBoost = 0
  const notes: string[] = []

  for (const adj of adjustments) {
    if (!adj.trigger) continue
    totalBoost += adj.confidenceBoost
    notes.push(adj.note)
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

    if (UPPER_LIMB_JOINTS.includes(jointName) && accidentDate >= '2026-07-01') {
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
    } else if (LOWER_LIMB_JOINTS.includes(jointName) && accidentDate >= '2026-07-01') {
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
    } else if (UPPER_LIMB_JOINTS.includes(jointName) || LOWER_LIMB_JOINTS.includes(jointName)) {
      const limb = UPPER_LIMB_JOINTS.includes(jointName) ? 'upper' : 'lower'
      baseLevel = lookupDisabilityLevelByDate(limb, romLossPercent, accidentDate)
      notes.push(`事故日適用 2026-07-01 前失能表：第 ${baseLevel} 級（單一關節 ROM 初篩）`)
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

  // 4) 收集截肢、神經與感覺等初篩訊號。這些訊號不得自動推定附表等級。
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
    const triggered = adjustments.filter((a) => a.trigger)
    finalConfidence = Math.min(
      triggered.reduce((sum, a) => sum + a.confidenceBoost, 0),
      0.6,
    )
    adjNotes.push(...triggered.map((a) => a.note))
  }

  notes.push(...adjNotes)

  // 5) 4 級初篩判定
  let screening: DisabilityScreening = 'A'
  if (signals.length === 0 && !medical.hasAmputation && !medical.hasPermanentImpairment) {
    screening = 'A' // 無明顯失能線索
  } else if (
    (medical.isSymptomFixed && medical.hasDisabilityCertificate && medical.hasAmputation) ||
    (medical.isSymptomFixed &&
      medical.hasDisabilityCertificate &&
      medical.hasPermanentImpairment) ||
    (medical.isSymptomFixed &&
      medical.hasDisabilityCertificate &&
      medical.hasRangeOfMotionLimitation &&
      romLossPercent !== null &&
      romLossPercent >= 30) ||
    (medical.isSymptomFixed && medical.hasDisabilityCertificate && finalLevel !== null)
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
      needsSupplement.push('補依附表項次規定之醫院層級或醫師開立的失能診斷書')
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

  // 重要提醒：ROM 喪失 ≠ 失能
  if (romLossPercent !== null && screening !== 'D') {
    notes.push('⚠️ 關節角度喪失是失能初篩線索，但「角度喪失」≠「失能」')
    notes.push('需確認：① 哪個關節 ② 正常活動範圍 ③ 喪失比例 ④ 是否症狀固定 ⑤ 是否有合格失能診斷書')
  }

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
  const manualLevels = [
    medical.disabilityLevel,
    ...(medical.additionalDisabilityLevels ?? []),
  ].filter(
    (level): level is DisabilityLevel =>
      typeof level === 'number' && Number.isInteger(level) && level >= 1 && level <= 15,
  )
  const standardItems = (medical.disabilityTableItemIds ?? [])
    .map((id) => getDisabilityStandardItem(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  const listedLevels =
    standardItems.length > 0 ? standardItems.map((item) => item.level) : manualLevels
  const hasLevelMismatch =
    standardItems.length > 0 &&
    manualLevels.length > 0 &&
    [...manualLevels].sort((a, b) => a - b).join(',') !==
      [...listedLevels].sort((a, b) => a - b).join(',')
  const isPayable =
    medical.isSymptomFixed &&
    medical.hasDisabilityCertificate &&
    standardItems.length > 0 &&
    listedLevels.length > 0 &&
    !hasLevelMismatch
  const combined = isPayable ? combineDisabilityBenefits(listedLevels, table) : null
  const preExistingLevel = medical.preExistingDisabilityLevel
  const preExistingAmount =
    preExistingLevel &&
    Number.isInteger(preExistingLevel) &&
    preExistingLevel >= 1 &&
    preExistingLevel <= 15
      ? lookupDisabilityAmount(preExistingLevel as DisabilityLevel, table)
      : 0
  const amount = combined ? Math.max(0, combined.amount - preExistingAmount) : 0
  const notes = [...engine.notes]
  const needsSupplement = [...engine.needsSupplement]

  if (!isPayable && engine.finalLevel !== null) {
    notes.push('此等級僅為初篩線索，未滿足強制險失能給付前提，未列入失能給付金額。')
  }
  if (!medical.isSymptomFixed) needsSupplement.push('補醫師記載之症狀固定或永久障害診斷')
  if (!medical.hasDisabilityCertificate)
    needsSupplement.push('補符合附表項目、依項次規定開立的失能診斷書')
  if (listedLevels.length === 0) needsSupplement.push('補失能診斷書載明的附表等級（第 1 至 15 等）')
  if (standardItems.length === 0) {
    needsSupplement.push('補選診斷書載明的正式失能給付標準表項次（204 項）')
  }
  if (standardItems.length > 0) {
    notes.push(
      `已依現行失能給付標準表核對：${standardItems
        .map((item) => `${item.id}（第 ${item.level} 級）`)
        .join('、')}。`,
    )
    needsSupplement.push(...standardItems.map((item) => `${item.id}：${item.requirement}`))
  }
  if (hasLevelMismatch) {
    needsSupplement.push('診斷書填寫的失能等級與所選附表項次不一致，請依診斷書或附表條號更正')
  }
  if (combined && combined.appliedUpgrade > 0) {
    notes.push(
      `同一事故同時符合 ${listedLevels.length} 項失能，依第 4 條升 ${combined.appliedUpgrade} 等計算。`,
    )
  }
  if (preExistingAmount > 0) {
    notes.push('已依第 5 條扣除同一障害部位事故前既有失能給付標準。')
  }

  return {
    screening: engine.screening,
    signals: engine.signals,
    possibleLevel: engine.finalLevel,
    possibleAmount: amount,
    isPayable,
    recognizedLevel: combined?.level ?? null,
    confidenceScore: engine.confidenceScore,
    romLossPercent: engine.romLossPercent,
    jointName: engine.jointName,
    notes,
    needsSupplement: [...new Set(needsSupplement)],
  }
}
