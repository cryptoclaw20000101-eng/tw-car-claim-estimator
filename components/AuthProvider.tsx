'use client'

/**
 * AuthProvider — Supabase 認證 context（v0.14.x 新增）
 *
 * 設計：
 * - 'use client' 元件，封裝 Supabase auth state
 * - 沒設 env vars 時自動降級（user = null，所有功能仍可用 localStorage）
 * - 透過 useAuth() hook 取得 { user, signInWithMagicLink, signOut }
 * - 監聽 auth state change 自動更新
 *
 * 使用：
 *   <AuthProvider>{children}</AuthProvider>
 *   const { user, signInWithMagicLink } = useAuth()
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getSupabase, hasSupabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AuthContextValue {
  user: User | null
  loading: boolean
  configured: boolean
  signInWithMagicLink: (email: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(false)

  useEffect(() => {
    setConfigured(hasSupabase())
    const client = getSupabase()
    if (!client) {
      setLoading(false)
      return
    }
    // 取得當前 session
    client.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    // 監聽 auth state change
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signInWithMagicLink = async (email: string) => {
    const client = getSupabase()
    if (!client) {
      return { error: 'Supabase 未設定' }
    }
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/claims/new`,
      },
    })
    if (error) return { error: error.message }
    return {}
  }

  const signOut = async () => {
    const client = getSupabase()
    if (!client) return
    await client.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, configured, signInWithMagicLink, signOut }}>
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