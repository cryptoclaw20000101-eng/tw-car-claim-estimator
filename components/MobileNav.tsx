/**
 * MobileNav — v0.8.0+ 手機專屬導覽列
 *
 * 設計：
 *   - 桌機（≥ 768px）：水平並排 nav
 *   - 手機（< 768px）：漢堡選單（Drawer）
 *   - 黏在頂部（sticky top-0）
 *   - iOS safe-area 處理（env(safe-area-inset-top)）
 *   - z-index 高於內容、低於 Modal
 *
 * 為什麼手機需要漢堡？
 *   5 大區塊 + 「開始估算」按鈕 → 桌機可並排，手機擠不下
 *   漢堡選單是 PWA / 原生 app 通用模式
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button, Drawer, Space, Typography } from 'antd'
import { MenuOutlined, CloseOutlined, HomeOutlined, CalculatorOutlined, ReadOutlined, ExperimentOutlined, FileSearchOutlined } from '@ant-design/icons'

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
  { href: '#sections', label: '5 大區塊', icon: <ReadOutlined /> },
]

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // 桌機版 — 水平並排
  const DesktopNav = (
    <nav className="hidden md:flex items-center gap-1" data-testid="mobile-nav-desktop">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href
        return (
          <Link key={item.href} href={item.href}>
            <Button
              type={active ? 'primary' : 'text'}
              icon={item.icon}
              data-testid={`nav-${item.label}`}
            >
              {item.label}
            </Button>
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
    <header
      className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
      data-testid="mobile-nav"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 md:px-6 md:py-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Text strong className="!text-base !text-foreground md:!text-lg">
            🚗 車禍理賠
          </Text>
        </Link>

        {/* 桌機 nav */}
        {DesktopNav}

        {/* 手機漢堡 */}
        {MobileBurger}
      </div>

      {/* 手機 Drawer */}
      <Drawer
        title={
          <Space>
            <span className="text-lg">🚗</span>
            <Text strong>車禍理賠估算器</Text>
          </Space>
        }
        placement="right"
        open={open}
        onClose={() => setOpen(false)}
        closeIcon={<CloseOutlined />}
        width="80vw"
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
          <div className="!mt-4 border-t border-border pt-4">
            <Text type="secondary" className="!text-xs">
              💡 加到主畫面變 app：iPhone 分享 → 加入主畫面 / Android Chrome 自動提示
            </Text>
          </div>
        </Space>
      </Drawer>
    </header>
  )
}

// 避免 unused warning
const _experimentIcon = <ExperimentOutlined />