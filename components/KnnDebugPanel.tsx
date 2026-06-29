/**
 * KnnDebugPanel — KNN 推薦理由面板（v0.7.3+）
 *
 * 設計目的：
 *   引擎已經算好 KNN 距離（v0.6.1）但結果丟掉了，UI 完全看不到
 *   「為什麼這個案例被推薦」。本元件把每個被推薦案例的 5 維距離
 *   拆解 + query 對比 + 解釋文字視覺化：
 *   - 5 維長條圖（city / disability_level / year / injury_severity / has_disability_record）
 *   - 各維「為什麼這麼高/低」的解釋
 *   - 加總距離 vs 0 距離極限（直觀「多像」）
 *
 * 使用場景：
 *   1. 結果頁理賠實務案例 Collapse — 每件展開顯示
 *   2. PainEnsembleCard KNN 票區（v0.7.3+ 開 debug=true）
 *
 * 設計選擇：
 *   - 純展示元件，無 state、無副作用 → 易測試
 *   - 'use client' 因為包了 AntD Progress/Tag/Tooltip
 *   - 5 維長條用 AntD Progress（與既有 EnsembleHealthHeroCard 風格一致）
 *   - 距離 0 = 完全相同 / 5 = 5 維全極端
 *
 * 不變量（測試守護）：
 *   - 空陣列 → 回 null 不 render
 *   - 每件距離加總 = 5 維 breakdown 加總
 *   - city: null vs null 不渲染（已是 0）
 *   - Tooltip 解釋永遠顯示（不論距離）
 */

'use client'

import { Card, Progress, Space, Tag, Tooltip, Typography } from 'antd'
import type { PracticeCaseWithKnn } from '@/lib/estimate/precedents'
import type { KnnDimensionBreakdown, PrecedentFeatures } from '@/lib/estimate/precedent-knn'

const { Text, Paragraph } = Typography

export interface KnnDebugPanelProps {
  /** findRelatedPracticeCases(..., true) 的回傳 */
  cases: PracticeCaseWithKnn[]
  /** 顯示標題（可省略，預設 "KNN 推薦理由"） */
  title?: string
}

interface DimensionRow {
  label: string
  emoji: string
  value: number
  tip: string
}

/**
 * 5 維解釋產生器
 *  - 每維產生 1 句「為什麼這個案例這項得 X 分」
 *  - city null vs null 不顯示（已是 0，無意義）
 */
function explainDimension(
  key: keyof KnnDimensionBreakdown,
  value: number,
  query: PrecedentFeatures,
  caseFeatures: PrecedentFeatures,
): string {
  switch (key) {
    case 'city': {
      if (query.city === null && caseFeatures.city === null) return ''
      if (value === 0) return `同縣市 ${query.city ?? caseFeatures.city}（+0 完全相符）`
      if (value === 1) return `不同縣市：query=${query.city ?? '?'} vs 案例=${caseFeatures.city ?? '?'}`
      return `一邊未知：query=${query.city ?? '?'} vs 案例=${caseFeatures.city ?? '?'}（中性 0.5）`
    }
    case 'disabilityLevel': {
      if (query.disabilityLevel === null && caseFeatures.disabilityLevel === null) return ''
      if (value === 0) return `同失能等級 第 ${query.disabilityLevel ?? caseFeatures.disabilityLevel} 級`
      const qLv = query.disabilityLevel ?? '?'
      const cLv = caseFeatures.disabilityLevel ?? '?'
      if (value === 0.5) return `一邊無失能：query=${qLv} vs 案例=${cLv}（中性 0.5）`
      const diff = Math.abs((query.disabilityLevel ?? 0) - (caseFeatures.disabilityLevel ?? 0))
      return `等級差 ${diff} 級（query=${qLv} vs 案例=${cLv}，正規化 ${value.toFixed(2)}）`
    }
    case 'year': {
      const diff = Math.abs(query.year - caseFeatures.year)
      return `年份差 ${diff} 年（query=${query.year} vs 案例=${caseFeatures.year}，正規化 ${value.toFixed(2)}）`
    }
    case 'injurySeverity': {
      if (query.injurySeverity === null && caseFeatures.injurySeverity === null) return ''
      if (value === 0) return '傷勢嚴重度相同'
      if (value === 0.5) return '一邊傷勢未知（中性 0.5）'
      return `傷勢嚴重度 ordinal 差 ${(value * 4).toFixed(1)} 級`
    }
    case 'hasDisabilityRecord': {
      return value === 0
        ? '失能紀錄一致'
        : '失能紀錄不一致（query 有 vs 案例無 或反之）'
    }
  }
}

