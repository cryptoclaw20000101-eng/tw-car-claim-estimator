'use client'
import type { JourneyEvent, JourneyStep } from './journey'
import { parseJourneyPayload } from './journey'

const KEY = 'tw-claim-journey-v1'
const sent = new Set<string>()
export function trackJourney(event: JourneyEvent, step: JourneyStep = '') {
  if (
    typeof window === 'undefined' ||
    navigator.doNotTrack === '1' ||
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl
  )
    return
  try {
    let session: {
      id: string
      ts: number
    } | null = null
    const raw = sessionStorage.getItem(KEY)
    try {
      session = raw ? JSON.parse(raw) : null
    } catch {
      // Replace corrupt measurement state without touching claim drafts.
    }
    if (
      !session ||
      !parseJourneyPayload({ sessionId: session.id, event: 'visit', step: '' }) ||
      !Number.isFinite(session.ts) ||
      session.ts > Date.now() ||
      Date.now() - session.ts >= 86400000
    ) {
      session = { id: crypto.randomUUID(), ts: Date.now() }
      sessionStorage.setItem(KEY, JSON.stringify(session))
    }
    const sessionId = session.id
    const send = (name: JourneyEvent, detail: JourneyStep) => {
      const key = `${sessionId}:${name}:${detail}`
      if (sent.has(key)) return
      // Deduplicate in-flight requests too; allow a later interaction to retry failures.
      sent.add(key)
      void fetch('/api/journey', {
        method: 'POST',
        credentials: 'omit',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, event: name, step: detail }),
      })
        .then((response) => {
          if (!response.ok) sent.delete(key)
        })
        .catch(() => {
          sent.delete(key)
        })
    }
    if (event !== 'visit') send('visit', '')
    send(event, step)
  } catch {
    /* Storage / browser privacy settings may disable measurement. */
  }
}
