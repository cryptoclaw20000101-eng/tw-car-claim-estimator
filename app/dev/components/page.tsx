/**
 * /dev/components — 元件 showcase 路由（v0.15.x Phase 5）
 *
 * 為什麼不裝 Storybook：
 * - Storybook 太重（~200MB deps + 複雜 webpack config）
 * - Next.js 16 + Turbopack 對 Storybook 相容性待驗證
 * - 業務價值：設計師/工程師隔離看元件的 props 變化
 * - 80% 價值可以用簡單 showcase 達到
 *
 * v0.15.x Phase 5：先做「元件 showcase 路由」
 * v0.15.x 之後：再評估是否真接 Storybook
 *
 * 用法：
 *   開發模式（pnpm dev）：
 *   - 開 http://localhost:3000/dev/components
 *   - 看每個元件的 props 變化
 *   - 顯示 dark mode / compact mode 切換
 *   - 顯示互動元件的 callback
 *
 * 正式環境 robots: noindex（不應該被搜尋引擎收錄）
 */

import type { Metadata } from 'next'
import ComponentsShowcase from './_content'

export const metadata: Metadata = {
  title: '元件 Showcase | 開發工具',
  description: 'v0.15.x 元件 showcase 路由（dev only）',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
}

export default function ComponentsDevPage() {
  return <ComponentsShowcase />
}
