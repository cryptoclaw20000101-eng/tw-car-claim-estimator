/**
 * DELETE /api/estimates/[id] — 刪除單筆估算 (v0.17.x+)
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  const { rowCount } = await query('delete from public.estimates where id = $1 and user_id = $2', [
    id,
    user.userId,
  ])
  if (!rowCount) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
