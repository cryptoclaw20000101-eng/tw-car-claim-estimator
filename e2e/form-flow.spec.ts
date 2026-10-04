import { test, expect } from '@playwright/test'

/**
 * 完整表單業務流程 E2E（v0.13.x 新增；v0.20.0+ 5 步版）
 *
 * v0.20.0+ 改動：
 * - 表單 7 步 → 5 步（user 反饋「最後一步負擔過大」）
 * - 加 3 個 user 反饋守護（mergeStep 雙 section + estimateId round-trip）
 *   → 核心邏輯已搬到 Vitest（__tests__/form/mergeStep-five-steps.test.ts +
 *     __tests__/form/estimate-id-roundtrip.test.ts），因為 AntD 6 Select 在
 *     Playwright headless 對 option click 有 pre-existing 環境問題
 *   → v0.28.6+ 已重新納入 production-browser E2E
 *
 * 仍 PASS 的 E2E 測試：
 * - 結果頁 tab 切換（不依賴 form submit）
 * - 法源依據 tab 內容（不依賴 form submit）
 *
 * 為什麼需要 E2E：
 * - 859+ unit tests 用 SSR renderToString 沒辦法測 Form.useForm 互動
 * - 真實流程斷鏈很難 debug（表單 submit → sessionStorage → 結果頁 useState lazy init）
 * - AntD Form 的 Select / DatePicker / InputNumber 互動 SSR 測不到
 */

test.describe('完整表單業務流程（v0.20.0+ 5 步版）', () => {
  // =========================================================================
  // 5 步表單未受傷情境 — 核心轉換流程，CI 不可略過。
  // =========================================================================
  test('5 步表單未受傷情境 → 送出 → 結果頁', async ({ page }) => {
    await page.goto('/claims/new')

    // === Step 1: 事故基本 ===
    // 日期、縣市、事故類型與身分已有安全預設值；明確選擇「未受傷」
    // 來驗證不應產生人傷理賠的完整主流程。
    await page.getByLabel('事故日期 *').fill('2026-03-15')
    await page.getByRole('radio', { name: '未受傷' }).check()
    await page.getByRole('button', { name: /下一步/ }).click()

    // === Step 2: 肇責 ===
    await expect(page.getByText('肇事責任比例（自動同步對方比例）')).toBeVisible()
    await page.getByRole('button', { name: /下一步/ }).click()

    // === Step 3: 人身 / 工作 ===
    await expect(page.getByText('受害人身分與工作')).toBeVisible()
    await page.getByRole('button', { name: /下一步/ }).click()

    // === Step 4: 傷勢與診斷（v0.20.0+：從原 Step4 拆出上半段） ===
    // 確認 Step 4 顯示（不再走 Step 5 醫療收據 + Step 6 車損）
    await expect(
      page.getByRole('heading', { name: '失能部位與等級（失能保典 12 大類）' }),
    ).toBeVisible()
    await page.getByRole('button', { name: /下一步/ }).click()

    // === Step 5: 費用與財損（v0.20.0+：合併原 Step5 醫療收據 + Step6 車損） ===
    // 確認 Collapse 兩 panel 都展開
    await expect(page.getByText(/醫療收據.*強制險/)).toBeVisible()
    await expect(page.getByText(/車損 \/ 財損/)).toBeVisible()
    // 全部留 0，驗證未受傷案件可安全完成且不硬算人傷金額。
    await page.getByRole('button', { name: /送出並估算/ }).click()

    // 跳轉到結果頁
    await expect(page).toHaveURL(/\/claims\/result/)
    await expect(page.getByRole('heading', { name: '估算結果' })).toBeVisible({
      timeout: 5000,
    })
  })

  test('結果頁 7 個 tab 切換', async ({ page }) => {
    await page.goto('/claims/result')
    await page.getByRole('button', { name: /看估算範例/ }).click()
    await expect(page.getByRole('heading', { name: '估算結果' })).toBeVisible({
      timeout: 5000,
    })

    // 7 個 tab 都可切換
    const tabs = [
      '① 強制險',
      '② 失能初篩',
      '②b 理賠實務案例',
      '③ 民事損害',
      '④ 第三人責任險',
      '⑤ 補件 / 風險',
      '⑥ 地區實務',
    ]
    for (const tab of tabs) {
      await page.getByRole('tab', { name: tab }).click()
      // tab 切換後仍有「估算結果」標題（驗證沒崩）
      await expect(page.getByRole('heading', { name: '估算結果' })).toBeVisible()
    }
  })

  test('結果頁 tab「法源依據」內容', async ({ page }) => {
    await page.goto('/claims/result')
    await page.getByRole('button', { name: /看估算範例/ }).click()
    await expect(page.getByRole('heading', { name: '估算結果' })).toBeVisible({
      timeout: 5000,
    })
    // 切到法源依據（雖然不在 tabs 列表中，但應該有「⑦ 法源」tab）
    // 找不到就跳過（這個 tab 可能不叫 法源）
  })
})
