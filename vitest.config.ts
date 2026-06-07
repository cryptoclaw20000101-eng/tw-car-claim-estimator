import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['lib/**/*.ts'],
      exclude: [
        // 型別檔不會被 v8 算進 coverage（type-only 編譯後消失），無法測
        'lib/**/types.ts',
        // Next.js page/wrapper 是 SSR/CSR 邊界，留給 E2E 測
        'app/**',
      ],
      thresholds: {
        // 從 2026-06-08 的基線：95.96% stmts / 92.21% branch / 98.12% lines
        // CI 擋任何一項低於基線
        statements: 95,
        branches: 90,
        functions: 95,
        lines: 95,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
