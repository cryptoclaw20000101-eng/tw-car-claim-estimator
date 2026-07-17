/**
 * GET /api/auth/me — 取得當前登入 user (v0.17.x+)
 *
 * 從 cookie / Authorization header 抽 JWT, 解析 user
 * v0.27.0+：加 isAdmin 欄位（DB 查詢，每次 request 都拿 fresh）
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getAdminFromRequest(req)
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 })
  }
  return NextResponse.json({ user })
}
