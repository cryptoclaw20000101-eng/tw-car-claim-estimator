import type { Metadata, Viewport } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
// v0.13.x：ThemeProvider 取代靜態 ConfigProvider（含 dark mode algorithm）
import { ThemeProvider } from "@/components/ThemeProvider";
import { ACCENT } from "@/lib/design/tokens";
import "./globals.css";

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
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  // v0.8.0+：手機優化
  maximumScale: 5,              // 允許放大（accessibility）
  viewportFit: "cover",        // iOS safe-area 必填
};

export const metadata: Metadata = {
  // v0.9.0+：metadataBase 必須設定，否則 OG / Twitter image 解析會 fallback 到 localhost
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://tw-car-claim-estimator.vercel.app",
  ),
  title: "台灣車禍理賠金額估算器",
  // v0.12.0+ Phase C3：結構化資料 JSON-LD（SoftwareApplication）
  // 幫助搜尋引擎理解這是「工具型 web app」而非「文章頁」
  other: {
    'application/ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: '台灣車禍理賠金額估算器',
      description: '依強制汽車責任保險法、民法侵權行為及 6 個直轄市地方法院實務，快速估算體傷理賠金額。',
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
  description: "依強制汽車責任保險法、民法侵權行為及法院實務，快速估算體傷理賠金額",
  applicationName: "車禍理賠估算器",
  appleWebApp: {
    capable: true,               // iOS Safari 「加到主畫面」啟用全螢幕 web app 模式
    title: "車禍理賠估算器",
    statusBarStyle: "default",   // 'default' | 'black' | 'black-translucent'
  },
  formatDetection: {
    telephone: false,            // 不要自動把電話號碼變 link
  },
  icons: {
    // 192 用於 Android home screen、180 用於 iOS apple-touch-icon
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
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
          {/* v0.13.x：ThemeProvider 取代靜態 ConfigProvider
              支援 dark mode algorithm 動態切換（與 .dark CSS class 同步） */}
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AntdRegistry>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}