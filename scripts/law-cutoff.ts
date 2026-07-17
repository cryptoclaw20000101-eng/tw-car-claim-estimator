/**
 * 強制險新/舊法切換 CLI 工具（v0.8.4+）
 *
 * 輸入：事故日（YYYY-MM-DD）+ 案件摘要（醫材費 / ROM 百分比）
 * 輸出：依事故日判定走新法或舊法 + 計算差異估算 + 相似 precedents 統計
 *
 * 用法：
 *   pnpm law-cutoff <事故日>                              # 人類可讀輸出
 *   pnpm law-cutoff <事故日> --json                       # JSON 模式（給程式呼叫）
 *   pnpm law-cutoff <事故日> --special 8000 --assistive 7000 --general 15000 --rom 40 --joint lower
 *   pnpm law-cutoff --help                                # 顯示說明
 *
 * 不裝新套件：純 Node + @/lib/* 內部模組 + node:fs
 */

import { computeCompulsoryMedicalByDate } from '../lib/insurance/compulsory'
import { lookupDisabilityLevelByDate } from '../lib/insurance/disability-joint-mapping'
import { isNewLaw, getLawVersionLabel, NEW_LAW_CUTOFF } from '../lib/data-sources/regulation-cutoff'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// 用 type-only import 守護型別（編譯後消除，nodenext 不會誤判檔案為 type-only）
type CompulsoryMedicalInputs = import('../lib/insurance/types').CompulsoryMedicalInputs

// ─── CLI 參數解析 ───────────────────────────────────────────────

interface CliArgs {
  accidentDate: string | null
  showHelp: boolean
  jsonMode: boolean
  // 醫材費明細（選填，給醫材差異估算用）
  specialMaterialFee: number
  medicalMaterialFee: number
  assistiveDeviceFee: number
  // ROM 百分比 + 關節（給失能差異估算用）
  romPercent: number | null
  joint: 'upper' | 'lower'
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    accidentDate: null,
    showHelp: argv.includes('--help') || argv.includes('-h'),
    jsonMode: argv.includes('--json'),
    specialMaterialFee: 0,
    medicalMaterialFee: 0,
    assistiveDeviceFee: 0,
    romPercent: null,
    joint: 'lower',
  }

  // 第一個非旗標參數 = 事故日
  for (const a of argv.slice(2)) {
    if (!a.startsWith('--') && args.accidentDate === null) {
      args.accidentDate = a
      break
    }
  }

  // 旗標參數
  const getFlagValue = (flag: string): string | null => {
    const idx = argv.indexOf(flag)
    if (idx < 0) return null
    return argv[idx + 1] ?? null
  }

  const special = getFlagValue('--special')
  if (special) args.specialMaterialFee = parseInt(special, 10) || 0

  const general = getFlagValue('--general')
  if (general) args.medicalMaterialFee = parseInt(general, 10) || 0

  const assistive = getFlagValue('--assistive')
  if (assistive) args.assistiveDeviceFee = parseInt(assistive, 10) || 0

  const rom = getFlagValue('--rom')
  if (rom) args.romPercent = parseInt(rom, 10) || 0

  const joint = getFlagValue('--joint')
  if (joint === 'upper' || joint === 'lower') args.joint = joint

  return args
}

function showHelp(): void {
  console.log(`
═══════════════════════════════════════════════════════════════
  強制險新/舊法切換 CLI 工具（v0.8.4+）
═══════════════════════════════════════════════════════════════

用法：
  pnpm law-cutoff <事故日> [選項]

  <事故日>     YYYY-MM-DD 格式（例: 2024-03-15 / 2026-07-01）

選項：
  --json                       JSON 模式輸出（給程式呼叫）
  --special <金額>             特殊材料費（v0.2.5+ 新法 subItems）
  --general <金額>             一般醫材費（紗布/縫線等，舊法合併計算）
  --assistive <金額>           輔具費（拐杖/輪椅/支架）
  --rom <0-100>                ROM 喪失百分比（給失能等級切換估算）
  --joint <upper|lower>        關節類型（upper=上肢 / lower=下肢，預設 lower）
  --help, -h                   顯示說明

範例：
  # 基本判定（只看新/舊法）
  pnpm law-cutoff 2024-03-15

  # 含醫材費差異估算
  pnpm law-cutoff 2024-03-15 --special 8000 --general 15000 --assistive 7000

  # 含失能等級差異估算
  pnpm law-cutoff 2024-03-15 --rom 40 --joint lower

  # 全部 + JSON 模式
  pnpm law-cutoff 2026-07-01 --special 8000 --general 15000 --assistive 7000 --rom 40 --json

切換規則：
  事故日 >= ${NEW_LAW_CUTOFF}  → 新法（拆 subItems / 三分類查表）
  事故日 <  ${NEW_LAW_CUTOFF}  → 舊法（合併 3 項 / 百分比段 5/15/30/50/70%）
  null / undefined / ''        → 保守預設為新法
`)
}

