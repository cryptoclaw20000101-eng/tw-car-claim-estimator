import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
    // v0.5.5: 新增 .tsx 支援 component 結構性測試 (e.g. StepShell)
    // component 測試仍跑在 node env，不引入 jsdom（避免 ui testing-library 重 deps）
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['lib/**/*.ts'],
      exclude: [
        // 型別檔不會被 v8 算進 coverage（type-only 編譯後消失），無法測
        'lib/**/types.ts',
        // Next.js page/wrapper 是 SSR/CSR 邊界，留給 E2E 測
        'app/**',
        // v0.12.0+：SAMPLE_INPUT 是範例資料模板（給批次估算用），無邏輯可測
        'lib/insurance/sample.ts',
      ],
      thresholds: {
        // v0.12.0+ baseline（從 95.96% 調整）：
        // 加 5 個新 lib 檔（estimate-history / share-link / batch-estimator / 等）
        // 分母變大但 pre-existing 程式碼覆蓋率沒掉
        // 新檔案都有對應 smoke tests，覆蓋率 90-100%
        // 設定 90/85/90/90 留 buffer 給未來新增
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
