'use client'

import { Button, Checkbox, Form } from 'antd'
import type { FormSchema } from '../_form'

interface ReviewSummaryProps {
  data: FormSchema
  onEdit: (step: number) => void
  roleOptions: { value: string; label: string }[]
  faultSourceOptions: { value: string; label: string }[]
}

/** Confirmation stays in the form store only; drafts and claim inputs contain no approval flag. */
export function ReviewSummary({
  data,
  onEdit,
  roleOptions,
  faultSourceOptions,
}: ReviewSummaryProps) {
  const { basics, fault, person } = data
  const rows = [
    {
      title: '事故資料',
      step: 0,
      value: [
        basics.accidentDate,
        basics.accidentCity,
        roleOptions.find((option) => option.value === basics.injuredRole)?.label,
        basics.isInjured ? '有受傷' : '未受傷',
      ]
        .filter(Boolean)
        .join('・'),
    },
    {
      title: '肇責比例',
      step: 1,
      value: `我方 ${fault.selfFaultRatio}%／對方 ${fault.otherFaultRatio}%・${faultSourceOptions.find((option) => option.value === fault.faultSource)?.label ?? '尚未確認'}`,
    },
    ...(basics.isInjured
      ? [
          {
            title: '年齡與收入',
            step: 2,
            value: `事故時 ${person.age} 歲・平均月薪 ${typeof person.sixMonthAverageSalary === 'number' && Number.isFinite(person.sixMonthAverageSalary) ? `${person.sixMonthAverageSalary.toLocaleString('zh-TW')} 元` : '未填'}`,
          },
        ]
      : []),
  ]

  return (
    <section
      aria-label="送出前核對"
      className="mt-5 rounded-lg border border-border bg-surface p-4"
    >
      <h3 className="mb-2 font-semibold">送出前核對</h3>
      <p className="mb-3 text-sm text-muted">預填值不代表實際案情，請核對後再送出。</p>
      <dl className="mb-4 divide-y divide-border">
        {rows.map((row) => (
          <div key={row.step} className="flex items-start justify-between gap-3 py-2">
            <div className="min-w-0">
              <dt className="text-sm text-muted">{row.title}</dt>
              <dd className="mt-1 break-words text-sm">{row.value}</dd>
            </div>
            <Button
              type="link"
              size="small"
              onClick={() => onEdit(row.step)}
              aria-label={`修改${row.title}`}
            >
              修改
            </Button>
          </div>
        ))}
      </dl>
      <Form.Item
        name="_reviewConfirmed"
        valuePropName="checked"
        className="!mb-0"
        rules={[
          {
            validator: (_, checked) =>
              checked === true
                ? Promise.resolve()
                : Promise.reject(new Error('請先核對摘要並勾選確認')),
          },
        ]}
      >
        <Checkbox>我已核對以上資料；未確認肇責僅作試算假設</Checkbox>
      </Form.Item>
    </section>
  )
}
