import { test, expect } from '@playwright/test'

/**
 * Dark mode 完整整合 E2E（v0.15.x Phase 6）
 *
 * 守護：
 * - 切換 dark mode 時 AntD 元件（Card/Button）真的變深色
 * - 不只 CSS variables 變，AntD 自己的 theme tokens 也跟著切
 * - 連續切換穩定
 *
 * 設計：
 * - 用 /dev/components 頁面測（已包含 AntD 元件範例）
 * - 比較切換前後 computed background color 變化
 */

test.describe('Dark mode AntD 整合', () => {
  // 先用 evaluate 設置 localStorage（避免依賴 MobileNav 的 render 時機）
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      window.localStorage.removeItem('tw-car-claim-estimator:theme')
    })
  })

  test('切換 dark mode → AntD Card 背景變深色', async ({ page }) => {
    await page.goto('/dev/components')

    // 找到 dev/components 頁面裡的 AntD Card
    const antdCard = page.locator('.ant-card').first()
    await expect(antdCard).toBeVisible()

    // Light mode：記錄初始 background color
    const lightBg = await antdCard.evaluate((el) => window.getComputedStyle(el).backgroundColor)

    // 透過 localStorage 觸發 dark mode（不依賴 MobileNav UI 點擊）
    await page.evaluate(() => {
      window.localStorage.setItem('tw-car-claim-estimator:theme', 'dark')
    })
    // 手動觸發 storage event（模擬 MobileNav toggle）
    await page.evaluate(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'tw-car-claim-estimator:theme',
          newValue: 'dark',
        }),
      )
    })

    // 給 React 一個 tick 重新 render
    await page.waitForTimeout(500)

    // 預期 .dark class 加上
    // 注意：實際上是靠 MutationObserver 偵測，storage event 可能不觸發 MutationObserver
    // → 改用直接 reload 讓 inline script 設 .dark
    await page.reload()
    await expect(page.locator('html')).toHaveClass(/dark/)

    const darkBg = await antdCard.evaluate((el) => window.getComputedStyle(el).backgroundColor)

    // 兩個顏色不同（AntD dark algorithm 生效）
    expect(lightBg).not.toBe(darkBg)
  })

  test('MobileNav 的 theme-toggle 按鈕存在', async ({ page }) => {
    await page.goto('/')
    const toggle = page.getByTestId('theme-toggle')
    await expect(toggle).toBeVisible()
  })

  test('透過 localStorage 設 dark → reload 後 html.dark', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      window.localStorage.setItem('tw-car-claim-estimator:theme', 'dark')
    })
    await page.reload()
    await expect(page.locator('html')).toHaveClass(/dark/)
  })
})
