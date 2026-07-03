export const dynamic = 'force-static'

import { ImageResponse } from 'next/og'
import { ACCENT, BACKGROUND } from '@/lib/design/tokens'

/**
 * OG image — 自動生成 1200x630（v0.9.0+ 新增）
 * 對應 <meta property="og:image"> 在 page metadata 引用
 *
 * 設計對齊首頁品牌：
 * - 背景 stone-50 (#fafaf9)
 * - 標題 zinc-900 + 強調 rose-700
 * - 系統字體棧（不依賴 Google Fonts 下載，AGENTS §15）
 *
 * 注意：next/og 內建，不需額外依賴
 */

export const runtime = 'nodejs' // ImageResponse 預設
export const alt = '台灣車禍理賠金額估算器 — 5 分鐘算給你看'
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
          padding: '80px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", "Microsoft JhengHei", sans-serif',
        }}
      >
        {/* 頂部 eyebrow */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            color: '#71717a',
            fontSize: 20,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom: 24,
          }}
        >
          <span>v0.9.0 · TAIWAN CAR-CLAIM ESTIMATOR</span>
        </div>

        {/* 主標題 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            color: '#18181b',
            fontSize: 88,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            marginBottom: 32,
          }}
        >
          <span>車禍理賠金額，</span>
          <span style={{ display: 'flex' }}>
            <span style={{ color: ACCENT }}>5 分鐘</span>
            <span>&nbsp;算給你看。</span>
          </span>
        </div>

        {/* 副標題 */}
        <div
          style={{
            display: 'flex',
            color: '#52525b',
            fontSize: 32,
            lineHeight: 1.4,
            maxWidth: 900,
          }}
        >
          強制汽車責任保險法 · 民法侵權行為 · 6 直轄市地方法院實務
        </div>

        {/* 底部 5 區塊 chips */}
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