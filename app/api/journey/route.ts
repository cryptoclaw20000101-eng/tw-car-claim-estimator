import { NextRequest, NextResponse } from 'next/server'
import { apiGuard } from '@/lib/api-security'
import { query } from '@/lib/db'
import { parseJourneyPayload } from '@/lib/journey'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const guarded = apiGuard(req, { bucket: 'journey' })
  if (guarded) return guarded
  if (Number(req.headers.get('content-length') ?? 0) > 1024)
    return new Response(null, { status: 413 })
  let payload
  try {
    const text = await req.text()
    if (text.length > 1024) return new Response(null, { status: 413 })
    payload = parseJourneyPayload(JSON.parse(text))
    if (!payload) return new Response(null, { status: 400 })
  } catch {
    return new Response(null, { status: 400 })
  }
  try {
    await query("DELETE FROM public.journey_events WHERE created_at < now() - interval '30 days'")
    await query(
      'INSERT INTO public.journey_events (session_id, event, step) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [payload.sessionId, payload.event, payload.step],
    )
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    // Log only configuration status, never the request body.
    return NextResponse.json({ error: 'measurement unavailable' }, { status: 503 })
  }
}
