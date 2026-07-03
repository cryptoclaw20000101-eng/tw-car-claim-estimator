'use client'

/**
 * EstimateHistory — localStorage 歷史估算列表（v0.12.0+ Phase B3）
 *
 * 顯示位置：首頁（在 FAQ 區下方、Footer 上方）
 * 顯示條件：localStorage 有資料才 render，沒資料時不顯示（避免打擾首次訪問）
 *
 * 安全：
 * - 完全 SSR safe（client-side only）
 * - 脫敏後資料（無姓名、身分證、車牌）
 * - 容量上限 10 筆（自動 FIFO 驅逐）
 */

import { useEffect, useState } from 'react'
import { Button, Space, Typography } from 'antd'
import { ClockCircleOutlined, DeleteOutlined } from '@ant-design/icons'
import {
  getEstimateHistory,
  clearEstimateHistory,
  type HistoryEntry,
} from '@/lib/estimate-history'

const { Text, Paragraph } = Typography

export function EstimateHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setHistory(getEstimateHistory())
  }, [])

  // SSR / 首次訪問：不要 render（避免打擾）
  if (!mounted || history.length === 0) return null

  const handleClear = () => {
    if (typeof window === 'undefined') return
    // 二次確認避免誤刪
    if (window.confirm(`確定要清除全部 ${history.length} 筆估算記錄嗎？`)) {
      clearEstimateHistory()
      setHistory([])
    }
  }

  return (
    <section className="border-t border-border bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-12 md:py-16">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <Space size={6} className="!mb-2">
              <ClockCircleOutlined />
              <Text className="!text-xs uppercase tracking-[0.18em] text-muted">
                Recent Estimates
              </Text>
            </Space>
            <h2 className="!mb-0 text-2xl font-semibold tracking-tight md:text-3xl">
              最近估算過的案件
            </h2>
            <Paragraph className="!mt-2 !mb-0 !text-sm text-muted">
              本機儲存最近 10 筆估算（不涉及個資）。清空資料不會影響估算結果。
            </Paragraph>
          </div>
          <Button
            type="text"
            size="small"
            icon={<DeleteOutlined />}
            onClick={handleClear}
            data-testid="clear-history"
          >
            清空
          </Button>
        </div>

        {/* 桌面：表格 / 手機：卡片堆疊 */}
        <div className="hidden overflow-hidden rounded-lg border border-border md:block">
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 text-left">時間</th>
                <th className="px-4 py-3 text-left">法院</th>
                <th className="px-4 py-3 text-right">失能等級</th>
                <th className="px-4 py-3 text-right">己方肇責</th>
                <th className="px-4 py-3 text-right">強制險估算</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry, i) => (
                <tr
                  key={entry.timestamp}
                  className={i % 2 === 0 ? 'bg-surface' : 'bg-surface-subtle/40'}
                >
                  <td className="px-4 py-3 text-muted">
                    {formatTime(entry.timestamp)}
                  </td>
                  <td className="px-4 py-3">{entry.courtName}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {entry.disabilityLevel ? `第 ${entry.disabilityLevel} 級` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {entry.selfFaultRatio}%
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">
                    ${entry.compulsoryTotalEstimated.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 手機：卡片 */}
        <div className="space-y-2 md:hidden">
          {history.map((entry) => (
            <div
              key={entry.timestamp}
              className="rounded-lg border border-border bg-surface p-3"
            >
              <div className="flex items-center justify-between">
                <Text className="!text-xs text-muted">
                  {formatTime(entry.timestamp)}
                </Text>
                <Text strong className="!text-sm tabular-nums">
                  ${entry.compulsoryTotalEstimated.toLocaleString()}
                </Text>
              </div>
              <div className="!mt-1 flex flex-wrap gap-2 !text-xs text-muted">
                <span>{entry.courtName}</span>
                {entry.disabilityLevel && (
                  <span>· 失能 {entry.disabilityLevel} 級</span>
                )}
                <span>· 肇責 {entry.selfFaultRatio}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/**
 * 格式化時間戳為人類可讀格式
 * - 今天：HH:MM
 * - 昨天/本週：X天前
 * - 更早：YYYY-MM-DD
 */
function formatTime(iso: string): string {
  try {
    const date = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)

    if (diffMin < 1) return '剛剛'
    if (diffMin < 60) return `${diffMin} 分鐘前`
    if (diffHour < 24) return `${diffHour} 小時前`
    if (diffDay < 7) return `${diffDay} 天前`
    return date.toLocaleDateString('zh-Hant', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return iso
  }
}