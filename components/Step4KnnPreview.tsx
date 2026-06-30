/**
 * Step4KnnPreview — Step4 失能等級輸入時即時 KNN 預視（v0.7.6+）
 *
 * 設計目的：
 *   v0.7.3 KNN debug panel 只在「結果頁」顯示，業務員填表時不知道
 *   「這個失能等級會推薦哪些案例」。本元件把 KNN 預覽前推到 Step4 表單
 *   填寫階段：邊打邊看到相似判例 → 填表更直覺、結果更可預期。
 *
 * 運作：
 *   1. useWatch 監聽 medical.disabilityLevel + basics.accidentLocation
 *   2. 防抖 300ms 避免每 keystroke 重算
 *   3. 用 findRelatedPracticeCases(courtName, level, 3, true) 拿 top 3 + KNN 拆解
 *   4. 顯示 3 張卡片（案例編號 + 距離 + 相似度）+ KnnDebugPanel 展開 5 維
 *
 * 不打 API / 不打 LLM：
 *   - 純 client-side，200+ precedents 已內嵌在 bundle（v0.5.x iOS Safari 修護時驗證）
 *   - 0 網路成本，每次更新只在記憶體跑 KNN（< 5ms）
 *
 * 不變量（測試守護）：
 *   - 空 disabilityLevel → 顯示提示「填入失能等級後預覽」
 *   - 兩欄齊全 + 0 件 → 顯示「無相似案例」
 *   - 兩欄齊全 + N 件 → 顯示 N 張卡片 + KnnDebugPanel
 *   - courtName 空 → fallback 為空字串（findRelatedPracticeCases 內部處理 null city）
 *   - 防抖 300ms：快速切換不重複計算
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import { Alert, Card, Empty, Space, Spin, Tag, Typography } from 'antd'
import type { PracticeCaseWithKnn } from '@/lib/estimate/precedents'
import { findRelatedPracticeCases } from '@/lib/estimate/precedents'
import { KnnDebugPanel } from '@/components/KnnDebugPanel'

const { Text, Paragraph } = Typography

export interface Step4KnnPreviewProps {
  /** 失能等級（1-15，null = 未填） */
  disabilityLevel: number | null | undefined
  /** 事故地點（從 Step1 basics.accidentLocation 帶入，用於 cityOfInjury → court → city 推導） */
  accidentLocation: string | null | undefined
}

const DEBOUNCE_MS = 300

/**
 * 防抖 hook — 只在值停止變動後 DEBOUNCE_MS 才更新 debouncedValue
 * 用 useState + useEffect 避免 lodash 依賴（AGENTS §2.2 零套件原則）
 */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function similarityLabel(distance: number): { label: string; color: string } {
  if (distance <= 0.5) return { label: '極相似', color: 'green' }
  if (distance <= 1.5) return { label: '相似', color: 'lime' }
  if (distance <= 2.5) return { label: '普通', color: 'gold' }
  if (distance <= 3.5) return { label: '偏遠', color: 'orange' }
  return { label: '極遠', color: 'red' }
}

export function Step4KnnPreview({ disabilityLevel, accidentLocation }: Step4KnnPreviewProps) {
  // 防抖：避免快速切換失能等級時重複計算
  const debouncedLevel = useDebouncedValue(disabilityLevel, DEBOUNCE_MS)
  const debouncedLocation = useDebouncedValue(accidentLocation, DEBOUNCE_MS)

  const cases: PracticeCaseWithKnn[] = useMemo(() => {
    // 條件：失能等級必填才跑 KNN（無等級則無相似度可比）
    if (debouncedLevel == null) return []
    const courtName = debouncedLocation ?? ''
    return findRelatedPracticeCases(courtName, debouncedLevel, 3, true) as PracticeCaseWithKnn[]
  }, [debouncedLevel, debouncedLocation])

  // 條件 1：失能等級未填 → 提示
  if (disabilityLevel == null) {
    return (
      <Alert
        type="info"
        showIcon
        title="填入失能等級後，預覽與目前案件最相似的 3 個真實判例"
        className="!mt-4"
      />
    )
  }

  // 條件 2：兩欄齊全但 0 件 → 空狀態
  if (cases.length === 0) {
    return (
      <Card size="small" title="📊 即時 KNN 預視" className="!mt-4">
        <Empty description="無相似案例（資料庫可能尚未含此等級 / 地點組合）" />
      </Card>
    )
  }

  // 條件 3：兩欄齊全且有結果 → 3 張卡片 + KnnDebugPanel
  return (
    <Card
      size="small"
      title={`📊 即時 KNN 預視（失能等級 ${disabilityLevel}${accidentLocation ? ` · ${accidentLocation}` : ''}）`}
      className="!mt-4"
      extra={<Tag color="blue">client-side · 0 網路成本</Tag>}
    >
      <Paragraph type="secondary" className="!text-xs !mt-0 !mb-3">
        從 {cases.length > 0 ? '200+' : '0'} 筆真實判例中，依 5 維特徵（縣市/失能等級/年份/傷勢/失能紀錄）找出最相似的 {cases.length} 筆。
        距離越小越相似。
      </Paragraph>

      <Space orientation="vertical" size="small" className="!w-full">
        {cases.map((c) => {
          const distance = c.knnDistance ?? 0
          const sim = similarityLabel(distance)
          return (
            <Card
              key={c.id}
              size="small"
              className="!bg-blue-50/30"
              data-testid="knn-preview-card"
            >
              <Space size="small" wrap className="!w-full !justify-between">
                <Space size="small" wrap>
                  <Text strong className="!text-sm">
                    {c.caseNo}
                  </Text>
                  <Tag color="default" className="!text-xs">
                    {c.court}
                  </Tag>
                  <Tag color="default" className="!text-xs">
                    {c.year} 年
                  </Tag>
                  {c.disabilities?.[0]?.level && (
                    <Tag color="purple" className="!text-xs">
                      失能 {c.disabilities[0].level} 級
                    </Tag>
                  )}
                </Space>
                <Tag color={sim.color} className="!text-xs">
                  距離 {distance.toFixed(2)} · {sim.label}
                </Tag>
              </Space>
            </Card>
          )
        })}
      </Space>

      <details className="!mt-3">
        <summary className="!cursor-pointer !text-xs !text-gray-500">
          🔍 展開 KNN 5 維拆解
        </summary>
        <KnnDebugPanel cases={cases} title="為什麼這些案例被推薦？" />
      </details>
    </Card>
  )
}

/**
 * 載入中佔位 — 用於 SSR/hydration 前
 * 防 hydration mismatch 警告
 */
export function Step4KnnPreviewSkeleton() {
  return (
    <Card size="small" title="📊 即時 KNN 預視" className="!mt-4">
      <Space>
        <Spin size="small" />
        <Text type="secondary" className="!text-xs">
          載入相似判例資料中…
        </Text>
      </Space>
    </Card>
  )
}