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
