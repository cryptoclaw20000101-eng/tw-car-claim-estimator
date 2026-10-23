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
  test('復健與看護按需填寫，切換步驟保留已填日數', async ({ page }) => {
    await page.goto('/claims/new')
    await expect(page.getByRole('button', { name: /下一步/ })).toBeEnabled()
    await page.getByLabel('事故日期 *').fill('2026-03-15')
    await page.getByLabel('事故日期 *').press('Enter')
    await page.getByRole('radio', { name: '有受傷', exact: true }).check()
    await page.getByRole('button', { name: /下一步/ }).click()
    await page.getByLabel('事故時年齡 *').fill('42')
    await page.getByText('收入與請假資料（估算工作損失時填）', { exact: true }).click()
    await page.getByLabel('有請假證明', { exact: true }).check()
    await expect(page.getByLabel('有扣薪證明', { exact: true })).not.toBeChecked()
    await page.getByRole('button', { name: /下一步/ }).click()
    await expect(page.getByLabel('復健次數')).not.toBeVisible()
    await expect(page.getByLabel('看護日數')).not.toBeVisible()
    await page.getByLabel('是否復健').check()
    await page.getByLabel('復健次數').fill('6')
    await page.getByLabel('需看護', { exact: true }).check()
    await page.getByLabel('看護日數').fill('3')
    await page.getByRole('button', { name: /上一步/ }).click()
    await expect(page.getByLabel('有請假證明', { exact: true })).toBeChecked()
    await expect(page.getByLabel('有扣薪證明', { exact: true })).not.toBeChecked()
    await page.getByRole('button', { name: /下一步/ }).click()
    await expect(page.getByLabel('復健次數')).toHaveValue('6')
    await expect(page.getByLabel('看護日數')).toHaveValue('3')
    // 已填的資料仍可檢查、清除，不會因關閉開關而被藏起來。
    await page.getByLabel('是否復健').uncheck()
    await expect(page.getByLabel('復健次數')).toBeVisible()
    await page.getByRole('button', { name: /下一步/ }).click()
    await expect(page.getByLabel('病房費差額', { exact: true })).not.toBeVisible()
    await page.getByRole('button', { name: '補填住院／病房費用' }).click()
    await page.getByLabel('病房費差額', { exact: true }).fill('3000')
    await page.getByLabel('病房費天數', { exact: true }).fill('2')
    await page.getByLabel('看護費（強制險上限 36,000）', { exact: true }).fill('3600')
    await expect(page.getByText(/看護 3 天/)).toBeVisible()
    await expect(page.getByLabel('看護天數（最多採計 30 日）')).not.toBeVisible()
    const review = page.getByRole('region', { name: '送出前核對' })
    await expect(review).toContainText('事故時 42 歲')
    await review.getByRole('checkbox').check()
    await page.getByRole('button', { name: /送出並估算/ }).click()
    await expect(page).toHaveURL(/\/claims\/result/)
    const input = await page.evaluate(() => JSON.parse(sessionStorage.getItem('claim-input')!))
    expect(input.medical.nursingDays).toBe(3)
    expect(input.medicalReceipts.nursingDays).toBe(3)
    expect(input.medicalReceipts.wardFeeDays).toBe(2)
    expect(input.person.hasLeaveCertificate).toBe(true)
    expect(input.person.hasSalaryDeductionProof).toBe(false)
    expect(input).not.toHaveProperty('_reviewConfirmed')
  })

  // =========================================================================
  // 5 步表單未受傷情境 — 核心轉換流程，CI 不可略過。
  // =========================================================================
  test('未受傷縮短為 2 步 → 送出 → 結果頁', async ({ page }) => {
    await page.goto('/claims/new')
    await expect(page.getByRole('button', { name: /下一步/ })).toBeEnabled()

    // === Step 1: 事故基本 ===
    // 日期、縣市、事故類型與身分已有安全預設值；明確選擇「未受傷」
    // 來驗證不應產生人傷理賠的完整主流程。
    await page.getByLabel('事故日期 *').fill('2026-03-15')
    await page.getByLabel('事故日期 *').press('Enter')
    await page.getByRole('radio', { name: '未受傷' }).check()
    await page.getByRole('button', { name: /下一步/ }).click()

    // 未受傷案件直接到車損，略過人身／工作與傷勢。
    await expect(page.getByText('工作與收入', { exact: true })).not.toBeVisible()
    await expect(page.getByText('診斷描述', { exact: true })).not.toBeVisible()

    // === Step 5: 費用與財損（v0.20.0+：合併原 Step5 醫療收據 + Step6 車損） ===
    // 確認 Collapse 兩 panel 都展開
    await expect(page.getByText('醫療費用', { exact: true })).not.toBeVisible()
    await expect(page.getByText(/車損 \/ 財損/)).toBeVisible()
    await page.getByLabel('維修費（元）', { exact: true }).fill('10000')
    await page.getByLabel('拖吊費', { exact: true }).fill('500')
    await page.getByLabel('事故前車價', { exact: true }).fill('200000')
    const review = page.getByRole('region', { name: '送出前核對' })
    await expect(review).toContainText('尚未確認')
    await expect(review).toContainText('2026-03-15')
    // 未核對摘要時不得送出；返回修改後也必須重新核對。
    await page.getByRole('button', { name: /送出並估算/ }).click()
    await expect(page.getByText('請先核對摘要並勾選確認')).toBeVisible()
    await expect(page).toHaveURL(/\/claims\/new/)
    await review.getByRole('checkbox').check()
    await page.getByRole('button', { name: '修改肇責比例' }).click()
    await page.getByLabel('我方肇責 (%) *').fill('30')
    await page.getByRole('button', { name: /下一步/ }).click()
    await expect(review).toContainText('我方 30%／對方 70%')
    await expect(review.getByRole('checkbox')).not.toBeChecked()
    await review.getByRole('checkbox').check()
    await page.getByRole('button', { name: /送出並估算/ }).click()

    // 跳轉到結果頁
    await expect(page).toHaveURL(/\/claims\/result/)
    await expect(page.getByRole('heading', { name: '估算結果' })).toBeVisible({
      timeout: 5000,
    })
    const assumptions = page.getByRole('region', { name: '本次試算假設' })
    await expect(assumptions).toContainText('肇責比例（暫定）')
    await expect(assumptions).toContainText('我方 30%／對方 70%')
    await expect(assumptions).toContainText('尚未確認；民事求償金額不代表保險給付。')
    await expect(page.getByText('精神慰撫金參考區間', { exact: true })).not.toBeVisible()
    const propertySummary = page.getByRole('region', { name: '車損試算摘要' })
    await expect(propertySummary).toContainText('10,500')
    await expect(propertySummary).toContainText('7,350')
    await expect(page.getByRole('region', { name: '肇責情境比較' })).toContainText('7,350')
    await expect(page.getByRole('tab', { name: /失能初篩/ })).not.toBeVisible()
    await expect(page.getByRole('tab', { name: /民事損害/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.getByRole('tabpanel')).toContainText('其他財物損失')
    await expect(page.getByRole('tabpanel')).not.toContainText('除疤')
    await assumptions.getByRole('button', { name: '查看補件與風險' }).click()
    await expect(page.getByRole('tab', { name: /補件 \/ 風險/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await page.getByRole('tab', { name: /第三人責任險/ }).click()
    await expect(page.getByRole('tabpanel')).toContainText('乘對方肇責 70%')
    // 修改本次資料時載入正在看的案件，不受其他本機草稿影響。
    await page.getByTestId('edit-current-estimate').click()
    await expect(page.getByRole('button', { name: /下一步/ })).toBeEnabled()
    await expect(page.getByLabel('事故日期 *')).toHaveValue('2026-03-15')
    await expect(page.getByRole('radio', { name: '未受傷' })).toBeChecked()
    await expect(page.getByLabel('我方肇責 (%) *')).toHaveValue('30')
    await page.getByRole('button', { name: /下一步/ }).click()
    await expect(page.getByLabel('維修費（元）', { exact: true })).toHaveValue('10,000')
    await expect(
      page.getByRole('region', { name: '送出前核對' }).getByRole('checkbox'),
    ).not.toBeChecked()
  })

  test('手機未知車價可以送出，但車損顯示待估而非零元', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/claims/new')
    await expect(page.getByRole('button', { name: /下一步/ })).toBeEnabled()
    await page.getByRole('radio', { name: '未受傷' }).check()
    await page.getByLabel('我方肇責 (%) *').fill('30')
    await page.getByRole('button', { name: /下一步/ }).click()
    await expect(page.getByLabel('事故前車價', { exact: true })).not.toBeVisible()
    await page.getByLabel('維修費（元）', { exact: true }).fill('10000')
    await expect(page.getByLabel('事故前車價', { exact: true })).toBeVisible()
    await expect(page.getByText('車損待補事故前車價', { exact: true })).toBeVisible()
    await page.getByLabel('拖吊費', { exact: true }).fill('500')
    await page.getByRole('region', { name: '送出前核對' }).getByRole('checkbox').check()
    await page.getByRole('button', { name: /送出並估算/ }).click()
    await expect(page).toHaveURL(/\/claims\/result/)
    await expect(page.getByRole('region', { name: '車損試算摘要' })).toContainText('車損待估')
    await expect(page.getByRole('tabpanel')).toContainText('待補車價')
    const result = await page.evaluate(() => JSON.parse(sessionStorage.getItem('claim-result')!))
    expect(result.vehicleDamage).toBeNull()
    expect(result.thirdParty.liableAmountMid).toBe(350)
    const layout = await page.evaluate(() => ({
      width: window.innerWidth,
      contentWidth: document.documentElement.scrollWidth,
      overflowing: [...document.querySelectorAll('main *')]
        .filter(
          (el) =>
            el.getBoundingClientRect().right > window.innerWidth + 1 &&
            el.getBoundingClientRect().width > 0,
        )
        .slice(0, 8)
        .map((el) => ({ tag: el.tagName, className: el.className })),
    }))
    expect(layout.contentWidth, JSON.stringify(layout)).toBeLessThanOrEqual(layout.width)
  })

  test('結果頁 7 個 tab 切換', async ({ page }) => {
    await page.goto('/claims/result')
    await page.getByRole('button', { name: /看估算範例/ }).click()
    await expect(page.getByRole('heading', { name: '估算結果' })).toBeVisible({
      timeout: 5000,
    })
    await expect(
      page.getByRole('heading', { name: '精神慰撫金參考區間', exact: true }),
    ).toBeVisible()
    await expect(page.getByText(/資料完整度 \d+%/)).not.toBeVisible()

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
      await expect(page.getByRole('tabpanel')).toHaveText(/\S/)
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
    await page.getByRole('tab', { name: /⑦ 法源/ }).click()
    await expect(page.getByRole('tabpanel')).toContainText('民法')
  })
})
