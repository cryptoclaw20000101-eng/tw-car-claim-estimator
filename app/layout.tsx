import type { Metadata, Viewport } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App, ConfigProvider } from "antd";
import zhTW from "antd/locale/zh_TW";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { MobileNav } from "@/components/MobileNav";
import { COLORS, ACCENT, FOREGROUND } from "@/lib/design/tokens";
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
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AntdRegistry>
          <ConfigProvider
            locale={zhTW}
            theme={{
              token: {
                // v0.12.0+：全部從 tokens 引用，不再硬編
                colorPrimary: ACCENT, // rose-700
                colorInfo: COLORS.antInfo, // cyan-700
                colorSuccess: COLORS.positive, // green-800
                colorWarning: COLORS.warning, // amber-700
                colorError: COLORS.negative, // red-800
                colorText: FOREGROUND, // zinc-900
                borderRadius: 8,
                fontFamily: "var(--font-body)",
                fontSize: 14,
              },
              // v0.12.0+：AntD 元件層級 token 擴充
              // 細部元件覆寫（與 taste-skill v1 視覺紀律對齊）
              components: {
                Card: {
                  borderRadiusLG: 12,
                  paddingLG: 24,
                },
                Tag: {
                  borderRadiusSM: 4,
                  fontSize: 12,
                },
                Button: {
                  borderRadius: 8,
                  controlHeight: 40,
                  fontWeight: 500,
                },
                Tabs: {
                  itemActiveColor: ACCENT,
                  itemHoverColor: ACCENT,
                  itemSelectedColor: ACCENT,
                  inkBarColor: ACCENT,
                },
                Alert: {
                  borderRadiusLG: 8,
                },
                Statistic: {
                  titleFontSize: 12,
                  contentFontSize: 24,
                },
                Tooltip: {
                  borderRadius: 6,
                },
              },
            }}
          >
            {/* v0.5.1 bugfix: AntD 6 的 message.error / message.success 是 static function，
                在 dynamic theme 下抓不到 context，會跳警告。要包 <App> 才吃到 ConfigProvider theme。 */}
            <App>
              {/* v0.8.0+：手機 / 桌機導覽列 */}
              <MobileNav />
              {children}
            </App>
          </ConfigProvider>
        </AntdRegistry>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}