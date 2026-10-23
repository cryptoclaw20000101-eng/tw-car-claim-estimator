import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { estimateClaim } from '@/lib/insurance'
import { SAMPLE_INPUT } from '@/lib/insurance/sample'
import { CivilSection } from '@/app/claims/result/_sections/CivilSection'
import { SupplementSection } from '@/app/claims/result/_sections/SupplementSection'
import { ThirdPartySection } from '@/app/claims/result/_sections/ThirdPartySection'
import { PracticeCasesSection } from '@/app/claims/result/_sections/PracticeCasesSection'
import { DisabilitySection } from '@/app/claims/result/_sections/DisabilitySection'
import { RegionSection } from '@/app/claims/result/_sections/RegionSection'

const result = estimateClaim(SAMPLE_INPUT)

describe('結果頁分頁可讀性', () => {
  it('失能、案例與地區分頁可呈現完整範例', () => {
    expect(() => renderToString(<DisabilitySection result={result} />)).not.toThrow()
    expect(() => renderToString(<PracticeCasesSection result={result} />)).not.toThrow()
    expect(() => renderToString(<RegionSection result={result} />)).not.toThrow()
  })
  it('受傷範例可完整呈現民事項目', () => {
    expect(renderToString(<CivilSection result={result} />)).toContain('精神慰撫金')
  })
  it('未受傷案件只顯示財損明細', () => {
    const html = renderToString(<CivilSection result={result} isInjured={false} />)
    expect(html).toContain('其他財物損失')
    expect(html).not.toContain('除疤')
    expect(html).not.toContain('勞動能力減損')
  })
  it('補件與第三人責任分頁可完整呈現範例', () => {
    expect(renderToString(<SupplementSection result={result} />)).toContain('風險提示')
    const html = renderToString(<ThirdPartySection input={SAMPLE_INPUT} result={result} />).replace(
      /<!--.*?-->/g,
      '',
    )
    expect(html).toContain(`乘對方肇責 ${SAMPLE_INPUT.fault.otherFaultRatio}%`)
  })
})
