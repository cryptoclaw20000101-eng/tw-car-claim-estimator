import type { ReactNode } from 'react'
import Link from 'next/link'
import { CONTENT_LAST_REVIEWED } from '@/lib/seo'
import { GUIDES } from '@/lib/guides'

type Source = { label: string; href: string }

export function GuideArticle({
  path,
  title,
  summary,
  sources,
  children,
}: {
  path: string
  title: string
  summary: string
  sources: readonly Source[]
  children: ReactNode
}) {
  return (
    <main id="main-content" className="flex-1 bg-surface-subtle">
      <article className="mx-auto w-full max-w-4xl px-6 py-10 md:py-16">
        <nav aria-label="麵包屑" className="mb-8 text-sm text-muted">
          <Link href="/" className="hover:text-accent">
            首頁
          </Link>
          <span aria-hidden="true"> / </span>
          <Link href="/guides" className="hover:text-accent">
            車禍理賠指南
          </Link>
        </nav>

        <header className="mb-10 border-b border-border pb-8">
          <p className="mb-3 text-sm font-semibold tracking-wide text-accent">
            臺灣車禍理賠資料整理
          </p>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground md:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">{summary}</p>
          <p className="mt-5 text-sm text-muted">
            內容整理：理賠顧問小鄭 · 最後檢視：
            <time dateTime={CONTENT_LAST_REVIEWED}>{CONTENT_LAST_REVIEWED}</time>
          </p>
        </header>

        <div className="guide-content">{children}</div>

        <aside className="mt-12 rounded-2xl border border-amber-300 bg-amber-50 p-6 text-stone-800">
          <h2 className="text-lg font-semibold">使用前提醒</h2>
          <p className="mt-2 leading-7">
            本文用來協助整理資料，不構成法律意見、法院判決或保險理賠承諾。實際結果仍須依事故日、醫療證明、肇事責任、保單條款、保險公司審核、調解或法院認定。
          </p>
        </aside>

        <section className="mt-12" aria-labelledby="official-sources">
          <h2 id="official-sources" className="text-2xl font-semibold text-foreground">
            官方資料來源
          </h2>
          <ul className="mt-4 space-y-3">
            {sources.map((source) => (
              <li key={source.href}>
                <a
                  href={source.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-accent underline-offset-4 hover:underline"
                >
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 border-t border-border pt-8" aria-labelledby="related-guides">
          <h2 id="related-guides" className="text-2xl font-semibold text-foreground">
            接著閱讀
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Link
              href="/guides"
              className="rounded-xl border border-border bg-background p-5 text-foreground hover:border-accent"
            >
              <span className="font-semibold">車禍理賠完整指南</span>
              <span className="mt-2 block text-sm leading-6 text-muted">
                回到所有理賠項目的整理入口
              </span>
            </Link>
            {GUIDES.filter((guide) => guide.href !== path).map((guide) => (
              <Link
                key={guide.href}
                href={guide.href}
                className="rounded-xl border border-border bg-background p-5 text-foreground hover:border-accent"
              >
                <span className="font-semibold">{guide.title}</span>
                <span className="mt-2 block text-sm leading-6 text-muted">{guide.description}</span>
              </Link>
            ))}
          </div>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/claims/new"
            className="rounded-lg bg-accent px-5 py-3 font-semibold text-white hover:opacity-90"
          >
            開始車禍理賠初步試算
          </Link>
          <Link
            href="/about"
            className="rounded-lg border border-border bg-background px-5 py-3 font-semibold text-foreground hover:border-accent"
          >
            查看計算方式與資料來源
          </Link>
        </div>
      </article>
    </main>
  )
}
