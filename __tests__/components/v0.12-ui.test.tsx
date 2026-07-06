/**
 * v0.12.0+ 新增 components SSR smoke tests
 *
 * 純 SSR（renderToString）守護關鍵 HTML 結構
 * 跟現有 components/*.test.tsx 風格一致
 */

import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { FormProgress } from '@/components/FormProgress'
import { EstimateHistory } from '@/components/EstimateHistory'
import { Skeleton, SkeletonBlock } from '@/components/Skeleton'
import { MultiFaultCompare } from '@/components/MultiFaultCompare'
import { AuthProvider } from '@/components/AuthProvider'

describe('FormProgress SSR', () => {
  it('渲染 7 步驟圓圈', () => {
    const steps = [
      { title: '事故基本' },
      { title: '肇責' },
      { title: '人身' },
      { title: '診斷' },
      { title: '收據' },
      { title: '車損' },
      { title: '地區' },
    ]
    const html = renderToString(<FormProgress steps={steps} current={3} />)
    expect(html).toContain('data-testid="form-progress"')
    expect(html).toContain('事故基本')
    expect(html).toContain('肇責')
    expect(html).toContain('地區')
  })

  it('完成狀態的步驟有 Check icon', () => {
    const steps = [{ title: 'Step A' }, { title: 'Step B' }]
    const html = renderToString(<FormProgress steps={steps} current={1} />)
    expect(html).toContain('data-step-status="done"')
  })

  it('空 steps 不崩潰', () => {
    const html = renderToString(<FormProgress steps={[]} current={0} />)
    expect(html).toBeTruthy()
  })
})

describe('EstimateHistory SSR', () => {
  it('SSR 不 render（避免首次訪問打擾）', () => {
    // v0.14.x：EstimateHistory 內部用 useAuth，需包 AuthProvider
    const html = renderToString(
      <AuthProvider>
        <EstimateHistory />
      </AuthProvider>,
    )
    expect(html).toBe('')
  })
})

describe('Skeleton SSR', () => {
  it('Skeleton 單塊渲染', () => {
    const html = renderToString(<Skeleton width="w-48" height="h-4" />)
    expect(html).toContain('w-48')
    expect(html).toContain('h-4')
    expect(html).toContain('bg-gray-200/60')
    expect(html).toContain('aria-hidden')
  })

  it('SkeletonBlock 多行渲染', () => {
    const html = renderToString(<SkeletonBlock rows={3} widths={['w-full', 'w-3/4', 'w-1/2']} />)
    expect(html).toContain('space-y-2')
  })

  it('Skeleton 自訂 rounded', () => {
    const html = renderToString(<Skeleton rounded="rounded-full" />)
    expect(html).toContain('rounded-full')
  })
})

describe('MultiFaultCompare SSR', () => {
  it('渲染 3 個肇責情境', () => {
    const html = renderToString(
      <MultiFaultCompare
        civilMidBaseline={100000}
        bodilyInjuryAmount={50000}
        propertyDamageAmount={20000}
      />,
    )
    // React 在 text node 之間插入 <!-- -->，所以分開檢查數字
    expect(html).toContain('己方')
    expect(html).toContain('對方')
    expect(html).toContain('30')
    expect(html).toContain('50')
    expect(html).toContain('70')
    expect(html).toContain('積極進取')
    expect(html).toContain('中間調解')
    expect(html).toContain('保守穩妥')
  })

  it('金額顯示 tabular-nums', () => {
    const html = renderToString(
      <MultiFaultCompare civilMidBaseline={100000} bodilyInjuryAmount={50000} />,
    )
    expect(html).toContain('tabular-nums')
    expect(html).toContain('$')
  })

  it('零金額不崩潰', () => {
    const html = renderToString(<MultiFaultCompare civilMidBaseline={0} />)
    expect(html).toBeTruthy()
  })
})
