'use client'

/**
 * EnsembleHealthHeroCard — 首頁 hero Ensemble 健康度小卡（v0.6.9+）
 *
 * 設計目的：
 *   v0.6.8 報表層加了 Ensemble 健康度區塊，但保經/律師要自己開報表才看得到。
 *   此元件把 Ensemble 健康度拉到首頁 hero 第一眼可見的位置。
 *
 * 設計紀律（沿用 taste-skill v1）：
 *   - 無 emoji（用「high / medium / low / none」純文字 + 對應文字色）
 *   - 數字 tabular-nums
 *   - 強調色沿用 rose-700（單一強調色）
 *   - 卡片樣式沿用 hero 右側「引用法源」「地區覆蓋」同 rounded-lg border
 *
 * 資料來源：build-time 靜態內嵌 taipei-mental-distress.json（Next 16 turbopack JSON imports）
 *   - import data from '@/data/precedents/taipei-mental-distress.json'
 *   - 102 件 × 約 50 bytes/件 = ~5KB build overhead（可接受）
 *   - 不需要 runtime fetch / loading state / API route
 */

import { Space, Tooltip, Typography } from 'antd'
import { ExperimentOutlined, WarningOutlined } from '@ant-design/icons'
import anchorData from '@/data/precedents/taipei-mental-distress.json'
import {
  computeEnsembleHealth,
  CONFIDENCE_META,
  type PrecedentRow,
} from '@/lib/insurance/pain-ensemble-health'

const { Text } = Typography

export function EnsembleHealthHeroCard() {
  // build-time 靜態計算（Next turbopack 把 JSON 內嵌進 bundle）
  const health = computeEnsembleHealth(anchorData as PrecedentRow[])
  const meta = CONFIDENCE_META[health.confidenceLevel]

  return (
    <div className="!mt-3 rounded-lg border border-border bg-surface p-4 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
      <Space size={6} className="!mb-2">
        <ExperimentOutlined />
        <Text className="!text-xs uppercase tracking-wider text-muted">
          Ensemble 健康度
        </Text>
      </Space>
      <div className="grid grid-cols-3 gap-3">
        {/* anchor 件數 */}
        <Tooltip title="歷史精神慰撫金判決 anchor 數量（ML 票依據）">
          <div>
            <div className="tabular-nums text-2xl font-semibold tracking-tight text-foreground">
              {health.anchorN}
            </div>
            <div className="text-xs uppercase tracking-wider text-muted">
              anchor 件數
            </div>
          </div>
        </Tooltip>

        {/* 中位數 */}
        <Tooltip title={`歷史 anchor 中位數（${health.anchorP10.toLocaleString()} ~ ${health.anchorP90.toLocaleString()}）`}>
          <div>
            <div className="tabular-nums text-2xl font-semibold tracking-tight text-foreground">
              {Math.round(health.anchorMedian / 1000)}K
            </div>
            <div className="text-xs uppercase tracking-wider text-muted">
              中位數
            </div>
          </div>
        </Tooltip>

        {/* 信心度 */}
        <Tooltip title={health.confidenceTip}>
          <div>
            <div className={`tabular-nums text-2xl font-semibold tracking-tight ${meta.color}`}>
              {meta.label}
            </div>
            <div className="text-xs uppercase tracking-wider text-muted">
              信心度
            </div>
          </div>
        </Tooltip>
      </div>

      {/* 傷勢梯度警示（沿用 rose-700 強調色） */}
      {health.injuryGradientWarning && (
        <div className="!mt-3 rounded border border-accent/20 bg-accent/5 p-2">
          <Space size={6} align="start">
            <WarningOutlined className="text-accent" />
            <Text className="!text-xs text-foreground">
              {health.injuryGradientWarning}
            </Text>
          </Space>
        </div>
      )}

      {/* 區間 + 提示（避免重複顯示 tip，tip 已在 tooltip 內） */}
      <Text className="!mt-2 !text-xs text-muted">
        P10 ~ P90：{health.anchorP10.toLocaleString()} ~ {health.anchorP90.toLocaleString()}
      </Text>
    </div>
  )
}
