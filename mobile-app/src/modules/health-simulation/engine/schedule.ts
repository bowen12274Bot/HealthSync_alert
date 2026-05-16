import { generateHealthRecord } from './generator'
import { getGenerationContext } from './runtime'
import { writeHealthRecord } from '../storage/repository'

// ─── 常數 ────────────────────────────────────────────────────────────────────

/** 每次生成間隔，對應系統需求 S003（每 5 秒寫入一筆） */
const GENERATION_INTERVAL_MS = 5_000

// ─── 狀態 ────────────────────────────────────────────────────────────────────

let intervalId: ReturnType<typeof setInterval> | null = null

// ─── 排程核心 ─────────────────────────────────────────────────────────────────

async function tick(): Promise<void> {
  const context = getGenerationContext()
  const record = generateHealthRecord(context)
  await writeHealthRecord(record)
}

// ─── 對外控制函式（由 index.ts 重新導出） ─────────────────────────────────────

/**
 * 啟動資料生成排程。
 * 若已在執行中則不重複啟動（idempotent）。
 */
export function startScheduler(): void {
  if (intervalId !== null) return
  intervalId = setInterval(() => {
    tick().catch((err: unknown) => {
      console.error('[health-simulation] 寫入失敗：', err)
    })
  }, GENERATION_INTERVAL_MS)
}

/**
 * 停止資料生成排程。
 * 若未在執行中則無作用（idempotent）。
 */
export function stopScheduler(): void {
  if (intervalId === null) return
  clearInterval(intervalId)
  intervalId = null
}

/** 回傳目前排程是否運作中 */
export function isSchedulerRunning(): boolean {
  return intervalId !== null
}
