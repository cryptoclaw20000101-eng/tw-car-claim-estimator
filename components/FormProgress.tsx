'use client'

/**
 * FormProgress — 自製 N 步驟進度條（v0.12.0+ Phase B2）
 *
 * v0.19.0+：從 hardcode 7 步改為動態 steps 數（支援 4 步表單重構）
 *
 * 為什麼不用 AntD Steps：
 * - AntD Steps 過於樣板化，視覺 zero surprise
 * - 想加 framer-motion 進場動畫
 * - 想用更精準的進度填充條
 *
 * 設計：
 * - N 個步驟圓圈 + 標題 + 進度填充條（動態 grid-cols-N）
 * - 三狀態：完成 / 進行中 / 未開始
 *   - 完成：accent 色填滿 + check icon
 *   - 進行中：accent 邊框 + 脈動 dot
 *   - 未開始：zinc 灰
 * - motion.div layoutId 共享圓圈過場動畫
 * - 整體響應式（手機可垂直堆疊或橫向滾動）
 */

import { motion, useReducedMotion } from 'framer-motion'
import { CheckOutlined } from '@ant-design/icons'

export interface FormProgressProps {
  steps: { title: string }[]
  current: number // 0-indexed
  className?: string
}

export function FormProgress({ steps, current, className = '' }: FormProgressProps) {
  const reduce = useReducedMotion()
  const total = steps.length
  const progressPercent = total > 1 ? (current / (total - 1)) * 100 : 0

  return (
    <div className={`!mb-8 ${className}`} data-testid="form-progress">
      {/* 進度填充條背景 */}
      <div className="relative">
        {/* 灰色底 */}
        <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-border" />
        {/* accent 填充條 */}
        <motion.div
          className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 bg-accent"
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />

        {/* 步驟圓圈 + 標題（動態 grid-cols-{total}） */}
        <div
          className="relative gap-2"
          style={{ display: 'grid', gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
        >
          {steps.map((step, i) => {
            const status = i < current ? 'done' : i === current ? 'current' : 'pending'
            return <StepDot key={step.title} index={i} status={status} title={step.title} />
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * 單步驟圓圈 + 標題
 */
function StepDot({
  index,
  status,
  title,
}: {
  index: number
  status: 'done' | 'current' | 'pending'
  title: string
}) {
  const reduce = useReducedMotion()
  return (
    <div className="flex flex-col items-center">
      <motion.div
        layoutId={`step-${index}`}
        initial={reduce ? false : { scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className={[
          'z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
          status === 'done'
            ? 'border-accent bg-accent text-white'
            : status === 'current'
              ? 'border-accent bg-background text-accent shadow-[0_0_0_4px_rgba(190,18,60,0.1)]'
              : 'border-border bg-surface text-muted',
        ].join(' ')}
        data-step-status={status}
      >
        {status === 'done' ? <CheckOutlined /> : index + 1}
      </motion.div>
      <div
        className={[
          '!mt-2 text-center text-xs',
          status === 'current' ? 'font-semibold text-foreground' : 'text-muted',
        ].join(' ')}
      >
        {title}
      </div>
    </div>
  )
}

export default FormProgress
