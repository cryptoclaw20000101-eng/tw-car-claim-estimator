/**
 * 全站 Loading 邊界 — taste-skill v1 anti-slop 紀律（v0.11.0+ 改用自製 Skeleton）
 *
 * - 不用菊花轉圈（AI 預設，視覺無感）
 * - 骨架屏 = 真實 layout 的形狀（layout-aware skeleton）
 * - 對齊偏左（variance 8）→ 模擬首頁 hero 的 7fr+5fr bento
 * - 數字 / 標籤處用 tabular-nums
 * - 零 emoji
 *
 * v0.11.0+ 改動：
 *   - 改用 components/Skeleton 自製元件（取代 AntD Skeleton）
 *   - AntD 6 Skeleton 在 Next 16 Turbopack SSR 有 bug
 *   - 自製元件 client mount 後才跑 pulse 動畫（避免 hydration mismatch）
 */
import { Skeleton, SkeletonBlock } from '@/components/Skeleton'

export default function Loading() {
  return (
    <main className="dvh-screen flex flex-1 flex-col">
      {/* Hero 骨架（偏左 7fr + 右側 5fr 卡片） */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-6 py-16 md:grid-cols-12 md:py-24">
          <div className="md:col-span-7">
            <div className="!mb-4">
              <Skeleton width="w-48" height="h-4" />
            </div>
            <div className="!mb-8">
              <Skeleton width="w-2/3" height="h-10" />
            </div>
            <div className="!mb-8">
              <SkeletonBlock rows={2} widths={['w-3/5', 'w-1/2']} />
            </div>
            <div className="flex gap-3">
              <Skeleton width="w-40" height="h-10" />
              <Skeleton width="w-32" height="h-10" />
            </div>
            <div className="mt-10 flex flex-wrap gap-x-12 gap-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <Skeleton width="w-12" height="h-7" />
                  <Skeleton width="w-24" height="h-4" />
                </div>
              ))}
            </div>
          </div>
          <div className="md:col-span-5">
            {/* v0.11.0+：Ensemble 主格 accent border skeleton */}
            <div className="rounded-lg border-2 border-accent/30 bg-surface p-5">
              <Skeleton width="w-32" height="h-3" />
              <div className="!mt-3">
                <SkeletonBlock rows={2} />
              </div>
            </div>
            {/* 次格 2 欄並排 */}
            <div className="!mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface p-4">
                <Skeleton width="w-20" height="h-3" />
                <div className="!mt-2">
                  <SkeletonBlock rows={4} widths={['w-full', 'w-3/4', 'w-full', 'w-2/3']} />
                </div>
              </div>
              <div className="rounded-lg border border-border bg-surface-subtle p-4">
                <Skeleton width="w-16" height="h-3" />
                <div className="!mt-2">
                  <SkeletonBlock rows={2} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5 區 bento 骨架（2fr+1fr 上面 + 1fr/1fr/1fr 下面） */}
      <section className="bg-surface-subtle">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <Skeleton width="w-40" height="h-4" />
          <div className="!mt-3 !mb-10">
            <Skeleton width="w-2/3" height="h-7" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-2">
            {/* 主格 2fr */}
            <div className="rounded-lg border border-border bg-surface p-6 md:col-span-2 md:row-span-2">
              <SkeletonBlock rows={6} />
            </div>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border border-border bg-surface p-6">
                <SkeletonBlock rows={3} />
              </div>
            ))}
            <div className="hidden rounded-lg border border-dashed border-border md:flex md:items-center md:justify-center">
              <Skeleton width="w-40" height="h-3" />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
