// 抽離 8 個計算函式，跑一次 demo 試算驗證（不靠 heredoc / 大字串）
const fs = require('fs')
const path = require('path')

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'claim-calculator.html'), 'utf8')
// v0.4.5: 多個 <script> 段（noscript 內含 0-char 段），抓最長的
const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
if (scriptMatches.length === 0) {
  console.error('No <script> found')
  process.exit(1)
}
let js = scriptMatches.reduce((max, m) => (m[1].length > max.length ? m[1] : max), '')

// 拔掉 document/window/$ 相關的程式碼，純函式庫
const removePatterns = [
  /const \$ = .*$/gm,
  /const num = .*$/gm,
  /const bool = .*$/gm,
  /const fmt = .*$/gm,
  /const fmtRange = .*$/gm,
  /function collectInput[\s\S]*?(?=\nfunction |\nconsole)/m,
  /function goStep[\s\S]*?(?=\nfunction |\nconsole)/m,
  /function renderResults[\s\S]*?(?=\nfunction |\nconsole)/m,
  /function exportPDF[\s\S]*?(?=\nfunction |\nconsole)/m,
  /document\.[^;]+;/g,
  /window\.[^;]+;/g,
  /window\.scrollTo[^;]+;/g,
]
removePatterns.forEach((p) => {
  js = js.replace(p, '')
})

// 構造執行環境（v0.3.3：切出純函式段，跟 check-rule-drift 共用邏輯）
// v0.4.5: end marker 從 "配權 4 維度" 改為函式定義
// v0.5.0: 加 var EMBEDDED_PRECEDENTS = [] stub（HTML 內已宣告）
const START_MARKER = 'const COMPULSORY_LIMITS = {'
const END_COMMENT_MARKER = 'function findRelatedPracticeCases'
const startIdx = js.indexOf(START_MARKER)
const funcStartIdx = js.indexOf(END_COMMENT_MARKER, startIdx)
let brace = 0,
  started = false,
  pureEnd = -1
for (let i = funcStartIdx; i < js.length; i++) {
  if (js[i] === '{') {
    brace++
    started = true
  } else if (js[i] === '}') {
    brace--
    if (started && brace === 0) {
      pureEnd = i + 1
      break
    }
  }
}
let pureJs = js.substring(startIdx, pureEnd)
pureJs = pureJs.replace(/^const \$ = .*$/m, '// $ stub')
// v0.5.0: stub EMBEDDED_PRECEDENTS + 空實作 findRelatedPracticeCases
const lib = {}
const wrapper = new Function(
  'var EMBEDDED_PRECEDENTS = [];\nvar findRelatedPracticeCases = function() { return []; };\n' +
    pureJs +
    `
  return {
    calcCompulsory, calcDisability, calcCivilDamages, calcThirdParty,
    calcRegion, hoffmannCalc, findRelatedPracticeCases, calcEvidence,
    COMPULSORY_LIMITS, HOFFMANN, REGION_MULTIPLIER, CITY_TO_COURT,
    EMBEDDED_PRECEDENTS
  };
`,
)

