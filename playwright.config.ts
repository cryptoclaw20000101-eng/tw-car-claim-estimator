import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E 測試配置（v0.13.x 新增）
 *
 * 為什麼需要 E2E：
 * - 760+ unit tests 都用 SSR renderToString + jsdom — 沒辦法測實際互動
 * - 業務流程（填表 → 結果 → 列印 → 分享）需要真實瀏覽器測
 *
 * 跑法：
 *   pnpm exec playwright test              # headless（CI）
 *   pnpm exec playwright test --headed    # 看瀏覽器
 *   pnpm exec playwright test --ui        # UI mode
 *
 * 對應 package.json script:
 *   "e2e": "playwright test"
 *   "e2e:headed": "playwright test --headed"
 *   "e2e:ui": "playwright test --ui"
 */

export default defineConfig({
  testDir: './e2e',
  // 整個 E2E 跑完最多 30 秒
  timeout: 30 * 1000,
  expect: { timeout: 5 * 1000 },
  fullyParallel: true,
  // CI 上跑 1 次就好，本地可以重試
  retries: process.env.CI ? 1 : 0,
  // 不在 webServer 模式（因為 static export，直接連 file:// 或 dev server）
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    // 蒐集 console 錯誤幫 debug
    launchOptions: {
      // dev 模式也跑得起來
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
  },
})