const fallbackSiteUrl = 'https://tw-car-claim-estimator-production.up.railway.app'

/**
 * SEO 與公開分享網址的單一來源。
 * 移除尾端斜線，避免 JSON-LD、robots 與 sitemap 產生不同 canonical。
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || fallbackSiteUrl).replace(/\/+$/, '')

/** 只有完成實際內容複核時才能更新，避免製造虛假的新鮮度訊號。 */
export const CONTENT_LAST_REVIEWED = '2026-08-10'
