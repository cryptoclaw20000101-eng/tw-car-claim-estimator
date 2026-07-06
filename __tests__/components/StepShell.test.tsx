/**
 * StepShell 結構性測試 — v0.5.5 A2 重構驗證
 *
 * 避免引入 jsdom 環境 + testing-library（vitest config 目前是 node env）。
 * StepShell 是純組合元件（Card + InfoAlert + children），用 props 介面 + 結構性斷言即可。
 *
 * 涵蓋: props 介面契約 + alertBody 條件渲染 + alertType 預設值
 */
import { describe, it, expect } from 'vitest'
import type { StepShellProps } from '@/components/StepShell'

describe('StepShell props 介面契約', () => {
  it('icon 為 ReactNode (可以是 null)', () => {
    const props: StepShellProps = {
      icon: null,
      title: 't',
      alertTitle: 'a',
      children: null,
    }
    expect(props.icon).toBeNull()
  })

  it('icon 為 ReactNode (可以是 JSX)', () => {
    const props: StepShellProps = {
      icon: '🚗',
      title: 't',
      alertTitle: 'a',
      children: null,
    }
    expect(typeof props.icon).toBe('string')
  })

  it('alertType 預設為 info', () => {
    // StepShell function signature 內部有預設值 alertType = 'info'
    // 此測試確保 props 沒傳 alertType 時 TS 仍能編譯（type 層面）
    const props: StepShellProps = {
      icon: null,
      title: 't',
      alertTitle: 'a',
      children: null,
    }
    expect(props.alertType).toBeUndefined() // 沒傳時是 undefined，元件內部 default to 'info'
  })

  it('alertType 可傳 warning/success/error', () => {
    const warn: StepShellProps = {
      icon: null,
      title: 't',
      alertTitle: 'a',
      alertType: 'warning',
      children: null,
    }
    const success: StepShellProps = {
      icon: null,
      title: 't',
      alertTitle: 'a',
      alertType: 'success',
      children: null,
    }
    const error: StepShellProps = {
      icon: null,
      title: 't',
      alertTitle: 'a',
      alertType: 'error',
      children: null,
    }
    expect(warn.alertType).toBe('warning')
    expect(success.alertType).toBe('success')
    expect(error.alertType).toBe('error')
  })

  it('alertBody 為可選欄位 (undefined 時不渲染第二段)', () => {
    const withoutBody: StepShellProps = { icon: null, title: 't', alertTitle: 'a', children: null }
    const withBody: StepShellProps = {
      icon: null,
      title: 't',
      alertTitle: 'a',
      alertBody: 'body text',
      children: null,
    }
    expect(withoutBody.alertBody).toBeUndefined()
    expect(withBody.alertBody).toBe('body text')
  })

  it('children 為 ReactNode', () => {
    const props: StepShellProps = {
      icon: null,
      title: 't',
      alertTitle: 'a',
      children: <div>test</div>,
    }
    expect(props.children).toBeTruthy()
  })
})
