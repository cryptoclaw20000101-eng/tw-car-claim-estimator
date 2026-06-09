import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import zhTW from "antd/locale/zh_TW";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "台灣車禍理賠金額估算器",
  description: "依強制汽車責任保險法、民法侵權行為及法院實務，快速估算體傷理賠金額",
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
      </body>
    </html>
  );
}
