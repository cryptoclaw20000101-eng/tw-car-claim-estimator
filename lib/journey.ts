export const JOURNEY_EVENTS = [
  'visit',
  'form_started',
  'step_viewed',
  'step_completed',
  'validation_failed',
  'estimate_completed',
  'repair_started',
  'repair_completed',
] as const
export const JOURNEY_STEPS = [
  '',
  'basics',
  'fault',
  'person',
  'diagnosis',
  'expenses',
  'repair',
] as const
export type JourneyEvent = (typeof JOURNEY_EVENTS)[number]
export type JourneyStep = (typeof JOURNEY_STEPS)[number]
export interface JourneyPayload {
  sessionId: string
  event: JourneyEvent
  step: JourneyStep
}

export function parseJourneyPayload(value: unknown): JourneyPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  if (Object.keys(v).some((key) => !['sessionId', 'event', 'step'].includes(key))) return null
  if (
    typeof v.sessionId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.sessionId)
  )
    return null
  if (
    !JOURNEY_EVENTS.includes(v.event as JourneyEvent) ||
    !JOURNEY_STEPS.includes(v.step as JourneyStep)
  )
    return null
  const requiresStep = ['step_viewed', 'step_completed', 'validation_failed'].includes(
    v.event as string,
  )
  if (requiresStep === (v.step === '')) return null
  return { sessionId: v.sessionId, event: v.event as JourneyEvent, step: v.step as JourneyStep }
}
