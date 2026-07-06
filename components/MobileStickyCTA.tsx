/**
 * MobileStickyCTA — v0.8.1+ 表單底部固定 CTA
 *
 * 設計目的：
 *   v0.8.0 加了 safe-area / mobile 字體，但「下一步 / 上一步」按鈕在
 *   手機長表單最下方要捲很久才看到。這個元件把按鈕固定在底部：
 *   - 桌機 (≥ 768px)：不固定（保留原本滾到底才看到）
 *   - 手機 (< 768px)：固定底部 + safe-area-inset-bottom + 軟陰影
 *
 * 用法：
 *   <MobileStickyCTA
 *     left={<Button onClick={prev}>上一步</Button>}
 *     right={<Button type="primary" onClick={next}>下一步</Button>}
 *   />
 *
 * 不變量：
 *   - 桌機版 → 回傳純 children wrapper（不套 sticky class）
 *   - 手機版 → 套 .mobile-sticky-cta + safe-bottom
 *   - SSR 安全（純 CSS class，無 JS 偵測）
 */

'use client'

import type { ReactNode } from 'react'

export interface MobileStickyCTAProps {
  /** 左側按鈕（通常「上一步」或「取消」） */
  left?: ReactNode
  /** 右側按鈕（通常「下一步」或「送出」，primary） */
  right?: ReactNode
}

export function MobileStickyCTA({ left, right }: MobileStickyCTAProps) {
  return (
    <div className="mobile-sticky-cta md:static md:bg-transparent md:border-0 md:shadow-none md:p-0 md:mt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">{left}</div>
        <div className="flex-1">{right}</div>
      </div>
    </div>
  )
}
