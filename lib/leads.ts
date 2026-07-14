/**
 * Leads — 結果頁 contact CTA 收集（v0.24.0c+）
 *
 * Schema：estimate_id / user_id 都 optional（未登入訪客也能留）
 * contact_type: 'line' | 'threads'
 * consent: true（AGENTS §6 業務員 follow-up 同意）
 *
 * 注意：contact_handle 是公開 ID（如 line.me/x 或 threads.net/@x），
 * 不是手機/身分證 — 沒個資問題（AGENTS §6 不存姓名/身分證/車牌）
 */
import { query } from '@/lib/db'

export type ContactType = 'line' | 'threads'

export interface LeadRow {
  id: string
  estimate_id: string | null
  user_id: string | null
  contact_type: ContactType
  contact_handle: string
  message: string | null
  consent: boolean
  created_at: Date
}

export interface InsertLeadInput {
  estimateId?: string | null
  userId?: string | null
  contactType: ContactType
  contactHandle: string
  message?: string | null
  consent: boolean
}

/**
 * 寫入 lead 記錄
 * 自動建立 table（idempotent CREATE TABLE IF NOT EXISTS）
 */
export async function insertLead(input: InsertLeadInput): Promise<LeadRow> {
  // v0.24.0c：CREATE TABLE IF NOT EXISTS — production migration 由 db.ts 自動處理
  await query(`
    CREATE TABLE IF NOT EXISTS public.leads (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      estimate_id uuid REFERENCES public.estimates(id) ON DELETE SET NULL,
      user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
      contact_type text NOT NULL CHECK (contact_type IN ('line', 'threads')),
      contact_handle text NOT NULL,
      message text,
      consent boolean NOT NULL DEFAULT true,
      created_at timestamptz DEFAULT now()
    );
  `)

  const { rows } = await query<{
    id: string
    estimate_id: string | null
    user_id: string | null
    contact_type: ContactType
    contact_handle: string
    message: string | null
    consent: boolean
    created_at: Date
  }>(
    `INSERT INTO public.leads (estimate_id, user_id, contact_type, contact_handle, message, consent)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, estimate_id, user_id, contact_type, contact_handle, message, consent, created_at`,
    [
      input.estimateId ?? null,
      input.userId ?? null,
      input.contactType,
      input.contactHandle,
      input.message ?? null,
      input.consent,
    ],
  )

  const row = rows[0]
  if (!row) throw new Error('insertLead failed: no row returned')
  return row
}

/**
 * 列出所有 leads（admin 用）
 */
export async function listLeads(limit = 200): Promise<LeadRow[]> {
  const { rows } = await query<{
    id: string
    estimate_id: string | null
    user_id: string | null
    contact_type: ContactType
    contact_handle: string
    message: string | null
    consent: boolean
    created_at: Date
  }>(
    `SELECT id, estimate_id, user_id, contact_type, contact_handle, message, consent, created_at
     FROM public.leads
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  )
  return rows
}
