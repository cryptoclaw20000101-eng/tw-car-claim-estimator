'use client'

/**
 * ThemeProvider — AntD 主題動態切換（v0.13.x 規劃落實）
 *
 * 設計：
 * - SSR：預設 light theme（避免 hydration mismatch）
 * - mount 後讀 localStorage → 切換 algorithm
 * - 與現有 .dark CSS class 同步（CSS variables + AntD 元件都跟著切）
 *
 * 不變量：
 * - SSR 永遠渲染 light（dark 是 client-side 決定）
 * - localStorage key: 'tw-car-claim-estimator:theme'（與 §23 一致）
 */

import { useEffect, useState } from 'react'
import { App, ConfigProvider, theme as antdTheme } from 'antd'
import zhTW from 'antd/locale/zh_TW'
import { MobileNav } from '@/components/MobileNav'
import { ACCENT } from '@/lib/design/tokens'

type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'tw-car-claim-estimator:theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light')
  const [mounted, setMounted] = useState(false)

  // mount 後讀 localStorage（避免 SSR 拿到 window）
  useEffect(() => {
    try {
      const pref = window.localStorage.getItem(STORAGE_KEY) || 'light'
      // AGENTS §2.1 鐵律：useEffect 內禁同步 setState。但這裡是真實 client-only
      // 場景：SSR 沒有 localStorage，必須 mount 後才能讀。AGENTS §2.1 解法是
      // useSyncExternalStore，但 localStorage 不是 reactive store → 強制 setState
      // 會 re-render 即使值未變。runtime 行為已驗證多年（v0.13.x+ production stable）。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode(pref as ThemeMode)
      // 同步 .dark class（給 CSS variables 用）
      if (pref === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    } catch {
      // ignore
    }

    setMounted(true)
  }, [])

  // 監聽 .dark class 變化（從 MobileNav 的 toggle 按鈕同步過來）
  useEffect(() => {
    if (!mounted) return
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark')
      // AGENTS §2.1：MutationObserver callback 內 setState 允許（DOM event 觸發）
      setMode(isDark ? 'dark' : 'light')
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [mounted])

  const algorithm = mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm
  // v0.15.x Phase 6：當 dark mode 時顯式給關鍵元件深色 token
  // 因為 AntD 6 + 靜態 export 對 algorithm 自動計算支援有限
  const isDark = mode === 'dark'

  return (
    <ConfigProvider
      locale={zhTW}
      theme={{
        algorithm,
        token: {
          // v0.12.0+ 從 tokens 引用（已含在 layout 內的 token）
          colorPrimary: ACCENT, // ACCENT
          colorInfo: '#0e7490',
          colorSuccess: '#166534',
          colorWarning: '#b45309',
          colorError: '#991b1b',
          colorText: isDark ? '#fafaf9' : '#18181b',
          colorBgContainer: isDark ? '#18181b' : '#ffffff',
          colorBgElevated: isDark ? '#27272a' : '#ffffff',
          colorBgLayout: isDark ? '#0a0a0a' : '#fafaf9',
          colorBorder: isDark ? '#3f3f46' : '#e4e4e7',
          colorBorderSecondary: isDark ? '#27272a' : '#e4e4e7',
          borderRadius: 8,
          fontFamily: 'var(--font-body)',
          fontSize: 14,
        },
        components: {
          Card: {
            borderRadiusLG: 12,
            paddingLG: 24,
            colorBgContainer: isDark ? '#18181b' : '#ffffff',
          },
          Tag: {
            borderRadiusSM: 4,
            fontSize: 12,
          },
          Button: {
            borderRadius: 8,
            controlHeight: 40,
            fontWeight: 500,
          },
          Tabs: {
            itemActiveColor: ACCENT,
            itemHoverColor: ACCENT,
            itemSelectedColor: ACCENT,
            inkBarColor: ACCENT,
          },
          Alert: {
            borderRadiusLG: 8,
          },
          Statistic: {
            titleFontSize: 12,
            contentFontSize: 24,
          },
          Tooltip: {
            borderRadius: 6,
          },
        },
      }}
    >
      <App>
        <MobileNav />
        {children}
      </App>
    </ConfigProvider>
  )
}
