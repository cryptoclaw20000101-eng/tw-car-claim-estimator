'use strict'
// =====================================================================
// 強制汽車責任保險 傷害醫療費用 細項計算
// 規範：強制汽車責任保險給付標準（2026-07-01 新制）
// 核心原則：無過失主義 → 不得乘肇事責任比例
// 總額上限：200,000 元
// =====================================================================
Object.defineProperty(exports, '__esModule', { value: true })
exports.COMPULSORY_LIMITS = void 0
exports.computeCompulsoryMedical = computeCompulsoryMedical
exports.calcMedicalMaterialOldLaw = calcMedicalMaterialOldLaw
exports.computeCompulsoryMedicalByDate = computeCompulsoryMedicalByDate
const regulation_cutoff_1 = require('../data-sources/regulation-cutoff')
// --- 法定上限常數（依強制汽車責任保險給付標準） -----------------------
exports.COMPULSORY_LIMITS = {
  TOTAL_MEDICAL_CAP: 200000, // 傷害醫療費用總額上限
  WARD_FEE_DAILY_CAP: 1500, // 病房費差額每日上限
  MEAL_FEE_DAILY_CAP: 180, // 膳食費每日上限
  PROSTHESIS_PER_LIMB: 50000, // 義肢器材每一上或下肢上限
  DENTURE_PER_TOOTH: 10000, // 義齒每缺一齒上限
  DENTURE_TOTAL_CAP: 50000, // 義齒五齒以上總上限
  ARTIFICIAL_EYE: 10000, // 義眼每顆上限
  MEDICAL_MATERIAL_ASSISTIVE: 20000, // 醫療材料/輔具/裝具總上限
  TRANSPORTATION: 20000, // 接送費用總上限
  NURSING_DAILY: 1200, // 看護費每日上限
  NURSING_DAYS_CAP: 30, // 看護費最高 30 日
}
// --- 細項計算 --------------------------------------------------------
// 每個 helper 回傳 (approved, cap, reason, hint)
function calcEmergency(input) {
  return mkItem(
    'emergencyFee',
    '急救費用',
    input.emergencyFee,
    input.emergencyFee,
    null,
    null,
    null,
  )
}
function calcAmbulance(input) {
  return mkItem(
    'ambulanceFee',
    '救護車費',
    input.ambulanceFee,
    input.ambulanceFee,
    null,
    null,
    null,
  )
}
function calcNhiCopayment(input) {
  // 健保自付額：依實際收據實支實付，無上限
  return mkItem(
    'nhiCopayment',
    '健保診療自負額',
    input.nhiCopayment,
    input.nhiCopayment,
    null,
    null,
    input.nhiCopayment === 0 ? '未輸入健保自付額，請補醫療收據' : null,
  )
}
function calcRegistration(input) {
  return mkItem(
    'registrationFee',
    '掛號費',
    input.registrationFee,
    input.registrationFee,
    null,
    null,
    null,
  )
}
function calcDiagnosisCertificate(input) {
  return mkItem(
    'diagnosisCertificateFee',
    '診斷證明書費',
    input.diagnosisCertificateFee,
    input.diagnosisCertificateFee,
    null,
    null,
    null,
  )
}
function calcNonNhi(input) {
  return mkItem(
    'nonNhiNecessaryMedicalFee',
    '非健保必要醫療費',
    input.nonNhiNecessaryMedicalFee,
    input.nonNhiNecessaryMedicalFee,
    null,
    null,
    input.nonNhiNecessaryMedicalFee === 0 ? '非健保自費項目需檢附醫師證明必要性' : null,
  )
}
function calcWardFee(input) {
  const cap = exports.COMPULSORY_LIMITS.WARD_FEE_DAILY_CAP * input.wardFeeDays
  const approved = Math.min(input.wardFeeDifference, cap)
  const reduction =
    approved < input.wardFeeDifference
      ? `病房費差額單日申請 ${formatTwd(input.wardFeeDifference / Math.max(input.wardFeeDays, 1))}，超出每日上限 1,500 元`
      : null
  const hint =
    input.wardFeeDays === 0 && input.wardFeeDifference > 0
      ? '需輸入實際住院日數，否則無法估算'
      : null
  return mkItem('wardFee', '病房費差額', input.wardFeeDifference, approved, cap, reduction, hint)
}
function calcMealFee(input) {
  const cap = exports.COMPULSORY_LIMITS.MEAL_FEE_DAILY_CAP * input.mealDays
  const approved = Math.min(input.mealFee, cap)
  const reduction =
    approved < input.mealFee
      ? `膳食費單日申請 ${formatTwd(input.mealFee / Math.max(input.mealDays, 1))}，超出每日上限 180 元`
      : null
  return mkItem('mealFee', '膳食費', input.mealFee, approved, cap, reduction, null)
}
function calcProsthesis(input) {
  // 義肢每一上或下肢 50,000，本欄位採單肢簡化
  const cap = exports.COMPULSORY_LIMITS.PROSTHESIS_PER_LIMB
  const approved = Math.min(input.prosthesisFee, cap)
  const reduction = approved < input.prosthesisFee ? '義肢費超出單肢 50,000 上限' : null
  // hasSurgery 提示需由外層串接 medical.hasSurgery，本函式不重複
  return mkItem('prosthesisFee', '義肢器材費', input.prosthesisFee, approved, cap, reduction, null)
}
function calcDenture(input) {
  const byTeeth = input.missingTeethCount * exports.COMPULSORY_LIMITS.DENTURE_PER_TOOTH
  const cap = Math.min(byTeeth, exports.COMPULSORY_LIMITS.DENTURE_TOTAL_CAP)
  const approved = Math.min(input.dentureFee, cap)
  const reduction =
    approved < input.dentureFee
      ? `義齒費超出 ${input.missingTeethCount} 齒上限（每齒 10,000，最多 50,000）`
      : null
  const hint = input.dentureFee > 0 && input.missingTeethCount === 0 ? '需補缺牙數量資料' : null
  return mkItem('dentureFee', '義齒費', input.dentureFee, approved, cap, reduction, hint)
}
function calcArtificialEye(input) {
  const cap = exports.COMPULSORY_LIMITS.ARTIFICIAL_EYE
  const approved = Math.min(input.artificialEyeFee, cap)
  const reduction = approved < input.artificialEyeFee ? '義眼費超出每顆 10,000 上限' : null
  return mkItem(
    'artificialEyeFee',
    '義眼費',
    input.artificialEyeFee,
    approved,
    cap,
    reduction,
    null,
  )
}
function calcMedicalMaterial(input) {
  var _a
  // v0.2.5+：法規修訂 — 強制汽車責任保險給付標準 §2 第 3 項第 6 款 (2026-07-01 新制)
  // 「其他非全民健康保險法所規定給付範圍之醫療材料（含輔助器材費用）及非具積極治療性之裝具：以 2 萬為限」
  //
  // 拆 2 子項（特殊材料 / 輔具），共用 2 萬上限：
  //   - 特殊材料 = 骨材/鋼板/人工關節/特材（非健保給付）
  //   - 輔具 = 拐杖/輪椅/支架（非具積極治療性裝具）
  //
  // 「一般醫材」（紗布/縫線/注射耗材）= 健保已給付，歸入「健保自付額」/「非健保必要醫療」，無 2 萬上限
  const special = (_a = input.specialMaterialFee) !== null && _a !== void 0 ? _a : 0
  const assistive = input.assistiveDeviceFee
  const subtotal = special + assistive
  const cap = exports.COMPULSORY_LIMITS.MEDICAL_MATERIAL_ASSISTIVE
  const approvedTotal = Math.min(subtotal, cap)
  // 按申請比例分攤（pro-rata）
  const ratio = subtotal > 0 ? approvedTotal / subtotal : 0
  let approvedSpecial = Math.round(special * ratio)
  let approvedAssistive = Math.round(assistive * ratio)
  // rounding diff 補回最大項
  const diff = approvedTotal - (approvedSpecial + approvedAssistive)
  if (diff !== 0) {
    if (special >= assistive) approvedSpecial += diff
    else approvedAssistive += diff
  }
  const reduction =
    approvedTotal < subtotal
      ? `特殊材料＋輔具合計 ${subtotal.toLocaleString()} 元超出 2 萬上限，採申請比例分攤`
      : null
  const hint =
    special > 0 && special > 15000
      ? '特殊材料費（骨材/鋼板等）單筆較高，建議檢附特材許可證明與醫師必要性說明'
      : null
  return {
    key: 'medicalMaterial',
    label: '特殊材料／輔具（非健保）',
    applied: subtotal,
    approved: approvedTotal,
    legalCap: cap,
    reductionReason: reduction,
    supplementHint: hint,
    subItems: [
      {
        key: 'specialMaterial',
        label: '特殊材料費',
        applied: special,
        approved: approvedSpecial,
        note: '骨材、鋼板、人工關節等（非健保特材）',
      },
      {
        key: 'assistiveDevice',
        label: '輔具費',
        applied: assistive,
        approved: approvedAssistive,
        note: '拐杖、輪椅、支架等（非積極治療性裝具）',
      },
    ],
  }
}
function calcTransportation(input) {
  const cap = exports.COMPULSORY_LIMITS.TRANSPORTATION
  const approved = Math.min(input.transportationFee, cap)
  const reduction = approved < input.transportationFee ? '接送費超出 20,000 上限' : null
  return mkItem(
    'transportationFee',
    '接送費用',
    input.transportationFee,
    approved,
    cap,
    reduction,
    null,
  )
}
function calcNursing(input) {
  const eligibleDays = Math.min(input.nursingDays, exports.COMPULSORY_LIMITS.NURSING_DAYS_CAP)
  const cap = exports.COMPULSORY_LIMITS.NURSING_DAILY * eligibleDays
  const approved = Math.min(input.nursingFee, cap)
  const reduction =
    approved < input.nursingFee ? `看護費超出 1,200 × ${eligibleDays} 日上限（最高 30 日）` : null
  // requiresNursingCare 提示需由外層串接 medical.requiresNursingCare
  return mkItem('nursingFee', '看護費用', input.nursingFee, approved, cap, reduction, null)
}
function calcOther(input) {
  return mkItem(
    'otherNecessaryMedicalFee',
    '其他必要醫療費',
    input.otherNecessaryMedicalFee,
    input.otherNecessaryMedicalFee,
    null,
    null,
    input.otherNecessaryMedicalFee > 0 ? '需檢附醫師必要性證明與收據' : null,
  )
}
// --- 主計算 ----------------------------------------------------------
function computeCompulsoryMedical(input) {
  const items = [
    calcEmergency(input),
    calcAmbulance(input),
    calcNhiCopayment(input),
    calcRegistration(input),
    calcDiagnosisCertificate(input),
    calcNonNhi(input),
    calcWardFee(input),
    calcMealFee(input),
    calcProsthesis(input),
    calcDenture(input),
    calcArtificialEye(input),
    calcMedicalMaterial(input),
    calcTransportation(input),
    calcNursing(input),
    calcOther(input),
  ]
  const subtotal = items.reduce((sum, it) => sum + it.approved, 0)
  const approved = Math.min(subtotal, exports.COMPULSORY_LIMITS.TOTAL_MEDICAL_CAP)
  return {
    items,
    subtotal,
    approved,
  }
}
// --- 工具 ------------------------------------------------------------
function mkItem(key, label, applied, approved, cap, reduction, hint) {
  return {
    key,
    label,
    applied,
    approved,
    legalCap: cap,
    reductionReason: reduction,
    supplementHint: hint,
  }
}
function formatTwd(n) {
  return n.toLocaleString('zh-TW', { maximumFractionDigits: 0 })
}
// =====================================================================
// v0.8.2 法規版本切換（新法 / 舊法）
// 強制汽車責任保險給付標準 §2 第 3 項第 6 款 修法日期：2026-07-01
//
// 新法（事故日 >= 2026-07-01）：特殊材料費 + 輔具費 各自 pro-rata 套 2 萬上限（拆 subItems）
// 舊法（事故日 < 2026-07-01）：醫材費 + 特殊材料費 + 輔具費 合併 1 個 2 萬上限（不拆）
// =====================================================================
/**
 * 舊法版 calcMedicalMaterial（事故日 < 2026-07-01）
 * 法源：強制汽車責任保險給付標準 §2.3.6 修法前
 * 「醫療材料及輔具費 合計 2 萬上限」（不分特殊材料 / 一般醫材 / 輔具）
 *
 * @param input 含 specialMaterialFee / medicalMaterialFee / assistiveDeviceFee 及其自付額
 * @returns CompulsoryItemResult（含 subItems 反映舊法合併邏輯）
 */
