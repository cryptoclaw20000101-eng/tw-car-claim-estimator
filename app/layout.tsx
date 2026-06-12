import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import zhTW from "antd/locale/zh_TW";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * S1.5 PWA 補強 — themeColor 必須用 viewport export（metadata.themeColor 在
 * Next 14+ 已 deprecated，會被忽略）。搭配 manifest.ts 的 theme_color 雙重設定：
 * - manifest 給 PWA 安裝 icon + 啟動畫面用
 * - viewport themeColor 給瀏覽器網址列 / 狀態列用
 */
export const viewport: Viewport = {
  themeColor: "#be123c",        // 對齊 ConfigProvider colorPrimary
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AntdRegistry>
          <ConfigProvider
            locale={zhTW}
            theme={{
              token: {
                colorPrimary: "#be123c",  // rose-700 — 對齊 taste-skill v1 單一強調色
                colorInfo: "#0e7490",       // cyan-700 — info 警示用
                colorSuccess: "#166534",   // green-800
                colorWarning: "#b45309",   // amber-700
                colorError: "#991b1b",     // red-800
                borderRadius: 8,
                fontFamily: "var(--font-geist-sans)",
                fontSize: 14,
              },
            }}
          >
            {children}
          </ConfigProvider>
        </AntdRegistry>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
