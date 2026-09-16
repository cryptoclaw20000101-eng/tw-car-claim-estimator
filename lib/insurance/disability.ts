// =====================================================================
// 強制險失能初篩規則引擎
//
// legal-audit 原則：
// 1. ROM 可用來初篩「可能對應」的關節障害條目。
// 2. 截肢、神經損傷、器官缺損、肌力／感覺喪失都是重要線索，
//    但不能用「直接第 1 級」或「自動升 X 級」的方式推定法定失能等級。
// 3. 非 ROM 類失能若沒有明確失能診斷／等級，只回補件與風險提示，不硬算金額。
// 4. 使用者已持失能診斷書且輸入 1-15 級時，優先採該明確等級。
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

function scanKeywords(text: string): string[] {
  if (!text) return []
  return DISABILITY_TRIGGER_KEYWORDS.filter((kw) => text.includes(kw))
}

function asDisabilityLevel(value: unknown): DisabilityLevel | null {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= 15 ? (n as DisabilityLevel) : null
}

function pushUnique(target: string[], value: string) {
  if (!target.includes(value)) target.push(value)
}

export function runDisabilityRuleEngine(input: RuleEngineInput): RuleEngineOutput {
  const { medical } = input
  const signals: string[] = [...scanKeywords(medical.diagnosisText)]
  const notes: string[] = []
  const needsSupplement: string[] = []

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

  let romLossPercent: number | null = null
  let jointName: JointName | null = null
  let baseLevel: DisabilityLevel | null = null
  let baseConfidence = 0

  if (medical.jointName && medical.hasRangeOfMotionLimitation && medical.romLossDegree > 0) {
    jointName = medical.jointName
    const normalRom = resolveNormalRom(jointName, medical.romNormalDegree)
    romLossPercent = normalRom > 0 ? (medical.romLossDegree / normalRom) * 100 : null

    if (romLossPercent !== null) {
      const rom = levelFromRomLoss(romLossPercent)
      baseConfidence = rom.confidence
      const severity: JointDisorderSeverity = rom.severity

      notes.push(
        `${jointLabelZh[jointName]}喪失 ${medical.romLossDegree} 度 / 正常 ${normalRom} 度 = ${romLossPercent.toFixed(1)}% 活動度喪失`,
      )

      const upper: JointName[] = ['shoulder', 'elbow', 'wrist']
      const lower: JointName[] = ['hip', 'knee', 'ankle']

      if (upper.includes(jointName)) {
        const current: LimbDisorderSummary = { count: '1', severity }
        const other: LimbDisorderSummary = { count: '0', severity: 'none' }
        const matched = lookupUpperLimbLevel(current, other)
        if (matched && severity !== 'none') {
          baseLevel = matched.level
          notes.push(`強制險附表 ${matched.articleId}：可能對應第 ${matched.level} 級（單一關節 ${severity}）`)
        }
      } else if (lower.includes(jointName)) {
        const current: LimbDisorderSummary = { count: '1', severity }
        const other: LimbDisorderSummary = { count: '0', severity: 'none' }
        const matched = lookupLowerLimbLevel(current, other)
        if (matched && severity !== 'none') {
          baseLevel = matched.level
          notes.push(`強制險附表 ${matched.articleId}：可能對應第 ${matched.level} 級（單一關節 ${severity}）`)
        }
      } else {
        // 手指、腳趾、頸椎、腰椎不能拿三大關節規則硬套法定等級。
        notes.push('此部位不適用上／下肢三大關節對照；需依失能給付標準表的具體條目判定。')
        baseLevel = null
        baseConfidence = Math.min(baseConfidence, 0.4)
      }

      if (romLossPercent < 5) {
        notes.push('角度喪失比例 < 5%，目前不作失能等級推定。')
        pushUnique(needsSupplement, '若仍有不適，建議保留復健科完整量測記錄')
        baseLevel = null
      }
    }
  }

  // 明確失能診斷書 + 明確 1-15 級，優先於初篩推定。
  const documentedLevel = medical.hasDisabilityCertificate
    ? asDisabilityLevel(medical.disabilityLevel)
    : null

  let finalLevel: DisabilityLevel | null = documentedLevel ?? baseLevel
  let finalConfidence = documentedLevel !== null ? 0.95 : baseConfidence

  if (documentedLevel !== null) {
    notes.push(`已輸入失能診斷等級：第 ${documentedLevel} 級；計算優先採用此明確資料。`)
  }

  // 非 ROM 類線索不得自行變更等級。
  const nonRomSignals = [
    medical.hasAmputation ? '截肢' : null,
    medical.hasOrganDamage ? '器官缺損' : null,
    medical.hasNerveDamage ? '神經損傷' : null,
    medical.hasMuscleWeakness ? '肌力下降' : null,
    medical.hasSensoryLoss ? '感覺喪失' : null,
  ].filter((x): x is string => Boolean(x))

  if (nonRomSignals.length > 0) {
    notes.push(
      `${nonRomSignals.join('、')}屬失能重要線索，但不得以固定「升級／降級」公式推定法定等級；需對照失能給付標準表具體條目。`,
    )
    if (documentedLevel === null && baseLevel === null) {
      finalLevel = null
      finalConfidence = 0
    }
    pushUnique(needsSupplement, '補失能診斷書及對應失能給付標準表條目／項次')
  }

  let screening: DisabilityScreening = 'A'
  if (signals.length === 0) {
    screening = 'A'
  } else if (medical.hasDisabilityCertificate && documentedLevel !== null) {
    screening = 'D'
  } else if (
    medical.hasAmputation ||
    medical.hasPermanentImpairment ||
    medical.hasOrganDamage ||
    medical.hasNerveDamage ||
    medical.isSymptomFixed ||
    (romLossPercent !== null && romLossPercent >= 33)
  ) {
    screening = 'C'
  } else {
    screening = 'B'
  }

  if (medical.hasRangeOfMotionLimitation) {
    if (!medical.isSymptomFixed) {
      pushUnique(needsSupplement, '補「症狀固定」或治療終止／穩定狀態之醫療證明')
    }
    if (!medical.hasDisabilityCertificate) {
      pushUnique(needsSupplement, '補合格失能診斷書')
    }
    if (romLossPercent !== null && romLossPercent >= 5 && medical.jointName) {
      pushUnique(
        needsSupplement,
        `補 ${jointLabelZh[medical.jointName]} 關節活動度完整量測（被動 ROM、健側對比）`,
      )
    }
  }

  if (medical.hasNerveDamage && !medical.hasDisabilityCertificate) {
    pushUnique(needsSupplement, '補神經傳導或肌電圖（NCV/EMG）檢查報告')
  }

  if (signals.length > 0 && !medical.hasDisabilityCertificate) {
    pushUnique(needsSupplement, '依診斷與功能障害資料向合格醫療機構評估失能')
  }

  if (romLossPercent !== null) {
    notes.push('關節活動度喪失僅屬失能初篩線索；最終仍須依事故日適用的失能給付標準表與醫療證據認定。')
  }

  return {
    romLossPercent,
    jointName,
    baseLevel,
    finalLevel,
    confidenceScore: finalConfidence,
    signals: [...new Set(signals)],
    notes,
    needsSupplement,
    screening,
  }
}

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
