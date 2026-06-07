
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Row,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  Collapse,
} from 'antd'
import {
  ArrowLeftOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  AlertOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  BankOutlined,
  ReadOutlined,
} from '@ant-design/icons'
import type { ClaimInput, EstimationResult } from '@/lib/insurance/types'
import { getMedianCourtCompensation, getCaseReferencesByCategory } from '@/lib/data-sources/judicial'
import { getAverageFoiCompensation } from '@/lib/data-sources/foi'
import { listLegalReferences, isLegalReferenceStale } from '@/lib/data-sources/legal-reference'
import type { LegalReference } from '@/lib/data-sources/types'

// 結果頁依賴 sessionStorage 與 AntD Table / Statistic，必須 client runtime

const { Title, Paragraph, Text } = Typography

const dollar = (n: number) => `NT$ ${(n ?? 0).toLocaleString('zh-TW')}`

export default function ResultForm() {
  const router = useRouter()
  // 用 lazy initializer 在第一次 render 時同步讀 sessionStorage，
  // 避免在 useEffect 內同步 setState 觸發 cascading render
  // （符合 react-hooks/set-state-in-effect 規則）
  const [hydrated] = useState(() => {
    if (typeof window === 'undefined') return { input: null, result: null, stale: false }
    const rawInput = sessionStorage.getItem('claim-input')
    const rawResult = sessionStorage.getItem('claim-result')
    if (!rawInput || !rawResult) return { input: null, result: null, stale: false }
    const input = JSON.parse(rawInput) as ClaimInput
    const result = JSON.parse(rawResult) as EstimationResult
    // 檢查法源時效（isLegalReferenceStale 是同步函數）
    let stale = false
    try {
      const all = listLegalReferences()
      stale = all.some((r) => isLegalReferenceStale(r))
    } catch {
      /* ignore */
    }
    return { input, result, stale }
  })

  useEffect(() => {
    if (!hydrated.input || !hydrated.result) {
      router.push('/claims/new')
    }
  }, [hydrated.input, hydrated.result, router])

  const input = hydrated.input
  const result = hydrated.result
  const stale = hydrated.stale

  if (!input || !result) {
    return <div className="p-12 text-center">載入中…</div>
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-8 bg-zinc-50">
      <div className="w-full max-w-5xl">
        <Space className="!mb-4">
          <Link href="/claims/new"><Button icon={<ArrowLeftOutlined />}>重新估算</Button></Link>
          <Link href="/"><Button>回首頁</Button></Link>
        </Space>

        <Title level={2} className="!mb-2">📊 估算結果</Title>
        <Paragraph type="secondary" className="!mb-4">
          事故地點：{input.basics.accidentLocation || '（未填）'} ·{' '}
          {input.basics.accidentDate} · 管轄法院：{result.region.courtName}
        </Paragraph>

        {stale && (
          <Alert
            type="warning"
            showIcon
            className="!mb-4"
            message="法源資料已超過 6 個月未更新"
            description="本結果所引用的法規/判例資料可能已過期，建議洽詢保險公司或律師確認最新規定。"
          />
        )}

        <Alert
          type="error"
          showIcon
          className="!mb-6"
          message="免責聲明"
          description="本結果為依使用者輸入及公開法源/案例之初步估算，非最終理賠金額。實際理賠須依保險公司審核、醫療資料、肇事責任、保單條款、評議/判決結果及雙方和解結果為準。"
        />

        <Tabs
          defaultActiveKey="compulsory"
          items={[
            {
              key: 'compulsory',
              label: <span><SafetyCertificateOutlined /> ① 強制險</span>,
              children: <CompulsorySection result={result} />,
            },
            {
              key: 'disability',
              label: <span><FileTextOutlined /> ② 失能初篩</span>,
              children: <DisabilitySection result={result} />,
            },
            {
              key: 'civil',
              label: <span><DollarOutlined /> ③ 民事損害</span>,
              children: <CivilSection result={result} />,
            },
            {
              key: 'third',
              label: <span><BankOutlined /> ④ 第三人責任險</span>,
              children: <ThirdPartySection result={result} input={input} />,
            },
            {
              key: 'supplement',
              label: <span><AlertOutlined /> ⑤ 補件 / 風險</span>,
              children: <SupplementSection result={result} />,
            },
            {
              key: 'region',
              label: <span><EnvironmentOutlined /> ⑥ 地區實務</span>,
              children: <RegionSection result={result} />,
            },
            {
              key: 'legal',
              label: <span><ReadOutlined /> ⑦ 法源依據</span>,
              children: <LegalSection />,
            },
          ]}
        />
      </div>
    </main>
  )
}

