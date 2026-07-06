export const dynamic = 'force-static'

import { ImageResponse } from 'next/og'
import { ACCENT, BACKGROUND } from '@/lib/design/tokens'

/**
 * Twitter card image — 自動生成 1200x630（v0.9.0+ 新增）
 * 對應 <meta name="twitter:image"> 在 page metadata 引用
 *
 * 設計同 opengraph-image，但簡化版（Twitter card 顯示較小）
 */

export const runtime = 'nodejs'
export const alt = '台灣車禍理賠金額估算器'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function TwitterImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: BACKGROUND,
        padding: 80,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", "Microsoft JhengHei", sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          fontSize: 80,
          fontWeight: 700,
          color: '#18181b',
          letterSpacing: '-0.02em',
          marginBottom: 24,
          textAlign: 'center',
        }}
      >
        車禍理賠金額估算器
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 40,
          color: ACCENT,
          fontWeight: 600,
        }}
      >
        5 分鐘算給你看
      </div>
    </div>,
    { ...size },
  )
}
