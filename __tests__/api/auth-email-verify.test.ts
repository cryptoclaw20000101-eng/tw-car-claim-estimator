// =====================================================================
// v0.21.0+ signup/signin email verify 守護
//
// User 回報：之前「貯存案件的資格」沒實現 → 實際是 production 沒真實 SMTP
// email verify 流程阻擋 user 登入 → 永遠卡在「email 或密碼錯誤」。
//
// v0.21.0+ 修法：signup 自動設 email_verified=true，signin 移除 email_verified 檢查。
//
// 守護測試：
// 1. signup route 用 email_verified=true insert（不再生成 verifyToken）
// 2. signin route 移除 if (!user.email_verified) 區塊
// 3. 結果頁 UI 顯示雲端同步狀態
// =====================================================================

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('signup route — 自動 email_verified=true', () => {
  it('signup INSERT 必須包含 email_verified=true（不是 verify_token）', () => {
    const src = readFileSync('app/api/auth/signup/route.ts', 'utf-8')
    // v0.21.0+：insert 用 email_verified，不用 verify_token
    expect(src).toContain('email_verified)')
    expect(src).toContain('true')
    // 確認不再用 verify_token（mock SMTP 已廢除）
    expect(src).not.toContain('verifyToken')
    expect(src).not.toContain('verifyExpires')
    expect(src).not.toContain('verifyUrl')
  })

  it('signup 不再 import generateVerifyToken', () => {
    const src = readFileSync('app/api/auth/signup/route.ts', 'utf-8')
    expect(src).not.toContain('generateVerifyToken')
  })

  it('signup 回傳 user.emailVerified: true', () => {
    const src = readFileSync('app/api/auth/signup/route.ts', 'utf-8')
    expect(src).toContain('emailVerified: true')
  })
})

describe('signin route — 移除 email_verified 檢查', () => {
  it('signin 不再阻擋未 verify user', () => {
    const src = readFileSync('app/api/auth/signin/route.ts', 'utf-8')
    // 不再有「if (!user.email_verified)」阻擋
    expect(src).not.toMatch(/if\s*\(\s*!user\.email_verified\s*\)/)
    expect(src).not.toContain('請先收信點擊驗證連結啟用帳號')
  })
})

describe('結果頁 — UI 雲端同步狀態', () => {
  it('結果頁必須有 syncStatus state + 4 種狀態 UI', () => {
    const src = readFileSync('app/claims/result/_form.tsx', 'utf-8')
    expect(src).toContain('syncStatus')
    // 4 種狀態
    expect(src).toContain("state: 'pending'")
    expect(src).toContain("state: 'cloud'")
    expect(src).toContain("state: 'local'")
    expect(src).toContain("state: 'error'")
    // UI 字串
    expect(src).toContain('已同步雲端')
    expect(src).toContain('僅存本機')
  })

  it('saveEstimate useEffect 必須用 storage === "cloud" 判斷', () => {
    const src = readFileSync('app/claims/result/_form.tsx', 'utf-8')
    expect(src).toContain("saved.storage === 'cloud'")
  })
})
