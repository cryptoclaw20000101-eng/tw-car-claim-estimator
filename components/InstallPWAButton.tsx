/**
 * InstallPWAButton — v0.8.0+ PWA 安裝引導按鈕（v0.10.0+ iOS Modal 自製 SVG illustration）
 *
 * 為什麼要這個元件？
 *   v0.7.18 已配 PWA manifest + service worker + icons，但用戶不知「可裝」。
 *   90% 用戶不知道 Safari/Chrome 右上有「加到主畫面」。
 *   本元件主動跳出「安裝 app」CTA，按下就觸發原生 prompt。
 *
 * 跨平台處理：
 *   - Android Chrome：攔截 `beforeinstallprompt` → 按下觸發 prompt
 *   - iOS Safari：沒有 prompt 事件 → 顯示「點分享 → 加主畫面」步驟圖
 *   - 已安裝（standalone）：隱藏按鈕（不重複打擾）
 *   - 不支援（舊瀏覽器）：隱藏按鈕
 *
 * v0.10.0+ 改動：
 *   - iOS Modal 的步驟圖改成自製 SVG illustration
 *   - 之前用 AntD icon（線性、抽象），改用視覺化的「手機 + Safari UI」圖
 *   - 對 9x 歲以上用戶更直覺：看圖就懂「分享按鈕在哪」「主畫面按鈕在哪」
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
import { InfoAlert } from '@/components/InfoAlert'
import { DownloadOutlined } from '@ant-design/icons'

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
  // v0.22.0+：lazy init platform 用 detectPlatform()（client-only 偵測）
  // SSR：window undefined → 'loading'
  // client mount：useState lazy init 自動偵測，避免 setState-in-effect
  // v0.23.0+：移除 setPlatform（已 lazy init 不需 useState — readonly 透過 [platform, setPlatform]
  // 解構後只讀取 platform，不再 setState — 改用 const 直接呼叫 detectPlatform）
  const platform: Platform = typeof window === 'undefined' ? 'loading' : detectPlatform()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [iosModalOpen, setIosModalOpen] = useState(false)

  useEffect(() => {
    // 只需要訂閱 beforeinstallprompt event（if 是 android-chrome）
    if (platform !== 'android-chrome') return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    const installedHandler = () => {
      // AGENTS §2.1：event handler 內 setState 允許（不是 effect body）
      setInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [platform])

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
  if (
    platform === 'loading' ||
    platform === 'unsupported' ||
    platform === 'installed' ||
    installed
  ) {
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

            {/* v0.10.0+：步驟 1 自製 SVG illustration */}
            <div className="rounded-lg bg-surface-subtle p-4">
              <Space size={12} align="start" className="!w-full">
                <IosShareIllustration />
                <div>
                  <Text strong>1. 點下方「分享」按鈕</Text>
                  <br />
                  <Text type="secondary" className="!text-sm">
                    Safari 網址列正中間的方框+箭頭圖示
                  </Text>
                </div>
              </Space>
            </div>

            {/* v0.10.0+：步驟 2 自製 SVG illustration */}
            <div className="rounded-lg bg-surface-subtle p-4">
              <Space size={12} align="start" className="!w-full">
                <IosAddToHomeIllustration />
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
    // AGENTS §2.1 鐵律：useEffect 內禁同步 setState。但這裡的 mounted 偵測是
    // 真實 client-only 場景（SSR 沒有 window），無法用 useState lazy init。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    // AGENTS §2.1：effect body 內 setState 禁用，但這裡是真實 client mount 偵測

    setInstalled(isStandalone)

    const handler = () => setInstalled(true)
    window.addEventListener('appinstalled', handler)
    return () => window.removeEventListener('appinstalled', handler)
  }, [])

  if (!mounted || installed) return null

  return (
    // v0.8.5+: 改用 InfoAlert wrapper（取代 deprecated description prop）
    <InfoAlert
      type="info"
      showIcon
      className="!mt-4"
      title="📱 可以裝到手機當 app 用"
      body="iPhone 點分享 → 加入主畫面；Android Chrome 按上方「安裝到手機」。裝好後離線可用、全螢幕、像原生 app。"
    />
  )
}

// ============== v0.10.0+ iOS illustration SVGs ==============

/**
 * Step 1 illustration — Safari URL bar with share button highlighted (rose-700 ring)
 */
function IosShareIllustration() {
  return (
    <svg
      width="80"
      height="60"
      viewBox="0 0 80 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="shrink-0"
    >
      {/* 模擬 iOS Safari URL bar */}
      <rect
        x="4"
        y="8"
        width="72"
        height="44"
        rx="8"
        fill="#ffffff"
        stroke="#e4e4e7"
        strokeWidth="1"
      />
      {/* URL 文字 */}
      <rect x="10" y="14" width="44" height="6" rx="2" fill="#a1a1aa" />
      {/* 重新整理 icon */}
      <circle cx="64" cy="17" r="3" stroke="#71717a" strokeWidth="1" fill="none" />
      {/* 分享 icon — accent ring 標記 */}
      <rect
        x="50"
        y="11"
        width="14"
        height="14"
        rx="3"
        fill="#ffffff"
        stroke="ACCENT"
        strokeWidth="2"
      />
      <path
        d="M53 18 L57 14 M57 14 L61 18 M57 14 L57 22"
        stroke="ACCENT"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* 下方漸層 bar 模擬頁面 */}
      <rect x="10" y="28" width="50" height="2" rx="1" fill="#e4e4e7" />
      <rect x="10" y="34" width="40" height="2" rx="1" fill="#e4e4e7" />
      <rect x="10" y="40" width="46" height="2" rx="1" fill="#e4e4e7" />
    </svg>
  )
}

/**
 * Step 2 illustration — iOS share sheet with "加入主畫面" highlighted
 */
function IosAddToHomeIllustration() {
  return (
    <svg
      width="80"
      height="60"
      viewBox="0 0 80 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="shrink-0"
    >
      {/* 模擬 iOS share sheet 容器 */}
      <rect
        x="4"
        y="4"
        width="72"
        height="52"
        rx="6"
        fill="#f4f4f5"
        stroke="#e4e4e7"
        strokeWidth="1"
      />
      {/* 標題列 */}
      <rect x="24" y="8" width="32" height="3" rx="1" fill="#71717a" />
      {/* 多個 icon grid（淡灰） */}
      <g fill="#d4d4d8">
        <rect x="10" y="16" width="10" height="10" rx="2" />
        <rect x="24" y="16" width="10" height="10" rx="2" />
        <rect x="38" y="16" width="10" height="10" rx="2" />
        <rect x="52" y="16" width="10" height="10" rx="2" />
        <rect x="66" y="16" width="6" height="10" rx="2" />
      </g>
      {/* 「加入主畫面」高亮列（accent 框） */}
      <rect
        x="10"
        y="32"
        width="62"
        height="16"
        rx="4"
        fill="#ffffff"
        stroke="ACCENT"
        strokeWidth="2"
      />
      {/* 加號 icon */}
      <rect
        x="14"
        y="36"
        width="8"
        height="8"
        rx="1.5"
        fill="none"
        stroke="ACCENT"
        strokeWidth="1.5"
      />
      <line x1="18" y1="38" x2="18" y2="42" stroke="ACCENT" strokeWidth="1.5" />
      <line x1="16" y1="40" x2="20" y2="40" stroke="ACCENT" strokeWidth="1.5" />
      {/* 文字標籤條 */}
      <rect x="26" y="38" width="32" height="4" rx="1" fill="ACCENT" opacity="0.4" />
    </svg>
  )
}
