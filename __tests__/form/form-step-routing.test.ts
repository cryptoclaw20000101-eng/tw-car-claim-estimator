/**
 * 表單 5 步 routing 結構性測試（commit 4a RED → 4b GREEN）
 *
 * 對應 use case：
 * - 表單 7 → 5 步重構（commit 4b）
 * - Step 1：事故基本（basics）
 * - Step 2：肇責（fault）
 * - Step 3：人身 / 工作（person）
 * - Step 4：傷勢與診斷（medical）
 * - Step 5：費用與財損（receipts + property）
 *
 * 為什麼用結構性 grep 而不是 component render：
 * - 表單頁依賴 AntD Form runtime + sessionStorage + useRouter，無法純 Vitest render
 * - 結構性 grep 守護 STEPS 陣列 + conditional render 是最 surgical 的測試
 * - 對齊 commit 1 §2.4 既有 pattern（date-picker-invariants.test.ts:19-32）
 *
 * 不變量：
 * 1. STEPS 陣列恰好 5 元素
 * 2. STEPS 標題依序對應到 5 個 section
 * 3. _form.tsx 內 conditional render 處理 current === 0,1,2,3,4 五個分支
 * 4. Step 元件 import 5 個檔（Step1/2/3 + 新的 Step4Diagnosis + Step5FeesAndProperty）
 */

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const FORM_PATH = join(process.cwd(), 'app/claims/new/_form.tsx')
const STEPS_DIR = join(process.cwd(), 'app/claims/new/_steps')

function readFormSource(): string {
  return readFileSync(FORM_PATH, 'utf8')
}

function listStepFiles(): string[] {
  return readdirSync(STEPS_DIR).filter((f: string) => f.startsWith('Step') && f.endsWith('.tsx'))
}

describe('表單 5 步 routing — STEPS 結構', () => {
  it('STEPS 陣列恰好 5 個元素', () => {
    const src = readFormSource()
    // 抓取 STEPS = [...] 區塊
    const match = src.match(/const STEPS = \[([\s\S]*?)\]/)
    expect(match).not.toBeNull()
    const entries = match![1]
      .split('},')
      .map((s) => s.trim())
      .filter((s) => s.startsWith('{') && s.includes('title:'))
    expect(entries.length).toBe(5)
  })

  it('5 個 step 標題依序為：事故基本 / 肇責 / 人身工作 / 傷勢診斷 / 費用財損', () => {
    const src = readFormSource()
    const match = src.match(/const STEPS = \[([\s\S]*?)\]/)
    expect(match).not.toBeNull()
    const body = match![1]
    expect(body).toContain("'事故基本'")
    expect(body).toContain("'肇責'")
    expect(body).toContain("'人身 / 工作'")
    expect(body).toContain("'傷勢與診斷'")
    expect(body).toContain("'費用與財損'")
  })

  it('conditional render 處理 current === 0,1,2,3,4 全部 5 個分支', () => {
    const src = readFormSource()
    expect(src).toMatch(/current\s*===\s*0/)
    expect(src).toMatch(/current\s*===\s*1/)
    expect(src).toMatch(/current\s*===\s*2/)
    expect(src).toMatch(/current\s*===\s*3/)
    expect(src).toMatch(/current\s*===\s*4/)
  })
})

describe('表單 5 步 routing — Step 元件檔案', () => {
  it('_steps/ 內有 Step1/2/3 + Step4Diagnosis + Step5FeesAndProperty 共 5 個 .tsx', () => {
    const files = listStepFiles()
    // 允許 StepShell 以外還有 5 個
    const expected = [
      'Step1Basics.tsx',
      'Step2Fault.tsx',
      'Step3PersonalWork.tsx',
      'Step4Diagnosis.tsx',
      'Step5FeesAndProperty.tsx',
    ]
    for (const f of expected) {
      expect(files).toContain(f)
    }
  })

  it('Step4Medical.tsx 已不存在（被拆成 Step4Diagnosis + Step5FeesAndProperty）', () => {
    const files = listStepFiles()
    expect(files).not.toContain('Step4Medical.tsx')
  })

  it('_form.tsx 內 import 5 個新 Step 元件', () => {
    const src = readFormSource()
    expect(src).toMatch(/import.*Step1Basics.*_steps/)
    expect(src).toMatch(/import.*Step2Fault.*_steps/)
    expect(src).toMatch(/import.*Step3PersonalWork.*_steps/)
    expect(src).toMatch(/import.*Step4Diagnosis.*_steps/)
    expect(src).toMatch(/import.*Step5FeesAndProperty.*_steps/)
  })
})
