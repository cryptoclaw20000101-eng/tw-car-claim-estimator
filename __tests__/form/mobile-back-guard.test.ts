// 使用者可離開並回來繼續；不可藉填表完成率限制瀏覽器返回。
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('mobile back navigation', () => {
  it('不攔截 popstate 把使用者困在表單', () => {
    const src = readFileSync('app/claims/new/_form.tsx', 'utf-8')
    expect(src).not.toMatch(/addEventListener\(\s*['"]popstate['"]/)
    expect(src).not.toContain("window.history.pushState(null, '', '/claims/new')")
  })
})
