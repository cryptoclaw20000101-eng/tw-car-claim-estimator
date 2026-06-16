import type { NextConfig } from "next";

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
  // v0.5.0: 標頭由 Vercel 的 vercel.json 控制（output: export 不支援 headers()）
};

export default nextConfig;
