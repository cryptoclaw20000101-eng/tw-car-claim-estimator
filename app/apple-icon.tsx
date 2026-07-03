export const dynamic = 'force-static'

import { ImageResponse } from 'next/og'

/**
 * Apple touch icon — 自動生成 180x180（v0.9.0+ 新增）
 * 對應 iOS Safari「加到主畫面」使用的獨立 180px 圖示
 * 原本是用 icon-192.png 充當，但 iOS 偏好 180×180
 */

export const runtime = 'nodejs'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default async function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#be123c',
          borderRadius: 32,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontWeight: 700,
          color: '#ffffff',
          fontSize: 96,
          letterSpacing: '-0.04em',
        }}
      >
        車
      </div>
    ),
    { ...size }
  )
}