function similarityLevel(distance: number): { label: string; color: string } {
  if (distance <= 0.5) return { label: '極相似', color: 'green' }
  if (distance <= 1.5) return { label: '相似', color: 'lime' }
  if (distance <= 2.5) return { label: '普通', color: 'gold' }
  if (distance <= 3.5) return { label: '偏遠', color: 'orange' }
  return { label: '極遠', color: 'red' }
}

function caseFeatures(p: PracticeCaseWithKnn): PrecedentFeatures {
  if (!p.knnBreakdown) {
    return { city: null, disabilityLevel: null, year: 0, injurySeverity: null, hasDisabilityRecord: false }
  }
  // knnBreakdown 沒存 case 端 city/level，要從 PracticeCase 重算
  let caseLevel: number | null = null
  for (const d of p.disabilities ?? []) {
    const lv = parseInt(d.level, 10)
    if (!isNaN(lv)) {
      caseLevel = lv
      break
    }
  }
  return {
    city: null, // city 已隱含在 knnBreakdown.city
    disabilityLevel: caseLevel,
    year: p.year,
    injurySeverity: null,
    hasDisabilityRecord: (p.disabilities ?? []).length > 0,
  }
}

export function KnnDebugPanel({ cases, title = '🔍 KNN 推薦理由（debug）' }: KnnDebugPanelProps) {
  // 過濾掉沒附 KNN 距離的（callers 沒傳 withKnnDebug=true）
  const debuggable = cases.filter(
    (c): c is PracticeCaseWithKnn & {
      knnDistance: number
      knnBreakdown: KnnDimensionBreakdown
      knnQuery: PrecedentFeatures
    } => c.knnDistance !== undefined && c.knnBreakdown !== undefined && c.knnQuery !== undefined,
  )

  if (debuggable.length === 0) return null

  return (
    <Card size="small" className="!mt-2 !bg-blue-50/40">
      <Text strong className="!text-sm">
        {title}
      </Text>
      <Paragraph type="secondary" className="!text-xs !mt-1 !mb-2">
        KNN 距離 = 5 維加總（0 = 完全相同，5 = 5 維全極端）。越小越相似。
      </Paragraph>

      <Space orientation="vertical" size="middle" className="!w-full">
        {debuggable.map((c) => {
          const distance = c.knnDistance
          const breakdown = c.knnBreakdown
          const query = c.knnQuery
          const cf = caseFeatures(c)
          const simMeta = similarityLevel(distance)

          const rows: DimensionRow[] = [
            {
              label: '縣市',
              emoji: '🏙️',
              value: breakdown.city,
              tip: explainDimension('city', breakdown.city, query, cf),
            },
            {
              label: '失能等級',
              emoji: '🩺',
              value: breakdown.disabilityLevel,
              tip: explainDimension('disabilityLevel', breakdown.disabilityLevel, query, cf),
            },
            {
              label: '年份',
              emoji: '📅',
              value: breakdown.year,
              tip: explainDimension('year', breakdown.year, query, cf),
            },
            {
              label: '傷勢',
              emoji: '⚕️',
              value: breakdown.injurySeverity,
              tip: explainDimension('injurySeverity', breakdown.injurySeverity, query, cf),
            },
            {
              label: '失能紀錄',
              emoji: '📋',
              value: breakdown.hasDisabilityRecord,
              tip: explainDimension('hasDisabilityRecord', breakdown.hasDisabilityRecord, query, cf),
            },
          ]

          return (
            <div key={c.id} className="!bg-white !p-2 !rounded">
              <Space size="small" wrap className="!mb-2">
                <Text strong className="!text-xs">
                  {c.caseNo}
                </Text>
                <Tag color={simMeta.color} className="!text-xs">
                  距離 {distance.toFixed(2)} · {simMeta.label}
                </Tag>
              </Space>

              <Space orientation="vertical" size={4} className="!w-full">
                {rows.map((row) => (
                  <div key={row.label} className="!flex !items-center !gap-2">
                    <Tooltip title={row.tip || `${row.label} 維度距離`}>
                      <Text className="!text-xs !w-20 !shrink-0">
                        {row.emoji} {row.label}
                      </Text>
                    </Tooltip>
                    <Progress
                      percent={Math.round(row.value * 100)}
                      size="small"
                      showInfo={false}
                      strokeColor={
                        row.value === 0
                          ? '#52c41a'
                          : row.value <= 0.3
                            ? '#73d13d'
                            : row.value <= 0.6
                              ? '#faad14'
                              : '#ff4d4f'
                      }
                      className="!flex-1 !mb-0"
                    />
                    <Text type="secondary" className="!text-xs !w-12 !text-right !shrink-0">
                      {row.value.toFixed(2)}
                    </Text>
                  </div>
                ))}
              </Space>
            </div>
          )
        })}
      </Space>
    </Card>
  )
}

export default KnnDebugPanel