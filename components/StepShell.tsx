/**
 * StepShell — v0.5.5 共用 Step 元件（v0.10.0+ 升級 B → A）
 *
 * 統一包裝 Step1-Step7 的 Card + InfoAlert + 標題 icon pattern。
 *
 * v0.10.0+ 升級：
 *   - 加 accent 左邊條（4px rose-700）
 *   - icon 改包在 accent 背景方框內（視覺更聚焦）
 *   - 加 framer-motion 進場動畫（fade-in-up）
 *   - 加 step badge 顯示（可選，由 caller 傳 step number）
 *   - honor prefers-reduced-motion
 *
 * 用法:
 *   <StepShell icon={<CarOutlined />} title="事故基本資料"
 *     stepNumber={1} alertType="info"
 *     alertTitle="強制險採無過失主義...">
 *     <Row>...</Row>
 *   </StepShell>
 *
 * 設計: Alert type 預設 'info'；body 為 undefined 時不渲染第二段。
 */
'use client'

import type { ReactNode } from 'react'
import { Card } from 'antd'
import { motion, useReducedMotion } from 'framer-motion'
import { InfoAlert } from './InfoAlert'

export interface StepShellProps {
  /** 標題前的 icon (e.g. <CarOutlined />) */
  icon: ReactNode
  /** Step 標題文字 */
  title: string
  /** InfoAlert 類型，預設 'info' */
  alertType?: 'info' | 'warning' | 'success' | 'error'
  /** Alert 標題（粗體一行） */
  alertTitle: string
  /** Alert 內文（可選，未傳則不渲染第二段） */
  alertBody?: string
  /** Step 內容 */
  children: ReactNode
  /** v0.10.0+：步驟編號（顯示在 icon 方框上方） */
  stepNumber?: number
}

export function StepShell({
  icon,
  title,
  alertType = 'info',
  alertTitle,
  alertBody,
  children,
  stepNumber,
}: StepShellProps) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      // v0.10.0+：進場 fade-in-up
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative"
    >
      {/* v0.10.0+：accent 左邊條（4px rose-700） */}
      <span aria-hidden className="absolute left-0 top-0 h-full w-1 rounded-l-lg bg-accent" />
      <Card
        className="!pl-3"
        title={
          <div className="flex items-center gap-3">
            {/* v0.10.0+：icon 包在 accent 背景方框 */}
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-lg text-accent">
              {icon}
            </span>
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-[0.18em] text-muted">
                Step {stepNumber ?? '·'}
              </span>
              <span className="!text-lg !font-semibold tracking-tight">{title}</span>
            </div>
          </div>
        }
      >
        <InfoAlert
          type={alertType}
          showIcon
          className="!mb-4"
          title={alertTitle}
          {...(alertBody ? { body: alertBody } : {})}
        />
        {children}
      </Card>
    </motion.div>
  )
}
