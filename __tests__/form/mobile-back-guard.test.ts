// =====================================================================
// v0.20.5+ 手機返回鍵保護守護
//
// User 回報：手機按返回鍵 → history.back() → SPA 離開 /claims/new → 回首頁 /
// 修法：_form.tsx 監聽 popstate → pushState 把 /claims/new 加回 history stack
//        + AntD message 警告
//
// 守護：
// 1. _form.tsx 必須有 popstate handler + pushState
// 2. popstate handler 必須呼叫 message.warning 提示 user
// 3. popstate handler 必須 pushState 保持 user 在表單
//
// 不做 runtime test：jsdom 對 history API 支援有限，source grep 守護足夠
// =====================================================================

import { describe, expect, it } from 'vitest'

describe('mobile back button guard', () => {
  it('_form.tsx 必須註冊 popstate handler', () => {
    const src = require('fs').readFileSync('app/claims/new/_form.tsx', 'utf-8')
    expect(src).toMatch(/addEventListener\(\s*['"]popstate['"]/)
    expect(src).toMatch(/window\.history\.pushState/)
  })

  it('popstate handler 必須呼叫 message.warning 提示', () => {
    const src = require('fs').readFileSync('app/claims/new/_form.tsx', 'utf-8')
    expect(src).toMatch(/message\.warning/)
    expect(src).toContain('請完成表單')
  })

  it('popstate handler 必須把 history 推回 /claims/new', () => {
    const src = require('fs').readFileSync('app/claims/new/_form.tsx', 'utf-8')
    expect(src).toContain("window.history.pushState(null, '', '/claims/new')")
  })
})
