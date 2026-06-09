/**
 * InfoAlert — 包裝 AntD Alert，自動解 deprecated `message` prop
 *
 * 設計目的：
 *   AntD 6 把 `message` / `description` 改名 `title` / `body`，
 *   21 處手改極易漏，且 `message → title` 會改變視覺結構（標題浮到頂）。
 *
 *   本元件封裝在 `components/InfoAlert.tsx`，所有頁面用
 *   `<InfoAlert type="info" title="..." body="..." />` 一致介面，
 *   內部仍呼叫 AntD `Alert`，但 prop 走新名稱。
 *
 * 限制：
 *   - 不支援 `Icon` 自訂 icon（用 AntD 預設 type icon 就好）
 *   - 不支援 `closable` / `action` 等進階 prop（21 處沒用到）
 *   - description 仍可加（optional 第二段詳細說明）
 */
'use client'

import { Alert, type AlertProps } from 'antd'

export interface InfoAlertProps {
  type?: AlertProps['type']
  title: React.ReactNode
  body?: React.ReactNode
  showIcon?: boolean
  className?: string
}

export function InfoAlert({ type = 'info', title, body, showIcon, className }: InfoAlertProps) {
  return (
    <Alert
      type={type}
      title={title}
      description={body}
      showIcon={showIcon}
      className={className}
    />
  )
}

export default InfoAlert
