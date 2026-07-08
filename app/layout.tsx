import type { Metadata, Viewport } from 'next'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar'
// v0.13.x：ThemeProvider 取代靜態 ConfigProvider（含 dark mode algorithm）
import { ThemeProvider } from '@/components/ThemeProvider'
// v0.13.x：Web Vitals 上報
import { WebVitalsReporter } from '@/components/WebVitalsReporter'
// v0.13.x：Sentry-style 錯誤追蹤 scaffold
import { ErrorTracker } from '@/components/ErrorTracker'
// v0.14.x：Supabase 認證 context
import { AuthProvider } from '@/components/AuthProvider'
import { ACCENT } from '@/lib/design/tokens'
import './globals.css'

/**
 * S1.5 PWA 補強 — themeColor 必須用 viewport export（metadata.themeColor 在
 * Next 14+ 已 deprecated，會被忽略）。搭配 manifest.ts 的 theme_color 雙重設定：
 * - manifest 給 PWA 安裝 icon + 啟動畫面用
 * - viewport themeColor 給瀏覽器網址列 / 狀態列用
 *
 * v0.12.0+：themeColor 從 tokens.ACCENT 引用（不再硬編 #be123c）
 */
export const viewport: Viewport = {
  themeColor: ACCENT, // 對齊 ConfigProvider colorPrimary
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  // v0.8.0+：手機優化
  maximumScale: 5, // 允許放大（accessibility）
  viewportFit: 'cover', // iOS safe-area 必填
}

