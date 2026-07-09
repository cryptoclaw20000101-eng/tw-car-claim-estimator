'use client'

/**
 * AuthProvider — JWT cookie auth context (v0.17.x 重寫)
 *
 * 從 Supabase Auth 切換到自寫 JWT + bcrypt + /api/auth/* (R6)
 * 介面保持不變 (useAuth hook 仍回 { user, loading, signIn, signOut })
 *
 * 設計:
 * - 'use client' 元件, 用 React Context 傳遞 auth state
 * - mount 時 GET /api/auth/me 查當前 user (從 cookie 抽 JWT)
 * - signIn: fetch POST /api/auth/signin (cookie 自動由 server 設)
 * - signOut: fetch POST /api/auth/signout (清 cookie)
 * - 跨頁: cookie 自動帶, 不需 manual sync
 *
 * 介面對外保持舊的 useAuth() 但內部實作改 fetch.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export interface AuthUser {
  id: string
  email: string
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  // mount 時 GET /api/auth/me 查當前 user
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.json() as Promise<{ user: AuthUser | null }>)
      .then((body) => setUser(body.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        return { error: body.error ?? '登入失敗' }
      }
      const body = (await res.json()) as { user: AuthUser }
      setUser(body.user)
      return {}
    } catch (e) {
      return { error: e instanceof Error ? e.message : '網路錯誤' }
    }
  }

  const signUp = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        return { error: body.error ?? '註冊失敗' }
      }
      const body = (await res.json()) as { user: AuthUser }
      setUser(body.user)
      return {}
    } catch (e) {
      return { error: e instanceof Error ? e.message : '網路錯誤' }
    }
  }

  const signOut = async () => {
    await fetch('/api/auth/signout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {})
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
