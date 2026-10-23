// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const KEY = 'tw-claim-journey-v1'
let track: typeof import('@/lib/journey-client').trackJourney
const fetchMock = vi.fn()

beforeEach(async () => {
  vi.resetModules()
  sessionStorage.clear()
  fetchMock.mockReset().mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', fetchMock)
  Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '0' })
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: false })
  track = (await import('@/lib/journey-client')).trackJourney
})
afterEach(() => vi.unstubAllGlobals())

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
const bodies = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body))

describe('填表事件傳送', () => {
  it('每個工作階段只傳一次造訪與相同步驟，不夾帶表單或帳號', async () => {
    track('visit')
    track('form_started')
    track('step_viewed', 'basics')
    track('step_viewed', 'basics')
    await settle()
    expect(bodies().map((body) => body.event)).toEqual(['visit', 'form_started', 'step_viewed'])
    expect(new Set(bodies().map((body) => body.sessionId)).size).toBe(1)
    expect(Object.keys(bodies()[0]).sort()).toEqual(['event', 'sessionId', 'step'])
    expect(fetchMock.mock.calls[0][1].credentials).toBe('omit')
  })

  it('首次從內頁開始也包含造訪事件', async () => {
    track('repair_started')
    await settle()
    expect(bodies().map((body) => body.event)).toEqual(['visit', 'repair_started'])
  })

  it.each(['network', 'http'])('傳送失敗後下次操作可重試：%s', async (failure) => {
    if (failure === 'network') fetchMock.mockRejectedValueOnce(new Error('offline'))
    else fetchMock.mockResolvedValueOnce({ ok: false })
    track('visit')
    await settle()
    track('visit')
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it.each(['dnt', 'gpc'])('尊重隱私設定：%s', async (setting) => {
    Object.defineProperty(navigator, setting === 'dnt' ? 'doNotTrack' : 'globalPrivacyControl', {
      configurable: true,
      value: setting === 'dnt' ? '1' : true,
    })
    track('visit')
    await settle()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(KEY)).toBeNull()
  })

  it.each(['null', '{bad', '{"id":"email@example.com","ts":0}', '{"id":"bad"}'])(
    '儲存資料損壞時建立新的匿名工作階段：%s',
    async (raw) => {
      sessionStorage.setItem(KEY, raw)
      track('visit')
      await settle()
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(bodies()[0].sessionId).toMatch(/^[0-9a-f-]{36}$/i)
    },
  )
  it('儲存空間不可用時不阻擋使用者', () => {
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => track('visit')).not.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
    read.mockRestore()
  })
})
