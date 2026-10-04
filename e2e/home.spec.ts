import { test, expect } from '@playwright/test'

/**
 * 首頁 E2E（v0.13.x 新增）
 *
 * 守護：
 * - 首頁 SSR 沒崩
 * - 關鍵區塊都在（hero / 估算方式 / FAQ / 資料來源）
 * - Skip Links 可以用（鍵盤 a11y）
 * - Dark mode toggle 正常運作
 */

test.describe('首頁', () => {
  test('SSR 載入 + 關鍵區塊', async ({ page }) => {
    await page.goto('/')

    // Hero
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('車禍理賠，先做一份初步試算。')

    // 核心方法與資料責任
    await expect(
      page.getByRole('heading', { name: '車禍理賠金額怎麼估算？', level: 2 }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: '資料來源與責任', level: 2 })).toBeVisible()

    // FAQ
    await expect(page.getByRole('heading', { name: '常見問題', level: 2 })).toBeVisible()
    await expect(page.getByText('試算結果就是最後理賠金額嗎？')).toBeVisible()
  })

  test('Skip Links 鍵盤可達', async ({ page }) => {
    await page.goto('/')
    // Tab 一次 → skip link 顯示
    await page.keyboard.press('Tab')
    const skipLink = page.getByRole('link', { name: '跳到主要內容' })
    await expect(skipLink).toBeFocused()
    // 按 Enter → 跳到 main
    await page.keyboard.press('Enter')
    // main 有 id="main-content"
    const main = page.locator('#main-content')
    await expect(main).toBeVisible()
  })

  test('Dark mode toggle 切換', async ({ page }) => {
    await page.goto('/')
    // 初始 light
    const html = page.locator('html')
    await expect(html).not.toHaveClass(/dark/)

    // 點 toggle
    const toggle = page.getByTestId('theme-toggle')
    await toggle.click()
    // 變 dark
    await expect(html).toHaveClass(/dark/)

    // 再點 → 回 light
    await toggle.click()
    await expect(html).not.toHaveClass(/dark/)
  })

  test('FAQ 區所有 3 題', async ({ page }) => {
    await page.goto('/')
    // 用 selector 限定在 FAQ section
    const faqSection = page.locator('section').filter({ hasText: '常見問題' })
    const faqs = [
      '試算結果就是最後理賠金額嗎？',
      '強制險會依肇責比例減少嗎？',
      '資料不完整也可以開始嗎？',
    ]
    for (const q of faqs) {
      await expect(faqSection.getByText(q)).toBeVisible()
    }
  })
})
