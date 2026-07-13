'use client'

/**
 * BatchForm — 批次估算表單（v0.12.0+ Phase E1）
 *
 * UI 流程：
 * 1. 貼上 CSV（4 欄：accidentDate / accidentLocation / disabilityLevel / faultRatio）
 * 2. 點「批次估算」
 * 3. 顯示結果表格（含每案的強制險估算金額、第三人責任險中標、錯誤訊息）
 * 4. 可「複製 CSV」把結果貼到 Excel
 */

import { useState } from 'react'
import Link from 'next/link'
import { Alert, Button, Card, Space, Table, Typography } from 'antd'
import { InfoAlert } from '@/components/InfoAlert'
// v0.13.x：共用 PageBreadcrumb 元件
import { PageBreadcrumb } from '@/components/PageBreadcrumb'
import { FileTextOutlined, ThunderboltOutlined, CopyOutlined } from '@ant-design/icons'
import {
  parseBatchCsv,
  estimateBatch,
  batchToCsv,
  BATCH_CSV_EXAMPLE,
  type BatchRow,
} from '@/lib/batch-estimator'

const { Title, Paragraph, Text } = Typography

export default function BatchForm() {
  const [csv, setCsv] = useState('')
  const [rows, setRows] = useState<BatchRow[]>([])
  const [computing, setComputing] = useState(false)

  const handleEstimate = async () => {
    if (!csv.trim()) return
    setComputing(true)
    // 讓 spinner 有時間顯示
    await new Promise((r) => setTimeout(r, 50))
    const parsed = parseBatchCsv(csv)
    const computed = estimateBatch(parsed)
    setRows(computed)
    setComputing(false)
  }

  const handleCopy = async () => {
    const csvOut = batchToCsv(rows)
    try {
      await navigator.clipboard.writeText(csvOut)
      // 簡單 fallback：alert
      // eslint-disable-next-line no-alert
      alert('已複製結果 CSV 到剪貼簿')
    } catch {
      // eslint-disable-next-line no-alert
      alert('複製失敗，請手動選取')
    }
  }

  const handleLoadExample = () => {
    setCsv(BATCH_CSV_EXAMPLE)
  }

  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col items-center px-6 py-8 bg-surface-subtle"
    >
      <div className="w-full max-w-5xl">
        <PageBreadcrumb back={{ kind: 'link', href: '/claims/new', label: '← 回單筆估算' }} />

        <Title level={2} className="!mb-2">
          <ThunderboltOutlined className="mr-2 text-accent" />
          批次估算（多案件）
        </Title>
        <Paragraph type="secondary" className="!mb-4">
          貼上 CSV 一次估算多個車禍理賠案件。業務員一天處理多案件不必逐筆填表。
          <br />
          <Text strong>注意：</Text>本工具以 SAMPLE_INPUT 模板為基底（保戶資料 /
          醫療細節用預設值）， 只調整「事故日 + 事故地點 + 失能等級 + 肇責比例」四個變數。
        </Paragraph>

        <InfoAlert
          type="info"
          showIcon
          className="!mb-4"
          title="CSV 格式"
          body={
            <div className="!text-xs">
              <p className="!mb-1">
                每行一個案件，逗號分隔，4 欄順序：
                <code>accidentDate, accidentLocation, disabilityLevel, faultRatio</code>
              </p>
              <p className="!mb-1">
                faultRatio 是己方肇責 0-100，otherFaultRatio 自動推算 = 100 - faultRatio
              </p>
              <Button type="link" size="small" onClick={handleLoadExample} className="!p-0">
                <FileTextOutlined /> 載入範例 CSV
              </Button>
            </div>
          }
        />

        {/* CSV 輸入區 */}
        <Card
          className="!mb-4"
          title={
            <>
              <FileTextOutlined /> 貼上 CSV
            </>
          }
        >
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={BATCH_CSV_EXAMPLE}
            rows={8}
            className="!w-full rounded border border-border bg-surface p-3 font-mono !text-xs"
            data-testid="batch-csv-input"
          />
          <Space className="!mt-3">
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={handleEstimate}
              loading={computing}
              disabled={!csv.trim()}
              data-testid="batch-estimate-button"
            >
              批次估算
            </Button>
            <Button onClick={() => setCsv('')} disabled={!csv}>
              清空
            </Button>
          </Space>
        </Card>

        {/* 結果表 */}
        {rows.length > 0 && (
          <Card
            title={`估算結果（${rows.length} 筆，${rows.filter((r) => r.result).length} 成功 / ${rows.filter((r) => r.error).length} 失敗）`}
            extra={
              <Button icon={<CopyOutlined />} onClick={handleCopy} data-testid="batch-copy-csv">
                複製結果 CSV
              </Button>
            }
          >
            <Table
              size="small"
              rowKey="rowNumber"
              pagination={false}
              dataSource={rows}
              columns={[
                { title: '#', dataIndex: 'rowNumber', width: 50 },
                { title: '事故日', dataIndex: 'accidentDate', width: 110 },
                { title: '地點', dataIndex: 'accidentLocation' },
                {
                  title: '失能等級',
                  dataIndex: 'disabilityLevel',
                  width: 90,
                  render: (v: number) => `第 ${v} 級`,
                },
                {
                  title: '己方肇責',
                  dataIndex: 'faultRatio',
                  width: 90,
                  render: (v: number) => `${v}%`,
                },
                {
                  title: '強制險估算',
                  dataIndex: ['result', 'compulsoryTotalEstimated'],
                  width: 130,
                  align: 'right',
                  render: (v?: number) =>
                    v ? `NT$ ${v.toLocaleString()}` : <Text type="danger">—</Text>,
                },
                {
                  title: '第三人責任險中標',
                  dataIndex: ['result', 'thirdParty', 'thirdPartyEstimateMid'],
                  width: 150,
                  align: 'right',
                  render: (v?: number) =>
                    v ? `NT$ ${v.toLocaleString()}` : <Text type="danger">—</Text>,
                },
                {
                  title: '狀態',
                  dataIndex: 'error',
                  width: 180,
                  render: (e?: string) =>
                    e ? (
                      <Text type="danger" className="!text-xs">
                        {e}
                      </Text>
                    ) : (
                      <Text type="success">✓ OK</Text>
                    ),
                },
              ]}
              scroll={{ x: 'max-content' }}
            />
          </Card>
        )}

        <Paragraph type="secondary" className="!mt-6 !text-xs">
          免責聲明：本批次估算結果為試算，非最終理賠金額。實際金額以保險公司審核為準。
        </Paragraph>
      </div>
    </main>
  )
}
