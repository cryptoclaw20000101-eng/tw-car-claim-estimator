// MultiFaultCompare 測試 — 多肇責比例並排比較
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MultiFaultCompare } from '@/components/MultiFaultCompare'

describe('MultiFaultCompare', () => {
  it('renders 3 scenarios (30/70, 50/50, 70/30)', () => {
    const html = renderToString(
      <MultiFaultCompare bodilyInjuryAmount={60000} propertyDamageAmount={40000} />,
    )
    // 3 scenarios labels (React injects <!-- --> comments between digits/text)
    expect(html).toMatch(/己方.{0,20}30.{0,20}%.{0,20}對方.{0,20}70/)
    expect(html).toMatch(/己方.{0,20}50.{0,20}%.{0,20}對方.{0,20}50/)
    expect(html).toMatch(/己方.{0,20}70.{0,20}%.{0,20}對方.{0,20}30/)
  })

  it('calculates each scenario with correct ratio', () => {
    // body 60K + property 40K = 100K total
    // 對方 70% (30/70 場景): 100K * 0.7 = 70K
    // 對方 50% (50/50 場景): 100K * 0.5 = 50K
    // 對方 30% (70/30 場景): 100K * 0.3 = 30K
    const html = renderToString(
      <MultiFaultCompare bodilyInjuryAmount={60000} propertyDamageAmount={40000} />,
    )
    // 數字格式為 70,000 / 50,000 / 30,000（千分位逗號）
    expect(html).toContain('70,000')
    expect(html).toContain('50,000')
    expect(html).toContain('30,000')
  })

  it('scenario labels (積極進取 / 中間調解 / 保守穩妥)', () => {
    const html = renderToString(
      <MultiFaultCompare bodilyInjuryAmount={60000} propertyDamageAmount={40000} />,
    )
    expect(html).toContain('積極進取')
    expect(html).toContain('中間調解')
    expect(html).toContain('保守穩妥')
  })

  it('renders description for each scenario', () => {
    const html = renderToString(
      <MultiFaultCompare bodilyInjuryAmount={60000} propertyDamageAmount={40000} />,
    )
    expect(html).toContain('客戶主張對方主要肇事')
    expect(html).toContain('雙方各半，常見調解結果')
    expect(html).toContain('客戶承認較多責任')
  })

  it('handles zero baseline (no claim)', () => {
    const html = renderToString(
      <MultiFaultCompare bodilyInjuryAmount={0} propertyDamageAmount={0} />,
    )
    // 即使 0 也要 render 3 scenarios
    expect(html).toMatch(/己方.{0,20}30.{0,20}%.{0,20}對方.{0,20}70/)
    // v0.28.1+：刪除 cap 文字後 React Fragment children 變少，
    // trailing <!-- --> 不再出現（最後一個 text node 後沒相鄰 text）
    // 改驗證 $0 出現
    expect(html).toContain('$<!-- -->0')
  })

  it('handles defaults (no props provided)', () => {
    // bodilyInjuryAmount + propertyDamageAmount 應 default 為 0
    // 全部 0 → 三個 scenario 都是 0
    const html = renderToString(<MultiFaultCompare />)
    // 0 * 0.7 = 0, 0 * 0.5 = 0, 0 * 0.3 = 0
    expect(html).toContain('$<!-- -->0')
  })
})
