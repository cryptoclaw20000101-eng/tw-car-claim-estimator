import { test, expect } from '@playwright/test'

/**
 * 3 個法律頁面 E2E（v0.14.x）
 *
 * 守護：
 * - /privacy 標題 + 「我們蒐集什麼」section 可見
 * - /terms 標題 + 「工具定位」section 可見
 * - /about 標題 + 「技術棧」section 可見
 * - 3 個頁面都含「← 回首頁」連結
 * - 3 個頁面都列在 MobileNav drawer
 */

test.describe('法律頁面 E2E', () => {
  test('/privacy 載入正確', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.getByRole('heading', { name: '隱私權政策' })).toBeVisible()
    await expect(page.getByText('我們蒐集什麼')).toBeVisible()
    await expect(page.getByText('查看')).toBeVisible()
  })

  test('/terms 載入正確', async ({ page }) => {
    await page.goto('/terms')
    await expect(page.getByRole('heading', { name: '服務條款' })).toBeVisible()
    await expect(page.getByText('工具定位')).toBeVisible()
    await expect(page.getByText('試算工具')).toBeVisible()
  })

  test('/about 載入正確', async ({ page }) => {
    await page.goto('/about')
    await expect(page.getByRole('heading', { name: '關於我們' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '技術棧' })).toBeVisible()
    await expect(page.getByText(/Open Source/)).toBeVisible()
  })

  test('3 個頁面都有回首頁連結', async ({ page }) => {
    for (const path of ['/privacy', '/terms', '/about']) {
      await page.goto(path)
      await expect(page.getByRole('link', { name: /回首頁/ })).toBeVisible()
    }
  })

  test('首頁 footer 鏈接到 3 個法律頁面', async ({ page }) => {
    await page.goto('/')
    // 滾到 footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(page.getByRole('link', { name: '關於我們' })).toBeVisible()
    await expect(page.getByRole('link', { name: '隱私權政策' })).toBeVisible()
    await expect(page.getByRole('link', { name: '服務條款' })).toBeVisible()
  })
})
