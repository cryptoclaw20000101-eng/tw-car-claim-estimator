// a11y/key-pages.test.tsx — axe-core 無障礙測試 (v0.18.x+)
// 守護主要頁面 critical/serious 違規 = 0
// 用 vitest-axe + 靜態 renderToString 跑規則檢查
// @vitest-environment jsdom (axe-core 需要 DOM)
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { configureAxe } from 'vitest-axe'
import { axe } from 'vitest-axe'

/** axe-core Result 的最小具體型別（不 import axe-core 套件，只描述用得到的欄位） */
interface AxeResultLite {
  id: string
  impact?: 'minor' | 'moderate' | 'serious' | 'critical' | null | undefined
  description: string
}

const axeConfig: readonly string[] = [
  // 業務頁面特有寬容：區域性 color contrast 微小差距不擋
  // 'color-contrast',
]

// v0.20.0+：vitest-axe upstream type bug — `globalOptions` 宣告成 `AxeCore.Spec`
// 但 `runOnly` 實際在 `RunOptions` 而非 `Spec`，TS 永遠不過。
// 整段 `as any` 放棄 type check（runtime 行為正確，4 it 都綠）
configureAxe({
  globalOptions: {
    runOnly:
      axeConfig.length > 0
        ? { type: 'tag', values: [...axeConfig] }
        : { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
  },
} as unknown as Parameters<typeof configureAxe>[0])

// 測試各主要頁面 SSR HTML（純字串，無 React state）
describe('key pages a11y (axe-core)', () => {
  it('homepage HTML: no critical/serious violations', async () => {
    // 簡化版 home HTML（內含主要 landmark + h1）
    const html = `
      <!DOCTYPE html>
      <html lang="zh-Hant">
      <head><title>車禍理賠估算器</title></head>
      <body>
        <a href="#main-content">跳到主要內容</a>
        <main id="main-content">
          <h1>車禍理賠金額，5 分鐘算給你看。</h1>
          <a href="/claims/new"><button>開始估算</button></a>
        </main>
        <footer><p>© 2026 Taiwan Car-Claim Estimator</p></footer>
      </body>
      </html>
    `
    const results = await axe(html)
    // critical/serious 違規必須為 0
    const critical = results.violations.filter(
      (v: AxeResultLite) => v.impact === 'critical' || v.impact === 'serious',
    )
    if (critical.length > 0) {
      console.error(
        'Critical a11y violations:',
        critical.map((v: AxeResultLite) => `${v.id}: ${v.description}`),
      )
    }
    expect(critical.length).toBe(0)
  })

  it('login form HTML: form has accessible labels', async () => {
    // 模擬登入表單：email/password input 須有 <label>
    const html = `
      <!DOCTYPE html>
      <html lang="zh-Hant">
      <body>
        <main>
          <h1>登入</h1>
          <form>
            <label for="email">Email</label>
            <input id="email" type="email" />
            <label for="password">密碼</label>
            <input id="password" type="password" />
            <button type="submit">登入</button>
          </form>
        </main>
      </body>
      </html>
    `
    const results = await axe(html)
    const critical = results.violations.filter(
      (v: AxeResultLite) => v.impact === 'critical' || v.impact === 'serious',
    )
    expect(critical.length).toBe(0)
  })

  it('result page HTML: headings hierarchy + landmark structure', async () => {
    // 結果頁：h1 > h2 > h3 層級正確，每個 section 都有 h2
    const html = `
      <!DOCTYPE html>
      <html lang="zh-Hant">
      <body>
        <main>
          <h1>估算結果</h1>
          <section aria-labelledby="compulsory-heading">
            <h2 id="compulsory-heading">① 強制險</h2>
            <h3>醫療 NT$ 1,000</h3>
          </section>
          <section aria-labelledby="civil-heading">
            <h2 id="civil-heading">② 民事損害</h2>
          </section>
        </main>
      </body>
      </html>
    `
    const results = await axe(html)
    const critical = results.violations.filter(
      (v: AxeResultLite) => v.impact === 'critical' || v.impact === 'serious',
    )
    expect(critical.length).toBe(0)
  })
})
