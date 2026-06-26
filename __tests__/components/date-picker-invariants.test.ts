// =====================================================================
// DatePicker 設定不變量測試 — v0.6.5
//
// 守護「換日期不會炸 rc-picker」這條 v0.6.4 修過的不變量。
//
// 兩條規則必須同時成立：
//   1. 父層 NewClaimForm mount 時 useEffect 一次性注入 dayjs 到 3 個日期欄位
//      （accidentDate / birthDate / emergencyDate）— 避免 conditional render
//      時未 mount Step 的 useEffect 還沒跑，validateFields 就拿到字串炸掉
//   2. 三個日期 Form.Item 都要帶 getValueProps（轉 form 字串 → dayjs）
//      — 避免 onChange 寫字串回流後 DatePicker 拿到字串炸掉
//
// 這個檔是結構性斷言（grep _form.tsx 原始碼），不需要 jsdom 環境，
// 跟 StepShell.test.tsx 風格一致。
//
// 對應 commit: v0.6.5 (2026-06-26)
// =====================================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const FORM_PATH = resolve(process.cwd(), 'app/claims/new/_form.tsx')
const source = readFileSync(FORM_PATH, 'utf-8')

describe('DatePicker 不變量 (v0.6.5 regression)', () => {
  // -------------------------------------------------------------------
  // 規則 1：父層 NewClaimForm useEffect 注入 3 個 dayjs 欄位
  // -------------------------------------------------------------------
  describe('父層 useEffect 注入 3 個日期欄位為 dayjs', () => {
    it('源碼內有 basics.accidentDate 用 dayjs() 注入', () => {
      // 找 setFieldsValue 區塊，確認含 accidentDate: dayjs(
      expect(source).toMatch(/setFieldsValue\(\s*\{[\s\S]*?basics:\s*\{\s*accidentDate:\s*dayjs\(/)
    })

    it('源碼內有 person.birthDate 用 dayjs() 注入', () => {
      expect(source).toMatch(/person:\s*\{\s*birthDate:\s*dayjs\(/)
    })

    it('源碼內有 medical.emergencyDate 用 dayjs() 注入', () => {
      expect(source).toMatch(/medical:\s*\{\s*emergencyDate:\s*dayjs\(/)
    })
  })

  // -------------------------------------------------------------------
  // 規則 2：三個日期 Form.Item 都要帶 getValueProps 轉字串→dayjs
  // -------------------------------------------------------------------
  describe('三個日期 Form.Item 都有 getValueProps（守護 onChange 字串回流）', () => {
    it('事故日期 Form.Item 有 getValueProps 把 value 轉 dayjs', () => {
      // 找 name={['basics', 'accidentDate']} 後面緊接 getValueProps
      const re =
        /name=\{\['basics',\s*'accidentDate'\]\}[\s\S]{0,200}getValueProps=\{[^}]*dayjs\(value\)/
      expect(source).toMatch(re)
    })

    it('出生年月日 Form.Item 有 getValueProps 把 value 轉 dayjs', () => {
      const re =
        /name=\{\['person',\s*'birthDate'\]\}[\s\S]{0,200}getValueProps=\{[^}]*dayjs\(value\)/
      expect(source).toMatch(re)
    })

    it('急診日期 Form.Item 有 getValueProps 把 value 轉 dayjs', () => {
      const re =
        /name=\{\['medical',\s*'emergencyDate'\]\}[\s\S]{0,200}getValueProps=\{[^}]*dayjs\(value\)/
      expect(source).toMatch(re)
    })
  })

  // -------------------------------------------------------------------
  // 規則 3：合計剛好 3 個 getValueProps（沒多沒少）
  // -------------------------------------------------------------------
  it('源碼內 getValueProps 共出現 3 次（剛好對應 3 個日期欄位）', () => {
    const matches = source.match(/getValueProps=/g) ?? []
    expect(matches.length).toBe(3)
  })
})