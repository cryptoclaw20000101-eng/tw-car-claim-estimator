/**
 * /claims/result 專用 Loading — 模擬真實結果頁 layout：
 * - 4 欄 Hero Stat 骨架（2fr+1fr+1fr 不對稱，刻意重現 result/_form.tsx 的 Hero Stat）
 * - 7 個 Tabs 骨架（card 樣，模擬 Tabs type="card"）
 * - 各 Tab 內 Section 標題 + 4 個 Statistic 骨架
 *
 * taste-skill v1 anti-slop 紀律：
 * - layout-aware skeleton（不是菊花轉圈）
 * - 對齊偏左、tabular-nums
 * - 零 emoji
 *
 * 技術備註：AntD 6 的 Skeleton.Input / Skeleton.Button 在 Next 16 + Turbopack
 * 的 SSR prerender 階段會 `Element type is invalid: got: undefined.`
 * （Turbopack 對 Skeleton 靜態屬性解析有 bug）。改用 <Skeleton active>
 * 配合 wrapper div 控制寬度規避。
 */
import { Skeleton } from 'antd'

export default function ResultLoading() {
  return (
    <main className="flex flex-1 flex-col items-center bg-surface-subtle px-6 py-8">
      <div className="w-full max-w-4xl">
        {/* 操作列骨架（兩個按鈕 — 用純 div 模擬） */}
        <div className="!mb-6 flex items-center justify-between">
          <div className="!h-7 !w-24 rounded-md bg-gray-200/60" />
          <div className="!h-7 !w-32 rounded-md bg-gray-200/60" />
        </div>

        {/* 標題骨架 */}
        <div className="!mb-4">
          <div className="!mb-2 !h-7 !w-48 rounded-md bg-gray-200/60" />
          <div className="!h-3 !w-96 rounded-md bg-gray-200/60" />
        </div>

        {/* 免責 Alert 骨架（不顯示 icon） */}
        <div className="!mb-6 rounded-md border border-border bg-surface p-4">
          <Skeleton active paragraph={{ rows: 2 }} title={false} />
        </div>

        {/* Hero Stat 4 欄骨架（2fr+1fr+1fr 不對稱） */}
        <div className="!mb-6 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-4">
          {/* 主格 2fr */}
          <div className="bg-surface p-5 md:col-span-2">
            <div className="!mb-2 !h-3 !w-32 rounded-md bg-gray-200/60" />
            <div className="!mb-2 !h-9 !w-56 rounded-md bg-gray-200/60" />
            <div className="!h-3 !w-72 rounded-md bg-gray-200/60" />
          </div>
          <div className="bg-surface p-5">
            <div className="!mb-2 !h-3 !w-24 rounded-md bg-gray-200/60" />
            <div className="!mb-2 !h-7 !w-40 rounded-md bg-gray-200/60" />
            <div className="!h-3 !w-48 rounded-md bg-gray-200/60" />
          </div>
          <div className="bg-surface p-5">
            <div className="!mb-2 !h-3 !w-20 rounded-md bg-gray-200/60" />
            <div className="!mb-2 !h-7 !w-24 rounded-md bg-gray-200/60" />
            <div className="!h-3 !w-40 rounded-md bg-gray-200/60" />
          </div>
        </div>

        {/* Tabs 7 個骨架（card 樣） */}
        <div className="!mb-4 flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className={[
                '!h-8 rounded-md bg-gray-200/60',
                i === 0 ? '!w-32' : '!w-24',
              ].join(' ')}
            />
          ))}
        </div>

        {/* Tab 內容骨架（4 個 Statistic + 說明文字） */}
        <div className="rounded-lg border border-border bg-surface p-6">
          <div className="!mb-4 w-1/3">
            <Skeleton active title paragraph={{ rows: 1 }} />
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <div className="!mb-2 !h-3 !w-20 rounded-md bg-gray-200/60" />
                <div className="!h-7 !w-24 rounded-md bg-gray-200/60" />
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Skeleton active paragraph={{ rows: 3 }} title={false} />
          </div>
        </div>
      </div>
    </main>
  )
}
