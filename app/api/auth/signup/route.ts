/**
 * POST /api/auth/signup — 註冊 (v0.17.x+)
 *
 * 取代 Supabase Auth.signUp
 * Body: { email, password, displayName? }
 * 流程: 查重 → bcrypt hash → insert users → sign JWT → 設 cookie
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { hashPassword, signToken, validatePasswordStrength } from '@/lib/auth'
import { apiGuard } from '@/lib/api-security'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // v0.18.x+：rate limit + CSRF (Origin) 守護
  const guard = apiGuard(req, { bucket: 'auth-signup' })
  if (guard) return guard

  try {
    const body = (await req.json()) as {
      email?: string
      password?: string
      displayName?: string
      // v0.27.0+：用戶可能嘗試傳 is_admin / isAdmin 提權，拒絕
      isAdmin?: unknown
      is_admin?: unknown
    }
    const { email, password, displayName } = body
    if (!email || !password) {
      return NextResponse.json({ error: 'email + password 必填' }, { status: 400 })
    }
    // v0.27.0+：安全 — 拒絕 body 傳 is_admin（privilege escalation 防禦）
    // admin 只能透過 SQL 直接設定，signup API 永遠不寫入 is_admin
    if (body.isAdmin === true || body.is_admin === true) {
      return NextResponse.json({ error: 'isAdmin 不可由 signup 設定' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: '密碼至少 8 字符' }, { status: 400 })
    }
    // v0.19.x+ 強密碼規則 (12+ 字符 + 數字 + 大寫)
    const pwError = validatePasswordStrength(password)
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 })
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

    // 註冊 (v0.19.x+ 含 email 驗證欄位；v0.21.0+ 自動 email_verified=true)
    // 取消 mock email verify：production 沒有真實 SMTP，user 永遠收不到信，
    // 改為註冊時直接 email_verified=true，讓 user 立即能用雲端存功能
    // AGENTS §31「v0.14.x+ 業務員從 console log 抓 link 給客戶」在 production 是 broken UX
    const hash = await hashPassword(password)
    const { rows } = await query<{ id: string; email: string }>(
      `insert into public.users (email, password_hash, display_name, email_verified)
       values ($1, $2, $3, true)
       returning id, email`,
      [normalizedEmail, hash, displayName ?? null],
    )
    const user = rows[0]
    if (!user) {
      return NextResponse.json({ error: '註冊失敗' }, { status: 500 })
    }

    // 簽 JWT + 設 httpOnly cookie（v0.21.0+：email_verified=true 立即可用）
    const token = signToken(user.id, user.email)
    const res = NextResponse.json({
      user: { id: user.id, email: user.email, emailVerified: true },
    })
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