// ============== ① 強制險 ==============
function CompulsorySection({ result }: { result: EstimationResult }) {
  const rows = result.compulsoryItems
  const totalApplied = rows.reduce((s, r) => s + r.applied, 0)
  const totalApproved = rows.reduce((s, r) => s + r.approved, 0)
  return (
    <Card>
      <Row gutter={16} className="!mb-4">
        <Col xs={12} md={6}><Statistic title="申請小計" value={totalApplied} formatter={(v) => dollar(Number(v))} /></Col>
        <Col xs={12} md={6}><Statistic title="預估可認列" value={totalApproved} formatter={(v) => dollar(Number(v))} valueStyle={{ color: '#1677ff' }} /></Col>
        <Col xs={12} md={6}><Statistic title="失能給付" value={result.compulsoryDisabilityAmount} formatter={(v) => dollar(Number(v))} /></Col>
        <Col xs={12} md={6}><Statistic title="死亡給付" value={result.compulsoryDeathAmount} formatter={(v) => dollar(Number(v))} /></Col>
      </Row>
      <Alert
        type="info"
        showIcon
        className="!mb-3"
        message={`強制險總估算：${dollar(result.compulsoryTotalEstimated)}`}
        description="含醫療、失能、死亡。精神慰撫金、工作損失、車損不計入強制險（法律強制）。"
      />
      <Table
        size="small"
        rowKey="key"
        dataSource={rows}
        pagination={false}
        columns={[
          { title: '項目', dataIndex: 'label', width: 140 },
          { title: '申請', dataIndex: 'applied', render: (v: number) => dollar(v), width: 110 },
          { title: '預估可認', dataIndex: 'approved', render: (v: number) => <Text strong>{dollar(v)}</Text>, width: 130 },
          { title: '法定上限', dataIndex: 'legalCap', render: (v: number | null) => v ? dollar(v) : '—', width: 100 },
          { title: '刪減原因', dataIndex: 'reductionReason', render: (v: string | null) => v ? <Tag color="orange">{v}</Tag> : '—' },
          { title: '補件建議', dataIndex: 'supplementHint', render: (v: string | null) => v ?? '—' },
        ]}
      />
    </Card>
  )
}

