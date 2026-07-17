/**
 * auth.ts — JWT 簽發 + bcrypt 驗證 (v0.17.x+)
 *
 * 取代 Supabase Auth (user 2026-07-09 選 Railway Postgres 改自寫)
 *
 * 設計:
 * - JWT signed with HS256 + JWT_SECRET env var
 * - bcrypt cost 10 (約 100ms / hash, 安全 + 平衡)
 * - Token 有效期 7 天 (refresh 由前端重新 signin)
 * - 登入後把 JWT 寫到 httpOnly cookie (前端 fetch 自動帶)
 *
 * API:
 * - signToken(userId, email) → JWT string
 * - verifyToken(token) → payload | null
 * - hashPassword(plain) → bcrypt hash
 * - verifyPassword(plain, hash) → boolean
 *
 * 為何不用 Supabase Auth: 自寫簡單, 不需 Supabase 帳號, 全 Railway
 */

import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { query } from '@/lib/db'

const BCRYPT_COST = 10
const JWT_EXPIRES_IN = '7d'
const JWT_ALG = 'HS256' as const

export interface JwtPayload {
  userId: string
  email: string
  // jsonwebtoken 自動加 iat / exp
}

/**
 * Hash 密碼 (註冊用)
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST)
}

/**
 * 驗證密碼 (登入用)
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

/**
 * 簽 JWT
 */
export function signToken(userId: string, email: string): string {
  const secret = getSecret()
  return jwt.sign({ userId, email } satisfies Omit<JwtPayload, 'iat' | 'exp'>, secret, {
    algorithm: JWT_ALG,
    expiresIn: JWT_EXPIRES_IN,
  })
}

/**
 * 驗 JWT (return null 表示過期或無效)
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const secret = getSecret()
    const decoded = jwt.verify(token, secret, { algorithms: [JWT_ALG] })
    if (typeof decoded === 'string' || !decoded.userId || !decoded.email) return null
    return {
      userId: decoded.userId as string,
      email: decoded.email as string,
    }
  } catch {
    return null
  }
}

/**
 * v0.19.x+ 密碼強度規則 (user 2026-07-10 重新設計)
 *
 * 業務場景: 業務員帳號常被同事共用, 強密碼可防撞庫
 * 規則: 12+ 字符 + 至少 1 個數字 + 至少 1 個大寫字母
 *
 * 回傳 null = 通過; 回傳字串 = 失敗原因 (繁中, 直接給使用者看)
 */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 12) {
    return '密碼至少 12 個字符'
  }
  if (!/\d/.test(password)) {
    return '密碼需包含至少 1 個數字'
  }
  if (!/[A-Z]/.test(password)) {
    return '密碼需包含至少 1 個大寫字母'
  }
  return null
}

/**
 * v0.19.x+ 生成 email 驗證 token (24 小時過期)
 *
 * 業務場景: 防垃圾註冊 + 確保 email 正確
 * 用 crypto.randomUUID + base64 編碼 (32 字符)
 *
 * 回傳 { token, expires (Date) }
 */
export function generateVerifyToken(): { token: string; expires: Date } {
  const token = Buffer.from(crypto.randomUUID() + crypto.randomUUID()).toString('base64url')
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 小時
  return { token, expires }
}

/**
 * v0.19.x+ Rate limit (user 2026-07-10 重新設計)
 *
 * 業務場景: 防暴力破解 (5 次/分鐘 → 鎖 15 分鐘)
 * 配合 users.failed_login_count + locked_until 欄位
 *
 * 5 次失敗 → 鎖 15 分鐘 → 期間 signin 直接返回 429
 *
 * 業務友善設計: 鎖定後回傳「帳號被暫時鎖定，請 15 分鐘後再試」+ 剩餘時間
 */

const RATE_LIMIT_THRESHOLD = 5
const RATE_LIMIT_WINDOW_MIN = 15
const RATE_LIMIT_WINDOW_MS = RATE_LIMIT_WINDOW_MIN * 60 * 1000

export function isAccountLocked(lockedUntil: Date | null): boolean {
  if (!lockedUntil) return false
  return new Date() < lockedUntil
}

export function shouldLockAccount(failedCount: number): boolean {
  return failedCount >= RATE_LIMIT_THRESHOLD
}

export function calculateLockUntil(): Date {
  return new Date(Date.now() + RATE_LIMIT_WINDOW_MS)
}

export const RATE_LIMIT_CONFIG = {
  threshold: RATE_LIMIT_THRESHOLD,
  windowMinutes: RATE_LIMIT_WINDOW_MIN,
} as const

/**
 * 從 cookie / header 抽出 token
 */
export function extractToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  // Cookie 格式: "name1=value1; name2=value2"
  const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * 從 Authorization header 抽出 token
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('[auth] JWT_SECRET 環境變數未設定')
  }
  return secret
}

/**
 * 從 Request 抽出 token (優先 Authorization header, 再 cookie)
 */
export function getTokenFromRequest(req: Request): string | null {
  return (
    extractBearerToken(req.headers.get('authorization')) ?? extractToken(req.headers.get('cookie'))
  )
}

/**
 * 從 Request 解析 user payload
 */
export function getUserFromRequest(req: Request): JwtPayload | null {
  const token = getTokenFromRequest(req)
  if (!token) return null
  return verifyToken(token)
}

/**
 * v0.27.0+：取得 user + is_admin（admin 路由用）
 * JWT 只放 userId / email，is_admin 從 DB 查（保持 fresh，可隨時撤銷）
 *
 * 注意：每次 request 都會多一次 DB query，只用在 /api/admin/* 路由
 */
export async function getAdminFromRequest(
  req: Request,
): Promise<(JwtPayload & { isAdmin: boolean }) | null> {
  const payload = getUserFromRequest(req)
  if (!payload) return null
  const { rows } = await query<{ is_admin: boolean }>(
    'select is_admin from public.users where id = $1',
    [payload.userId],
  )
  return { ...payload, isAdmin: rows[0]?.is_admin ?? false }
}
