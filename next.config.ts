import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  // v0.5.0: Vercel 部署優化
  output: "export", // 靜態 export，Vercel Edge 全球 CDN
  images: {
    // 靜態 export 必須 unoptimized
    unoptimized: true,
  },
  // AGENTS.md §2.4：Next.js 16 breaking changes — reactStrictMode 預設已 true
  reactStrictMode: true,
  // v0.5.0: 環境變數 prefix
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "https://tw-car-claim-estimator.vercel.app",
  },
  // v0.5.1: 允許 LAN 裝置（HMR / dev resources）— Next 16 預設只允 localhost
  // 手機/別台電腦用 http://<你的 IP>:3001 開的時候需要加，否則 webpack-hmr 會被擋
  allowedDevOrigins: ["192.168.1.146", "192.168.1.156", "localhost", "127.0.0.1"],
  // v0.5.0: 標頭由 Vercel 的 vercel.json 控制（output: export 不支援 headers()）
};

export default withBundleAnalyzer(nextConfig);
