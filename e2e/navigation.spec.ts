import { test, expect } from '@playwright/test'

/**
 * 表單 + 結果頁 + 404 + 批次估算 E2E（v0.13.x 新增）
 *
 * 守護：
 * - 主要 route 可達
 * - FormProgress 渲染
 * - 404 頁內容正確
 * - 結果頁空狀態有「看估算範例」入口
 */

test.describe('路由可達性', () => {
  test('首頁 → 表單頁可達', async ({ page }) => {
    await page.goto('/')
    // 點 hero CTA 按鈕（用 partial match 因為有 emoji）
    await page.getByRole('link', { name: /開始估算/ }).first().click()
    await expect(page).toHaveURL(/\/claims\/new/)
    // FormProgress 渲染
    await expect(page.getByTestId('form-progress')).toBeVisible()
  })

  test('結果頁空狀態有「看估算範例」按鈕', async ({ page }) => {
    await page.goto('/claims/result')
    // 等 hydration + sessionStorage 檢查
    await expect(page.getByRole('button', { name: /看估算範例/ })).toBeVisible({
      timeout: 5000,
    })
  })

  test('404 頁有兩條出路', async ({ page }) => {
    const response = await page.goto('/not-a-real-page')
    expect(response?.status()).toBe(404)
    // 404 頁內容
    await expect(page.getByText('這個頁面不存在')).toBeVisible()
    // 兩條出路
    await expect(page.getByRole('link', { name: /回到首頁/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /直接開始估算/ })).toBeVisible()
  })

  test('/claims/batch 直接訪問可達', async ({ page }) => {
    await page.goto('/claims/batch')
    await expect(page).toHaveURL(/\/claims\/batch/)
    await expect(page.getByRole('button', { name: /載入範例 CSV/ })).toBeVisible()
    // 載入範例
    await page.getByRole('button', { name: /載入範例 CSV/ }).click()
    const textarea = page.getByTestId('batch-csv-input')
    await expect(textarea).not.toHaveValue('')
  })
})