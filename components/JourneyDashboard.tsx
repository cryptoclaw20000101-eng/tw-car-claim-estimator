'use client'
import { useEffect, useState } from 'react'
interface Row {
  event: string
  step: string
  sessions: number
}
export function JourneyDashboard() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    fetch('/api/admin/journey', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('unavailable')
        const data = await res.json()
        if (active) setRows(data.items)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [])
  if (failed) return <p role="status">填表統計尚不可用，請確認資料庫 migration 與管理員權限。</p>
  if (!rows) return <p role="status">讀取填表統計…</p>
  const count = (event: string, step = '') =>
    rows.find((r) => r.event === event && r.step === step)?.sessions ?? 0
  const rate = (done: number, started: number) =>
    started ? `${((done / started) * 100).toFixed(1)}%` : '尚無資料'
  return (
    <section className="space-y-5">
      <h2 className="text-xl font-semibold">近 7 天填表完成情況</h2>
      <p className="text-sm text-muted">
        以匿名瀏覽工作階段計算；同一人可能使用多個裝置。只統計有回傳事件的造訪，不代表所有訪客或填寫意願。車損快速試算與完整表單分開計算。
      </p>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <dt>可量測造訪</dt>
          <dd className="text-2xl font-semibold">{count('visit')}</dd>
        </div>
        <div>
          <dt>完整表單完成率</dt>
          <dd className="text-2xl font-semibold">
            {rate(count('estimate_completed'), count('form_started'))}
          </dd>
          <p>
            {count('estimate_completed')} / {count('form_started')} 次開始
          </p>
        </div>
        <div>
          <dt>車損快速試算完成率</dt>
          <dd className="text-2xl font-semibold">
            {rate(count('repair_completed'), count('repair_started'))}
          </dd>
          <p>
            {count('repair_completed')} / {count('repair_started')} 次開始
          </p>
        </div>
      </dl>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="p-2">步驟</th>
              <th>進入</th>
              <th>完成</th>
              <th>完成率</th>
              <th>遇到驗證提示</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ['basics', '事故基本'],
                ['fault', '肇責'],
                ['person', '人身／工作'],
                ['diagnosis', '傷勢'],
                ['expenses', '費用'],
                ['repair', '維修折舊'],
              ] as const
            ).map(([step, label]) => (
              <tr key={step} className="border-t border-border">
                <td className="p-2">{label}</td>
                <td>{step === 'repair' ? count('repair_started') : count('step_viewed', step)}</td>
                <td>
                  {step === 'repair' ? count('repair_completed') : count('step_completed', step)}
                </td>
                <td>
                  {rate(
                    step === 'repair' ? count('repair_completed') : count('step_completed', step),
                    step === 'repair' ? count('repair_started') : count('step_viewed', step),
                  )}
                </td>
                <td>{count('validation_failed', step)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        未完成包含仍在填寫、晚點繼續及離開，不等同拒絕填表。尊重瀏覽器 Do Not Track／Global Privacy
        Control；事件保留最多 30 天並在接收新事件時清理。不收集表單內容、聯絡資料或帳號。
      </p>
    </section>
  )
}
