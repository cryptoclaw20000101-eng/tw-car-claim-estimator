import { test, expect } from '@playwright/test'

/**
 * 首頁 E2E（v0.13.x 新增）
 *
 * 守護：
 * - 首頁 SSR 沒崩
 * - 關鍵區塊都在（hero / 5 區塊 / FAQ / 免責）
 * - Skip Links 可以用（鍵盤 a11y）
 * - Dark mode toggle 正常運作
 */

test.describe('首頁', () => {
  test('SSR 載入 + 關鍵區塊', async ({ page }) => {
    await page.goto('/')

    // Hero
    await expect(page.getByRole('heading', { level: 1 })).toContainText('車禍理賠金額')

    // 5 區塊（強制險同時出現在多處，用 heading 限定到 BentoCell）
    await expect(page.getByRole('heading', { name: '強制險', level: 3 })).toBeVisible()
    await expect(page.getByRole('heading', { name: '失能初篩', level: 3 })).toBeVisible()

    // 鐵律
    await expect(page.getByRole('heading', { name: '三條鐵律', level: 2 })).toBeVisible()
    await expect(page.getByText('強制險採無過失主義')).toBeVisible()

    // FAQ
    await expect(page.getByRole('heading', { name: '常見問題', level: 2 })).toBeVisible()
    await expect(page.getByText('為什麼我的估算金額跟鄰居不一樣？')).toBeVisible()
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

  test('FAQ 區所有 6 題', async ({ page }) => {
    await page.goto('/')
    // 用 selector 限定在 FAQ section
    const faqSection = page.locator('section').filter({ hasText: '常見問題' })
    const faqs = [
      '為什麼我的估算金額跟鄰居不一樣？',
      '強制險是什麼？跟第三人責任險差在哪？',
      '精神慰撫金怎麼算？為什麼這麼高？',
      '失能等級怎麼認定？我自己填準嗎？',
      '資料不足怎麼辦？工具會給假數字嗎？',
      '理賠結果不如預期，可以去哪裡申訴？',
    ]
    for (const q of faqs) {
      await expect(faqSection.getByText(q)).toBeVisible()
    }
  })
})