// ─── 醫材費差異估算 ────────────────────────────────────────────

interface MedicalMaterialDiff {
  oldLaw: number
  newLaw: number
  difference: number
  oldLawSubItems: number
  newLawSubItems: number
}

const EMPTY_MEDICAL_INPUT: CompulsoryMedicalInputs = {
  emergencyFee: 0,
  ambulanceFee: 0,
  nhiCopayment: 0,
  registrationFee: 0,
  diagnosisCertificateFee: 0,
  nonNhiNecessaryMedicalFee: 0,
  wardFeeDifference: 0,
  wardFeeDays: 0,
  mealFee: 0,
  mealDays: 0,
  prosthesisFee: 0,
  dentureFee: 0,
  missingTeethCount: 0,
  artificialEyeFee: 0,
  specialMaterialFee: 0,
  medicalMaterialFee: 0,
  assistiveDeviceFee: 0,
  transportationFee: 0,
  nursingFee: 0,
  nursingDays: 0,
}

function computeMedicalDiff(args: CliArgs): MedicalMaterialDiff | null {
  const subtotal = args.specialMaterialFee + args.medicalMaterialFee + args.assistiveDeviceFee
  if (subtotal === 0) return null

  const input: CompulsoryMedicalInputs = {
    ...EMPTY_MEDICAL_INPUT,
    specialMaterialFee: args.specialMaterialFee,
    medicalMaterialFee: args.medicalMaterialFee,
    assistiveDeviceFee: args.assistiveDeviceFee,
  }

  const oldLawResult = computeCompulsoryMedicalByDate(input, '2020-01-01')
  const newLawResult = computeCompulsoryMedicalByDate(input, '2027-01-01')

  const oldItem = oldLawResult.items.find((it) => it.key === 'medicalMaterial')
  const newItem = newLawResult.items.find((it) => it.key === 'medicalMaterial')

  return {
    oldLaw: oldItem?.approved ?? 0,
    newLaw: newItem?.approved ?? 0,
    difference: (newItem?.approved ?? 0) - (oldItem?.approved ?? 0),
    oldLawSubItems: oldItem?.subItems?.length ?? 0,
    newLawSubItems: newItem?.subItems?.length ?? 0,
  }
}

// ─── 失能等級差異估算 ──────────────────────────────────────────

interface DisabilityDiff {
  oldLaw: number
  newLaw: number
  difference: number
  changed: boolean
}

function computeDisabilityDiff(args: CliArgs): DisabilityDiff | null {
  if (args.romPercent === null) return null

  const oldLaw = lookupDisabilityLevelByDate(args.joint, args.romPercent, '2020-01-01')
  const newLaw = lookupDisabilityLevelByDate(args.joint, args.romPercent, '2027-01-01')

  return {
    oldLaw,
    newLaw,
    difference: newLaw - oldLaw,
    changed: oldLaw !== newLaw,
  }
}

// ─── Precedents 統計（切換日前/後案件數）─────────────────────

interface PrecedentStats {
  total: number
  beforeCutoff: number
  afterCutoff: number
  cutoffDate: string
}

function loadPrecedentStats(): PrecedentStats {
  const precedentsDir = join(process.cwd(), 'data/precedents')
  const stats: PrecedentStats = {
    total: 0,
    beforeCutoff: 0,
    afterCutoff: 0,
    cutoffDate: NEW_LAW_CUTOFF,
  }

  let files: string[]
  try {
    files = readdirSync(precedentsDir).filter((f) => f.endsWith('.json'))
  } catch {
    return stats
  }

  for (const file of files) {
    try {
      const content = readFileSync(join(precedentsDir, file), 'utf-8')
      const data = JSON.parse(content)
      if (!Array.isArray(data)) continue
      stats.total += data.length
      for (const p of data) {
        // v0.2.18+ precedents 結構含 year（西元年）
        if (typeof p.year === 'number') {
          if (p.year < 2026) stats.beforeCutoff++
          else stats.afterCutoff++
        } else {
          // 沒 year 欄位的舊資料，預設為切換前
          stats.beforeCutoff++
        }
      }
    } catch {
      // 忽略單檔錯誤
    }
  }

  return stats
}

