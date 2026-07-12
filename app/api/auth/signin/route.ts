/**
 * POST /api/auth/signin — 登入 (v0.17.x+)
 *
 * Body: { email, password }
 * 流程: 查 user → bcrypt verify → sign JWT → 設 cookie
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { verifyPassword, signToken } from '@/lib/auth'
import { apiGuard } from '@/lib/api-security'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // v0.18.x+：rate limit + CSRF (Origin) 守護
  const guard = apiGuard(req, { bucket: 'auth-signin' })
  if (guard) return guard

  try {
    const { email, password } = (await req.json()) as {
      email?: string
      password?: string
    }
    if (!email || !password) {
      return NextResponse.json({ error: 'email + password 必填' }, { status: 400 })
    }
    const normalizedEmail = email.trim().toLowerCase()

    const { rows } = await query<{
      id: string
      email: string
      password_hash: string
      email_verified: boolean
      failed_login_count: number
      locked_until: Date | null
    }>(
      'select id, email, password_hash, email_verified, failed_login_count, locked_until from public.users where email = $1',
      [normalizedEmail],
    )
    const user = rows[0]
    if (!user) {
      return NextResponse.json({ error: 'email 或密碼錯誤' }, { status: 401 })
    }

    // v0.19.x+ Rate limit: 帳號鎖定檢查
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      const remainMin = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000)
      return NextResponse.json(
        { error: `帳號已被暫時鎖定，請 ${remainMin} 分鐘後再試` },
        { status: 429 },
      )
    }

    const ok = await verifyPassword(password, user.password_hash)
    if (!ok) {
      // v0.19.x+ Rate limit: 失敗 +1, 5 次 → 鎖 15 分鐘
      const newFailCount = (user.failed_login_count ?? 0) + 1
      if (newFailCount >= 5) {
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000)
        await query(
          'update public.users set failed_login_count = 0, locked_until = $1 where id = $2',
          [lockUntil, user.id],
        )
        return NextResponse.json(
          { error: '連續 5 次登入失敗，帳號已被鎖定 15 分鐘' },
          { status: 429 },
        )
      }
      await query('update public.users set failed_login_count = $1 where id = $2', [
        newFailCount,
        user.id,
      ])
      return NextResponse.json({ error: 'email 或密碼錯誤' }, { status: 401 })
    }

    // v0.19.x+ Email 驗證檢查 (註冊後需收信點連結)
    if (!user.email_verified) {
      return NextResponse.json({ error: '請先收信點擊驗證連結啟用帳號' }, { status: 403 })
    }

    // 登入成功: 清 failed_login_count
    await query('update public.users set failed_login_count = 0 where id = $1', [user.id])

    const token = signToken(user.id, user.email)
    const res = NextResponse.json({
      user: { id: user.id, email: user.email, emailVerified: true },
    })
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
