#!/usr/bin/env bash
# rebuild-hero.sh — scrape 完一鍵重生 hero Ensemble 健康度區塊（v0.7.0+）
#
# 設計目的：
#   首頁 hero Ensemble 健康度卡（v0.6.9）是 build-time 靜態內嵌。
#   當 scrape 抓新資料 → report 自動重生 precedents-report.html，
#   但 hero 區塊凍結在 build 時的 snapshot。
#   此 script 串接「report → rebuild hero」讓 cron 跑完 hero 自動跟著更新。
#
# 為什麼需要 `pnpm build`？
#   Next 16 `output: "export"` 靜態 export 模式不支援 ISR / revalidatePath，
#   hero 卡 build-time import data/precedents/taipei-mental-distress.json，
#   唯一重生方式是 full rebuild。
#
# 為什麼這層重要？
#   沒有這個 script，cron 跑完只有報表更新，首頁 hero 仍顯示舊數字。
#   保經/律師進站第一眼看到舊的「102 件 / high confidence」會誤判
#   整個資料庫的健康度。
#
# 流程（3 步必須按序）：
#   1. pnpm report:precedents — 重生 precedents-report.html（報表層）
#   2. touch data/precedents/taipei-mental-distress.json — bump mtime
#      讓 Next turbopack cache 偵測到 JSON 變更（必要 trigger）
#   3. pnpm build — 全站 rebuild（含 hero Ensemble 健康度卡）
#
# 對 Vercel 部署友善：
#   本地跑完此 script 後，Vercel deploy hook 由 CI/CD 觸發，
#   本 script 只負責「本地 / 自管 prod」的情境。
#
# 預期耗時：~30 秒（pnpm build 是最重的步驟）
# 對 cron 每小時第 15 分跑一次的頻率：可接受
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$HOME/projects/tw-car-claim-estimator}"
LOG_FILE="${LOG_FILE:-/tmp/rebuild-hero.log}"

cd "$PROJECT_DIR" || { echo "❌ 找不到 $PROJECT_DIR" >&2; exit 1; }

NOW=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$NOW] === rebuild-hero 啟動 ===" | tee -a "$LOG_FILE"

# === 步驟 1: 重生報表 ===
echo "[$NOW] 步驟 1/3: 重生 precedents-report.html..." | tee -a "$LOG_FILE"
pnpm report:precedents 2>&1 | tail -5 | tee -a "$LOG_FILE"

# === 步驟 2: bump anchor JSON mtime（觸發 Next turbopack cache 失效）===
echo "[$NOW] 步驟 2/3: bump anchor JSON mtime..." | tee -a "$LOG_FILE"
touch data/precedents/taipei-mental-distress.json

# === 步驟 3: 全站 rebuild（含 hero Ensemble 健康度卡）===
echo "[$NOW] 步驟 3/3: pnpm build（hero 區塊重生）..." | tee -a "$LOG_FILE"
pnpm build 2>&1 | tail -10 | tee -a "$LOG_FILE"

END=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$END] ✅ rebuild-hero 完成" | tee -a "$LOG_FILE"
