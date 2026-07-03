/**
 * Skeleton — 自製 branded skeleton（v0.11.0+ 取代 AntD Skeleton）
 *
 * 為什麼不用 AntD Skeleton：
 *   - AntD 6 的 Skeleton.Input / Skeleton.Button 在 Next 16 + Turbopack
 *     的 SSR prerender 階段會 `Element type is invalid: got: undefined.`
 *     （Turbopack 對 Skeleton 靜態屬性解析有 bug，AGENTS §2.4 提及）
 *   - 視覺一致性：本專案已有 taste-skill v1 自製灰底 skeleton 風格
 *     → 統一收斂到這個元件
 *
 * 設計：
 *   - 純 Tailwind div + bg-gradient pulse 動畫
 *   - 對齊 taste-skill v1：無 emoji、灰底 bg-gray-200/60 + rounded-md
 *   - 客戶端 hydration 後才跑 pulse（SSR 仍是靜態灰底，避免 hydration mismatch）
 *
 * 用法：
 *   <Skeleton width="w-48" height="h-4" />
 *   <SkeletonBlock rows={4} />  // 多行段落
 */

'use client'

import { useEffect, useState } from 'react'

interface SkeletonProps {
  /** Tailwind 寬度 class，例如 'w-48'、'w-2/3'、'w-full' */
  width?: string
  /** Tailwind 高度 class，例如 'h-4'、'h-10' */
  height?: string
  /** 圓角 class，預設 rounded-md */
  rounded?: string
  className?: string
}

/**
 * 單塊 skeleton bar
 */
export function Skeleton({
  width = 'w-full',
  height = 'h-3',
  rounded = 'rounded-md',
  className = '',
}: SkeletonProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div
      // SSR 渲染靜態灰底；client mount 後加 pulse 動畫
      className={[
        width,
        height,
        rounded,
        'bg-gray-200/60',
        mounted ? 'animate-pulse' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden
    />
  )
}

interface SkeletonBlockProps {
  /** 段落行數 */
  rows?: number
  /** 每行寬度（可傳 array 個別指定，或單一字串統一） */
  widths?: string | string[]
  className?: string
}

/**
 * 多行段落 skeleton（模擬 AntD Skeleton.Paragraph）
 */
export function SkeletonBlock({ rows = 3, widths, className = '' }: SkeletonBlockProps) {
  const items = Array.from({ length: rows }, (_, i) => i)
  const widthList = Array.isArray(widths)
    ? widths
    : widths
      ? Array(rows).fill(widths)
      : Array(rows).fill('w-full')

  return (
    <div className={`space-y-2 ${className}`}>
      {items.map((i) => (
        <Skeleton key={i} width={widthList[i] ?? 'w-full'} height="h-3" />
      ))}
    </div>
  )
}

export default Skeleton