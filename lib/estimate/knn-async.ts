/**
 * KNN Async — 非同步 KNN 計算（v0.15.x Phase 2）
 *
 * 為什麼：
 * - KNN 計算 200+ 案件需要 5-50ms（依機器）
 * - 同步計算會 block main thread → 結果頁切換感覺卡
 * - 把計算包成 Promise + setTimeout(0) yield → 讓 React 先 render frame 再算
 *
 * 為什麼不直接用 Web Worker：
 * - Next.js output: export 對 Worker 配置有限制
 * - Worker bundle 需要額外 build step
 * - KNN 計算量不大（200+ 案件，5-50ms），用 yield 就足夠
 *
 * 完整 Web Worker 留 v0.15.x 規劃。
 *
 * 對外 API：
 * - findRelatedPracticeCasesAsync() — 跟原本的 findRelatedPracticeCases 簽名相同
 * - 自動 fallback 同步版本（SSR / 舊瀏覽器）
 */

import type { PracticeCase, PracticeCaseWithKnn } from '@/lib/estimate/precedents'
import { findRelatedPracticeCases } from '@/lib/estimate/precedents'

/**
 * 用 setTimeout yield 一個 tick（讓 React 渲染先 commit）
 */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof setTimeout === 'undefined') {
      resolve()
      return
    }
    setTimeout(resolve, 0)
  })
}

/**
 * 非同步版的 findRelatedPracticeCases
 *
 * 行為：
 * - 第一次呼叫：先 await yieldToMain() 讓 React 渲染，再跑 KNN
 * - 第二次以後（cache 命中）：直接同步回傳
 *
 * v0.15.x 之後可改用真正的 Web Worker
 */
export async function findRelatedPracticeCasesAsync<T extends boolean = false>(
  courtName: string,
  possibleLevel: number | null,
  limit = 3,
  withKnnDebug?: T,
): Promise<T extends true ? PracticeCaseWithKnn[] : PracticeCase[]> {
  await yieldToMain()
  return findRelatedPracticeCases(courtName, possibleLevel, limit, withKnnDebug) as T extends true
    ? PracticeCaseWithKnn[]
    : PracticeCase[]
}
