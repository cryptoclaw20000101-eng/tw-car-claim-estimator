/**
 * /api/admin/leads — 後台列出所有聯絡記錄（v0.24.0c+）
 *
 * Auth：需要登入
 * Response：[{ id, contactType, contactHandle, message, consent, userEmail, createdAt }, ...]
 */
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const { rows } = await query<{
      id: string
      contact_type: string
      contact_handle: string
      message: string | null
      consent: boolean
      created_at: Date
      user_email: string | null
    }>(
      `SELECT l.id, l.contact_type, l.contact_handle, l.message, l.consent, l.created_at, u.email as user_email
       FROM public.leads l
       LEFT JOIN public.users u ON u.id = l.user_id
       ORDER BY l.created_at DESC
       LIMIT 200`,
    )

    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.id,
        contactType: r.contact_type,
        contactHandle: r.contact_handle,
        message: r.message,
        consent: r.consent,
        userEmail: r.user_email,
        createdAt: r.created_at.toISOString(),
      })),
    })
  } catch (e) {
    console.error('[api/admin/leads]', e)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
