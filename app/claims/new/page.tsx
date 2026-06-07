'use client'

import dynamic from 'next/dynamic'

// AntD Form / Table 等依賴 client React context，必須 client runtime
const NewClaimForm = dynamic(() => import('./_form'), {
  ssr: false,
  loading: () => <div className="p-12 text-center text-zinc-500">載入中…</div>,
})

export default function NewClaimPage() {
  return <NewClaimForm />
}
