'use client'

import Link from 'next/link'
import { Button, Typography, Space, Alert } from 'antd'
import { InfoAlert } from '@/components/InfoAlert'
import { motion, useReducedMotion } from 'framer-motion'
import { EnsembleHealthHeroCard } from '@/components/EnsembleHealthHeroCard'
import { InstallPWAButton, PWAHintCard } from '@/components/InstallPWAButton'
import { EstimateHistory } from '@/components/EstimateHistory'
import {
  CalculatorOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  EnvironmentOutlined,
  ArrowRightOutlined,
  CompassOutlined,
  ExperimentOutlined,
  ReadOutlined,
  // v0.12.0+ Phase A6：FAQ 區 icon
  QuestionCircleOutlined,
} from '@ant-design/icons'

const { Title, Paragraph, Text } = Typography

/**
 * 首頁 client component（v0.9.0+ 從 app/page.tsx 抽出）
 * - 對齊偏左（variance 8 預設 hero 不置中）
 * - 強調色單一 rose-700，不混紫藍漸層
 * - 5 大區塊改 bento grid 2fr/1fr/1fr 不對稱
 * - 無 emoji（AntD icons 取代）
 * - 數字 tabular-nums
 */
export default function HomeClient() {
  const reduce = useReducedMotion()
  // v0.10.0+：scroll-reveal 共用 viewport 設定（觸發一次、20% 可見時啟動）
  const viewportOnce = { once: true, amount: 0.2 } as const
  return (
    <main id="main-content" className="dvh-screen flex flex-1 flex-col">
      {/* ============ Hero — 偏左不置中 ============ */}
      <motion.section
        className="border-b border-border bg-background"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-6 py-16 md:grid-cols-12 md:py-24">
          <div className="md:col-span-7 md:pr-8">
            <Space size={6} className="!mb-4">
              <Text className="text-xs uppercase tracking-[0.18em] text-muted">v0.1 MVP</Text>
              <span className="text-muted">·</span>
              <Text className="text-xs uppercase tracking-[0.18em] text-muted">
                Taiwan Car-Claim Estimator
              </Text>
            </Space>
            <Title
              level={1}
              className="!mb-4 !text-4xl !leading-[1.05] !tracking-tight md:!text-6xl"
            >
              車禍理賠金額，
              <br />
              <span className="text-accent">5 分鐘</span>算給你看。
            </Title>
            <Paragraph className="!mb-8 !text-base text-muted md:!text-lg">
              依<strong className="text-foreground"> 強制汽車責任保險法 </strong>、
              <strong className="text-foreground"> 民法 §184-196 侵權行為 </strong>
              ，以及<strong className="text-foreground"> 6 個直轄市地方法院實務區間 </strong>
              ，自動產出 5 區估算結果。
            </Paragraph>
            <Space size={12} wrap>
              <Link href="/claims/new">
                <Button
                  type="primary"
                  size="large"
                  icon={<ArrowRightOutlined />}
                  iconPlacement="end"
                >
                  開始估算（7 步表單）
                </Button>
              </Link>
              {/* v0.8.0+：PWA 安裝按鈕 — Android 自動 prompt / iOS 顯示步驟 */}
              <InstallPWAButton />
            </Space>
            {/* v0.8.0+：提示卡 — 永遠顯示「可以裝成 app」 */}
            <PWAHintCard />
            <Space size={20} className="!mt-10" wrap>
              <Stat label="583 件真實判例" value="583" />
              <Divider />
              <Stat label="6 大計算引擎" value="6" />
              <Divider />
              <Stat label="39 律師手動建檔" value="39" />
              <Divider />
              <Stat label="6 直轄市法院" value="6" />
              <Divider />
              <Stat label="26 縣市自動對應" value="26" />
              <Divider />
              <Stat label="強制險 15 細項" value="15" />
            </Space>
          </div>

          {/* Hero 右侧 — bento 重排 (v0.11.0+)：
              1 大格（Ensemble 健康度，accent 邊框為主視覺錨點）
              + 2 小格（引用法源 / 地區覆蓋 並排） */}
          <div className="md:col-span-5">
            {/* 主格：Ensemble 健康度 — 加大 padding、accent border 凸顯主視覺 */}
            <div className="rounded-lg border-2 border-accent/30 bg-surface p-5 shadow-[0_1px_0_rgba(190,18,60,0.04)]">
              <EnsembleHealthHeroCard />
            </div>

            {/* 次格 2 欄並排：引用法源 + 地區覆蓋 */}
            <div className="!mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface p-4 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
                <Space size={6} className="!mb-2">
                  <ReadOutlined />
                  <Text className="!text-xs !font-semibold uppercase tracking-wider text-foreground">
                    引用法源
                  </Text>
                </Space>
                <ul className="m-0 space-y-2 !text-xs text-muted">
                  <li>
                    <span className="text-foreground">強制汽車責任保險法 §27</span>
                    <br />
                    <span className="text-[11px] text-muted">
                      國家立法保障所有用路人，基本醫療與失能必賠
                    </span>
                  </li>
                  <li>
                    <span className="text-foreground">強制險給付標準 §2-§4</span>
                    <br />
                    <span className="text-[11px] text-muted">
                      15 細項法定上限（如醫療 20 萬、看護每日 1,200 元）
                    </span>
                  </li>
                  <li>
                    <span className="text-foreground">民法 §184 / §193-§195</span>
                    <br />
                    <span className="text-[11px] text-muted">
                      侵權行為 + 醫療 / 工作 / 精神慰撫金請求權
                    </span>
                  </li>
                  <li className="text-foreground">
                    6 直轄市地院慰撫金區間
                    <br />
                    <span className="text-[11px] text-muted">同類傷勢在不同地區法院的判賠區間</span>
                  </li>
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-surface-subtle p-4">
                <Space size={6} className="!mb-2">
                  <EnvironmentOutlined />
                  <Text className="!text-xs uppercase tracking-wider text-muted">地區覆蓋</Text>
                </Space>
                <Text className="!text-xs text-foreground">
                  6 直轄市地院 + 26 縣市自動對應
                  <br />
                  （台 / 臺異體字相容）
                </Text>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ============ 5 大區塊 — bento grid 2fr / 1fr / 1fr ============ */}
      <motion.section
        id="sections"
        className="bg-surface-subtle"
        // v0.10.0+：scroll reveal
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportOnce}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <Space size={6} className="!mb-2">
            <ExperimentOutlined />
            <Text className="!text-xs uppercase tracking-[0.18em] text-muted">
              Estimation Sections
            </Text>
          </Space>
          <Title level={2} className="!mb-3 !text-3xl !tracking-tight md:!text-4xl">
            5 區估算結果
          </Title>
          <Paragraph className="!mb-10 !text-base text-muted">
            每一區都是「試算」非「判決」。實際理賠仍須依保險公司審核、醫療資料、肇事責任、
            保單條款、金融評議或法院認定為準。
          </Paragraph>

          {/* Bento grid — 2fr/1fr 上面 + 1fr/1fr/1fr 下面（variance 8 不對稱） */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-2">
            {/* 主格：強制險 — 2fr 寬 */}
            <BentoCell
              icon={<SafetyCertificateOutlined />}
              index="01"
              title="強制險"
              subtitle="Compulsory Insurance"
              description="依 15 細項法定上限逐項試算（醫療 20 萬 cap / 看護 30 日 1,200 元 / 日）"
              featured
            />
            <BentoCell
              icon={<CompassOutlined />}
              index="02"
              title="失能初篩"
              subtitle="Disability Screening"
              description="關節 ROM 量測 → 失能等級對照，不直接判定，給補件建議"
            />
            <BentoCell
              icon={<CalculatorOutlined />}
              index="03"
              title="第三人責任險"
              subtitle="Third-Party Liability"
              description="體傷 + 財損分開 cap，自動扣強制險已估金額"
            />
            <BentoCell
              icon={<FileTextOutlined />}
              index="04"
              title="補件清單"
              subtitle="Evidence Checklist"
              description="依空欄位自動產出需補件項目，避免估算不準"
            />
            <BentoCell
              icon={<EnvironmentOutlined />}
              index="05"
              title="地區實務參考"
              subtitle="Regional Court Data"
              description="金融評議中心案例 + 司法院判決區間"
            />
            {/* 第 6 格空白 bento，營造 variance */}
            <div className="hidden rounded-lg border border-dashed border-border md:flex md:items-center md:justify-center">
              <Text className="!text-xs uppercase tracking-wider text-muted">
                法源資料每 30 天更新
              </Text>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ============ 鐵律（不踩雷） ============ */}
      <motion.section
        className="border-t border-border bg-background"
        // v0.10.0+：scroll reveal
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportOnce}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <Space size={6} className="!mb-2">
            <ExperimentOutlined />
            <Text className="!text-xs uppercase tracking-[0.18em] text-muted">
              Engineering Principles
            </Text>
          </Space>
          <Title level={2} className="!mb-3 !text-2xl !tracking-tight md:!text-3xl">
            三條鐵律，系統永遠守著。
          </Title>
          <Paragraph className="!mb-10 !text-base text-muted">
            這三條不是工程師個人偏好，是法律強制 + 業務實務的底線。
            <br />
            違反任一條都可能讓估算金額對保戶產生誤導，後果比「算不出來」更嚴重。
          </Paragraph>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
            <IronRow
              label="強制險採無過失主義"
              desc="不乘肇責比例，純依傷害程度計算"
              reason="1967 年強制險立法目的就是為了讓受害人不必舉證對方過失，肇責只影響第三人責任險層。"
            />
            <IronRow
              label="精神慰撫金 / 工作損失 / 車損不放入強制險"
              desc="這是法律強制，不是系統限制"
              reason="強制險 §27 列舉的給付項目限定醫療 / 失能 / 死亡三類，把精神慰撫金塞進去會誤導保戶。"
            />
            <IronRow
              label="資料不足不硬算"
              desc="顯示需補資料，不給假數字"
              reason="估算金額會影響保戶決策。缺資料時硬給一個數字，比老實說『需要補件』更不負責任。"
            />
          </div>
        </div>
      </motion.section>

      {/* ============ v0.16.x 信任區塊 — 為什麼選我們 (保險公司專業感) ============ */}
      <motion.section
        id="trust"
        className="border-t border-border bg-background"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportOnce}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <Space size={6} className="!mb-2">
            <SafetyCertificateOutlined />
            <Text className="!text-xs uppercase tracking-[0.18em] text-muted">Why Choose Us</Text>
          </Space>
          <Title level={2} className="!mb-3 !text-3xl !tracking-tight md:!text-4xl">
            為什麼保經業務員選這個工具
          </Title>
          <Paragraph className="!mb-10 !text-base text-muted">
            不是另一個 AI 估算，是依「真實判例 + 律師手動建檔 + Ensemble 三票共識」的可信試算。
          </Paragraph>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* 真實判例 */}
            <div className="rounded-lg border border-border bg-surface p-5">
              <div className="!mb-3 text-3xl text-accent tabular-nums">583</div>
              <Text strong className="!block !mb-1 !text-base">
                件真實司法院判例
              </Text>
              <Text className="!text-xs !text-muted">
                13 條法律鏈自動爬取 + 律師手動建檔 39 件。每週自動更新，涵蓋近 2 年車禍判決。
              </Text>
            </div>

            {/* 6 大引擎 */}
            <div className="rounded-lg border border-border bg-surface p-5">
              <div className="!mb-3 text-3xl text-accent tabular-nums">6</div>
              <Text strong className="!block !mb-1 !text-base">
                大計算引擎
              </Text>
              <Text className="!text-xs !text-muted">
                強制險 / 失能初篩 / 民事 / 第三人 / 補件 / 地區。每個引擎有獨立測試（79 it 守護）。
              </Text>
            </div>

            {/* Ensemble 三票 */}
            <div className="rounded-lg border border-border bg-surface p-5">
              <div className="!mb-3 text-3xl text-accent tabular-nums">3</div>
              <Text strong className="!block !mb-1 !text-base">
                票 Ensemble 共識
              </Text>
              <Text className="!text-xs !text-muted">
                規則公式 + ML anchor + KNN 相似判例，三種推理路徑共識。信心度分級 + LLM 顧問複核。
              </Text>
            </div>

            {/* 個資保護 */}
            <div className="rounded-lg border border-border bg-surface p-5">
              <div className="!mb-3 text-3xl text-accent tabular-nums">0</div>
              <Text strong className="!block !mb-1 !text-base">
                個資外洩
              </Text>
              <Text className="!text-xs !text-muted">
                個資不送 LLM、可關閉雲端同步、localStorage 脫敏。律師事務所內網自架可行。
              </Text>
            </div>
          </div>

          {/* 律師事務所合作 CTA — v0.16.x 預留 (C3 待 user 填具體資訊) */}
          <div className="!mt-8 rounded-lg border-2 border-accent/30 bg-surface p-6">
            <Space size={8} className="!mb-2">
              <ReadOutlined className="text-accent" />
              <Text strong className="!text-base">
                律師事務所合作
              </Text>
            </Space>
            <Paragraph className="!mb-3 !text-sm text-foreground">
              本工具由 <Text strong>__律師事務所名稱__</Text> 提供法律諮詢支援。
              計算結果僅供試算，實際理賠仍須依保險公司審核、醫療資料、肇事責任、保單條款、金融評議或法院認定為準。
            </Paragraph>
            <Space size={12} wrap>
              <Text className="!text-xs text-muted">
                電話：<Text strong>__待填__</Text>
              </Text>
              <Text className="!text-xs text-muted">
                地址：<Text strong>__待填__</Text>
              </Text>
              <Text className="!text-xs text-muted">
                LINE：<Text strong>__待填__</Text>
              </Text>
            </Space>
          </div>
        </div>
      </motion.section>

      {/* ============ FAQ — v0.12.0+ Phase A6 常見問題 ============ */}
      <motion.section
        className="border-t border-border bg-surface-subtle"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportOnce}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <Space size={6} className="!mb-2">
            <QuestionCircleOutlined />
            <Text className="!text-xs uppercase tracking-[0.18em] text-muted">FAQ</Text>
          </Space>
          <Title level={2} className="!mb-3 !text-2xl !tracking-tight md:!text-3xl">
            常見問題
          </Title>
          <Paragraph className="!mb-10 !text-base text-muted">
            保戶最常問的 6 個問題，先看這裡；如果還有疑問，
            <br />
            請諮詢保險經紀人或律師（聯絡資訊見金融消費評議中心）。
          </Paragraph>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FaqCard
              q="為什麼我的估算金額跟鄰居不一樣？"
              a="車禍理賠估算至少受 3 個變數影響：肇責比例（強制險不受影響，但第三人責任險差很多）、失能等級（同一個部位不同等級差到 10 倍）、地區法院實務係數（臺北跟高雄的精神慰撫金可能差 30%）。填越多精確欄位，估算越接近實際理賠。"
            />
            <FaqCard
              q="強制險是什麼？跟第三人責任險差在哪？"
              a="強制險是國家立法規定每輛車都要保的「基本險」，保護所有用路人（不論肇事責任），賠醫療、失能、死亡三大類。第三人責任險是「自己加保的進階險」，賠對方的體傷與財損，乘肇責比例才有賠。"
            />
            <FaqCard
              q="精神慰撫金怎麼算？為什麼這麼高？"
              a="精神慰撫金沒有法定公式，採用法院實務區間 × 傷勢等級 × 地區係數。本工具用 13 件真實判決 + Ensemble 三票（規則公式 / ML 統計 / KNN 相似案件）給出區間，金額從數萬到數十萬都有可能，須依個案情節調整。"
            />
            <FaqCard
              q="失能等級怎麼認定？我自己填準嗎？"
              a="失能等級須由醫院開立「失能診斷書」並經保險公司 / 評議 / 法院認定。本工具的「失能等級」欄是「初步篩選用途」，真實理賠以官方診斷為準。業務員常用這欄做客戶預估，但不要直接拿這個等級去跟保險公司談。"
            />
            <FaqCard
              q="資料不足怎麼辦？工具會給假數字嗎？"
              a="不會。資料不足時工具會顯示「需補件清單」並回傳 null，不會硬給數字。這是系統的底線之一 — 估算金額會影響保戶決策，缺資料時硬給數字比老實說「需補件」更不負責任。"
            />
            <FaqCard
              q="理賠結果不如預期，可以去哪裡申訴？"
              a="三個管道：(1) 向保險公司申訴部門申訴；(2) 不滿結果可向「財團法人金融消費評議中心」申請評議（免費、具法律效力）；(3) 涉及訴訟請洽執業律師，循民事訴訟程序。本工具不提供申訴服務，也不介入個案。"
            />
          </div>
        </div>
      </motion.section>

      {/* ============ 最近估算紀錄 — v0.12.0+ Phase B3（localStorage） ============ */}
      <EstimateHistory />

      {/* ============ Footer / 免責 ============ */}
      <motion.footer
        className="mt-auto border-t border-border bg-background"
        // v0.10.0+：scroll reveal
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportOnce}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="mx-auto w-full max-w-6xl px-6 py-10">
          {/* v0.12.0+ Phase A4：免責聲明精準化 — 主標 + 3 點白話拆解 */}
          <InfoAlert
            type="warning"
            showIcon
            className="!mb-4"
            title="這是「估算」，不是「判決」"
            body={
              <>
                <p className="!mb-3">
                  本工具依你輸入的資料 + 強制汽車責任保險給付標準 + 民法 §184-196 + 6
                  直轄市地方法院實務區間，做<strong>初步金額估算</strong>。
                  這不是保險公司的最終理賠，也不是律師 / 法院的判決。
                </p>
                <p className="!mb-3">
                  <strong>實際理賠金額</strong>還要看：保險公司審核 · 醫療單據齊全度 · 肇事責任認定
                  · 保單條款 · 金融評議結果 · 法院判決 · 雙方和解。
                </p>
                <p className="!mb-0">
                  <strong>本工具不保證金額，亦不構成法律意見。</strong>
                  涉及訴訟請洽執業律師；理賠爭議可向金融消費評議中心申訴。
                </p>
              </>
            }
          />
          {/* v0.12.0+ Phase A4：拆出「3 個常見誤解」幫保戶建立正確預期 */}
          <div className="!mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded border border-border bg-surface-subtle p-3">
              <Text strong className="!text-xs text-foreground">
                「估算」不等於「保證」
              </Text>
              <Text className="!mt-1 !text-xs text-muted">
                同一個案件，可能因為一份醫療單據差 1,000 元，估算就不同。
              </Text>
            </div>
            <div className="rounded border border-border bg-surface-subtle p-3">
              <Text strong className="!text-xs text-foreground">
                「結果」需專業複核
              </Text>
              <Text className="!mt-1 !text-xs text-muted">
                真實理賠前請交給保險經紀人 / 律師，依個案情節重新檢視。
              </Text>
            </div>
            <div className="rounded border border-border bg-surface-subtle p-3">
              <Text strong className="!text-xs text-foreground">
                「規則」會持續更新
              </Text>
              <Text className="!mt-1 !text-xs text-muted">
                法規與案例每 30 天更新。重大法規變動請參考司法院公告。
              </Text>
            </div>
          </div>
          <div className="flex flex-col items-start justify-between gap-2 text-xs text-muted md:flex-row md:items-center">
            <Space size={12} wrap>
              <Text className="!text-xs text-muted">
                © 2026 tw-car-claim-estimator · Built with Next.js 16 + AntD 6
              </Text>
              <Link href="/about" className="!text-xs text-muted hover:text-accent">
                關於我們
              </Link>
              <Link href="/privacy" className="!text-xs text-muted hover:text-accent">
                隱私權政策
              </Link>
              <Link href="/terms" className="!text-xs text-muted hover:text-accent">
                服務條款
              </Link>
            </Space>
            <Text className="!text-xs text-muted">v0.12.0 · 6 直轄市 + 26 縣市</Text>
          </div>
        </div>
      </motion.footer>
    </main>
  )
}

