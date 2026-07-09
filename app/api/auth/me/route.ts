/**
 * GET /api/auth/me — 取得當前登入 user (v0.17.x+)
 *
 * 從 cookie / Authorization header 抽 JWT, 解析 user
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 })
  }
  return NextResponse.json({ user })
}
