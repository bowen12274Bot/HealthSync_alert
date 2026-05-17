import { generateHealthRecord } from './generator'
import { getGenerationContext } from './runtime'
import { writeHealthRecord } from '../storage/repository'
import { packPendingWindows } from './packer'

// ─── 常數 ────────────────────────────────────────────────────────────────────

/** 每次生成間隔，對應系統需求 S003（每 5 秒寫入一筆） */
const GENERATION_INTERVAL_MS = 5_000

/** 每次打包壓縮間隔，對應方案 C（每 10 分鐘打包一次） */
const PACK_INTERVAL_MS = 10 * 60 * 1000

// ─── 狀態 ────────────────────────────────────────────────────────────────────

let intervalId: ReturnType<typeof setInterval> | null = null
let packIntervalId: ReturnType<typeof setInterval> | null = null

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
  
  // 啟動 5 秒高頻感應器生成
  intervalId = setInterval(() => {
    tick().catch((err: unknown) => {
      console.error('[health-simulation] 寫入失敗：', err)
    })
  }, GENERATION_INTERVAL_MS)

  // 啟動 10 分鐘打包壓縮 (方案 C)
  // Boot-up 時先執行一次，把過去斷電遺留的資料壓起來
  packPendingWindows().catch((err) => console.error('[health-packer] 初始打包失敗：', err))
  
  packIntervalId = setInterval(() => {
    packPendingWindows().catch((err) => console.error('[health-packer] 定期打包失敗：', err))
  }, PACK_INTERVAL_MS)
}

/**
 * 停止資料生成排程。
 * 若未在執行中則無作用（idempotent）。
 */
export function stopScheduler(): void {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
  }
  if (packIntervalId !== null) {
    clearInterval(packIntervalId)
    packIntervalId = null
  }
}

/** 回傳目前排程是否運作中 */
export function isSchedulerRunning(): boolean {
  return intervalId !== null
}
