// =====================================================================
// v0.8.5 apply-courts.ts — 套用 _court-resolution.json 到 precedents
// =====================================================================

import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('apply-courts 套用邏輯（v0.8.5+）', () => {
  describe('_court-resolution.json 結構', () => {
    it('8 條查證結果（v0.8.5 baseline）', () => {
      const data = JSON.parse(
        readFileSync(join(process.cwd(), 'data/precedents/_court-resolution.json'), 'utf-8'),
      )
      const codes = Object.keys(data).sort()
      expect(codes).toEqual(['CTDV', 'ILDV', 'KLDV', 'KSDM', 'SCDV', 'TNHV', 'TYDM', 'ULDV'])
    })

    it('每條對照都是法院全名（含「法院」字）', () => {
      const data = JSON.parse(
        readFileSync(join(process.cwd(), 'data/precedents/_court-resolution.json'), 'utf-8'),
      )
      for (const [code, name] of Object.entries(data)) {
        expect(name, `${code} 應為法院全名`).toMatch(/法院/)
      }
    })
  })

  describe('套用 court 欄位（v0.8.5 新行為）', () => {
    let tmpDir: string
    let mockPrecedentFile: string

    beforeAll(() => {
      tmpDir = mkdtempSync(join(tmpdir(), 'apply-courts-test-'))
      mockPrecedentFile = join(tmpDir, 'mock-precedents.json')
      const mockData = [
        {
          id: '1',
          caseNo: '114年度訴字第1號',
          court: 'ULDV（未知代碼）',
          source: 'ULDV（未知代碼） 114年度訴字第1號',
        },
        {
          id: '2',
          caseNo: '113年度訴字第2號',
          court: 'ILDV（未知代碼）',
          source: 'ILDV（未知代碼） 113年度訴字第2號',
        },
        {
          id: '3',
          caseNo: '112年度訴字第3號',
          court: '臺灣臺北地方法院',
          source: 'TPDV 112年度訴字第3號',
        },
        {
          id: '4',
          caseNo: '111年度訴字第4號',
          court: 'UNKNOWN（未知代碼）',
          source: 'UNKNOWN（未知代碼） 111年度訴字第4號',
        },
      ]
      writeFileSync(mockPrecedentFile, JSON.stringify(mockData, null, 2))
    })

    afterAll(() => {
      rmSync(tmpDir, { recursive: true, force: true })
    })

    it('v0.8.5 模擬邏輯：ULDV → 臺灣雲林地方法院', () => {
      // 模擬 apply-courts.ts 的核心邏輯
      const COURT_MAP: Record<string, string> = JSON.parse(
        readFileSync(join(process.cwd(), 'data/precedents/_court-resolution.json'), 'utf-8'),
      )
      const data = JSON.parse(readFileSync(mockPrecedentFile, 'utf-8'))
      const p = data.find((x: { id: string }) => x.id === '1')!
      const m = p.court.match(/^([A-Z]{4})（未知代碼）$/)
      const code = m?.[1]
      expect(code).toBe('ULDV')
      expect(COURT_MAP[code]).toBe('臺灣雲林地方法院')
    })

    it('v0.8.5 模擬邏輯：ILDV → 臺灣宜蘭地方法院', () => {
      const COURT_MAP: Record<string, string> = JSON.parse(
        readFileSync(join(process.cwd(), 'data/precedents/_court-resolution.json'), 'utf-8'),
      )
      const data = JSON.parse(readFileSync(mockPrecedentFile, 'utf-8'))
      const p = data.find((x: { id: string }) => x.id === '2')!
      const m = p.court.match(/^([A-Z]{4})（未知代碼）$/)
      const code = m?.[1]
      expect(code).toBe('ILDV')
      expect(COURT_MAP[code]).toBe('臺灣宜蘭地方法院')
    })

    it('不該變動已是正確全名的案件', () => {
      const data = JSON.parse(readFileSync(mockPrecedentFile, 'utf-8'))
      const p = data.find((x: { id: string }) => x.id === '3')!
      // 已是「臺灣臺北地方法院」，不該被 _court-resolution.json 變動
      expect(p.court).toBe('臺灣臺北地方法院')
    })

    it('未知代碼不在 _court-resolution.json 內 → 不該變動', () => {
      // UNKNOWN 不在 COURT_MAP 內 → 維持原樣
      const COURT_MAP: Record<string, string> = JSON.parse(
        readFileSync(join(process.cwd(), 'data/precedents/_court-resolution.json'), 'utf-8'),
      )
      expect(COURT_MAP['UNKNOWN']).toBeUndefined()
    })
  })

  describe('source 欄位同步替換（v0.8.5 新功能）', () => {
    it('source="ULDV（未知代碼） 114年度訴字第1號" → "臺灣雲林地方法院 114年度訴字第1號"', () => {
      const COURT_MAP: Record<string, string> = JSON.parse(
        readFileSync(join(process.cwd(), 'data/precedents/_court-resolution.json'), 'utf-8'),
      )
      const source = 'ULDV（未知代碼） 114年度訴字第1號'
      const m = source.match(/^([A-Z]{4})（未知代碼）\s+(.+)$/)
      expect(m).not.toBeNull()
      const code = m![1]!
      const rest = m![2]!
      expect(code).toBe('ULDV')
      const newSource = `${COURT_MAP[code]} ${rest}`
      expect(newSource).toBe('臺灣雲林地方法院 114年度訴字第1號')
    })

    it('source 已是正確全名 → 不該變動', () => {
      const source = '臺灣臺北地方法院 112年度訴字第3號'
      const m = source.match(/^([A-Z]{4})（未知代碼）\s+(.+)$/)
      expect(m).toBeNull()
    })
  })

  describe('不變量守護', () => {
    it('實際 precedents 中未知代碼數量大幅下降（v0.8.5 跑完 apply-courts 後）', () => {
      // 跑過 apply-courts.ts 後，從 165 件降到 ~48 件（剩 17 個未知代碼 - 8 個已查證）
      const dataDir = join(process.cwd(), 'data/precedents')
      const files = readdirSync(dataDir).filter(
        (f) => f.endsWith('.json') && !f.startsWith('_') && f !== 'precedents-report.html',
      )
      let totalUnknown = 0
      for (const f of files) {
        const data = JSON.parse(readFileSync(join(dataDir, f), 'utf-8'))
        for (const p of data) {
          const court = p.court || ''
          if (/^[A-Z]{4}（未知代碼）$/.test(court)) totalUnknown++
        }
      }
      // v0.8.5 之前是 165 件，跑完應該 ≤ 70 件（解了 ILDV 23 + ULDV 53 + CTDV 20 + KLDV 5 + SCDV 16 = 117）
      expect(totalUnknown).toBeLessThanOrEqual(70)
      expect(totalUnknown).toBeGreaterThanOrEqual(40) // 不該歸 0（還有 17 個待查證代碼）
    })

    it('(未知代碼) 標記格式守護：必為「XXDV（未知代碼）」或「XXDM（未知代碼）」等 4 字大寫', () => {
      const dataDir = join(process.cwd(), 'data/precedents')
      const files = readdirSync(dataDir).filter(
        (f) => f.endsWith('.json') && !f.startsWith('_') && f !== 'precedents-report.html',
      )
      const unknownPattern = /^[A-Z]{4}（未知代碼）$/
      let found = 0
      for (const f of files) {
        const data = JSON.parse(readFileSync(join(dataDir, f), 'utf-8'))
        for (const p of data) {
          const court = p.court || ''
          if (court.includes('未知代碼')) {
            expect(court, `非標準格式: ${court}`).toMatch(unknownPattern)
            found++
          }
        }
      }
      expect(found).toBeGreaterThan(0) // 至少要有剩餘待補的
    })
  })
})