// ============== ② 失能初篩 ==============
function DisabilitySection({ result }: { result: EstimationResult }) {
  const d = result.disability
  const colorMap: Record<string, string> = { A: 'green', B: 'blue', C: 'orange', D: 'red' }
  return (
    <Card>
      <Space size="middle" className="!mb-3">
        <Tag color={colorMap[d.screening]} style={{ fontSize: 18, padding: '4px 12px' }}>
          分級 {d.screening}
        </Tag>
        {d.possibleLevel && <Tag color="purple">可能失能等級：第 {d.possibleLevel} 級</Tag>}
        {d.possibleAmount > 0 && <Statistic title="依等級推估金額" value={d.possibleAmount} formatter={(v) => dollar(Number(v))} />}
      </Space>

      <Paragraph className="!mt-4">
        <Text strong>關鍵信號：</Text>
        {d.signals.length > 0 ? d.signals.join('、') : '（無明顯失能線索）'}
      </Paragraph>

      {d.romLossPercent !== null && d.jointName && (
        <Paragraph>
          <Text strong>{d.jointName} 關節</Text>活動度喪失約 {d.romLossPercent.toFixed(1)}%
        </Paragraph>
      )}

      <Divider />
      <Title level={5}>系統提示</Title>
      {d.notes.length > 0 ? (
        <ul>{d.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
      ) : (
        <Paragraph type="secondary">無</Paragraph>
      )}

      {d.needsSupplement.length > 0 && (
        <>
          <Divider />
          <Title level={5}>需補件</Title>
          <ul>{d.needsSupplement.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </>
      )}

      <Alert
        type="warning"
        showIcon
        className="!mt-4"
        message="失能等級須由醫院開立失能診斷書並經保險公司/評議/法院認定，本系統僅為初篩。"
      />
    </Card>
  )
}

// ============== ③ 民事損害 ==============
function CivilSection({ result }: { result: EstimationResult }) {
  const pas = result.painAndSuffering
  return (
    <Card>
      <Row gutter={16} className="!mb-4">
        <Col xs={24} md={8}><Statistic title="民事醫療差額" value={result.civilMedicalExpense} formatter={(v) => dollar(Number(v))} /></Col>
        <Col xs={24} md={8}><Statistic title="民事看護" value={result.civilNursingFeeMid} formatter={(v) => dollar(Number(v))} /></Col>
        <Col xs={24} md={8}><Statistic title="工作損失" value={result.workLoss} formatter={(v) => dollar(Number(v))} /></Col>
      </Row>

      <Divider>精神慰撫金（依 {result.region.courtName} 係數）</Divider>
      <Row gutter={16}>
        <Col xs={8}><Statistic title="低標" value={pas.regionalLow} formatter={(v) => dollar(Number(v))} /></Col>
        <Col xs={8}><Statistic title="中標" value={pas.regionalMid} formatter={(v) => dollar(Number(v))} valueStyle={{ color: '#1677ff' }} /></Col>
        <Col xs={8}><Statistic title="高標" value={pas.regionalHigh} formatter={(v) => dollar(Number(v))} /></Col>
      </Row>
      <Paragraph type="secondary" className="!mt-2 text-sm">
        基礎值 {dollar(pas.baseLow)} / {dollar(pas.baseMid)} / {dollar(pas.baseHigh)} × 地區係數 {pas.regionalMultiplier}
        · 嚴重度評分 {pas.severityScore} / 100（{pas.severityLevel}）
      </Paragraph>

      <Divider>勞動能力減損（終身）</Divider>
      <Row gutter={16}>
        <Col xs={24} md={12}><Statistic title="估算金額" value={result.laborCapacityLossEstimate} formatter={(v) => dollar(Number(v))} /></Col>
        <Col xs={24} md={12}><Paragraph type="secondary" className="!text-sm">{result.laborCapacityLossHint ?? '—'}</Paragraph></Col>
      </Row>

      <Divider>車損 / 財損（第三人責任險）</Divider>
      <Row gutter={16}>
        <Col xs={12}><Statistic title="車損" value={result.vehicleDamage} formatter={(v) => dollar(Number(v))} /></Col>
        <Col xs={12}><Statistic title="財損" value={result.propertyDamage} formatter={(v) => dollar(Number(v))} /></Col>
      </Row>
    </Card>
  )
}

// ============== ④ 第三人責任險 ==============
function ThirdPartySection({ result, input }: { result: EstimationResult; input: ClaimInput }) {
  const t = result.thirdParty
  if (!input.basics.hasThirdPartyInsurance) {
    return (
      <Card>
        <Empty description="未填寫第三人責任險" />
        <Paragraph type="secondary" className="!mt-4">
          若您/對方有第三人責任險體傷+財損保額，請在 Step 1 補填，本估算才有意義。
        </Paragraph>
      </Card>
    )
  }
  return (
    <Card>
      <Row gutter={16} className="!mb-4">
        <Col xs={12} md={6}><Statistic title="體傷保額" value={t.bodilyCap} formatter={(v) => dollar(Number(v))} /></Col>
        <Col xs={12} md={6}><Statistic title="財損保額" value={t.propertyCap} formatter={(v) => dollar(Number(v))} /></Col>
        <Col xs={12} md={6}><Statistic title="用盡體傷額度" value={t.usedBodilyCap ? '是' : '否'} valueStyle={{ color: t.usedBodilyCap ? '#cf1322' : '#3f8600' }} /></Col>
        <Col xs={12} md={6}><Statistic title="用盡財損額度" value={t.usedPropertyCap ? '是' : '否'} valueStyle={{ color: t.usedPropertyCap ? '#cf1322' : '#3f8600' }} /></Col>
      </Row>
      <Divider>第三人責任險估算（不含強制險）</Divider>
      <Row gutter={16}>
        <Col xs={8}><Statistic title="低標" value={t.thirdPartyEstimateLow} formatter={(v) => dollar(Number(v))} /></Col>
        <Col xs={8}><Statistic title="中標" value={t.thirdPartyEstimateMid} formatter={(v) => dollar(Number(v))} valueStyle={{ color: '#1677ff' }} /></Col>
        <Col xs={8}><Statistic title="高標" value={t.thirdPartyEstimateHigh} formatter={(v) => dollar(Number(v))} /></Col>
      </Row>
      <Paragraph type="secondary" className="!mt-2 text-sm">
        民事總損害 {dollar(t.civilDamageTotalLow)} / {dollar(t.civilDamageTotalMid)} / {dollar(t.civilDamageTotalHigh)}
        · 乘己方肇責 {input.fault.selfFaultRatio}% 後有責金額 {dollar(t.liableAmountLow)} / {dollar(t.liableAmountMid)} / {dollar(t.liableAmountHigh)}
      </Paragraph>
      {t.notes.length > 0 && (
        <>
          <Divider />
          <Title level={5}>系統提示</Title>
          <ul>{t.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </>
      )}
    </Card>
  )
}

// ============== ⑤ 補件 / 風險 ==============
function SupplementSection({ result }: { result: EstimationResult }) {
  return (
    <Card>
      <Title level={5}>需補件</Title>
      {result.missingDocuments.length > 0 ? (
        <ul>{result.missingDocuments.map((m, i) => <li key={i}><AlertOutlined /> {m}</li>)}</ul>
      ) : (
        <Paragraph type="success">✅ 目前資料充足，無需補件。</Paragraph>
      )}

      <Divider />
      <Title level={5}>風險提示</Title>
      {result.riskNotes.length > 0 ? (
        <ul>{result.riskNotes.map((n, i) => <li key={i}>⚠ {n}</li>)}</ul>
      ) : (
        <Paragraph type="secondary">無</Paragraph>
      )}
    </Card>
  )
}

// ============== ⑥ 地區實務 ==============
function RegionSection({ result }: { result: EstimationResult }) {
  const courtName = result.region.courtName
  const medianAmount = getMedianCourtCompensation(courtName, 'pain_and_suffering')
  const refs = getCaseReferencesByCategory('pain_and_suffering').filter((r) => r.courtName === courtName)
  // FoiDisputeCategory 沒有 pain_and_suffering，改用 nursing_fee / work_loss 平均
  const foiNursingAvg = getAverageFoiCompensation('nursing_fee')
  const foiWorkLossAvg = getAverageFoiCompensation('work_loss')
  return (
    <Card>
      <Title level={4}>{courtName} 地區係數</Title>
      <Row gutter={16} className="!mb-3">
        <Col xs={12} md={6}><Statistic title="慰撫金係數" value={result.region.painAndSufferingMultiplier} /></Col>
        <Col xs={12} md={6}><Statistic title="看護日額（中）" value={result.region.nursingDailyRateMid} formatter={(v) => `${Number(v).toLocaleString()} 元/日`} /></Col>
        <Col xs={12} md={6}><Statistic title="工作損失嚴格度" value={result.region.workLossEvidenceStrictness} /></Col>
        <Col xs={12} md={6}><Statistic title="車損折舊嚴格度" value={result.region.vehicleDepreciationStrictness} /></Col>
      </Row>
      <Alert
        type="info"
        showIcon
        className="!mb-4"
        message={result.region.regionNotes}
        description={`資料信心：${result.region.confidenceLevel}`}
      />

      <Divider>司法院同類判決中位數（精神慰撫金）</Divider>
      {medianAmount !== null ? (
        <Paragraph>
          {courtName} 精神慰撫金中位數：<Text strong>{dollar(medianAmount)}</Text>
        </Paragraph>
      ) : (
        <Paragraph type="secondary">無資料</Paragraph>
      )}
      {refs.length > 0 && (
        <Collapse
          items={refs.slice(0, 3).map((r) => ({
            key: r.caseId,
            label: `${r.caseId} · ${r.amount !== null ? dollar(r.amount) : '（無具體金額）'}（區間 ${dollar(r.amountLow)}-${dollar(r.amountHigh)}）`,
            children: (
              <Space direction="vertical">
                <Text>{r.summary}</Text>
                <Text type="secondary" className="!text-xs">{r.keyReasoning}</Text>
              </Space>
            ),
          }))}
        />
      )}

      <Divider>金融評議中心同類平均</Divider>
      <Paragraph>
        看護費類平均：{foiNursingAvg !== null ? dollar(foiNursingAvg) : '—'} ·
        工作損失類平均：{foiWorkLossAvg !== null ? dollar(foiWorkLossAvg) : '—'}
      </Paragraph>
      <Paragraph type="secondary" className="!text-xs">
        ※ 金融評議中心資料含調解/評議結果，金額區間較法院判決彈性；精神慰撫金非 Foi 評議主要類別，故不列。
      </Paragraph>
    </Card>
  )
}

// ============== ⑦ 法源依據 ==============
function LegalSection() {
  const refs: LegalReference[] = listLegalReferences()
  return (
    <Card>
      <Title level={4}>引用法源</Title>
      <Table<LegalReference>
        size="small"
        rowKey="key"
        dataSource={refs}
        pagination={false}
        columns={[
          { title: '法規名稱', dataIndex: 'title' },
          { title: '生效日', dataIndex: 'effectiveDate', width: 120 },
          { title: '最後檢視', dataIndex: 'lastReviewed', width: 120 },
          { title: '重要條號', dataIndex: 'relevantArticles', width: 220, render: (v: string[]) => v.join('、') },
          { title: 'URL', dataIndex: 'sourceUrl', width: 160, render: (v: string) => <a href={v} target="_blank" rel="noreferrer">查閱</a> },
        ]}
      />
      <Alert
        type="info"
        showIcon
        className="!mt-4"
        message="以上法源僅作估算依據；個案適用仍以最新法規及主管機關解釋為準。"
      />
    </Card>
  )
}
