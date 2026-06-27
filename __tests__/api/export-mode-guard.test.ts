// =====================================================================
// Export Mode Guard — v0.7.0
//
// 守護 `next.config.ts` 設 `output: "export"` 時的部署限制：
//   1. next.config.ts 必須保留 `output: "export"`
//   2. /api/advisor/route.ts 開頭必須有 v0.7.0 deprecation 警告
//   3. components/PainEnsembleCard.tsx 必須顯示「靜態 mock」標籤
//   4. AGENTS.md §13 部署場景矩陣必須存在
//
// 這些 invariant 是「未來 agent 不會誤改 config 而部署出 404」的最後防線。
// =====================================================================

import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const PROJECT_ROOT = join(__dirname, "..", "..")

describe("Export Mode Guard (v0.7.0)", () => {
  // -----------------------------------------------------------------
  // 1. next.config.ts 必須保留 output: "export"
  // -----------------------------------------------------------------
  describe("next.config.ts", () => {
    const configSource = readFileSync(
      join(PROJECT_ROOT, "next.config.ts"),
      "utf-8"
    )

    it("必須保留 output: \"export\"", () => {
      expect(configSource).toMatch(/output:\s*["']export["']/)
    })

    it("必須有 images.unoptimized: true（export 必備）", () => {
      expect(configSource).toMatch(/unoptimized:\s*true/)
    })

    it("必須有註解說明這是 Vercel Edge CDN 部署", () => {
      // 防止未來 agent 砍掉 v0.5.0 設定的關鍵字
      expect(configSource).toMatch(/Vercel/i)
    })
  })

  // -----------------------------------------------------------------
  // 2. /api/advisor/route.ts 開頭必須有 deprecation 警告
  // -----------------------------------------------------------------
  describe("app/api/advisor/route.ts deprecation", () => {
    const routeSource = readFileSync(
      join(PROJECT_ROOT, "app", "api", "advisor", "route.ts"),
      "utf-8"
    )

    it("必須有 v0.7.0 deprecation 警告", () => {
      expect(routeSource).toMatch(/v0\.7\.0.*部署場景警告|deployment.*warning/i)
    })

    it("必須標註 output: \"export\" 不會跑此 route", () => {
      expect(routeSource).toMatch(/output:\s*["']export["']/)
    })

    it("必須參考 AGENTS.md §13", () => {
      expect(routeSource).toMatch(/AGENTS\.md.*§\s*13/)
    })

    it("必須警告部署後 POST /api/advisor 會 404", () => {
      expect(routeSource).toMatch(/404/)
    })
  })

  // -----------------------------------------------------------------
  // 3. PainEnsembleCard 必須顯示「靜態 mock」標籤
  // -----------------------------------------------------------------
  describe("components/PainEnsembleCard.tsx UI label", () => {
    const cardSource = readFileSync(
      join(PROJECT_ROOT, "components", "PainEnsembleCard.tsx"),
      "utf-8"
    )

    it("Divider 文字必須含「靜態 mock」", () => {
      // 不能誤導使用者以為是真的 LLM 回應
      expect(cardSource).toContain("靜態 mock")
    })

    it("Divider 文字必須參考 AGENTS.md §13", () => {
      expect(cardSource).toContain("AGENTS.md §13")
    })

    it("不能誤稱為「v0.6.4 mock」（已過時）", () => {
      // v0.6.4 → v0.7.0 已升級；保留 v0.6.4 字串會誤導
      expect(cardSource).not.toMatch(/v0\.6\.4\s*mock/)
    })
  })

  // -----------------------------------------------------------------
  // 4. AGENTS.md §13 部署場景矩陣必須存在
  // -----------------------------------------------------------------
  describe("AGENTS.md §13 部署場景矩陣", () => {
    const agentsSource = readFileSync(
      join(PROJECT_ROOT, "AGENTS.md"),
      "utf-8"
    )

    it("必須有 §13 標題", () => {
      expect(agentsSource).toMatch(/##\s*§13/)
    })

    it("§13 必須含「部署場景矩陣」字串", () => {
      expect(agentsSource).toContain("部署場景矩陣")
    })

    it("§13 必須含 4 個部署場景", () => {
      // Vercel Edge CDN / 本地 dev server / Vercel Functions / 自架 Node
      expect(agentsSource).toContain("Vercel Edge CDN")
      expect(agentsSource).toContain("Vercel Functions")
      expect(agentsSource).toContain("自架 Node")
      expect(agentsSource).toContain("本地 dev server")
    })

    it("§13 必須有紅線條目", () => {
      // 從 §13 開頭到 §14（檔案結尾）找紅線
      const sec13Start = agentsSource.indexOf("§13")
      const sec13Content = sec13Start >= 0 ? agentsSource.slice(sec13Start) : ""
      expect(sec13Content).toContain("紅線")
    })
  })
})
