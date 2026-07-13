'use client'

/**
 * PageBreadcrumb — 頁面頂部導覽列（v0.13.x 新增）
 *
 * 為什麼抽出：
 * - 3 個 page（claims/result / claims/batch）有相同的「回上一頁 / 回首頁」按鈕 pattern
 * - 重複 3 次 → 抽出統一
 * - 未來加頁面（e.g. /claims/about）直接用這個
 *
 * 用法：
 *   <PageBreadcrumb
 *     back={{ kind: 'link', href: '/claims/new', label: '← 回單筆估算' }}
 *   />
 *   <PageBreadcrumb
 *     back={{ kind: 'link', href: '/claims/new', label: '重新估算', icon: <EditOutlined /> }}
 *     actions={[
 *       { kind: 'button', onClick: handleShare, label: '分享連結', icon: <ShareOutlined />, testId: 'share-link' },
 *     ]}
 *   />
 *
 * 預設行為：
 * - 沒給 back：只顯示回首頁
 * - 沒給 actions：自動加回首頁按鈕
 */

import Link from 'next/link'
import { Button, Space } from 'antd'
import { HomeOutlined } from '@ant-design/icons'
import type { MouseEvent, ReactNode } from 'react'

export type BreadcrumbItem =
  | {
      kind?: 'link'
      href: string
      label: string
      icon?: ReactNode
      type?: 'default' | 'primary' | 'text'
    }
  | {
      kind: 'button'
      onClick: (e: MouseEvent) => void
      label: string
      icon?: ReactNode
      type?: 'default' | 'primary' | 'text'
      testId?: string
    }

export interface PageBreadcrumbProps {
  /** 「回上一頁」按鈕（如「重新估算」、「← 回單筆估算」）*/
  back?: BreadcrumbItem
  /** 右側額外按鈕（如「分享」、「客戶精簡模式」）*/
  actions?: BreadcrumbItem[]
  /** 是否自動加回首頁按鈕（預設 true）*/
  showHome?: boolean
  className?: string
}

export function PageBreadcrumb({
  back,
  actions,
  showHome = true,
  className = '!mb-4',
}: PageBreadcrumbProps) {
  const allItems: BreadcrumbItem[] = [
    ...(back ? [back] : []),
    ...(actions ?? []),
    ...(showHome && !actions?.some((a) => 'href' in a && a.href === '/')
      ? [{ kind: 'link' as const, href: '/', label: '回首頁', icon: <HomeOutlined /> }]
      : []),
  ]

  return (
    <Space className={className}>
      {allItems.map((item, i) => {
        const key = `${i}-${'href' in item ? item.href : item.label}`
        if (item.kind === 'button') {
          return (
            <Button
              key={key}
              type={item.type ?? 'default'}
              icon={item.icon}
              onClick={item.onClick}
              data-testid={item.testId}
            >
              {item.label}
            </Button>
          )
        }
        return (
          <Link key={key} href={item.href}>
            <Button type={item.type ?? 'default'} icon={item.icon}>
              {item.label}
            </Button>
          </Link>
        )
      })}
    </Space>
  )
}

export default PageBreadcrumb
