/**
 * POST /api/auth/signup — 註冊 (v0.17.x+)
 *
 * 取代 Supabase Auth.signUp
 * Body: { email, password, displayName? }
 * 流程: 查重 → bcrypt hash → insert users → sign JWT → 設 cookie
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { hashPassword, signToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { email, password, displayName } = (await req.json()) as {
      email?: string
      password?: string
      displayName?: string
    }
    if (!email || !password) {
      return NextResponse.json({ error: 'email + password 必填' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: '密碼至少 8 字符' }, { status: 400 })
    }
    const normalizedEmail = email.trim().toLowerCase()

    // 查重
    const { rows: existing } = await query<{ id: string }>(
      'select id from public.users where email = $1',
      [normalizedEmail],
    )
    if (existing.length > 0) {
      return NextResponse.json({ error: 'email 已被註冊' }, { status: 409 })
    }

    // 註冊
    const hash = await hashPassword(password)
    const { rows } = await query<{ id: string; email: string }>(
      `insert into public.users (email, password_hash, display_name)
       values ($1, $2, $3)
       returning id, email`,
      [normalizedEmail, hash, displayName ?? null],
    )
    const user = rows[0]
    if (!user) {
      return NextResponse.json({ error: '註冊失敗' }, { status: 500 })
    }

    // 簽 JWT + 設 httpOnly cookie
    const token = signToken(user.id, user.email)
    const res = NextResponse.json({ user: { id: user.id, email: user.email } })
    res.cookies.set('auth_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 天
      path: '/',
    })
    return res
  } catch (e) {
    console.error('[api/auth/signup]', e)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
