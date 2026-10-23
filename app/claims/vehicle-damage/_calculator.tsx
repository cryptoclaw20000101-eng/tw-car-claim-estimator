'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button, InputNumber, Radio } from 'antd'
import {
  computeRepairDepreciation,
  type RepairDepreciationInput,
} from '@/lib/insurance/repair-depreciation'
import { trackJourney } from '@/lib/journey-client'

const DRAFT_KEY = 'tw-claim-repair-draft-v1'
const blank: RepairDepreciationInput = {
  vehicleType: 'car',
  manufactureDate: '',
  accidentDate: '',
  parts: null,
  labor: null,
  paint: null,
}
const money = (value: number) => `NT$ ${value.toLocaleString('zh-TW')}`

export default function VehicleRepairCalculator() {
  const [input, setInput] = useState<RepairDepreciationInput>(blank)
  const [ready, setReady] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [result, setResult] = useState<ReturnType<typeof computeRepairDepreciation>>(null)
  useEffect(() => {
    // Defer browser-only restoration to avoid hydration differences.
    const timer = setTimeout(() => {
      try {
        const raw = localStorage.getItem(DRAFT_KEY)
        const draft = raw ? JSON.parse(raw) : null
        if (
          draft &&
          Number.isFinite(draft.ts) &&
          draft.ts <= Date.now() &&
          Date.now() - draft.ts < 7 * 86400000 &&
          draft.input &&
          typeof draft.input === 'object' &&
          !Array.isArray(draft.input)
        )
          setInput({ ...blank, ...draft.input })
      } catch {
        /* Storage may be unavailable. */
      }
      setReady(true)
    }, 0)
    trackJourney('repair_started')
    return () => clearTimeout(timer)
  }, [])
  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ input, ts: Date.now() }))
    } catch {
      /* Storage is optional; do not delay saving until after a possible navigation. */
    }
  }, [input, ready])
  const update = (patch: Partial<RepairDepreciationInput>) => {
    setInput((v) => ({ ...v, ...patch }))
    setResult(null)
    setAttempted(false)
  }
  const missingDates = (input.parts ?? 0) > 0 && (!input.manufactureDate || !input.accidentDate)
  const invalidDates =
    !missingDates &&
    (input.parts ?? 0) > 0 &&
    !computeRepairDepreciation({ ...input, labor: input.labor ?? 0, paint: input.paint ?? 0 })
  const calculate = () => {
    setAttempted(true)
    const next = computeRepairDepreciation(input)
    setResult(next)
    if (next) trackJourney('repair_completed')
    else trackJourney('validation_failed', 'repair')
    if (next)
      requestAnimationFrame(() =>
        document
          .getElementById('repair-result')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      )
  }
  return (
    <main id="main-content" className="flex-1 bg-surface-subtle px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="mb-2 text-sm font-semibold text-accent">未受傷・只有車損</p>
          <h1 className="text-3xl font-bold text-foreground">維修費折舊試算</h1>
          <p className="mt-3 text-muted">
            照維修單填零件、工資與烤漆費，就能查看折舊後金額。無須登入，草稿會保留在本機 7 天。
          </p>
        </div>
        <form
          className="space-y-5 rounded-xl border border-border bg-surface p-5 sm:p-7"
          onSubmit={(e) => {
            e.preventDefault()
            calculate()
          }}
          noValidate
        >
          <fieldset>
            <legend className="mb-2 font-semibold">車輛類型</legend>
            <Radio.Group
              value={input.vehicleType}
              onChange={(e) => update({ vehicleType: e.target.value })}
              options={[
                { value: 'car', label: '自用汽車' },
                { value: 'motorcycle', label: '機車' },
              ]}
            />
          </fieldset>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(
              [
                {
                  key: 'manufactureDate',
                  label: '出廠日期',
                  help: '行照只有年月時，可填該月 1 日；這會影響使用月數。',
                },
                {
                  key: 'accidentDate',
                  label: '事故日期',
                  help: '依事故當日車齡計算，不使用今天的車齡。',
                },
              ] as const
            ).map(({ key, label, help }) => (
              <div key={key}>
                <label htmlFor={`repair-${key}`} className="mb-2 block font-medium">
                  {label}
                  {(input.parts ?? 0) > 0 ? '（必填）' : '（有零件費時填）'}
                </label>
                <input
                  id={`repair-${key}`}
                  type="date"
                  value={input[key]}
                  onChange={(e) => update({ [key]: e.target.value })}
                  className="min-h-11 w-full min-w-0 rounded-lg border border-border bg-surface px-3 text-foreground"
                  aria-describedby={`repair-${key}-help`}
                />
                <p id={`repair-${key}-help`} className="mt-2 text-xs text-muted">
                  {help}
                </p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(
              [
                { key: 'parts', label: '零件費（元）', help: '只有新品替換舊品的零件費折舊。' },
                { key: 'labor', label: '工資（元）', help: '含拆裝、鈑金等工資，不折舊。' },
                { key: 'paint', label: '烤漆費（元）', help: '不折舊；已含在工資內則填 0。' },
              ] as const
            ).map(({ key, label, help }) => (
              <div key={key}>
                <label htmlFor={`repair-${key}`} className="mb-2 block font-medium">
                  {label}
                </label>
                <InputNumber
                  id={`repair-${key}`}
                  min={0}
                  precision={0}
                  value={input[key]}
                  placeholder="沒有此項請填 0"
                  onChange={(value) => update({ [key]: value })}
                  style={{ width: '100%' }}
                  size="large"
                />
                <p className="mt-2 text-xs text-muted">{help}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted">
            沒有分項的總價，請先向修車廠索取明細。把整張維修單折舊，會連工資與烤漆費一起扣掉。
          </p>
          {attempted && !result && (
            <p role="alert" className="text-sm text-red-700">
              {missingDates
                ? '有零件費時，請填出廠日期與事故日期。'
                : invalidDates
                  ? '請確認日期有效，且出廠日期不晚於事故日期。'
                  : '請填三項費用；沒有的項目填 0，不要留空。'}
            </p>
          )}
          <Button htmlType="submit" type="primary" size="large" block disabled={!ready}>
            計算折舊後維修費
          </Button>
        </form>
        {result && (
          <section
            id="repair-result"
            aria-live="polite"
            className="scroll-mt-6 rounded-xl border border-border bg-surface p-5 sm:p-7"
          >
            <h2 className="text-lg font-semibold">折舊後修復費初步試算</h2>
            <p
              className="mt-3 text-3xl font-bold tabular-nums text-accent"
              data-testid="repair-total"
            >
              {money(result.total)}
            </p>
            <dl className="mt-5 divide-y divide-border text-sm">
              {[
                ['維修單合計', money(result.originalTotal)],
                ['零件折舊扣除', money(result.depreciationAmount)],
                ['折舊後零件費', money(result.partsAfterDepreciation)],
                ['工資（不折舊）', money(input.labor!)],
                ['烤漆費（不折舊）', money(input.paint!)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 py-3">
                  <dt>{label}</dt>
                  <dd className="shrink-0 tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-muted">
              {input.parts! > 0
                ? `使用期間 ${Math.floor(result.monthsUsed / 12)} 年 ${result.monthsUsed % 12} 月；採定率遞減法，年折舊率 ${result.annualRate * 100}%，耐用年數 ${result.usefulYears} 年。未滿一年按月比例計算，未滿一月以一月計，零件最低保留原價 10%。`
                : '本次沒有零件費，工資與烤漆費不折舊。'}
            </p>
            <p className="mt-3 text-sm text-muted">
              以上尚未乘肇責比例，也未評估事故前車價、修復必要性或保單條款。結果僅供資料整理，不保證法院或保險公司採用此金額。
            </p>
            <Button className="mt-4" onClick={() => window.print()}>
              列印／另存 PDF
            </Button>
          </section>
        )}
        <div className="space-y-3 text-sm text-muted">
          <p>
            參考依據：
            <a
              className="underline"
              href="https://judgment.judicial.gov.tw/FJUD/printData.aspx?id=KLDV%2C114%2C%E5%9F%BA%E5%B0%8F%2C2056%2C20251230%2C1"
              target="_blank"
              rel="noopener noreferrer"
            >
              汽車零件折舊判決
            </a>
            、
            <a
              className="underline"
              href="https://judgment.judicial.gov.tw/FJUD/printData.aspx?id=MLDV%2C113%2C%E8%8B%97%E7%B0%A1%2C50%2C20240318%2C1"
              target="_blank"
              rel="noopener noreferrer"
            >
              機車零件與工資判決
            </a>
            。最後檢視：2026-10-21。
          </p>
          <Link href="/claims/new" className="inline-block font-medium text-accent underline">
            有受傷或其他損失？繼續完整理賠試算
          </Link>
        </div>
      </div>
    </main>
  )
}