function calcMedicalMaterialOldLaw(input) {
  var _a, _b, _c
  const special = (_a = input.specialMaterialFee) !== null && _a !== void 0 ? _a : 0
  const generalMaterial = (_b = input.medicalMaterialFee) !== null && _b !== void 0 ? _b : 0
  const assistive = (_c = input.assistiveDeviceFee) !== null && _c !== void 0 ? _c : 0
  const subtotal = special + generalMaterial + assistive
  if (subtotal === 0) {
    return {
      key: 'medicalMaterial',
      label: '醫療材料／輔具費（舊法合併）',
      applied: 0,
      approved: 0,
      legalCap: exports.COMPULSORY_LIMITS.MEDICAL_MATERIAL_ASSISTIVE,
      reductionReason: null,
      supplementHint: null,
      subItems: [
        {
          key: 'specialMaterial',
          label: '特殊材料費',
          applied: special,
          approved: 0,
          note: '骨材、鋼板、人工關節等',
        },
        {
          key: 'generalMaterial',
          label: '一般醫材費',
          applied: generalMaterial,
          approved: 0,
          note: '紗布、縫線、注射耗材（舊法不另設上限）',
        },
        {
          key: 'assistiveDevice',
          label: '輔具費',
          applied: assistive,
          approved: 0,
          note: '拐杖、輪椅、支架等',
        },
      ],
    }
  }
  const cap = exports.COMPULSORY_LIMITS.MEDICAL_MATERIAL_ASSISTIVE
  const approvedTotal = Math.min(subtotal, cap)
  // 舊法：合併按申請比例分攤（pro-rata）
  const ratio = approvedTotal / subtotal
  let approvedSpecial = Math.round(special * ratio)
  let approvedGeneral = Math.round(generalMaterial * ratio)
  let approvedAssistive = Math.round(assistive * ratio)
  const diff = approvedTotal - (approvedSpecial + approvedGeneral + approvedAssistive)
  if (diff !== 0) {
    // rounding diff 補回最大項
    const items = [
      { v: special, ref: 's' },
      { v: generalMaterial, ref: 'g' },
      { v: assistive, ref: 'a' },
    ].sort((x, y) => y.v - x.v)
    if (items[0].ref === 's') approvedSpecial += diff
    else if (items[0].ref === 'g') approvedGeneral += diff
    else approvedAssistive += diff
  }
  const reduction =
    approvedTotal < subtotal
      ? `醫療材料＋特殊材料＋輔具合計 ${subtotal.toLocaleString()} 元超出 2 萬上限（舊法合併計算）`
      : null
  const hint = subtotal > 15000 ? '舊法合併上限 2 萬，建議檢附醫師必要性說明爭取全額' : null
  return {
    key: 'medicalMaterial',
    label: '醫療材料／輔具費（舊法合併）',
    applied: subtotal,
    approved: approvedTotal,
    legalCap: cap,
    reductionReason: reduction,
    supplementHint: hint,
    subItems: [
      {
        key: 'specialMaterial',
        label: '特殊材料費',
        applied: special,
        approved: approvedSpecial,
        note: '骨材、鋼板、人工關節等',
      },
      {
        key: 'generalMaterial',
        label: '一般醫材費',
        applied: generalMaterial,
        approved: approvedGeneral,
        note: '紗布、縫線、注射耗材（舊法不另設上限）',
      },
      {
        key: 'assistiveDevice',
        label: '輔具費',
        applied: assistive,
        approved: approvedAssistive,
        note: '拐杖、輪椅、支架等',
      },
    ],
  }
}
/**
 * 強制險傷害醫療主計算（依事故日自動切換新/舊法）
 *
 * @param input 醫療輸入
 * @param accidentDate 事故日（YYYY-MM-DD 或 dayjs 可轉格式）；null/undefined 視為新法（保守預設）
 * @returns CompulsoryComputeResult
 */
function computeCompulsoryMedicalByDate(input, accidentDate) {
  if (!(0, regulation_cutoff_1.isNewLaw)(accidentDate)) {
    // 舊法：自組 items（除 calcMedicalMaterial 外其他項目不變）
    const items = [
      calcEmergency(input),
      calcAmbulance(input),
      calcNhiCopayment(input),
      calcRegistration(input),
      calcDiagnosisCertificate(input),
      calcNonNhi(input),
      calcWardFee(input),
      calcMealFee(input),
      calcProsthesis(input),
      calcDenture(input),
      calcArtificialEye(input),
      calcMedicalMaterialOldLaw(input),
      calcTransportation(input),
      calcNursing(input),
      calcOther(input),
    ]
    const subtotal = items.reduce((sum, it) => sum + it.approved, 0)
    const approved = Math.min(subtotal, exports.COMPULSORY_LIMITS.TOTAL_MEDICAL_CAP)
    return { items, subtotal, approved }
  }
  // 新法（>= 2026-07-01 或未填）
  return computeCompulsoryMedical(input)
}
