/**
 * GET /api/auth/verify — Email 驗證 (v0.19.x+)
 *
 * 業務場景: 用戶註冊後收到 email 點連結 → 啟用帳號
 * Query: ?token=xxx (24 小時過期)
 * 流程: 查 user by verify_token + check expired + 設 email_verified=true + 清 verify_token
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: '缺少 token' }, { status: 400 })
  }

  // 查 user by verify_token
  const { rows } = await query<{
    id: string
    email: string
    email_verified: boolean
    verify_expires: Date | null
  }>('select id, email, email_verified, verify_expires from public.users where verify_token = $1', [
    token,
  ])
  const user = rows[0]
  if (!user) {
    return NextResponse.json({ error: '驗證連結無效' }, { status: 404 })
  }

  // 檢查過期
  if (user.verify_expires && new Date() > new Date(user.verify_expires)) {
    return NextResponse.json({ error: '驗證連結已過期, 請重新註冊' }, { status: 410 })
  }

  // 設 email_verified=true + 清 verify_token
  await query(
    `update public.users set email_verified = true, verify_token = null, verify_expires = null
     where id = $1`,
    [user.id],
  )

  return NextResponse.json({
    success: true,
    email: user.email,
    message: 'Email 驗證成功，請重新登入',
  })
}
