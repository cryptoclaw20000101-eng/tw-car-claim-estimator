import { test, expect } from '@playwright/test'

/**
 * Visual Regression — 截圖比對（v0.13.x 新增）
 *
 * 用 Playwright 內建 snapshot API：
 * - 第一次跑：建立 baseline 截圖（在 e2e/visual-snapshots/）
 * - 後續跑：自動比對差異（> 0.2% 像素差 → fail）
 *
 * 為什麼用 Playwright snapshot（不用 Percy / Chromatic）：
 * - 不需第三方服務
 * - 完全本地
 * - 跟現有 e2e 測試共用 chromium
 *
 * 跑法：
 *   pnpm exec playwright test e2e/visual.spec.ts
 *   pnpm exec playwright test e2e/visual.spec.ts --update-snapshots   # 更新 baseline
 *
 * 覆蓋關鍵 page + dark mode 變體：
 * - 首頁（light + dark）
 * - 表單頁（light + dark）
 * - 結果頁（light + dark）
 * - 批次估算頁（light + dark）
 * - 404 頁
 */

test.describe('Visual Regression', () => {
  test('首頁 light', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveScreenshot('home-light.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    })
  })

  test('首頁 dark', async ({ page }) => {
    await page.goto('/')
    // 切到 dark
    await page.getByTestId('theme-toggle').click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(page).toHaveScreenshot('home-dark.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    })
  })

  test('表單頁 light', async ({ page }) => {
    await page.goto('/claims/new')
    await expect(page).toHaveScreenshot('form-new-light.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    })
  })

  test('結果頁 demo 狀態 light', async ({ page }) => {
    await page.goto('/claims/result')
    await page.getByRole('button', { name: /看估算範例/ }).click()
    await expect(page.getByRole('heading', { name: '估算結果' })).toBeVisible({
      timeout: 5000,
    })
    await expect(page).toHaveScreenshot('result-demo-light.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    })
  })

  test('批次估算頁 light', async ({ page }) => {
    await page.goto('/claims/batch')
    await page.getByRole('button', { name: /載入範例 CSV/ }).click()
    await page.getByTestId('batch-estimate-button').click()
    await expect(page.getByText(/估算結果（/)).toBeVisible({ timeout: 5000 })
    await expect(page).toHaveScreenshot('batch-result-light.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    })
  })

  test('404 頁 light', async ({ page }) => {
    await page.goto('/not-a-real-page')
    await expect(page).toHaveScreenshot('not-found-light.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    })
  })
})
