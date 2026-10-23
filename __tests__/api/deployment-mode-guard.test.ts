// =====================================================================
// Deployment Mode Guard — v0.16.x+（serverful）
//
// 守護現行部署契約（ADR 0003 已取代 ADR 0001 static export）：
//   1. next.config.ts 不得設定 output: "export"（改用標準 serverful build）
//   2. /api/advisor/route.ts 必須是 serverful route（不被當成 dead code）
//   3. components/PainEnsembleCard.tsx 必須顯示「靜態 mock」標籤
//   4. AGENTS.md 必須記錄現行部署契約（serverful + Railway）
//
// 這些 invariant 是「未來 agent 不會誤改部署模式而部署出 404 / 壞掉
// /api/auth、/api/estimates」的���後防線。
//
// ⚠️ 歷史：本檔原為 export-mode-guard.test.ts，守護 v0.7.0 的
//    `output: "export"` 契約。該契約已被 ADR 0003 取代（v0.16.x 起改
//    serverful），原守護方向與現行架構相反，故翻轉。
// =====================================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const PROJECT_ROOT = join(__dirname, '..', '..')

describe('Deployment Mode Guard (serverful, v0.16.x+)', () => {
  // -----------------------------------------------------------------
  // 1. next.config.ts 不得設定 output: "export"
  // -----------------------------------------------------------------
  describe('next.config.ts', () => {
    const configSource = readFileSync(join(PROJECT_ROOT, 'next.config.ts'), 'utf-8')

    it('不得設定 output: "export"（ADR 0003）', () => {
      // 排除註解後檢查 — 註解裡提到 output:'export' 是說明「已移除」
      const withoutComments = configSource
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      expect(withoutComments).not.toMatch(/output:\s*["']export["']/)
    })

    it('必須有 images.unoptimized: true', () => {
      expect(configSource).toMatch(/unoptimized:\s*true/)
    })

    it('必須參考 ADR 0003（serverful 決策）', () => {
      // 防止未來 agent 砍掉 v0.16.x 架構決策的說明
      expect(configSource).toMatch(/0003-serverful-nextjs/)
    })

    it('必須保留 serverful 安全標頭', () => {
      expect(configSource).toMatch(/X-Content-Type-Options/)
      expect(configSource).toMatch(/X-Frame-Options/)
    })

    it('必須保留 allowedDevOrigins（LAN 裝置 HMR）', () => {
      expect(configSource).toMatch(/allowedDevOrigins/)
    })

    it('必須保留 canonical redirects（/home /estimate /result）', () => {
      expect(configSource).toMatch(/source:\s*'\/home'/)
      expect(configSource).toMatch(/source:\s*'\/estimate'/)
      expect(configSource).toMatch(/source:\s*'\/result'/)
    })
  })

  // -----------------------------------------------------------------
  // 2. /api/advisor/route.ts 必須是 serverful route
  // -----------------------------------------------------------------
  describe('app/api/advisor/route.ts', () => {
    const routeSource = readFileSync(
      join(PROJECT_ROOT, 'app', 'api', 'advisor', 'route.ts'),
      'utf-8',
    )

    it('必須有 POST handler（serverful 才會被路由）', () => {
      expect(routeSource).toMatch(/export\s+async\s+function\s+POST/)
    })

    it('必須設 cache-control: no-store（個資絕不 cache）', () => {
      expect(routeSource).toMatch(/no-store/)
    })

    it('不得標成 force-dynamic（Next 16 static export 不接受）', () => {
      expect(routeSource).not.toMatch(/force-dynamic/)
    })
  })

  // -----------------------------------------------------------------
  // 3. PainEnsembleCard 必須顯示「靜態 mock」標籤
  // -----------------------------------------------------------------
  describe('components/PainEnsembleCard.tsx UI label', () => {
    const cardSource = readFileSync(
      join(PROJECT_ROOT, 'components', 'PainEnsembleCard.tsx'),
      'utf-8',
    )

    it('明確標示風險提醒由規則產生', () => {
      // 不能誤導使用者以為是真的 LLM 回應
      expect(cardSource).toContain('規則產生的風險提醒')
    })

    it('不能誤稱為「v0.6.4 mock」（已過時）', () => {
      // v0.6.4 → v0.7.0 已升級；保留 v0.6.4 字串會誤導
      expect(cardSource).not.toMatch(/v0\.6\.4\s*mock/)
    })
  })

  // -----------------------------------------------------------------
  // 4. AGENTS.md 必須記錄現行部署契約
  // -----------------------------------------------------------------
  describe('AGENTS.md 部署契約', () => {
    const agentsSource = readFileSync(join(PROJECT_ROOT, 'AGENTS.md'), 'utf-8')

    it('必須記錄 serverful 部署契約', () => {
      expect(agentsSource).toContain('serverful')
    })

    it('必須引用 ADR 0003', () => {
      expect(agentsSource).toContain('0003-serverful-nextjs')
    })

    it('必須說明歷史版本敘事已歸檔（避免重複膨脹）', () => {
      expect(agentsSource).toContain('AGENTS-HISTORY.md')
    })

    it('必須保留 Railway Postgres 部署章節', () => {
      expect(agentsSource).toMatch(/##\s*§9/)
      expect(agentsSource).toContain('DATABASE_URL')
    })
  })

  // -----------------------------------------------------------------
  // 5. Dockerfile 必須對應 serverful（pnpm start，不是 static serve）
  // -----------------------------------------------------------------
  describe('Dockerfile', () => {
    const dockerSource = readFileSync(join(PROJECT_ROOT, 'Dockerfile'), 'utf-8')

    it('必須用 pnpm start 啟動（serverful 需要 Node runtime）', () => {
      expect(dockerSource).toMatch(/CMD\s+\["pnpm",\s*"start"\]/)
    })

    it('不得用靜態檔案伺服器（如 npx serve out）', () => {
      expect(dockerSource).not.toMatch(/serve\s+out/)
    })
  })
})
