/**
 * /api/leads/[id] — Lead 刪除 endpoint（v0.26.0a+）
 *
 * 對應 AGENTS §6 個資風格守護：
 *   "可隨時要求刪除"（業務員/管理員刪除或用戶要求刪除）
 *
 * Auth：需登入（admin / 業務員）
 * Response：{ ok: true, id } 或 404
 *
 * 為何選 DELETE 而非 soft delete：
 * - user 明確要求刪除個資（GDPR 風格）→ 真刪除
 * - 保留 deleted_at 欄位會被視為「還在保留個資」
 *
 * 為何不做 auth 「請求者本人」檢查：
 * - current schema 沒 lead.owner_id 欄位
 * - admin / 業務員被授權刪除（v0.24.0c list 介面已存在）
 * - 未來若用戶自助刪除可加 token-based verification email
 */
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await params
  // 簡單 UUID 格式檢查（避免 SQL injection 風險）
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  }

  try {
    const { rowCount } = await query<{ id: string }>(`DELETE FROM public.leads WHERE id = $1`, [id])
    if (rowCount === 0) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    console.error('[api/leads/[id] DELETE]', e)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
