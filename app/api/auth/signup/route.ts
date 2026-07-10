/**
 * POST /api/auth/signup — 註冊 (v0.17.x+)
 *
 * 取代 Supabase Auth.signUp
 * Body: { email, password, displayName? }
 * 流程: 查重 → bcrypt hash → insert users → sign JWT → 設 cookie
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { hashPassword, signToken, validatePasswordStrength, generateVerifyToken } from '@/lib/auth'

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

    // 註冊 (v0.19.x+ 含 email 驗證欄位)
    const hash = await hashPassword(password)
    const { token: verifyToken, expires: verifyExpires } = generateVerifyToken()
    const { rows } = await query<{ id: string; email: string }>(
      `insert into public.users (email, password_hash, display_name, verify_token, verify_expires)
       values ($1, $2, $3, $4, $5)
       returning id, email`,
      [normalizedEmail, hash, displayName ?? null, verifyToken, verifyExpires],
    )
    const user = rows[0]
    if (!user) {
      return NextResponse.json({ error: '註冊失敗' }, { status: 500 })
    }

    // v0.19.x+ 印驗證連結 (mock SMTP, 業務環境: 控制台 log 給業務員)
    // 注意: verifyUrl 指向 /verify 頁面 (用戶友好), 不是 /api/auth/verify (JSON 端點)
    const verifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/verify?token=${verifyToken}`
    console.log(`\n📧 [Email 驗證] 寄給 ${normalizedEmail}\n🔗 ${verifyUrl}\n📅 24 小時內有效\n`)

    // 簽 JWT + 設 httpOnly cookie (但 email_verified=false, 登入後引導去驗證)
    const token = signToken(user.id, user.email)
    const res = NextResponse.json({
      user: { id: user.id, email: user.email, emailVerified: false },
      verifyUrl, // 前端顯示「請收信點連結驗證」
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
