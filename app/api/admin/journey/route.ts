import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getAdminFromRequest(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!user.isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  try {
    // Cohort by first observed visit, rather than mixing old completions with new starts.
    const { rows } = await query<{ event: string; step: string; sessions: number }>(`
      WITH cohort AS (
        SELECT session_id FROM public.journey_events
        WHERE event = 'visit' AND created_at >= now() - interval '7 days'
      )
      SELECT event, step, count(DISTINCT session_id)::int AS sessions
      FROM public.journey_events JOIN cohort USING (session_id)
      GROUP BY event, step ORDER BY event, step
    `)
    return NextResponse.json({ days: 7, items: rows }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json(
      { error: 'measurement unavailable; apply database migration' },
      { status: 503 },
    )
  }
}
