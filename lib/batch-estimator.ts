/**
 * Batch Estimator — 批次估算多案件（v0.12.0+ Phase E1）
 *
 * 業務員常見場景：一天處理 5-10 個案件，全部填 7 步表單太累
 * → 用 CSV 一次貼 10 筆，系統跑全部，回傳結果表
 *
 * CSV 格式（每行 1 案件）：
 *   accidentDate,accidentLocation,disabilityLevel,faultRatio
 *   2026-03-15,臺中市西區,7,30
 *   2026-04-01,臺北市大安區,12,50
 *
 * - 第一行是 header（必須）
 * - 欄位順序固定，逗號分隔
 * - 4 個欄位都必填
 * - faultRatio：己方肇責 0-100（自動推算 otherFaultRatio = 100 - faultRatio）
 *
 * 為什麼用 SAMPLE_INPUT 模板：estimateClaim 需要完整 ClaimInput，
 * 其他欄位（person/medicalReceipts/property）預先用合理預設值
 */

import { estimateClaim } from '@/lib/insurance'
import { SAMPLE_INPUT } from '@/lib/insurance/sample'
import type { ClaimInput, EstimationResult } from '@/lib/insurance/types'

export interface BatchRow {
  /** 1-indexed row number（含 header 為第 1 行）*/
  rowNumber: number
  /** 原始 CSV 欄位值 */
  accidentDate: string
  accidentLocation: string
  disabilityLevel: number
  faultRatio: number
  /** 計算結果（成功時有）*/
  result?: EstimationResult
  /** 錯誤訊息（失敗時有）*/
  error?: string
}

/**
 * 解析 CSV 字串成 BatchRow[]
 * - header row 必填
 * - 4 個欄位順序：accidentDate, accidentLocation, disabilityLevel, faultRatio
 */
export function parseBatchCsv(csv: string): BatchRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) return []

  const rows: BatchRow[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // 跳過 header
    if (i === 0 && /accidentDate/i.test(line)) continue

    const cols = line.split(',').map((c) => c.trim())
    if (cols.length < 4) {
      rows.push({
        rowNumber: i + 1,
        accidentDate: cols[0] ?? '',
        accidentLocation: cols[1] ?? '',
        disabilityLevel: 0,
        faultRatio: 0,
        error: `欄位不足 4 個（找到 ${cols.length}）`,
      })
      continue
    }

    const dl = Number(cols[2])
    const fr = Number(cols[3])

    if (Number.isNaN(dl) || dl < 1 || dl > 15) {
      rows.push({
        rowNumber: i + 1,
        accidentDate: cols[0] ?? '',
        accidentLocation: cols[1] ?? '',
        disabilityLevel: 0,
        faultRatio: fr,
        error: `失能等級 ${cols[2]} 超出範圍 1-15`,
      })
      continue
    }

    if (Number.isNaN(fr) || fr < 0 || fr > 100) {
      rows.push({
        rowNumber: i + 1,
        accidentDate: cols[0] ?? '',
        accidentLocation: cols[1] ?? '',
        disabilityLevel: dl,
        faultRatio: 0,
        error: `肇責比例 ${cols[3]} 超出範圍 0-100`,
      })
      continue
    }

    rows.push({
      rowNumber: i + 1,
      accidentDate: cols[0] ?? '',
      accidentLocation: cols[1] ?? '',
      disabilityLevel: dl,
      faultRatio: fr,
    })
  }

  return rows
}

/**
 * 估算 BatchRow[] 全部案件
 * - 用 estimateClaim 跑 6 大引擎
 * - 用 SAMPLE_INPUT 模板填其他必填欄位（保戶資料 / 醫療細節）
 * - 任何錯誤不會中斷整批，會在 row.error 顯示
 */
export function estimateBatch(rows: BatchRow[]): BatchRow[] {
  return rows.map((row) => {
    if (row.error) return row
    try {
      const input: ClaimInput = {
        ...SAMPLE_INPUT,
        basics: {
          ...SAMPLE_INPUT.basics,
          accidentDate: row.accidentDate,
          accidentLocation: row.accidentLocation,
          accidentCity: row.accidentLocation,
        },
        medical: {
          ...SAMPLE_INPUT.medical,
          disabilityLevel: row.disabilityLevel,
        },
        fault: {
          ...SAMPLE_INPUT.fault,
          selfFaultRatio: row.faultRatio,
          otherFaultRatio: 100 - row.faultRatio,
        },
      }
      const result = estimateClaim(input)
      return { ...row, result }
    } catch (e) {
      return {
        ...row,
        error: e instanceof Error ? e.message : '未知錯誤',
      }
    }
  })
}

/**
 * 從 BatchRow[] 產出 CSV 字串（給「複製 CSV」按鈕用）
 */
export function batchToCsv(rows: BatchRow[]): string {
  const header = 'rowNumber,accidentDate,accidentLocation,disabilityLevel,faultRatio,compulsoryTotal,thirdPartyMid,error'
  const lines = rows.map((row) => {
    const cols = [
      String(row.rowNumber),
      row.accidentDate,
      row.accidentLocation,
      String(row.disabilityLevel),
      String(row.faultRatio),
      row.result?.compulsoryTotalEstimated?.toString() ?? '',
      row.result?.thirdParty?.thirdPartyEstimateMid?.toString() ?? '',
      row.error ?? '',
    ]
    return cols.join(',')
  })
  return [header, ...lines].join('\n')
}

/**
 * 範例 CSV（給 textarea placeholder 用）
 */
export const BATCH_CSV_EXAMPLE = `accidentDate,accidentLocation,disabilityLevel,faultRatio
2026-03-15,臺中市西區,7,30
2026-04-01,臺北市大安區,12,50
2026-05-20,高雄市苓雅區,3,70`