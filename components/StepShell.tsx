/**
 * StepShell — v0.5.5 共用 Step 元件（A2 重構抽出）
 *
 * 統一包裝 Step1-Step7 的 Card + InfoAlert + 標題 icon pattern。
 * 原本每個 Step 都自己 <Card title={...}><InfoAlert ... /></Card>，重複 6+ 次。
 *
 * 用法:
 *   <StepShell icon={<CarOutlined />} title="事故基本資料" alertType="info"
 *     alertTitle="強制險採無過失主義...">
 *     <Row>...</Row>
 *   </StepShell>
 *
 * 設計: Alert type 預設 'info'；body 為 undefined 時不渲染第二段。
 */
import type { ReactNode } from 'react'
import { Card } from 'antd'
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
}

export function StepShell({ icon, title, alertType = 'info', alertTitle, alertBody, children }: StepShellProps) {
  return (
    <Card title={<>{icon}<span className="ml-2">{title}</span></>}>
      <InfoAlert
        type={alertType}
        showIcon
        className="!mb-4"
        title={alertTitle}
        {...(alertBody ? { body: alertBody } : {})}
      />
      {children}
    </Card>
  )
}