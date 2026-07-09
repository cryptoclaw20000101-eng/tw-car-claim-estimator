/**
 * POST /api/auth/signout — 登出 (v0.17.x+)
 * 清掉 auth_token cookie
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('auth_token', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  })
  return res
}
