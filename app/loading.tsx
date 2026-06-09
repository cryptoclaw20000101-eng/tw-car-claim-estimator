/**
 * 全站 Loading 邊界 — taste-skill v1 anti-slop 紀律：
 * - 不用菊花轉圈（AI 預設，視覺無感）
 * - 骨架屏 = 真實 layout 的形狀（layout-aware skeleton）
 * - 對齊偏左（variance 8）→ 模擬首頁 hero 的 7fr+5fr bento
 * - 數字 / 標籤處用 tabular-nums
 * - 零 emoji
 *
 * 技術備註：AntD 6 的 Skeleton.Input / Skeleton.Button 在 Next 16 + Turbopack
 * 的 SSR prerender 階段會 `Element type is invalid: got: undefined.`
 * （Turbopack 對 Skeleton 靜態屬性解析有 bug）。改用 <Skeleton active>
 * 配合 wrapper div 控制寬度規避。
 */
import { Skeleton } from 'antd'

export default function Loading() {
  return (
    <main className="dvh-screen flex flex-1 flex-col">
      {/* Hero 骨架（偏左 7fr + 右側 5fr 卡片） */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-6 py-16 md:grid-cols-12 md:py-24">
          <div className="md:col-span-7">
            <div className="!mb-4 w-48">
              <Skeleton active paragraph={{ rows: 0 }} />
            </div>
            <div className="!mb-8 w-2/3">
              <Skeleton active title={false} paragraph={{ rows: 1 }} />
            </div>
            <div className="!mb-8 w-3/5">
              <Skeleton active title={false} paragraph={{ rows: 1 }} />
            </div>
            <div className="flex gap-3">
              <div className="!h-10 !w-40 rounded-md bg-gray-200/60" />
              <div className="!h-10 !w-32 rounded-md bg-gray-200/60" />
            </div>
            <div className="mt-10 flex flex-wrap gap-x-12 gap-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="!h-7 !w-12 rounded-md bg-gray-200/60" />
                  <div className="!h-4 !w-24 rounded-md bg-gray-200/60" />
                </div>
              ))}
            </div>
          </div>
          <div className="md:col-span-5">
            <div className="rounded-lg border border-border bg-surface p-6">
              <div className="!mb-3 !h-4 !w-24 rounded-md bg-gray-200/60" />
              <Skeleton active paragraph={{ rows: 4 }} />
            </div>
            <div className="mt-3 rounded-lg border border-border bg-surface-subtle p-4">
              <div className="!mb-2 !h-3 !w-20 rounded-md bg-gray-200/60" />
              <div className="!h-3 !w-full rounded-md bg-gray-200/60" />
            </div>
          </div>
        </div>
      </section>

      {/* 5 區 bento 骨架（2fr+1fr 上面 + 1fr/1fr/1fr/1fr 下面） */}
      <section className="bg-surface-subtle">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <div className="!mb-3 !h-4 !w-40 rounded-md bg-gray-200/60" />
          <div className="!mb-10 w-2/3">
            <Skeleton active title paragraph={{ rows: 1 }} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-2">
            {/* 主格 2fr */}
            <div className="rounded-lg border border-border bg-surface p-6 md:col-span-2 md:row-span-2">
              <Skeleton active paragraph={{ rows: 6 }} />
            </div>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border border-border bg-surface p-6">
                <Skeleton active paragraph={{ rows: 3 }} />
              </div>
            ))}
            <div className="hidden rounded-lg border border-dashed border-border md:flex md:items-center md:justify-center">
              <div className="!h-3 !w-40 rounded-md bg-gray-200/60" />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
