/**
 * 全站 404 — taste-skill v1 anti-slop 紀律：
 * - 不死路（給兩條出路）
 * - 對齊偏左 + bento 不對稱
 * - tabular-nums 用在「404」大數字
 * - 零 emoji、零 AntD icon（避免 Next 16 SSR 雙檔 createContext 雷）
 * - 全用 inline SVG + 純 Tailwind，不依賴 React Context
 */
import Link from 'next/link'
import { Compass, House, PenLine, Search } from 'lucide-react'

export default function NotFound() {
  return (
    <main id="main-content" className="flex min-h-[100dvh] flex-1 flex-col items-center px-6 py-16 md:py-24">
      <div className="w-full max-w-6xl">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:grid-rows-2">
          {/* 404 主格（2fr × 2fr） — v0.11.0+ 加 accent decoration */}
          <div className="rounded-lg border border-border bg-surface p-10 md:col-span-2 md:row-span-2">
            <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-accent">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              <Compass className="h-3.5 w-3.5" aria-hidden />
              <span>404 · Page Not Found</span>
            </div>
            <div className="tabular-nums text-7xl font-semibold leading-none tracking-tight text-foreground md:text-9xl">
              404
            </div>
            {/* v0.11.0+：404 數字下方 accent 細線裝飾 */}
            <div aria-hidden className="mt-4 h-px w-24 bg-accent" />
            <h1 className="mb-3 mt-6 text-3xl font-semibold leading-tight tracking-tight text-foreground md:text-4xl">
              這個頁面不存在
            </h1>
            <p className="mb-6 text-base text-muted">
              連結可能已失效，或你輸入了不存在的路徑。
              <br />
              想做的事，從這兩條路開始：
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-strong"
              >
                <House className="h-4 w-4" aria-hidden />
                回到首頁
              </Link>
              <Link
                href="/claims/new"
                className="inline-flex h-11 items-center gap-2 rounded-md border border-border-strong bg-surface px-5 text-sm font-medium text-foreground transition-colors hover:bg-surface-subtle"
              >
                <PenLine className="h-4 w-4" aria-hidden />
                直接開始估算
              </Link>
            </div>
          </div>

          {/* 次格 1：常見路徑 */}
          <div className="rounded-lg border border-border bg-surface p-6">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted">
              <Search className="h-3.5 w-3.5" aria-hidden />
              <span>常見路徑</span>
            </div>
            <ul className="m-0 space-y-1.5 text-sm">
              <li>
                <Link href="/" className="text-accent hover:underline">
                  /
                </Link>
                <span className="ml-2 text-xs text-muted">首頁</span>
              </li>
              <li>
                <Link href="/claims/new" className="text-accent hover:underline">
                  /claims/new
                </Link>
                <span className="ml-2 text-xs text-muted">新增估算（7 步表單）</span>
              </li>
              <li>
                <Link href="/claims/result" className="text-accent hover:underline">
                  /claims/result
                </Link>
                <span className="ml-2 text-xs text-muted">估算結果（需 sessionStorage）</span>
              </li>
            </ul>
          </div>

          {/* 次格 2：免責提醒 */}
          <div className="rounded-lg border border-border bg-surface-subtle p-6">
            <p className="mb-2 text-xs uppercase tracking-wider text-muted">免責聲明</p>
            <p className="text-sm text-foreground">
              本系統依使用者輸入、強制汽車責任保險給付標準、民法侵權行為、
              金融評議中心案例、6 直轄市地方法院實務區間做初步估算，
              <strong>非最終理賠金額</strong>。
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
