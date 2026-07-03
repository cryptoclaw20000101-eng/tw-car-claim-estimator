export const dynamic = 'force-static'

import { ImageResponse } from 'next/og'
import { ACCENT, BACKGROUND } from '@/lib/design/tokens'

/**
 * /claims/result 專用 OG image（v0.12.0+ Phase C4）
 * 強調「5 區估算結果」與「精神慰撫金三票共識」
 */

export const alt = '估算結果 — 5 區明細 | 車禍理賠估算器'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: BACKGROUND,
          padding: 80,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", "Microsoft JhengHei", sans-serif',
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
          估算結果
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
          <span>5 區明細</span>
          <span style={{ color: ACCENT }}>三票共識 + 200+ 判例</span>
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
          強制險、失能、第三人責任險、補件、地區實務 — 含 Ensemble 三票 + 歷史判例比對。
        </div>

        {/* 5 區塊 chips */}
        <div
          style={{
            display: 'flex',
            marginTop: 'auto',
            gap: 16,
            color: '#18181b',
            fontSize: 22,
          }}
        >
          <Chip>強制險</Chip>
          <Chip>失能初篩</Chip>
          <Chip>第三人責任險</Chip>
          <Chip>補件清單</Chip>
          <Chip>地區實務</Chip>
        </div>
      </div>
    ),
    { ...size }
  )
}

function Chip({ children }: { children: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 20px',
        borderRadius: 999,
        backgroundColor: '#ffffff',
        border: '1px solid #e4e4e7',
        color: '#18181b',
        fontSize: 22,
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  )
}