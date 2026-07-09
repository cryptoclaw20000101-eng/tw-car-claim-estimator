/**
 * /api/estimates — 雲端估算歷史 CRUD (v0.17.x+)
 *
 * 取代 lib/estimate-storage.ts 的 client-side pg 呼叫
 * Client 透過 fetch 走這個 route
 *
 * GET /api/estimates?limit=20
 * POST /api/estimates { claimInput, result }
 * DELETE /api/estimates?id=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import type { ClaimInput, EstimationResult } from '@/lib/insurance/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { rows } = await query<{
    id: string
    user_id: string
    claim_input: ClaimInput
    result: EstimationResult | null
    created_at: string
  }>(
    `select id, user_id, claim_input, result, created_at
     from public.estimates
     where user_id = $1
     order by created_at desc
     limit 20`,
    [user.userId],
  )
  return NextResponse.json({
    items: rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      claimInput: row.claim_input,
      result: row.result,
      createdAt: row.created_at,
    })),
  })
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { claimInput, result } = (await req.json()) as {
    claimInput?: ClaimInput
    result?: EstimationResult
  }
  if (!claimInput || !result) {
    return NextResponse.json({ error: 'claimInput + result 必填' }, { status: 400 })
  }
  const { rows } = await query<{ id: string }>(
    `insert into public.estimates
       (user_id, claim_input, result, compulsory_total_estimated,
        disability_level, court_name, self_fault_ratio)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id`,
    [
      user.userId,
      claimInput,
      result,
      result.compulsoryTotalEstimated,
      claimInput.medical?.disabilityLevel ?? null,
      result.region.courtName,
      claimInput.fault?.selfFaultRatio ?? 50,
    ],
  )
  return NextResponse.json({ id: rows[0]?.id })
}
