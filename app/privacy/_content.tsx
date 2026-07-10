'use client'

/**
 * 隱私權政策內容（v0.14.x）
 *
 * 結構：
 * - 概述
 * - 我們蒐集什麼
 * - 我們怎麼用
 * - 我們怎麼保護
 * - 您的權利
 * - Cookie / localStorage
 * - 第三方服務
 * - 聯絡
 */

import Link from 'next/link'
import { Card, Space, Typography } from 'antd'
import { LockOutlined, DeleteOutlined, EyeInvisibleOutlined } from '@ant-design/icons'

const { Title, Paragraph } = Typography

export default function PrivacyContent() {
  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col items-center bg-surface-subtle px-6 py-12"
    >
      <div className="w-full max-w-3xl">
        <Title level={1} className="!mb-2">
          隱私權政策
        </Title>
        <Paragraph type="secondary" className="!mb-6 !text-sm">
          最後更新：2026-07-06
        </Paragraph>

        <Card>
          <Space direction="vertical" size="large" className="!w-full">
            <Section
              title="概述"
              icon={<LockOutlined />}
              content={
                <>
                  <Paragraph>
                    本工具（車禍理賠估算器）是一個<strong>技術透明</strong>的純前端應用。
                    我們遵循「最少資料蒐集」原則：您不需註冊即可使用核心功能。
                  </Paragraph>
                  <Paragraph>
                    登入是<strong>選用</strong>的：未登入時您的估算只存在瀏覽器 localStorage；
                    登入後可同步到 Railway Postgres 雲端，隨時可刪除。
                  </Paragraph>
                </>
              }
            />

            <Section
              title="我們蒐集什麼"
              icon={<EyeInvisibleOutlined />}
              content={
                <>
                  <Paragraph>
                    <strong>估算資料（脫敏後）</strong>：失能等級、肇責比例、估算金額、
                    事故縣市。這些是業務流程必要資訊，
                    <strong>不含姓名、身分證字號、車牌號碼</strong>。
                  </Paragraph>
                  <Paragraph>
                    <strong>技術資料</strong>：瀏覽器類型、IP（Web Vitals 上報時，會自動匿名化）。
                    我們<strong>不追蹤您的身分</strong>。
                  </Paragraph>
                  <Paragraph>
                    <strong>登入 email（選用）</strong>：用 email + password 登入時使用 (v0.19.x+ 從
                    Supabase magic link 切換)。 Email 只用於寄送登入連結，
                    <strong>不會用於行銷或第三方分享</strong>。
                  </Paragraph>
                </>
              }
            />

            <Section
              title="我們怎麼用"
              content={
                <>
                  <Paragraph>
                    <strong>本地（未登入）</strong>：估算資料存在瀏覽器 localStorage， 容量上限 10
                    筆（FIFO 自動驅逐最舊）。清除瀏覽器資料即可刪除。
                  </Paragraph>
                  <Paragraph>
                    <strong>雲端（登入時）</strong>：存在 Railway Postgres DB (v0.17.x+)。 啟用
                    App-Level Security（RLS），只有您自己能讀寫自己的估算。
                  </Paragraph>
                  <Paragraph>
                    <strong>用途</strong>：純粹跨裝置同步您的估算記錄。<strong>不</strong>用於：
                    廣告投放 · 用戶分析 · 第三方資料分享 · AI 訓練。
                  </Paragraph>
                </>
              }
            />

            <Section
              title="我們怎麼保護"
              icon={<LockOutlined />}
              content={
                <>
                  <Paragraph>
                    <strong>傳輸加密</strong>：全站 HTTPS（含 HSTS preload）。
                  </Paragraph>
                  <Paragraph>
                    <strong>資料加密</strong>：Railway 提供 TLS 1.2+ 傳輸加密 + 靜態加密（at
                    rest）。
                  </Paragraph>
                  <Paragraph>
                    <strong>存取控制</strong>：App-Level Filter (WHERE user_id = $1) 取代 RLS
                    確保只有您能存取自己的資料。
                  </Paragraph>
                  <Paragraph>
                    <strong>安全標頭</strong>：X-Frame-Options（防 clickjacking）、
                    X-Content-Type-Options（防 MIME sniffing）、 Referrer-Policy（防 referrer
                    洩漏）。
                  </Paragraph>
                </>
              }
            />

            <Section
              title="您的權利"
              icon={<DeleteOutlined />}
              content={
                <>
                  <Paragraph>
                    <strong>查看</strong>：首頁「最近估算過的案件」可看雲端所有估算。
                  </Paragraph>
                  <Paragraph>
                    <strong>刪除</strong>：點「清空」按鈕可一鍵刪除所有雲端估算。
                  </Paragraph>
                  <Paragraph>
                    <strong>匯出</strong>：點「複製結果 CSV」可下載單筆估算。
                  </Paragraph>
                  <Paragraph>
                    <strong>帳號刪除</strong>：登出後聯絡我們（見下方）可永久刪除 Railway 帳號。
                  </Paragraph>
                </>
              }
            />

            <Section
              title="Cookie / localStorage 使用"
              content={
                <>
                  <Paragraph>
                    <strong>不使用第三方追蹤 cookie</strong>（沒 GA、沒 Facebook Pixel）。
                  </Paragraph>
                  <Paragraph>
                    <strong>localStorage</strong>：僅存估算記錄（脫敏）+ 主題偏好（light/dark）。
                    可隨時清除。
                  </Paragraph>
                  <Paragraph>
                    <strong>Service Worker</strong>：用於離線快取（v0.13.x），不追蹤。
                  </Paragraph>
                </>
              }
            />

            <Section
              title="第三方服務"
              content={
                <>
                  <Paragraph>
                    <strong>Railway</strong>：雲端 PostgreSQL + 自寫 JWT 認證（v0.17.x+，避免
                    Supabase vendor lock-in）。 隱私權政策：{' '}
                    <a
                      href="https://supabase.com/privacy"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-accent hover:underline"
                    >
                      supabase.com/privacy
                    </a>
                  </Paragraph>
                  <Paragraph>
                    <strong>Vercel</strong>：靜態網站 hosting（CDN 邊緣節點）。 隱私權政策：{' '}
                    <a
                      href="https://vercel.com/legal/privacy-policy"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-accent hover:underline"
                    >
                      vercel.com/legal/privacy-policy
                    </a>
                  </Paragraph>
                </>
              }
            />

            <Section
              title="聯絡"
              content={
                <Paragraph>
                  隱私權問題：請在 GitHub repo 開 issue（open source 專案）。
                  <br />
                  <Link href="/" className="text-accent hover:underline">
                    ← 回首頁
                  </Link>
                </Paragraph>
              }
            />
          </Space>
        </Card>

        <Paragraph type="secondary" className="!mt-6 !text-center !text-xs">
          ※ 本文件為技術透明性說明，非正式法律建議。正式法律文件請諮詢執業律師。
        </Paragraph>
      </div>
    </main>
  )
}

function Section({
  title,
  icon,
  content,
}: {
  title: string
  icon?: React.ReactNode
  content: React.ReactNode
}) {
  return (
    <div>
      <Title level={3} className="!mb-2 !flex !items-center !gap-2 !text-xl">
        {icon}
        {title}
      </Title>
      <div>{content}</div>
    </div>
  )
}
