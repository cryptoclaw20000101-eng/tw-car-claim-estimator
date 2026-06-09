// =====================================================================
// 除疤 / 修疤費用估算
// 依據：
//   - 臺中市美容醫學醫療機構收費標準表（111.03.30 臺中市政府醫事審議委員會審議通過）
//     修疤手術每公分 3,000~10,000 元（唯一明示「修疤」之收費）
//   - 雷射（紅寶石/染料/CO2/Er:YAG/飛梭）依發數 × 每發單價
//   - 拉皮（傳統式/內視鏡，依部位）
//   - 蟹足腫注射、血小板生長因子（PRP）等治療（依中地院 110 簡 202 判例全額准許 80 萬）
//
// 法源：民法 §213 III（回復原狀費用）、§193 I（醫療費用）
//
// 設計：
//   - 術式 4 種（修疤手術 / 雷射 / 拉皮 / 注射治療）對應「疤痕治療的不同選擇」
//   - 地區係數：北中南差異（北部最貴、南部最便宜）
//   - 疤痕長度（公分）為主要計價變數；無公分則以部位/面積近似
// =====================================================================

import type { MedicalRecord } from './types'
import { getRegionAdjustment } from './region-adjustments'

/** 術式 */
export type ScarProcedure =
  | 'revision_surgery'   // 修疤手術（外科切除 + Z 形整形 / W 形整形）
  | 'laser'              // 雷射除疤（紅寶石/染料/CO2/Er:YAG/飛梭）
  | 'facelift'           // 拉皮（用於大面積疤痕或合併臉部鬆弛）
  | 'injection'          // 蟹足腫注射 / PRP 血小板生長因子

/** 地區差異（北中南加成）— 依臺中市收費表為基線（1.0） */
export const REGIONAL_SCAR_MULTIPLIER: Record<string, number> = {
  // 北
  臺北: 1.20, 新北: 1.15, 基隆: 1.10, 桃園: 1.10, 新竹: 1.10,
  // 中（基線）
  苗栗: 0.95, 臺中: 1.00, 彰化: 0.95, 南投: 0.95,
  // 南
  雲林: 0.90, 嘉義: 0.90, 臺南: 0.95, 高雄: 0.95, 屏東: 0.90,
  // 東
  宜蘭: 0.95, 花蓮: 0.90, 臺東: 0.90,
}

/** 術式單價表（臺中市基線；單位：新臺幣） */
export const SCAR_PROCEDURE_BASE = {
  revision_surgery: {
    /** 修疤手術每公分 */
    perCm: { min: 3_000, mid: 6_000, max: 10_000 },
    /** 預估療程次數 */
    sessions: 1,
    note: '修疤手術：外科切除後 Z/W 形整形，每公分單價',
  },
  laser: {
    /** 雷射基本費 */
    base: { min: 1_000, mid: 1_500, max: 2_000 },
    /** 每平方公分 */
    perCm2: { min: 1_000, mid: 1_500, max: 2_000 },
    /** 預估療程次數（紅寶石/染料雷射平均 3-5 次） */
    sessions: 4,
    note: '雷射除疤：紅寶石/染料雷射，基本費 + 每 cm² 單價 × 療程次數',
  },
  facelift: {
    /** 傳統式全臉 */
    fullFace: { min: 200_000, mid: 250_000, max: 300_000 },
    /** 腹部 */
    abdomen: { min: 180_000, mid: 210_000, max: 240_000 },
    /** 內視鏡全臉（較貴） */
    endoscopic: { min: 300_000, mid: 350_000, max: 400_000 },
    note: '拉皮：傳統式 / 內視鏡，依部位計價',
  },
  injection: {
    /** 蟹足腫注射：每針 */
    perInjection: { min: 1_000, mid: 2_000, max: 3_000 },
    /** PRP 血小板生長因子：每次 */
    perSession: { min: 15_000, mid: 25_000, max: 40_000 },
    /** 中地院 110 簡 202 案例：80 萬 */
    caseReference: 800_000,
    note: '注射治療：蟹足腫注射 + PRP，依療程次數計價',
  },
} as const

/** 治療部位（用於 facelift 與雷射） */
export type ScarLocation =
  | 'face'      // 臉部（全臉 / 雙頰）
  | 'abdomen'   // 腹部
  | 'limb'      // 四肢（手臂 / 腿部）
  | 'neck'      // 頸部
  | 'multiple'  // 多處

