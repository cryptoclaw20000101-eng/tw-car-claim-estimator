/**
 * InstallPWAButton SSR 渲染測試 — v0.8.0+
 *
 * 不變量（測試守護）：
 *   - SSR 不 render 按鈕（避免 hydration mismatch）
 *   - 元件 import 不報錯
 *   - PWAHintCard 在 SSR 也只 render 空
 */

import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { InstallPWAButton, PWAHintCard } from '@/components/InstallPWAButton'

describe('InstallPWAButton SSR', () => {
  it('SSR 不 render 按鈕（避免 hydration mismatch）', () => {
    const html = renderToString(<InstallPWAButton />)
    // SSR 階段 platform=loading → 不 render
    expect(html).toBe('')
  })

  it('PWAHintCard SSR 不 render（client only）', () => {
    const html = renderToString(<PWAHintCard />)
    expect(html).toBe('')
  })
})

describe('InstallPWAButton — 元件 import', () => {
  it('可以正確 import 兩個元件', () => {
    expect(InstallPWAButton).toBeDefined()
    expect(PWAHintCard).toBeDefined()
  })
})