try {
  const api = wrapper()
  // Demo 案件（你之前按的：機車 vs 汽車，臺中，肇責 30/70，右膝韌帶）
  const demo = {
    accidentCity: '臺中市',
    // v0.5.2: 拿掉 thirdPartyBodilyLimit（永遠有第三人險、無保額上限）
    otherFaultRatio: 70,
    selfFaultRatio: 30,
    age: 35,
    sixMonthAverageSalary: 60000,
    monthlySalary: 60000,
    doctorOrderedRestDays: 60,
    actualLeaveDays: 45,
    hasSalaryTransferRecord: true,
    hasLeaveCertificate: true,
    hasSalaryDeductionProof: true,
    diagnosisText: '右膝韌帶撕裂',
    hospitalizationDays: 5,
    outpatientVisitCount: 8,
    rehabilitationCount: 12,
    hasSurgery: true,
    hasRehabilitation: true,
    requiresNursingCare: true,
    nursingDays: 14,
    hasDisabilityCertificate: false,
    disabilityCategory: '11_lower_limb',
    romLossDegree: 30,
    hasFracture: false,
    hasNerveDamage: false,
    hasPermanentImpairment: false,
    requiresNursingCare: true,
    hasScar: false,
    // 給 findRelatedPracticeCases 用的車輛欄位
    vehicleRepairEstimate: 35000,
    vehicleRepairInvoice: 0,
    emergencyFee: 3500,
    ambulanceFee: 1200,
    nhiCopayment: 8500,
    registrationFee: 800,
    diagnosisCertificateFee: 2500,
    nonNhiNecessaryMedicalFee: 0,
    wardFeeDays: 5,
    wardFeeDifference: 6000,
    mealDays: 5,
    specialMaterialFee: 15000,
    assistiveDeviceFee: 5000,
    transportationFee: 3000,
    nursingFee: 16800,
    prosthesisFee: 0,
    otherNecessaryMedicalFee: 0,
    vehicleRepairEstimate: 35000,
    vehicleRepairInvoice: 0,
    vehicleMarketValueBeforeAccident: 80000,
    salvageValue: 0,
    towingFee: 2000,
    helmetDamage: 3000,
    clothingDamage: 1500,
  }

  // 模擬真實 input 結構（HTML 內 collectInput 會建好這個 shape）
  const realInput = {
    basics: {
      accidentCity: demo.accidentCity,
      accidentDate: '2026-05-15',
      hasPolicePreliminaryReport: demo.hasPolicePreliminaryReport,
      hasAccidentAppraisal: demo.hasAccidentAppraisal,
    },
    fault: { otherFaultRatio: demo.otherFaultRatio },
    person: { sixMonthAverageSalary: demo.sixMonthAverageSalary },
    medical: {
      requiresNursingCare: demo.requiresNursingCare,
      outpatientVisitCount: demo.outpatientVisitCount,
    },
  }
  // property 補到 input 結構
  realInput.vehicleRepairEstimate = demo.vehicleRepairEstimate
  // 補 collectInput 結構裡的其他欄位（HTML 內會有，這裡模擬空值）
  realInput.medicalReceipts = {
    registrationFee: demo.registrationFee,
    wardFeeDifference: demo.wardFeeDifference,
    nursingFee: demo.nursingFee,
    nursingDays: demo.nursingDays,
    vehicleRepairInvoice: demo.vehicleRepairInvoice,
    vehicleRepairEstimate: demo.vehicleRepairEstimate,
  }
  realInput.medical = Object.assign({}, demo) // 含 requiresNursingCare 等所有 medical 欄位

  const region = api.calcRegion(demo.accidentCity)
  const comp = api.calcCompulsory(demo)
  const disab = api.calcDisability(demo)
  const civil = api.calcCivilDamages(demo, demo, region.multiplier)
  const tp = api.calcThirdParty(demo, civil, comp)
  const evidence = api.calcEvidence(demo, demo, disab)
  const cases = api.findRelatedPracticeCases(realInput, civil, disab)
  const total = comp.approved + disab.possibleAmount

  console.log('✅ 8 個函式 + demo 案件試算成功\n')
  console.log('📍 地區:', region.courtName, '| 係數', region.multiplier)
  console.log(
    '🏥 強制險 15 細項：',
    comp.items.length,
    '項, 醫療 approved =',
    comp.approved.toLocaleString(),
  )
  const matItem = comp.items.find((i) => i.key === 'specialMaterialAndAssistive')
  if (matItem && matItem.subItems) {
    console.log(
      '   - 特殊材料+輔具 subItems:',
      matItem.subItems.length,
      '子項',
      '(special=' +
        matItem.subItems[0].applied.toLocaleString() +
        ' + assistive=' +
        matItem.subItems[1].applied.toLocaleString() +
        ')',
    )
  }
  console.log(
    '🦴 失能初篩：',
    disab.screening,
    '級 | 等級',
    disab.possibleLevel,
    '| 金額',
    disab.possibleAmount.toLocaleString(),
  )
  console.log('   線索：', disab.signals.join(', ') || '無')
  if (disab.needsSupplement.length > 0) console.log('   需補：', disab.needsSupplement.join(', '))
  console.log(
    '💰 精神慰撫金：',
    civil.painAndSuffering.low.toLocaleString(),
    '~',
    civil.painAndSuffering.mid.toLocaleString(),
    '~',
    civil.painAndSuffering.high.toLocaleString(),
  )
  console.log(
    '💼 工作損失：',
    civil.workLoss.toLocaleString(),
    '（證據',
    civil.workLossEvidence,
    '）',
  )
  console.log(
    '   短期:',
    civil.workLossShortTerm.toLocaleString(),
    '| 長期:',
    civil.workLossLongTerm.toLocaleString(),
  )
  console.log(
    '👨‍⚕️ 看護費：',
    civil.nursingFeeLow.toLocaleString(),
    '~',
    civil.nursingFeeHigh.toLocaleString(),
    '（',
    civil.nursingDays,
    '日）',
  )
  console.log(
    '🚗 第三人責任險：',
    tp.estimate.low.toLocaleString(),
    '~',
    tp.estimate.mid.toLocaleString(),
    '~',
    tp.estimate.high.toLocaleString(),
  )
  if (tp.usedCap) console.log('   ⚠️ 已觸體傷保額上限')
  console.log('📋 補件清單：', evidence.length, '項')
  evidence.forEach((e) => console.log('   -', e))
  console.log('🆔 配權判例：', cases.length, '筆')
  cases.forEach((c) =>
    console.log('   -', c.caseNo, '(', c.court, ',', c.chain, ',', c.similarity + '% )'),
  )
  console.log('\n📊 霍夫曼速查（r=5%）：')
  console.log(
    '   5年:',
    api.HOFFMANN[5].toFixed(4),
    '| 10年:',
    api.HOFFMANN[10].toFixed(4),
    '| 30年:',
    api.HOFFMANN[30].toFixed(4),
  )
  console.log('\n💎 強制險合計：', total.toLocaleString())
  console.log(
    '   (醫療',
    comp.approved.toLocaleString(),
    '+ 失能',
    disab.possibleAmount.toLocaleString() + ')',
  )

  // v0.3.1 配權 Top 5 驗證
  console.log('\n🔍 v0.3.1 真實配權結果（Top 5）：')
  cases.forEach((c, i) => {
    console.log(`  #${i + 1} [${c.similarity}%] ${c.caseNo} | ${c.court}`)
    console.log(`      鏈=${c.chain} 金額=${c.amount.toLocaleString()} 肇責=${c.ratioOther}%`)
    console.log(`      ${c.gist}`)
    console.log(`      配權依據：${c.matchReason}`)
  })
} catch (e) {
  console.error('❌ 執行錯誤：', e.message)
  console.error(e.stack)
  process.exit(1)
}
