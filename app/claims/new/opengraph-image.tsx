export const dynamic = 'force-static'

import { ImageResponse } from 'next/og'
import { ACCENT, BACKGROUND } from '@/lib/design/tokens'

/**
 * /claims/new 專用 OG image（v0.12.0+ Phase C4）
 * 強調「開始估算 · 7 步驟」CTA 視覺
 */

export const alt = '開始估算 — 7 步驟輸入資料 | 車禍理賠估算器'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: BACKGROUND,
        padding: 80,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", "Microsoft JhengHei", sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          color: ACCENT,
          fontSize: 22,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          marginBottom: 32,
        }}
      >
        7 步驟表單
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          color: '#18181b',
          fontSize: 84,
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          marginBottom: 24,
        }}
      >
        <span>開始估算</span>
        <span style={{ color: ACCENT }}>5 分鐘算給你看</span>
      </div>

      <div
        style={{
          display: 'flex',
          color: '#52525b',
          fontSize: 28,
          lineHeight: 1.5,
          maxWidth: 900,
        }}
      >
        事故基本 → 肇責 → 醫療 → 車損 → 地區，邊填邊預覽相似判例。
      </div>

      {/* 7 steps 進度條示意 */}
      <div
        style={{
          display: 'flex',
          marginTop: 'auto',
          gap: 12,
        }}
      >
        {['①', '②', '③', '④', '⑤', '⑥', '⑦'].map((n) => (
          <div
            key={n}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: '#ffffff',
              border: `2px solid ${ACCENT}`,
              color: ACCENT,
              fontSize: 22,
              fontWeight: 600,
            }}
          >
            {n}
          </div>
        ))}
      </div>
    </div>,
    { ...size },
  )
}
