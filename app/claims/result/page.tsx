'use client'

import dynamic from 'next/dynamic'

// 結果頁依賴 sessionStorage + AntD Table / Statistic
const ResultForm = dynamic(() => import('./_form'), {
  ssr: false,
  loading: () => <div className="p-12 text-center text-zinc-500">載入中…</div>,
})

export default function ResultPage() {
  return <ResultForm />
}
