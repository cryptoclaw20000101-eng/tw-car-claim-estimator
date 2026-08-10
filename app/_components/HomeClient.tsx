'use client'

/**
 * 首頁 client component（v0.18.x+ 極簡版）
 *
 * v0.18.x+ 設計紀律：user 2026-07-10 要求「小工具 → 越簡單越直白越好」
 * - 1 句話標題 + 1 個主 CTA
 * - 3 步驟改 1 行 inline（不 3 個 card）
 * - 移除 PWA / 批次估算 / 3 步驟 card / 任何 v0.18 標籤
 * - 保留 EstimateHistory（localStorage）+ Footer
 */

import Link from 'next/link'
import Image from 'next/image'
import { Button, Typography, Space } from 'antd'
import { motion, useReducedMotion } from 'framer-motion'
import { EstimateHistory } from '@/components/EstimateHistory'
import { ArrowRightOutlined, UserAddOutlined } from '@ant-design/icons'
// v0.23.1+：user 反饋「找不到登入鍵」，在 HomeClient 加 useAuth + 明顯登入 CTA
import { useAuth } from '@/components/AuthProvider'
import { CONTENT_LAST_REVIEWED } from '@/lib/seo'
import { GUIDES } from '@/lib/guides'

const { Title, Text } = Typography

