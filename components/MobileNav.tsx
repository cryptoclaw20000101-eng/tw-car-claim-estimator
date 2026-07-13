/**
 * MobileNav — v0.8.0+ 手機專屬導覽列（v0.10.0+ 加 framer-motion 進場與 active underline）
 *
 * 設計：
 *   - 桌機（≥ 768px）：水平並排 nav，active 項有 animated underline
 *   - 手機（< 768px）：漢堡選單（Drawer）
 *   - 黏在頂部（sticky top-0）
 *   - iOS safe-area 處理（env(safe-area-inset-top)）
 *   - z-index 高於內容、低於 Modal
 *
 * v0.10.0+ 新增：
 *   - 進場動畫：header fade-in-down
 *   - active underline：motion.div 用 layoutId 跨 nav item 滑動
 *   - honor prefers-reduced-motion
 *
 * 為什麼手機需要漢堡？
 *   首頁 + 「開始估算」按鈕 → 桌機可並排，手機擠不下
 *   漢堡選單是 PWA / 原生 app 通用模式
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button, Drawer, Space, Tooltip, Typography } from 'antd'
import { CarOutlined } from '@ant-design/icons'
import {
  MenuOutlined,
  CloseOutlined,
  HomeOutlined,
  CalculatorOutlined,
  ReadOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  // v0.12.0+ Phase B6：dark mode toggle icons
  SunOutlined,
  MoonOutlined,
  // v0.14.x：user icon
  UserOutlined,
  LoginOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import { motion, useReducedMotion } from 'framer-motion'
import { useAuth } from '@/components/AuthProvider'

const { Text } = Typography

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: '首頁', icon: <HomeOutlined /> },
  { href: '/claims/new', label: '開始估算', icon: <CalculatorOutlined /> },
  { href: '/claims/result', label: '結果頁', icon: <FileSearchOutlined /> },
]

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const pathname = usePathname()
  const reduce = useReducedMotion()

  // v0.12.0+ Phase B6：讀 localStorage 套用 theme（client-side hydration 後）
  useEffect(() => {
    try {
      const pref = window.localStorage.getItem('tw-car-claim-estimator:theme') || 'light'
      setTheme(pref as 'light' | 'dark')
    } catch {
      // ignore
    }
  }, [])

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    try {
      window.localStorage.setItem('tw-car-claim-estimator:theme', next)
    } catch {
      // ignore
    }
    // 立即套用 / 移除 .dark class
    if (next === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // 桌機版 — 水平並排 + active underline (v0.10.0+ motion polish)
  const DesktopNav = (
    <nav className="hidden md:flex items-center gap-1" data-testid="mobile-nav-desktop">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href
        return (
          <Link key={item.href} href={item.href} className="relative">
            <Button
              type={active ? 'primary' : 'text'}
              icon={item.icon}
              data-testid={`nav-${item.label}`}
            >
              {item.label}
            </Button>
            {/* v0.10.0+：active 項加 motion underline（layoutId 跨 item 共享） */}
            {active && (
              <motion.span
                layoutId="nav-underline"
                className="absolute -bottom-1 left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-accent"
                transition={
                  reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 30 }
                }
                aria-hidden
              />
            )}
          </Link>
        )
      })}
    </nav>
  )

  // 手機版 — 漢堡
  const MobileBurger = (
    <Button
      className="md:hidden"
      icon={<MenuOutlined />}
      onClick={() => setOpen(true)}
      aria-label="開啟選單"
      data-testid="mobile-nav-burger"
    />
  )

  return (
    <motion.header
      className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
      data-testid="mobile-nav"
      // v0.10.0+：header 進場 fade-in-down
      initial={reduce ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 md:px-6 md:py-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Text strong className="!text-base !text-foreground md:!text-lg">
            <CarOutlined /> 車禍理賠
          </Text>
        </Link>

        {/* 桌機 nav */}
        {DesktopNav}

        {/* v0.12.0+ Phase B6：dark mode toggle */}
        <Tooltip title={theme === 'dark' ? '切換淺色' : '切換深色'}>
          <Button
            type="text"
            icon={theme === 'dark' ? <SunOutlined /> : <MoonOutlined />}
            onClick={toggleTheme}
            data-testid="theme-toggle"
            aria-label={theme === 'dark' ? '切換淺色模式' : '切換深色模式'}
          />
        </Tooltip>

        {/* v0.14.x：用戶登入狀態 */}
        <UserMenu />

        {/* 手機漢堡 */}
        {MobileBurger}
      </div>

      {/* 手機 Drawer */}
      <Drawer
        title={
          <Space>
            <CarOutlined className="text-lg" />
            <Text strong>車禍理賠估算器</Text>
          </Space>
        }
        placement="right"
        open={open}
        onClose={() => setOpen(false)}
        closeIcon={<CloseOutlined />}
        size="large"
        style={{ width: '80vw', maxWidth: 360 }}
        data-testid="mobile-nav-drawer"
      >
        <Space orientation="vertical" size="small" className="!w-full">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                style={{ width: '100%' }}
              >
                <Button
                  type={active ? 'primary' : 'text'}
                  icon={item.icon}
                  block
                  size="large"
                  className="!justify-start"
                  data-testid={`mobile-drawer-${item.label}`}
                >
                  {item.label}
                </Button>
              </Link>
            )
          })}
          {/* v0.14.x：法律頁面（隱私 / 條款 / 關於我們）*/}
          <div className="!mt-4 border-t border-border pt-4">
            <Text type="secondary" className="!mb-2 !text-xs uppercase tracking-wider">
              更多
            </Text>
            <Space direction="vertical" size="small" className="!w-full">
              <Link href="/about" onClick={() => setOpen(false)} style={{ width: '100%' }}>
                <Button type="text" block className="!justify-start" size="small">
                  關於我們
                </Button>
              </Link>
              <Link href="/privacy" onClick={() => setOpen(false)} style={{ width: '100%' }}>
                <Button type="text" block className="!justify-start" size="small">
                  隱私權政策
                </Button>
              </Link>
              <Link href="/terms" onClick={() => setOpen(false)} style={{ width: '100%' }}>
                <Button type="text" block className="!justify-start" size="small">
                  服務條款
                </Button>
              </Link>
            </Space>
          </div>
          <div className="!mt-4 border-t border-border pt-4">
            <Text type="secondary" className="!text-xs">
              💡 加到主畫面變 app：iPhone 分享 → 加入主畫面 / Android Chrome 自動提示
            </Text>
          </div>
        </Space>
      </Drawer>
    </motion.header>
  )
}

// 避免 unused warning
const _experimentIcon = <ExperimentOutlined />

/**
 * v0.14.x：用戶登入選單（顯示登入狀態 + 切換）
 */
function UserMenu() {
  const { user, signOut, loading } = useAuth()
  const pathname = usePathname()

  if (loading) {
    return <Button type="text" icon={<UserOutlined />} disabled data-testid="user-menu" />
  }

  if (!user) {
    return (
      <Tooltip title="點擊登入">
        <Link href="/login" passHref legacyBehavior>
          <Button type="text" icon={<LoginOutlined />} data-testid="user-menu" aria-label="登入" />
        </Link>
      </Tooltip>
    )
  }

  return (
    <Tooltip title={`已登入：${user.email ?? '用戶'}（點擊登出）`}>
      <Button
        type="text"
        icon={<LogoutOutlined />}
        onClick={() => signOut()}
        data-testid="user-menu"
        aria-label="登出"
      />
    </Tooltip>
  )
}