export interface ScarRevisionInput {
  medical: Pick<MedicalRecord,
    | 'scarLengthCm'
    | 'scarAreaCm2'
    | 'scarLocation'
    | 'scarSeverity'        // 'mild' | 'moderate' | 'severe' | 'keloid'
  >
  courtName: string
  /** 採用的術式 */
  procedure: ScarProcedure
  /** 醫囑建議的療程次數（覆寫預設） */
  prescribedSessions?: number
  /** 是否為「肥厚性疤痕 / 蟹足腫」→ 強制走注射治療 */
  isKeloid?: boolean
}

export interface ScarRevisionResult {
  /** 估算總額（mid） */
  amount: number
  /** 低/中/高三階估算 */
  range: { low: number; mid: number; high: number }
  /** 採用術式 */
  procedure: ScarProcedure
  /** 地區係數 */
  regionalMultiplier: number
  /** 計算明細 */
  breakdown: {
    perUnitCost: number
    units: number
    sessions: number
    baseFee: number
  }
  /** 法源/判例引註 */
  precedents: string[]
  /** 計算說明 */
  notes: string[]
  /** 升級提示 */
  hint: string | null
}

/** 從 courtName 推地區 */
function inferRegionMultiplier(courtName: string): number {
  for (const [key, mult] of Object.entries(REGIONAL_SCAR_MULTIPLIER)) {
    if (courtName.includes(key)) return mult
  }
  return 1.00  // 預設 = 臺中市基線
}

