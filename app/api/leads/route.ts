/**
 * /api/leads — 結果頁 contact CTA 收集（v0.24.0c+）
 *
 * POST { contactType, contactHandle, message?, consent, estimateId? }
 * Auth：不強制（未登入訪客也能留），但若有 session 就關聯 userId
 * Response：{ id, ok: true }
 */
import { NextRequest, NextResponse } from 'next/server'
import { insertLead, type ContactType } from '@/lib/leads'
import { getUserFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * 簡單 runtime validation（不引入 zod 套件，AGENTS §2.2 零套件原則）
 */
function validateLeadInput(body: unknown):
  | {
      ok: true
      data: {
        contactType: ContactType
        contactHandle: string
        message: string | null
        consent: boolean
        estimateId: string | null
      }
    }
  | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Body 必須是 JSON object' }
  }
  const b = body as Record<string, unknown>
  const contactType = b.contactType
  if (contactType !== 'line' && contactType !== 'threads') {
    return { ok: false, error: 'contactType 必須是 line 或 threads' }
  }
  const contactHandle = typeof b.contactHandle === 'string' ? b.contactHandle.trim() : ''
  if (contactHandle.length < 3 || contactHandle.length > 100) {
    return { ok: false, error: 'contactHandle 長度必須在 3-100 之間' }
  }
  // 簡單驗證：line / threads handle 不能含 @ / 空白 / URL 前綴
  if (/[\s@]/.test(contactHandle)) {
    return { ok: false, error: 'contactHandle 不能含 @ 或空白' }
  }
  const message = typeof b.message === 'string' ? b.message.slice(0, 1000) : null
  const consent = b.consent === true
  if (!consent) {
    return { ok: false, error: '必須勾選同意條款（consent = true）才能送出' }
  }
  const estimateId = typeof b.estimateId === 'string' ? b.estimateId : null
  return { ok: true, data: { contactType, contactHandle, message, consent, estimateId } }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const validation = validateLeadInput(body)
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Auth：optional（未登入訪客也能留；若有 session 就關聯）
    const user = getUserFromRequest(req)

    const lead = await insertLead({
      estimateId: validation.data.estimateId,
      userId: user?.userId ?? null,
      contactType: validation.data.contactType,
      contactHandle: validation.data.contactHandle,
      message: validation.data.message,
      consent: validation.data.consent,
    })

    return NextResponse.json({ id: lead.id, ok: true })
  } catch (e) {
    console.error('[api/leads]', e)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
