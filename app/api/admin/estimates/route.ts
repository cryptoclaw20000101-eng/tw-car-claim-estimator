/**
 * /api/admin/estimates — 後台 dashboard 列出所有估算（v0.24.0+）
 *
 * Auth：需要登入
 * Response：[{ id, userId, email, compulsoryTotal, disabilityLevel, court, selfFaultRatio, createdAt }, ...]
 *
 * v0.24.0+：不只列自己，列所有 user 的估算（業務員用）
 * 若日後需要 role-based 權限 → 加 role 欄位 + check
 */
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAdminFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // v0.27.0+：admin 守護 — 未登入 401，非 admin 403
  const user = await getAdminFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!user.isAdmin) {
    return NextResponse.json({ error: 'forbidden: admin only' }, { status: 403 })
  }

  try {
    const { rows } = await query<{
      id: string
      user_id: string
      email: string | null
      claim_input: Record<string, unknown>
      compulsory_total_estimated: number | null
      disability_level: number | null
      court_name: string | null
      self_fault_ratio: number | null
      created_at: Date
    }>(
      `SELECT e.id, e.user_id, u.email, e.claim_input,
              e.compulsory_total_estimated, e.disability_level,
              e.court_name, e.self_fault_ratio, e.created_at
       FROM public.estimates e
       LEFT JOIN public.users u ON u.id = e.user_id
       ORDER BY e.created_at DESC
       LIMIT 200`,
    )

    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        email: r.email ?? '(deleted user)',
        compulsoryTotalEstimated: r.compulsory_total_estimated,
        disabilityLevel: r.disability_level,
        courtName: r.court_name,
        selfFaultRatio: r.self_fault_ratio,
        createdAt: r.created_at.toISOString(),
        // v0.27.0+：完整 claim_input JSON（後台要看到完整民眾查詢）
        claimInput: r.claim_input,
      })),
    })
  } catch (e) {
    console.error('[api/admin/estimates]', e)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
