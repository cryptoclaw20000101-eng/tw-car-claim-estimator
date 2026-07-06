'use client'
// =====================================================================
// v0.8.3 法規版本標籤（結果頁顯示用）
// 顯示「強制險新法 (2026-07-01 起)」或「強制險舊法 (2026-07-01 前)」
// SSR-safe（不依賴 client state）
// =====================================================================

import { Tag, Tooltip } from 'antd'
import { isNewLaw, getLawVersionLabel } from '@/lib/data-sources/regulation-cutoff'

export interface LawVersionBadgeProps {
  /** 事故日（YYYY-MM-DD）；null/undefined 視為新法（保守預設）*/
  accidentDate?: string | null
  /** 自訂 tooltip 說明 */
  tooltip?: string
  /** 是否顯示圖示（default: true）*/
  showIcon?: boolean
}

const DEFAULT_NEW_LAW_TOOLTIP =
  '依強制汽車責任保險給付標準 §2.3.6（民國 115-05-29 修正、115-07-01 施行），\n特殊材料費與輔具費各自 pro-rata 套 2 萬上限（拆 subItems）。'

const DEFAULT_OLD_LAW_TOOLTIP =
  '依修法前之強制汽車責任保險給付標準（民國 114 年以前適用），\n醫療材料費、特殊材料費、輔具費 合併計算，套 2 萬上限。'

/**
 * 法規版本切換標籤（v0.8.3+）
 *
 * 顯示邏輯：
 *   - 新法（事故日 >= 2026-07-01 或未填）→ 綠色 Tag
 *   - 舊法（事故日 < 2026-07-01）→ 橘色 Tag
 *
 * @example
 * <LawVersionBadge accidentDate={input.basics.accidentDate} />
 */
export function LawVersionBadge({ accidentDate, tooltip, showIcon = true }: LawVersionBadgeProps) {
  const isNew = isNewLaw(accidentDate ?? null)
  const label = getLawVersionLabel(accidentDate ?? null)
  const fullLabel = isNew
    ? `強制險${label} · 特殊材料＋輔具各自 2 萬上限`
    : `強制險${label} · 醫材＋特殊材料＋輔具合併 2 萬上限`
  const color = isNew ? 'success' : 'warning'
  const defaultTooltip = isNew ? DEFAULT_NEW_LAW_TOOLTIP : DEFAULT_OLD_LAW_TOOLTIP
  const tipText = tooltip ?? defaultTooltip

  return (
    <Tooltip title={tipText} placement="top">
      <Tag
        color={color}
        className="!m-0"
        data-testid="law-version-badge"
        data-law-version={isNew ? 'new' : 'old'}
      >
        {showIcon && (
          <span aria-hidden="true" className="mr-1">
            {isNew ? '🆕' : '📜'}
          </span>
        )}
        {fullLabel}
      </Tag>
    </Tooltip>
  )
}