export function computeScarRevisionCost(input: ScarRevisionInput): ScarRevisionResult {
  const { medical, courtName, procedure, prescribedSessions, isKeloid = false } = input
  const region = getRegionAdjustment(courtName)
  const regionalMultiplier = inferRegionMultiplier(courtName)
  const precedents: string[] = []
  const notes: string[] = []

  // 必要輸入檢查
  const scarLength = medical.scarLengthCm ?? 0
  const scarArea = Math.max(medical.scarAreaCm2 ?? 0, 0)
  const severity: 'mild' | 'moderate' | 'severe' | 'keloid' = medical.scarSeverity ?? 'moderate'

  if (scarLength === 0 && scarArea === 0) {
    return {
      amount: 0,
      range: { low: 0, mid: 0, high: 0 },
      procedure,
      regionalMultiplier,
      breakdown: { perUnitCost: 0, units: 0, sessions: 0, baseFee: 0 },
      precedents: [],
      notes: ['未輸入疤痕長度（公分）或面積（平方公分），無法估算除疤費用'],
      hint: '請於表單輸入「疤痕長度」或「疤痕面積」',
    }
  }

  // 蟹足腫 → 強制走注射治療
  const effectiveProcedure: ScarProcedure =
    (isKeloid || severity === 'keloid') ? 'injection' : procedure

  let low = 0, mid = 0, high = 0
  let perUnitCost = 0
  let units = 0
  let sessions = prescribedSessions || 0
  let baseFee = 0

  switch (effectiveProcedure) {
    case 'revision_surgery': {
      const cfg = SCAR_PROCEDURE_BASE.revision_surgery
      sessions = sessions || cfg.sessions
      units = scarLength
      low = cfg.perCm.min * units * sessions
      mid = cfg.perCm.mid * units * sessions
      high = cfg.perCm.max * units * sessions
      perUnitCost = cfg.perCm.mid
      baseFee = 0
      precedents.push('臺中市美容醫學醫療機構收費標準表 111.03.30（修疤手術每公分 3,000~10,000 元）')
      notes.push(`疤痕 ${scarLength} 公分 × 修疤手術每公分 ${perUnitCost.toLocaleString()} 元 × ${sessions} 次`)
      break
    }
    case 'laser': {
      const cfg = SCAR_PROCEDURE_BASE.laser
      sessions = sessions || cfg.sessions
      // 雷射：以面積計，無面積則用長度 × 寬度 1cm 近似
      const area = scarArea > 0 ? scarArea : scarLength * 1
      low = (cfg.base.min + cfg.perCm2.min * area) * sessions
      mid = (cfg.base.mid + cfg.perCm2.mid * area) * sessions
      high = (cfg.base.max + cfg.perCm2.max * area) * sessions
      perUnitCost = cfg.perCm2.mid
      units = area
      baseFee = cfg.base.mid
      precedents.push('臺中市美容醫學醫療機構收費標準表 111.03.30（紅寶石/染料/CO2/Er:YAG 雷射基本費 + 每 cm²）')
      precedents.push('飛梭雷射全臉 10,000~30,000 元 / 雙頰 5,000~15,000 元（同表）')
      notes.push(`疤痕面積 ${area} cm² × 雷射基本費 ${cfg.base.mid} + 每 cm² ${cfg.perCm2.mid} 元 × ${sessions} 次療程`)
      break
    }
    case 'facelift': {
      const cfg = SCAR_PROCEDURE_BASE.facelift
      sessions = sessions || 1
      // 拉皮：依部位
      const loc: ScarLocation = (medical.scarLocation as ScarLocation) || 'multiple'
      let cfgPart: { readonly min: number; readonly mid: number; readonly max: number } = cfg.fullFace
      let partName = '全臉（傳統式）'
      if (loc === 'abdomen') {
        cfgPart = cfg.abdomen
        partName = '腹部'
      } else if (severity === 'severe' || scarLength > 20) {
        cfgPart = cfg.endoscopic
        partName = '全臉（內視鏡）'
      }
      low = cfgPart.min * sessions
      mid = cfgPart.mid * sessions
      high = cfgPart.max * sessions
      perUnitCost = cfgPart.mid
      units = 1
      baseFee = 0
      precedents.push('臺中市美容醫學醫療機構收費標準表 111.03.30（傳統式全臉 200,000~300,000 / 內視鏡全臉 300,000~400,000 / 腹部 180,000~240,000）')
      notes.push(`拉皮手術：${partName}，單價 ${perUnitCost.toLocaleString()} 元`)
      break
    }
    case 'injection': {
      const cfg = SCAR_PROCEDURE_BASE.injection
      // 蟹足腫 / PRP 治療：依嚴重度
      sessions = sessions || (severity === 'keloid' ? 6 : severity === 'severe' ? 4 : 2)
      // 簡化：肥厚性疤痕用蟹足腫注射；嚴重疤痕用 PRP
      if (severity === 'keloid') {
        // 蟹足腫：每 2-4 週一次，估 6 次
        perUnitCost = cfg.perInjection.mid
        units = scarLength * 2  // 每公分約 2 針
        low = cfg.perInjection.min * units * sessions
        mid = cfg.perInjection.mid * units * sessions
        high = cfg.perInjection.max * units * sessions
        notes.push(`蟹足腫注射：每公分約 2 針 × ${scarLength} 公分 × ${sessions} 次療程`)
      } else {
        // PRP / 血小板生長因子
        perUnitCost = cfg.perSession.mid
        units = 1
        low = cfg.perSession.min * sessions
        mid = cfg.perSession.mid * sessions
        high = cfg.perSession.max * sessions
        notes.push(`PRP 血小板生長因子：每次 ${perUnitCost.toLocaleString()} 元 × ${sessions} 次療程`)
      }
      baseFee = 0
      precedents.push('中地院 110 簡 202 判決：蟹足腫注射 + 血小板生長因子 + 雷射除疤 80 萬元全額准許')
      precedents.push('臺中市美容醫學醫療機構收費標準表 111.03.30（無注射單價，引用美容整外診所市場行情）')
      if (scarLength > 20) {
        notes.push(`⚠️ 疤痕長度 ${scarLength} 公分（中地院 110 簡 202 為多處肥厚性疤痕 80 萬），建議參照該判例請求`)
      }
      break
    }
  }

  // 套用地區係數
  const lowFinal = Math.round(low * regionalMultiplier)
  const midFinal = Math.round(mid * regionalMultiplier)
  const highFinal = Math.round(high * regionalMultiplier)

  // 地區提示
  if (regionalMultiplier !== 1.0) {
    notes.push(`地區係數 ${regionalMultiplier}（${courtName.match(/(臺北|新北|桃園|臺中|彰化|高雄|臺南)/)?.[0] || '基線'}）`)
  }

  // 證據強度提示
  if (region.workLossEvidenceStrictness === 'high') {
    notes.push(`${region.courtName} 對醫美單據、診斷證明書嚴格審查，建議齊備：醫美診所收據、醫囑建議、術前術後照片`)
  }

  return {
    amount: midFinal,
    range: { low: lowFinal, mid: midFinal, high: highFinal },
    procedure: effectiveProcedure,
    regionalMultiplier,
    breakdown: {
      perUnitCost,
      units: Math.round(units * 100) / 100,
      sessions,
      baseFee,
    },
    precedents,
    notes,
    hint: severity === 'keloid'
      ? '蟹足腫建議走「注射治療 + 雷射」複合療程，單次雷射效果有限'
      : null,
  }
}
