/**
 * POST /api/auth/signin — 登入 (v0.17.x+)
 *
 * Body: { email, password }
 * 流程: 查 user → bcrypt verify → sign JWT → 設 cookie
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyPassword, signToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = (await req.json()) as {
      email?: string
      password?: string
    }
    if (!email || !password) {
      return NextResponse.json({ error: 'email + password 必填' }, { status: 400 })
    }
    const normalizedEmail = email.trim().toLowerCase()

    const { rows } = await query<{ id: string; email: string; password_hash: string }>(
      'select id, email, password_hash from public.users where email = $1',
      [normalizedEmail],
    )
    const user = rows[0]
    if (!user) {
      return NextResponse.json({ error: 'email 或密碼錯誤' }, { status: 401 })
    }

    const ok = await verifyPassword(password, user.password_hash)
    if (!ok) {
      return NextResponse.json({ error: 'email 或密碼錯誤' }, { status: 401 })
    }

    const token = signToken(user.id, user.email)
    const res = NextResponse.json({ user: { id: user.id, email: user.email } })
    res.cookies.set('auth_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    return res
  } catch (e) {
    console.error('[api/auth/signin]', e)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
