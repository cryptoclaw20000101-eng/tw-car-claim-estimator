'use client'

import { Button } from 'antd'
import type { ClaimInput, EstimationResult } from '@/lib/insurance/types'

export function EstimateAssumptions({
  input,
  result,
  onOpenSupplements,
}: {
  input: ClaimInput
  result: EstimationResult
  onOpenSupplements?: () => void
}) {
  const provisional = input.fault.faultSource === 'unclear' || input.fault.isFaultDisputed
  const coverage = input.basics.thirdPartyCoverageStatus ?? 'unknown'
  const missingCount = result.missingDocuments?.length ?? 0

  return (
    <section
      aria-label="本次試算假設"
      className="mb-5 rounded-lg border border-border bg-surface p-4"
    >
      <h3 className="mb-3 font-semibold">本次試算假設與待補資料</h3>
      <dl className="grid gap-3 text-sm md:grid-cols-3">
        <div>
          <dt className="text-muted">肇責比例{provisional ? '（暫定）' : ''}</dt>
          <dd className="mt-1">
            我方 {input.fault.selfFaultRatio}%／對方 {input.fault.otherFaultRatio}%
          </dd>
          {provisional && <p className="mt-1 text-muted">依假設比例試算，確認肇責後請重新估算。</p>}
        </div>
        <div>
          <dt className="text-muted">對方第三人責任險</dt>
          <dd className="mt-1">
            {coverage === 'unknown'
              ? '尚未確認；民事求償金額不代表保險給付。'
              : coverage === 'uninsured'
                ? '未投保／不適用；請核對可向對方主張的民事責任。'
                : '已填投保；保險給付仍須核對保額與保單條款。'}
          </dd>
        </div>
        <div>
          <dt className="text-muted">待補資料</dt>
          <dd className="mt-1">
            {missingCount > 0
              ? `${missingCount} 項，詳見「補件／風險」。`
              : '目前未列出缺件，仍需核對實際文件。'}
          </dd>
          {result.vehicleDamage === null && (
            <p className="mt-1 text-muted">
              車輛維修損失待補事故前車價，暫未列入任何總額或肇責比較。
            </p>
          )}
          {onOpenSupplements && (
            <Button type="link" className="!px-0" onClick={onOpenSupplements}>
              查看補件與風險
            </Button>
          )}
        </div>
      </dl>
    </section>
  )
}
