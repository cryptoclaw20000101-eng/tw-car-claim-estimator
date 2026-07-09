import type { NextConfig } from 'next'
import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig: NextConfig = {
  // v0.16.x：拿掉 output: 'export' 改用 Vercel 標準 Next.js 部署
  // 原因：Next.js 16 + Vercel static export 找 routes-manifest.json 失敗
  // 拿掉後 build 產 .next/ 含 manifest, Vercel 自動偵測並 deploy
  // 副作用：advisor route 變可訪問 (但仍走 mockLLMAdvisor, 0 cost)
  // 參考：AGENTS.md §13 部署矩陣 (Vercel Edge CDN 仍運作, 只是改成 serverful 部署)
  // images.unoptimized 保留 (即使 serverful 也不影響)
  images: {
    unoptimized: true,
  },
  // AGENTS.md §2.4：Next.js 16 breaking changes — reactStrictMode 預設已 true
  reactStrictMode: true,
  // v0.5.0: 環境變數 prefix
  env: {
    NEXT_PUBLIC_SITE_URL:
      process.env.NEXT_PUBLIC_SITE_URL || 'https://tw-car-claim-estimator.vercel.app',
  },
  // v0.5.1: 允許 LAN 裝置（HMR / dev resources）— Next 16 預設只允 localhost
  // 手機/別台電腦用 http://<你的 IP>:3001 開的時候需要加，否則 webpack-hmr 會被擋
  allowedDevOrigins: ['192.168.1.146', '192.168.1.156', 'localhost', '127.0.0.1'],
  // v0.5.0: 標頭由 Vercel 的 vercel.json 控制（output: export 不支援大部分 headers()）
  // v0.13.x：仍可設 runtime 安全標頭（next.config headers() 在 export mode 部分支援）
  // CSP / X-Frame-Options 由 vercel.json 在部署端控制
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
  // v0.17.x：3 個 redirect 從舊路徑到新路徑（/home /estimate /result → canonical）
  // 原本在 vercel.json (Vercel-only), Railway 不支援, 改用 Next.js 16 內建 redirects
  async redirects() {
    return [
      { source: '/home', destination: '/', permanent: true },
      { source: '/estimate', destination: '/claims/new', permanent: true },
      { source: '/result', destination: '/claims/result', permanent: true },
    ]
  },
}

export default withBundleAnalyzer(nextConfig)
