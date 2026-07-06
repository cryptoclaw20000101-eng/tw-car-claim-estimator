/**
 * InfoAlert — 包裝 AntD Alert，提供統一 props 介面（v0.10.0+ 加 closable + onClose）
 *
 * 設計目的：
 *   統一全專案 Alert 呼叫端的 props 介面，避免散落在各頁面。
 *   內部仍呼叫 AntD `Alert` 的 description prop。
 *
 * v0.10.0+ 新增：
 *   - closable + onClose：可選關閉按鈕，呼叫端控制關閉後行為
 *   - 對應 AntD Alert 的 closable / onClose props
 *
 * 介面：
 *   `<InfoAlert type="info" title="..." body="..." closable onClose={fn} />`
 *   內部把 `body` 對應到 AntD `Alert` 的 `description` prop。
 */
'use client'

import { Alert, type AlertProps } from 'antd'

export interface InfoAlertProps {
  type?: AlertProps['type']
  title: React.ReactNode
  body?: React.ReactNode
  showIcon?: boolean
  className?: string
  /** v0.10.0+：是否顯示關閉按鈕 */
  closable?: boolean
  /** v0.10.0+：關閉事件（搭配 closable=true 用） */
  onClose?: (e: React.MouseEvent<HTMLButtonElement>) => void
}

export function InfoAlert({
  type = 'info',
  title,
  body,
  showIcon,
  className,
  closable,
  onClose,
}: InfoAlertProps) {
  return (
    <Alert
      type={type}
      title={title}
      description={body}
      showIcon={showIcon}
      className={className}
      closable={closable}
      onClose={onClose}
    />
  )
}

export default InfoAlert
