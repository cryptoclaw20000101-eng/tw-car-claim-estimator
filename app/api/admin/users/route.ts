/**
 * /api/admin/users — 後台 dashboard 列出所有註冊 user（v0.24.0+）
 *
 * Auth：需要登入（業務員或 admin 用）
 * Body：none
 * Response：[{ id, email, emailVerified, createdAt, lastSignInAt }, ...]
 */
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Auth 守護：未登入直接 401
  const user = getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    // v0.24.0+：列出所有 user（脫敏 — 不傳 password_hash / verify_token）
    const { rows } = await query<{
      id: string
      email: string
      email_verified: boolean
      created_at: Date
      last_sign_in_at: Date | null
    }>(
      `SELECT id, email, email_verified, created_at, last_sign_in_at
       FROM public.users
       ORDER BY created_at DESC
       LIMIT 200`,
    )

    return NextResponse.json({
      items: rows.map((u) => ({
        id: u.id,
        email: u.email,
        emailVerified: u.email_verified,
        createdAt: u.created_at.toISOString(),
        lastSignInAt: u.last_sign_in_at?.toISOString() ?? null,
      })),
    })
  } catch (e) {
    console.error('[api/admin/users]', e)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