// ============== Sub-components ==============

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Space orientation="vertical" size={2}>
      <span className="tabular-nums text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </span>
      <span className="text-xs uppercase tracking-wider text-muted">{label}</span>
    </Space>
  )
}

function Divider() {
  return <span aria-hidden className="hidden h-8 w-px bg-border md:inline-block" />
}

function BentoCell({
  icon,
  index,
  title,
  subtitle,
  description,
  featured = false,
}: {
  icon: React.ReactNode
  index: string
  title: string
  subtitle: string
  description: string
  featured?: boolean
}) {
  return (
    <div
      className={[
        'group rounded-lg border bg-surface p-6 transition-colors',
        'border-border hover:border-border-strong',
        featured ? 'md:col-span-2 md:row-span-2' : '',
      ].join(' ')}
    >
      <Space size={8} className="!mb-3">
        <span className="text-lg text-accent">{icon}</span>
        <span className="tabular-nums text-xs font-mono uppercase tracking-wider text-muted">
          {index}
        </span>
      </Space>
      <Title level={3} className="!mb-1 !text-xl !tracking-tight">
        {title}
      </Title>
      <Text className="!mb-3 !text-xs uppercase tracking-wider text-muted">{subtitle}</Text>
      <Paragraph
        className={['!mb-0 !text-sm text-muted', featured ? 'md:!text-base' : ''].join(' ')}
      >
        {description}
      </Paragraph>
    </div>
  )
}

function IronRow({ label, desc, reason }: { label: string; desc: string; reason?: string }) {
  return (
    <div className="bg-background p-5">
      <Space size={6} className="!mb-1">
        <span className="text-accent">/</span>
        <Text className="!text-sm !font-semibold text-foreground">{label}</Text>
      </Space>
      <Text className="!text-sm text-muted">{desc}</Text>
      {reason && (
        <Text className="!mt-2 !text-xs italic text-muted opacity-80">為什麼：{reason}</Text>
      )}
    </div>
  )
}

/**
 * v0.12.0+ Phase A6：FAQ 卡片子元件
 * Q 在上、A 在下，hover 加陰影提示可閱讀
 */
function FaqCard({ q, a }: { q: string; a: string }) {
  return (
    <div className="group rounded-lg border border-border bg-surface p-5 transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <Text strong className="!text-sm text-foreground">
        Q · {q}
      </Text>
      <Paragraph className="!mt-2 !mb-0 !text-sm text-muted">{a}</Paragraph>
    </div>
  )
}
