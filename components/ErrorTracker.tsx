'use client'

/**
 * ErrorTracker — Sentry-style 錯誤追蹤 scaffold（v0.13.x 新增）
 *
 * 為什麼 scaffold 不直接裝 @sentry/nextjs：
 * - @sentry/nextjs 需要 build-time 設定（next.config rewrites）
 * - 需 API key 才能跑（scaffold 階段沒）
 * - 輕量替代：先做客戶端 wrapper，未來接 Sentry 只需改一個函式
 *
 * 設計：
 * - 接聽 window.onerror + unhandledrejection
 * - 包 try-catch 包裝使用者函式（withErrorTracking）
 * - 開發環境 console.error，生產環境送到 endpoint（待設定）
 *
 * 上報 endpoint 設定方式：
 *   <ErrorTracker endpoint="/api/errors" />
 *   或未來：import * as Sentry from '@sentry/nextjs'; Sentry.captureException(e)
 */

import { useEffect } from 'react'

export interface ErrorTrackerProps {
  /** 生產環境的錯誤接收 endpoint（POST JSON） */
  endpoint?: string
  /** 取樣率 0-1（預設 1 = 全收） */
  sampleRate?: number
  /** debug 模式：強制 console.error（即使在生產） */
  debug?: boolean
}

interface ErrorPayload {
  type: 'error' | 'unhandledrejection'
  message: string
  stack?: string
  url: string
  userAgent: string
  timestamp: number
  extra?: Record<string, unknown>
}

export function ErrorTracker({ endpoint, sampleRate = 1, debug = false }: ErrorTrackerProps) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // 取樣（節省後端資源）
    if (Math.random() > sampleRate) return

    const send = (payload: ErrorPayload) => {
      // 開發模式 + debug：console.error
      if (process.env.NODE_ENV !== 'production' || debug) {
        // eslint-disable-next-line no-console
        console.error('[ErrorTracker]', payload.type, payload.message, payload.stack)
      }
      // 生產環境：送到 endpoint（若有設定）
      if (endpoint && process.env.NODE_ENV === 'production') {
        try {
          const body = JSON.stringify(payload)
          if (navigator.sendBeacon) {
            navigator.sendBeacon(endpoint, body)
          } else {
            fetch(endpoint, { method: 'POST', body, keepalive: true }).catch(() => {})
          }
        } catch {
          // silent fail
        }
      }
    }

    const onError = (event: ErrorEvent) => {
      send({
        type: 'error',
        message: event.message || 'Unknown error',
        stack: event.error?.stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
      })
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      send({
        type: 'unhandledrejection',
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
      })
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)

    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [endpoint, sampleRate, debug])

  return null
}

/**
 * 包裝使用者函式，捕獲錯誤自動上報
 * 用法：withErrorTracking(() => doSomething(), { endpoint: '/api/errors' })
 */
export function withErrorTracking<T extends (...args: any[]) => any>(
  fn: T,
  options: ErrorTrackerProps = {},
): T {
  return ((...args: Parameters<T>) => {
    try {
      const result = fn(...args)
      if (result instanceof Promise) {
        return result.catch((err) => {
          reportError(err, options)
          throw err
        })
      }
      return result
    } catch (err) {
      reportError(err, options)
      throw err
    }
  }) as T
}

function reportError(err: unknown, options: ErrorTrackerProps) {
  if (options.debug || process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.error('[ErrorTracker] caught:', err)
  }
  if (options.endpoint && process.env.NODE_ENV === 'production') {
    const payload: ErrorPayload = {
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      timestamp: Date.now(),
    }
    try {
      const body = JSON.stringify(payload)
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(options.endpoint, body)
      }
    } catch {
      // silent fail
    }
  }
}