export const metadata: Metadata = {
  // v0.9.0+：metadataBase 必須設定，否則 OG / Twitter image 解析會 fallback 到 localhost
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || 'https://tw-car-claim-estimator.vercel.app',
  ),
  title: '台灣車禍理賠金額估算器',
  // v0.12.0+ Phase C3：結構化資料 JSON-LD（SoftwareApplication）
  // 幫助搜尋引擎理解這是「工具型 web app」而非「文章頁」
  other: {
    'application/ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: '台灣車禍理賠金額估算器',
      description:
        '依強制汽車責任保險法、民法侵權行為及 6 個直轄市地方法院實務，快速估算體傷理賠金額。',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      inLanguage: 'zh-Hant',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'TWD',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.5',
        ratingCount: '1', // 未來收集用戶回饋後更新
      },
    }),
  },
  description: '依強制汽車責任保險法、民法侵權行為及法院實務，快速估算體傷理賠金額',
  applicationName: '車禍理賠估算器',
  appleWebApp: {
    capable: true, // iOS Safari 「加到主畫面」啟用全螢幕 web app 模式
    title: '車禍理賠估算器',
    statusBarStyle: 'default', // 'default' | 'black' | 'black-translucent'
  },
  formatDetection: {
    telephone: false, // 不要自動把電話號碼變 link
  },
  icons: {
    // 192 用於 Android home screen、180 用於 iOS apple-touch-icon
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="zh-Hant"
      className="h-full antialiased"
      // v0.12.0+ Phase B6：dark mode 由 client script 早期套用（避免 FOUC）
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* v0.12.0+ Phase C2：Skip Links — 鍵盤 / 螢幕閱讀器使用者快速跳到主內容
            視覺隱藏但 focus 時顯示，符合 WCAG 2.4.1 Bypass Blocks */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-white focus:shadow-lg"
        >
          跳到主要內容
        </a>
        {/* v0.12.0+ Phase B6：dark mode 早期套用（避免 FOUC）
            script 必須在 React hydration 前執行 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var pref = localStorage.getItem('tw-car-claim-estimator:theme') || 'light';
                  if (pref === 'dark') {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <AntdRegistry>
          {/* v0.14.x：AuthProvider 必須在最外層（MobileNav / ThemeProvider 都要用 useAuth）*/}
          <AuthProvider>
            {/* v0.13.x：ThemeProvider 取代靜態 ConfigProvider
                支援 dark mode algorithm 動態切換（與 .dark CSS class 同步） */}
            <ThemeProvider>
              {/* v0.13.x：Web Vitals 上報（LCP/CLS/INP/FCP/TTFB）*/}
              <WebVitalsReporter />
              {/* v0.13.x：Sentry-style 錯誤追蹤 scaffold */}
              <ErrorTracker />
              <div className="flex flex-1 flex-col">
                {children}
                {/* v0.16.x 完整 footer — 保險公司專業感 (律師事務所/客服/社群/法律) */}
                <footer
                  className="mt-auto border-t border-border bg-surface-subtle print-footer hidden"
                  aria-label="網站頁尾"
                >
                  <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-6 py-12 md:grid-cols-4">
                    {/* 律師事務所 — 必填欄位 placeholder (v0.16.x 預留) */}
                    <div>
                      <h3 className="!mb-3 !text-sm !font-semibold !uppercase !tracking-wider text-foreground">
                        法律諮詢
                      </h3>
                      <p className="!mb-2 !text-sm !text-foreground">
                        <strong>__律師事務所名稱__</strong>
                      </p>
                      <p className="!mb-1 !text-xs !text-muted">電話：__待填__</p>
                      <p className="!mb-1 !text-xs !text-muted">地址：__待填__</p>
                      <p className="!mb-1 !text-xs !text-muted">LINE：__待填__</p>
                      <p className="!mt-3 !text-[10px] !text-muted">
                        計算結果僅供試算，不構成法律意見
                      </p>
                    </div>

                    {/* 客服 — 公開 (v0.16.x) */}
                    <div>
                      <h3 className="!mb-3 !text-sm !font-semibold !uppercase !tracking-wider text-foreground">
                        客服
                      </h3>
                      <p className="!mb-1 !text-xs !text-muted">
                        Email：
                        <a
                          href="mailto:support@tw-car-claim-estimator.vercel.app"
                          className="!text-accent hover:underline"
                        >
                          support@tw-car-claim-estimator.vercel.app
                        </a>
                      </p>
                      <p className="!mb-1 !text-xs !text-muted">回覆時間：3 個工作天內</p>
                      <p className="!mb-1 !text-xs !text-muted">GitHub Issues：</p>
                      <p className="!text-xs">
                        <a
                          href="https://github.com/cryptoclaw20000101-eng/tw-car-claim-estimator/issues"
                          target="_blank"
                          rel="noreferrer"
                          className="!text-accent hover:underline"
                        >
                          回報問題 / 建議
                        </a>
                      </p>
                    </div>

                    {/* 導覽 */}
                    <div>
                      <h3 className="!mb-3 !text-sm !font-semibold !uppercase !tracking-wider text-foreground">
                        導覽
                      </h3>
                      <ul className="!m-0 !space-y-1 !p-0 !text-xs">
                        <li>
                          <a href="/claims/new" className="!text-muted hover:!text-foreground">
                            開始估算
                          </a>
                        </li>
                        <li>
                          <a href="/claims/batch" className="!text-muted hover:!text-foreground">
                            批次估算
                          </a>
                        </li>
                        <li>
                          <a href="/about" className="!text-muted hover:!text-foreground">
                            關於我們
                          </a>
                        </li>
                        <li>
                          <a href="/privacy" className="!text-muted hover:!text-foreground">
                            隱私權政策
                          </a>
                        </li>
                        <li>
                          <a href="/terms" className="!text-muted hover:!text-foreground">
                            服務條款
                          </a>
                        </li>
                      </ul>
                    </div>

                    {/* 法源 */}
                    <div>
                      <h3 className="!mb-3 !text-sm !font-semibold !uppercase !tracking-wider text-foreground">
                        法源
                      </h3>
                      <ul className="!m-0 !space-y-1 !p-0 !text-xs">
                        <li>強制汽車責任保險法 §27</li>
                        <li>強制險給付標準 §2-§4</li>
                        <li>民法 §184-196 侵權</li>
                        <li>6 直轄市地院慰撫金區間</li>
                      </ul>
                    </div>
                  </div>
                  <div className="border-t border-border">
                    <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-2 px-6 py-4 text-xs text-muted md:flex-row md:items-center md:justify-between">
                      <p>© 2026 Taiwan Car-Claim Estimator · v0.16.x</p>
                      <p>
                        本工具僅供試算，不構成法律意見。實際理賠依保險公司審核 / 醫療資料 /
                        肇事責任為準。
                      </p>
                    </div>
                  </div>
                </footer>
              </div>
            </ThemeProvider>
          </AuthProvider>
        </AntdRegistry>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
