// =====================================================================
// AGENTS.md 章節引用守護 — v0.28.9
//
// 問題背景（2026-10-21）：
//   AGENTS.md 從 81 KB 精簡到 25 KB（歷史版本敘事搬到 docs/AGENTS-HISTORY.md）
//   章節編號大幅重排，導致散落各處的「AGENTS.md §N」引用全部失效。
//   實際抓到 9 處 stale：§13（部署場景矩陣）、§32（ErrorTracker）、
//   §8-§12（已重組成 §8 架構速查）等。
//
// 這個測試守護「程式碼裡的 AGENTS.md 章節引用必須指向存在的章節」，
// 讓未來 agent 重新編號章節時立刻被 CI 抓到，而不是等到文件漂移幾個月。
//
// 技術做法：
//   1. 從 AGENTS.md 解析出所有實際存在的章節編號（## §N 或 ## §N.M）
//   2. 掃描全專案（排除 .trail/cache / node_modules / docs/AGENTS-HISTORY.md）
//      所有「AGENTS.md §N」形式的引用
//   3. 每個引用的章節必須存在
// =====================================================================

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const PROJECT_ROOT = join(__dirname, '..', '..')

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.trail',
  'out',
  'dist',
  'build',
  'coverage',
  'playwright-report',
  'test-results',
  '.vercel',
])

// 只掃描會引用章節的檔案類型
const SCAN_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.md', '.sh', '.json'])

// 本檔自身含 regex 樣板字串，會自我匹配 —— 直接排除
const SELF_PATH = relative(PROJECT_ROOT, __filename)

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue
      walk(full, acc)
    } else if (SCAN_EXT.has(extname(entry))) {
      acc.push(full)
    }
  }
  return acc
}

// AGENTS.md 章節裡的引用（如「詳見 AGENTS.md §13」）是刻意指向歷史文件的，
// 掃描時排除整份歷史歸檔檔案本身。
const EXCLUDE_FILES = new Set(['docs/AGENTS-HISTORY.md'])

describe('AGENTS.md 章節引用守護', () => {
  const agentsSource = readFileSync(join(PROJECT_ROOT, 'AGENTS.md'), 'utf-8')

  // 實際存在的章節編號，例如 '0' '1' '8' '8.1' '9' '10'
  const existingSections = new Set<string>()
  for (const m of agentsSource.matchAll(/^##\s+§(\d+(?:\.\d+)?)/gm)) {
    existingSections.add(m[1])
  }

  it('AGENTS.md 必須有可解析的章節標題', () => {
    expect(existingSections.size).toBeGreaterThan(0)
  })

  it('§0 專案定位必須存在（所有文件的入口）', () => {
    expect(existingSections.has('0')).toBe(true)
  })

  it('所有「AGENTS.md §N」引用必須指向存在的章節', () => {
    const stale: string[] = []
    const files = walk(PROJECT_ROOT)

    for (const file of files) {
      const rel = relative(PROJECT_ROOT, file)
      if (EXCLUDE_FILES.has(rel) || rel === SELF_PATH) continue

      const src = readFileSync(file, 'utf-8')
      // 匹配 "AGENTS.md §N" / "AGENTS.md §N.M" / "AGENTS §N"
      for (const m of src.matchAll(/AGENTS(?:\.md)?\s*§\s*(\d+(?:\.\d+)?)/g)) {
        const section = m[1]
        // 章節存在，或它是某個存在的父章節的子項（如 §8.1 → §8 存在）
        const parent = section.split('.')[0]
        if (!existingSections.has(section) && !existingSections.has(parent)) {
          const line = src.slice(0, m.index).split('\n').length
          stale.push(`${rel}:${line} → AGENTS.md §${section}`)
        }
      }
    }

    expect(
      stale,
      `以下引用指向不存在的 AGENTS.md 章節（章節編號改了要一起修引用）：\n  ${stale.join('\n  ')}`,
    ).toEqual([])
  })

  it('AGENTS.md 必須說明歷史版本敘事已歸檔（避免重複膨脹）', () => {
    expect(agentsSource).toContain('AGENTS-HISTORY.md')
  })
})
