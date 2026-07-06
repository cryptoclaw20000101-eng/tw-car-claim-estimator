'use client'

/**
 * EstimateHistory — 歷史估算列表（v0.12.0+ Phase B3 + v0.14.x 雲端）
 *
 * 顯示位置：首頁（在 FAQ 區下方、Footer 上方）
 * 顯示條件：有資料才 render，沒資料時不顯示（避免打擾首次訪問）
 *
 * v0.14.x 升級：
 * - 登入時優先用 Supabase 雲端資料（loadEstimates）
 * - 未登入時 fallback 到 localStorage（v0.12.0+ Phase B3 行為）
 * - 切換登入狀態時自動 re-fetch
 *
 * 安全：
 * - 完全 SSR safe（client-side only）
 * - 脫敏後資料（無姓名、身分證、車牌）
 * - 容量上限：localStorage 10 筆 / 雲端 20 筆
 */

import { useEffect, useState } from 'react'
import { Button, Space, Tag, Tooltip, Typography } from 'antd'
import { ClockCircleOutlined, DeleteOutlined, CloudOutlined, ReloadOutlined } from '@ant-design/icons'
import { getEstimateHistory, clearEstimateHistory, type HistoryEntry } from '@/lib/estimate-history'
import { loadEstimates, deleteCloudEstimate, type CloudEstimate } from '@/lib/estimate-storage'
import { useAuth } from '@/components/AuthProvider'
// v0.14.x：載入舊案件
import { saveForLoad } from '@/lib/estimate-loader'

const { Text, Paragraph } = Typography

export function EstimateHistory() {
  const { user, configured } = useAuth()
  const [items, setItems] = useState<HistoryEntry[]>([])
  const [cloudItems, setCloudItems] = useState<CloudEstimate[]>([])
  const [storage, setStorage] = useState<'cloud' | 'local'>('local')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function refresh() {
    const result = await loadEstimates(user?.id ?? null)
    if (result.storage === 'cloud') {
      const cloud = result.items as CloudEstimate[]
      setCloudItems(cloud)
      // 雲端記錄 → 轉成 HistoryEntry 格式（手機用）
      setItems(
        cloud.map((e) => ({
          timestamp: e.createdAt,
          compulsoryTotalEstimated: e.result?.compulsoryTotalEstimated ?? 0,
          disabilityLevel: e.claimInput?.medical?.disabilityLevel ?? null,
          courtName: e.result?.region?.courtName ?? '—',
          selfFaultRatio: e.claimInput?.fault?.selfFaultRatio ?? 50,
        })),
      )
    } else {
      setCloudItems([])
      setItems(result.items as HistoryEntry[])
    }
    setStorage(result.storage)
  }

  /**
   * 載入舊案件：寫入 sessionStorage + 跳轉到 /claims/new
   * 表單會在 mount 時讀 sessionStorage 自動填入
   */
  const handleLoad = (entry: HistoryEntry | CloudEstimate, index: number) => {
    if (storage === 'cloud' && 'claimInput' in entry) {
      saveForLoad(entry.claimInput)
    } else {
      // 本地：只存簡化資料（沒有原始 ClaimInput），用最簡版本重建
      const he = entry as HistoryEntry
      saveForLoad({
        basics: {
          accidentDate: '',
          accidentLocation: '',
          accidentType: '',
          injuredRole: '',
          isAutomobileAccident: true,
          courtJurisdiction: '',
        },
        fault: {
          selfFaultRatio: he.selfFaultRatio,
          otherFaultRatio: 100 - he.selfFaultRatio,
          faultSource: '尚未確定',
          isFaultDisputed: false,
        },
        person: { employmentType: '正職月薪' },
        medical: { disabilityLevel: he.disabilityLevel },
        medicalReceipts: {},
        property: {},
      } as any)
    }
    window.location.href = '/claims/new?load=true'
  }

  // SSR / 首次訪問：不要 render（避免打擾）
  if (!mounted || items.length === 0) return null

  const handleClear = async () => {
    if (typeof window === 'undefined') return
    // 二次確認避免誤刪
    if (!window.confirm(`確定要清除全部 ${items.length} 筆估算記錄嗎？`)) {
      return
    }
    if (storage === 'cloud' && user) {
      // 雲端：逐筆刪除
      for (const e of (await loadEstimates(user.id)).items as CloudEstimate[]) {
        await deleteCloudEstimate(e.id, user.id)
      }
    } else {
      clearEstimateHistory()
    }
    setItems([])
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
              {storage === 'cloud' && (
                <Tag color="blue" icon={<CloudOutlined />} className="!ml-3">
                  雲端同步
                </Tag>
              )}
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
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry, i) => (
                <tr
                  key={entry.timestamp}
                  className={i % 2 === 0 ? 'bg-surface' : 'bg-surface-subtle/40'}
                >
                  <td className="px-4 py-3 text-muted">{formatTime(entry.timestamp)}</td>
                  <td className="px-4 py-3">{entry.courtName}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {entry.disabilityLevel ? `第 ${entry.disabilityLevel} 級` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{entry.selfFaultRatio}%</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">
                    ${entry.compulsoryTotalEstimated.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Tooltip title="把這個案件的欄位預填回估算表單">
                      <Button
                        type="link"
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={() => handleLoad(entry, i)}
                        data-testid="load-history"
                      >
                        載入
                      </Button>
                    </Tooltip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 手機：卡片 */}
        <div className="space-y-2 md:hidden">
          {items.map((entry, i) => (
            <div key={entry.timestamp} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center justify-between">
                <Text className="!text-xs text-muted">{formatTime(entry.timestamp)}</Text>
                <Text strong className="!text-sm tabular-nums">
                  ${entry.compulsoryTotalEstimated.toLocaleString()}
                </Text>
              </div>
              <div className="!mt-1 flex flex-wrap gap-2 !text-xs text-muted">
                <span>{entry.courtName}</span>
                {entry.disabilityLevel && <span>· 失能 {entry.disabilityLevel} 級</span>}
                <span>· 肇責 {entry.selfFaultRatio}%</span>
              </div>
              <Button
                type="link"
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => handleLoad(entry, i)}
                data-testid="load-history"
                block
              >
                載入回表單
              </Button>
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