// ─── 切換日距離計算 ──────────────────────────────────────────

function daysBetween(dateISO: string, targetISO: string): number {
  const d1 = new Date(dateISO + 'T00:00:00Z').getTime()
  const d2 = new Date(targetISO + 'T00:00:00Z').getTime()
  return Math.round((d1 - d2) / (1000 * 60 * 60 * 24))
}

// ─── 主輸出（人類可讀）─────────────────────────────────────────

function printHumanOutput(
  args: CliArgs,
  medicalDiff: MedicalMaterialDiff | null,
  disabilityDiff: DisabilityDiff | null,
  precedentStats: PrecedentStats,
): void {
  const isNew = isNewLaw(args.accidentDate)
  const label = getLawVersionLabel(args.accidentDate)
  const icon = isNew ? '🆕' : '📜'

  console.log('')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  ${icon} ${label}`)
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log(`事故日:        ${args.accidentDate ?? '（未填）'}`)
  console.log(`切換日:        ${NEW_LAW_CUTOFF}`)
  console.log(
    `距離切換日:    ${args.accidentDate ? daysBetween(args.accidentDate, NEW_LAW_CUTOFF) + ' 天' : '（無）'}`,
  )
  console.log(`判定結果:      ${isNew ? '新法（拆 subItems）' : '舊法（合併 3 項）'}`)
  console.log('')

  // 醫材費差異
  if (medicalDiff) {
    console.log('───────────────────────────────────────────────────────────────')
    console.log('📦 醫材費差異估算')
    console.log('───────────────────────────────────────────────────────────────')
    console.log(`  特殊材料費:   ${args.specialMaterialFee.toLocaleString()} 元`)
    console.log(`  一般醫材費:   ${args.medicalMaterialFee.toLocaleString()} 元`)
    console.log(`  輔具費:       ${args.assistiveDeviceFee.toLocaleString()} 元`)
    console.log(
      `  小計:         ${(args.specialMaterialFee + args.medicalMaterialFee + args.assistiveDeviceFee).toLocaleString()} 元`,
    )
    console.log('')
    console.log(
      `  舊法 approved: ${medicalDiff.oldLaw.toLocaleString()} 元（${medicalDiff.oldLawSubItems} 項 subItems）`,
    )
    console.log(
      `  新法 approved: ${medicalDiff.newLaw.toLocaleString()} 元（${medicalDiff.newLawSubItems} 項 subItems）`,
    )
    const diffSign = medicalDiff.difference > 0 ? '+' : ''
    const diffEmoji = medicalDiff.difference === 0 ? '✅' : medicalDiff.difference > 0 ? '📈' : '📉'
    console.log(`  ${diffEmoji} 差異: ${diffSign}${medicalDiff.difference.toLocaleString()} 元`)
    console.log('')
  }

  // 失能差異
  if (disabilityDiff) {
    console.log('───────────────────────────────────────────────────────────────')
    console.log('🦴 失能等級差異估算')
    console.log('───────────────────────────────────────────────────────────────')
    console.log(`  關節:         ${args.joint === 'upper' ? '上肢' : '下肢'}`)
    console.log(`  ROM 喪失:     ${args.romPercent}%`)
    console.log('')
    console.log(`  舊法等級:     第 ${disabilityDiff.oldLaw} 級`)
    console.log(`  新法等級:     第 ${disabilityDiff.newLaw} 級`)
    const changedEmoji = disabilityDiff.changed ? '🔄' : '✅'
    console.log(
      `  ${changedEmoji} 差異:     ${disabilityDiff.changed ? '切換生效（' + (disabilityDiff.difference > 0 ? '新法 ' + disabilityDiff.newLaw + ' 級較高' : '新法 ' + disabilityDiff.newLaw + ' 級較低') + '）' : '新舊法結果相同'}`,
    )
    console.log('')
  }

  // Precedents 統計
  console.log('───────────────────────────────────────────────────────────────')
  console.log('📚 司法院真實判例資料庫（按年度分組）')
  console.log('───────────────────────────────────────────────────────────────')
  console.log(`  總件數:       ${precedentStats.total} 件`)
  console.log(
    `  切換日前:     ${precedentStats.beforeCutoff} 件（民國 ${2026 - 1911} 年以前，含 v0.2.18 前舊資料）`,
  )
  console.log(`  切換日後:     ${precedentStats.afterCutoff} 件（民國 115 年起）`)
  console.log('')

  console.log('───────────────────────────────────────────────────────────────')
  console.log('📋 法源說明')
  console.log('───────────────────────────────────────────────────────────────')
  if (isNew) {
    console.log('  強制汽車責任保險給付標準 §2.3.6（民國 115-05-29 修正、115-07-01 施行）')
    console.log('  失能等級附表（同日施行）')
    console.log('')
    console.log('  新法重點：')
    console.log('    - 特殊材料費 + 輔具費 各自 pro-rata 套 2 萬上限（拆 subItems）')
    console.log('    - 一般醫材費歸入健保自付額 / 非健保必要，不算 2 萬上限範圍')
    console.log('    - 失能採「先三分類（喪失/顯著/運動障害）→ 再查對照表」')
  } else {
    console.log('  強制汽車責任保險給付標準 §2.3.6（民國 114 年以前適用版本）')
    console.log('  失能等級附表（修法前版本）')
    console.log('')
    console.log('  舊法重點：')
    console.log('    - 醫療材料費 + 特殊材料費 + 輔具費 合併計算，套 1 個 2 萬上限')
    console.log('    - 失能採 ROM 百分比段 5/15/30/50/70% 對應單一等級（2/7/9/11/13/15）')
  }
  console.log('')
  console.log('═══════════════════════════════════════════════════════════════')
}

// ─── 主輸出（JSON 模式）────────────────────────────────────────

function printJsonOutput(
  args: CliArgs,
  medicalDiff: MedicalMaterialDiff | null,
  disabilityDiff: DisabilityDiff | null,
  precedentStats: PrecedentStats,
): void {
  const isNew = isNewLaw(args.accidentDate)
  const output = {
    accidentDate: args.accidentDate,
    cutoffDate: NEW_LAW_CUTOFF,
    daysFromCutoff: args.accidentDate ? daysBetween(args.accidentDate, NEW_LAW_CUTOFF) : null,
    lawVersion: isNew ? 'new' : 'old',
    lawVersionLabel: getLawVersionLabel(args.accidentDate),
    medicalMaterial: medicalDiff
      ? {
          input: {
            specialMaterialFee: args.specialMaterialFee,
            medicalMaterialFee: args.medicalMaterialFee,
            assistiveDeviceFee: args.assistiveDeviceFee,
            subtotal: args.specialMaterialFee + args.medicalMaterialFee + args.assistiveDeviceFee,
          },
          oldLaw: {
            approved: medicalDiff.oldLaw,
            subItems: medicalDiff.oldLawSubItems,
          },
          newLaw: {
            approved: medicalDiff.newLaw,
            subItems: medicalDiff.newLawSubItems,
          },
          difference: medicalDiff.difference,
        }
      : null,
    disability: disabilityDiff
      ? {
          joint: args.joint,
          romPercent: args.romPercent,
          oldLawLevel: disabilityDiff.oldLaw,
          newLawLevel: disabilityDiff.newLaw,
          difference: disabilityDiff.difference,
          changed: disabilityDiff.changed,
        }
      : null,
    precedents: precedentStats,
  }
  console.log(JSON.stringify(output, null, 2))
}

// ─── main ────────────────────────────────────────────────────

function main(): void {
  const args = parseArgs(process.argv)

  if (args.showHelp) {
    showHelp()
    return
  }

  if (!args.accidentDate) {
    console.error('❌ 錯誤：請提供事故日（YYYY-MM-DD）')
    console.error('   範例: pnpm law-cutoff 2024-03-15')
    console.error('   查 help: pnpm law-cutoff --help')
    process.exit(1)
  }

  // 驗證日期格式
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.accidentDate)) {
    console.error(`❌ 錯誤：事故日格式錯誤（需 YYYY-MM-DD）: ${args.accidentDate}`)
    process.exit(1)
  }

  const medicalDiff = computeMedicalDiff(args)
  const disabilityDiff = computeDisabilityDiff(args)
  const precedentStats = loadPrecedentStats()

  if (args.jsonMode) {
    printJsonOutput(args, medicalDiff, disabilityDiff, precedentStats)
  } else {
    printHumanOutput(args, medicalDiff, disabilityDiff, precedentStats)
  }
}

// 直接跑 main 才執行（避免 import 時跑）
if (process.argv[1]?.endsWith('law-cutoff.js')) {
  main()
}