export default function HomeClient() {
  const reduce = useReducedMotion()
  const viewportOnce = { once: true, amount: 0.2 } as const
  // v0.23.1+：user 反饋找不到登入鍵 — 在 Hero CTA 旁加明顯登入連結
  const { user } = useAuth()
  return (
    <main id="main-content" className="dvh-screen flex flex-1 flex-col">
      <motion.section
        className="border-b border-border bg-background"
        initial={false}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-10 md:grid-cols-[0.92fr_1.08fr] md:gap-14 md:py-16 lg:py-20">
          <div className="max-w-xl">
            <Text className="!mb-4 !inline-block !text-sm !font-medium text-accent">
              依資料釐清可主張的理賠項目
            </Text>
            <Title level={1} className="!mb-5 !text-4xl !leading-tight md:!text-5xl">
              車禍理賠，先做一份初步試算。
            </Title>
            <Text className="!mb-8 !block !text-base !leading-7 text-muted md:!text-lg">
              依事故、醫療與收入資料整理估算範圍，協助你準備下一步所需文件。
            </Text>
            <Space size={12} wrap>
              <Link href="/claims/new">
                <Button
                  type="primary"
                  size="large"
                  icon={<ArrowRightOutlined />}
                  iconPlacement="end"
                >
                  開始估算
                </Button>
              </Link>
              {user ? (
                <Text className="!text-sm text-muted">已登入：{user.email ?? '用戶'}</Text>
              ) : (
                <Link href="/login">
                  <Button size="large" icon={<UserAddOutlined />} data-testid="hero-login-button">
                    登入以同步估算
                  </Button>
                </Link>
              )}
            </Space>
          </div>
          <div className="relative min-h-[300px] overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_18px_48px_rgba(30,64,175,0.12)] md:min-h-[420px]">
            <Image
              src="/images/claim-clarity-hero-v1.jpg"
              alt="雨後城市道路、停靠車輛與整理理賠文件的插畫"
              fill
              priority
              sizes="(max-width: 767px) 100vw, 55vw"
              className="object-cover"
            />
          </div>
        </div>
      </motion.section>

      <section
        aria-labelledby="claim-guide-title"
        className="border-b border-border bg-surface-subtle"
      >
        <div className="mx-auto w-full max-w-6xl px-6 py-12 md:py-16">
          <div className="max-w-3xl">
            <h2
              id="claim-guide-title"
              className="mb-4 text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
            >
              車禍理賠金額怎麼估算？
            </h2>
            <p className="text-base leading-8 text-muted">
              先分開整理強制險與民事損害，再依醫療單據、工作收入、肇事責任與失能資料逐項試算。本工具不把精神慰撫金、工作損失或車損計入強制險，也不會在資料不足時憑空補值。
            </p>
          </div>

          <div className="mt-10 grid gap-8 md:grid-cols-3">
            <article>
              <h3 className="mb-2 text-lg font-semibold text-foreground">1. 整理事故與醫療資料</h3>
              <p className="leading-7 text-muted">
                準備事故日期、肇責比例、診斷、門診或住院紀錄、醫療費與交通費等可核對資料。
              </p>
            </article>
            <article>
              <h3 className="mb-2 text-lg font-semibold text-foreground">2. 分類可主張項目</h3>
              <p className="leading-7 text-muted">
                試算會區分強制險、民事損害與第三人責任險，避免把不同法律基礎的金額混在一起。
              </p>
            </article>
            <article>
              <h3 className="mb-2 text-lg font-semibold text-foreground">3. 取得區間與補件清單</h3>
              <p className="leading-7 text-muted">
                結果呈現初步範圍、計算依據與缺少的證明文件，方便後續向保險公司、調解委員或律師確認。
              </p>
            </article>
          </div>

          <nav className="mt-10" aria-label="車禍理賠主題指南">
            <Link href="/guides" className="font-semibold text-accent hover:underline">
              閱讀車禍理賠完整指南
            </Link>
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-sm">
              {GUIDES.map((guide) => (
                <li key={guide.href}>
                  <Link href={guide.href} className="text-muted hover:text-accent hover:underline">
                    {guide.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-12 grid gap-10 md:grid-cols-[1.2fr_0.8fr]">
            <div>
              <h2 className="mb-4 text-2xl font-semibold tracking-tight text-foreground">
                常見問題
              </h2>
              <dl className="space-y-6">
                <div>
                  <dt className="font-semibold text-foreground">試算結果就是最後理賠金額嗎？</dt>
                  <dd className="mt-2 leading-7 text-muted">
                    不是。結果只用來整理初步範圍，實際金額仍取決於保險公司審核、醫療證明、肇事責任、保單條款、調解或法院認定。
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-foreground">強制險會依肇責比例減少嗎？</dt>
                  <dd className="mt-2 leading-7 text-muted">
                    強制汽車責任保險採基本保障制度；本工具不把肇責比例乘入強制險試算。民事損害與第三人責任險則需另外評估肇責影響。
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-foreground">資料不完整也可以開始嗎？</dt>
                  <dd className="mt-2 leading-7 text-muted">
                    可以。無法合理估算的欄位會標示資料不足並列出補件，不會用假設金額填補。
                  </dd>
                </div>
              </dl>
            </div>

            <aside
              className="rounded-2xl border border-border bg-background p-6"
              aria-label="資料來源與內容責任"
            >
              <h2 className="mb-3 text-lg font-semibold text-foreground">資料來源與責任</h2>
              <p className="leading-7 text-muted">
                計算規則參考官方法規與司法院公開裁判資料；公開資訊可能修正，正式主張前仍應核對最新規定。
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <a
                    href="https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=G0390060"
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline"
                  >
                    全國法規資料庫：強制汽車責任保險法
                  </a>
                </li>
                <li>
                  <a
                    href="https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=B0000001"
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline"
                  >
                    全國法規資料庫：民法
                  </a>
                </li>
                <li>
                  <a
                    href="https://opendata.judicial.gov.tw/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline"
                  >
                    司法院資料開放平台
                  </a>
                </li>
              </ul>
              <p className="mt-5 text-xs leading-6 text-muted">
                內容整理：理賠顧問小鄭 · 法規資訊最後檢視：{CONTENT_LAST_REVIEWED}
              </p>
            </aside>
          </div>
        </div>
      </section>

      <EstimateHistory />

      {/* ============ Footer ============ */}
      <motion.footer
        className="mt-auto border-t border-border bg-background"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportOnce}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div className="mx-auto max-w-2xl px-6 py-8">
          <div className="flex flex-col items-center gap-2 text-xs text-muted md:flex-row md:justify-between">
            {/* v0.24.1+：footer 改成「理賠顧問小鄭製作」 */}
            <Text className="!text-xs text-muted">© 2026 理賠顧問小鄭製作</Text>
            <Space size={12} wrap>
              {/* v0.27.6+：管理員後台入口已從 footer 移除（v0.27.0 admin gate 已守住 URL，
                  不需要公開連結暴露路徑）*/}
              <Link href="/about" className="!text-xs text-muted hover:text-accent">
                關於
              </Link>
              <Link href="/guides" className="!text-xs text-muted hover:text-accent">
                理賠指南
              </Link>
              <Link href="/privacy" className="!text-xs text-muted hover:text-accent">
                隱私
              </Link>
              <Link href="/terms" className="!text-xs text-muted hover:text-accent">
                條款
              </Link>
            </Space>
          </div>
        </div>
      </motion.footer>
    </main>
  )
}
