/**
 * InstallPWAButton — v0.8.0+ PWA 安裝引導按鈕
 *
 * 為什麼要這個元件？
 *   v0.7.18 已配 PWA manifest + service worker + icons，但用戶不知「可裝」。
 *   90% 用戶不知道 Safari/Chrome 右上有「加到主畫面」。
 *   本元件主動跳出「安裝 app」CTA，按下就觸發原生 prompt。
 *
 * 跨平台處理：
 *   - Android Chrome：攔截 `beforeinstallprompt` → 按下觸發 prompt
 *   - iOS Safari：沒有 prompt 事件 → 顯示「點分享 → 加到主畫面」步驟圖
 *   - 已安裝（standalone）：隱藏按鈕（不重複打擾）
 *   - 不支援（舊瀏覽器）：隱藏按鈕
 *
 * 不變量（測試守護）：
 *   - SSR 不 render 按鈕（避免 hydration mismatch）
 *   - 已安裝 → 不 render
 *   - 不支援平台 → 不 render
 *   - iOS → 顯示步驟說明，非原生按鈕
 */

'use client'

import { useEffect, useState } from 'react'
import { Alert, Button, Modal, Space, Typography } from 'antd'
import { DownloadOutlined, ShareAltOutlined, PlusSquareOutlined, CloseOutlined } from '@ant-design/icons'

const { Text, Paragraph } = Typography

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Platform = 'android-chrome' | 'ios-safari' | 'installed' | 'unsupported' | 'loading'

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'loading'

  // 已安裝（standalone 模式）→ 隱藏
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari standalone
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (isStandalone) return 'installed'

  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !/Android/.test(ua)
  const isAndroid = /Android/.test(ua)

  if (isIOS) {
    // iOS Safari 都支援 PWA，但需手動加主畫面
    return 'ios-safari'
  }
  if (isAndroid) {
    // Android Chrome / Edge / Samsung Internet 都有 beforeinstallprompt
    return 'android-chrome'
  }
  // 桌機 / 其他 → 不顯示
  return 'unsupported'
}

export function InstallPWAButton() {
  const [platform, setPlatform] = useState<Platform>('loading')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [iosModalOpen, setIosModalOpen] = useState(false)

  useEffect(() => {
    const detected = detectPlatform()
    setPlatform(detected)

    if (detected !== 'android-chrome') return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    const installedHandler = () => {
      setInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setInstalled(true)
    }
    setDeferredPrompt(null)
  }

  // SSR / loading / 已安裝 / 不支援 → 不 render
  if (platform === 'loading' || platform === 'unsupported' || platform === 'installed' || installed) {
    return null
  }

  // iOS Safari：按鈕打開 modal 顯示步驟
  if (platform === 'ios-safari') {
    return (
      <>
        <Button
          size="large"
          icon={<DownloadOutlined />}
          onClick={() => setIosModalOpen(true)}
          data-testid="install-pwa-button-ios"
        >
          加到 iPhone 主畫面
        </Button>
        <Modal
          title="📱 如何加到 iPhone 主畫面"
          open={iosModalOpen}
          onCancel={() => setIosModalOpen(false)}
          footer={null}
          data-testid="install-pwa-ios-modal"
        >
          <Space orientation="vertical" size="middle" className="!w-full">
            <Paragraph>
              iOS Safari 不支援自動安裝 prompt，請<strong>手動 2 步驟</strong>加入主畫面：
            </Paragraph>
            <div className="rounded-lg bg-surface-subtle p-4">
              <Space size={12} align="start">
                <ShareAltOutlined className="!text-xl" />
                <div>
                  <Text strong>1. 點下方「分享」按鈕</Text>
                  <br />
                  <Text type="secondary" className="!text-sm">
                    Safari 網址列正中間的方框+箭頭圖示
                  </Text>
                </div>
              </Space>
            </div>
            <div className="rounded-lg bg-surface-subtle p-4">
              <Space size={12} align="start">
                <PlusSquareOutlined className="!text-xl" />
                <div>
                  <Text strong>2. 選「加入主畫面」</Text>
                  <br />
                  <Text type="secondary" className="!text-sm">
                    捲到選單最下方，點「加入主畫面」確認
                  </Text>
                </div>
              </Space>
            </div>
            <Alert
              type="success"
              title="加好後從主畫面開啟 → 全螢幕、離線可用、像原生 app"
              showIcon
            />
          </Space>
        </Modal>
      </>
    )
  }

  // Android Chrome：原生 prompt
  return (
    <Button
      type="primary"
      size="large"
      icon={<DownloadOutlined />}
      onClick={handleInstall}
      disabled={!deferredPrompt}
      data-testid="install-pwa-button-android"
    >
      {deferredPrompt ? '安裝到手機' : '瀏覽器準備中…'}
    </Button>
  )
}

/**
 * 永遠顯示的提示卡（不論平台）— 給使用者「這是 PWA」認知
 * 已在 installed 模式 → 自動隱藏
 */
export function PWAHintCard() {
  const [installed, setInstalled] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    setInstalled(isStandalone)

    const handler = () => setInstalled(true)
    window.addEventListener('appinstalled', handler)
    return () => window.removeEventListener('appinstalled', handler)
  }, [])

  if (!mounted || installed) return null

  return (
    <Alert
      type="info"
      showIcon
      className="!mt-4"
      title="📱 可以裝到手機當 app 用"
      description="iPhone 點分享 → 加入主畫面；Android Chrome 按上方「安裝到手機」。裝好後離線可用、全螢幕、像原生 app。"
    />
  )
}

// 避免 unused warning
const _closeIcon = <CloseOutlined />