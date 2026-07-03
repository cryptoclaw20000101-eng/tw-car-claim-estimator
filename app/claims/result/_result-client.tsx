'use client'

import dynamic from 'next/dynamic'

/**
 * /claims/result 的 client wrapper（v0.9.0+ 新增）
 *
 * 為什麼需要這個檔：
 * - result/_form.tsx 在 render 階段透過 useState lazy initializer 讀 sessionStorage
 * - 必須 ssr:false 才能避免 SSR 期 sessionStorage 存取錯誤
 * - 但 Next.js 16 不允許 server component 使用 ssr:false 動態 import
 * - 解法：把 dynamic + ssr:false 包在 client wrapper 裡
 *
 * 對應 page.tsx（server）→ render <ResultClient />
 *                  → dynamic + ssr:false
 *                  → result/_form.tsx（client, 'use client'）
 */
const ResultForm = dynamic(() => import('./_form'), {
  ssr: false,
  loading: () => <div className="p-12 text-center text-zinc-500">載入中…</div>,
})

export default function ResultClient() {
  return <ResultForm />
}