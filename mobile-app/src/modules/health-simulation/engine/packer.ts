import { getDatabaseConnection } from '@/db/sqlite'
import { encode } from '@msgpack/msgpack'
import { ZstdCodec } from 'zstd-codec'
import type { RawHealthRecord } from '../types'
import { scheduleSyncWithJitter } from './sync_client'

// ─── ZSTD 實體管理 ─────────────────────────────────────────────────────────────

let zstdSimple: any = null

async function getZstd() {
  if (zstdSimple) return zstdSimple
  return new Promise<any>((resolve) => {
    ZstdCodec.run((zstd: any) => {
      zstdSimple = new zstd.Simple()
      resolve(zstdSimple)
    })
  })
}

// ─── 常數 ────────────────────────────────────────────────────────────────────

/** 視窗大小：10 分鐘 (毫秒) */
export const WINDOW_SIZE_MS = 10 * 60 * 1000

// ─── 數學聚合工具 ────────────────────────────────────────────────────────────

function calculateMode(arr: number[]): number {
  if (arr.length === 0) return 0
  const counts = new Map<number, number>()
  let maxCount = 0
  let mode = arr[0]
  for (const num of arr) {
    const c = (counts.get(num) || 0) + 1
    counts.set(num, c)
    if (c > maxCount) {
      maxCount = c
      mode = num
    }
  }
  return mode
}

// ─── 核心打包邏輯 ─────────────────────────────────────────────────────────────

/**
 * 取得過去尚未打包的 10 分鐘視窗，並執行壓縮與寫入
 */
export async function packPendingWindows(): Promise<void> {
  const db = await getDatabaseConnection()
  
  // 找出目前還沒滿的當下視窗時間
  const currentWindowStartTs = Math.floor(Date.now() / WINDOW_SIZE_MS) * WINDOW_SIZE_MS
  const currentWindowStartIso = new Date(currentWindowStartTs).toISOString()

  // 1. 找出所有存在於 realtime_health_records 但早於當下視窗的獨立視窗
  const windowQuery = await db.query(`
    SELECT DISTINCT
      substr(recorded_at, 1, 15) || '0:00.000Z' as window_start_guess
    FROM realtime_health_records
    WHERE recorded_at < ?
    ORDER BY recorded_at ASC
  `, [currentWindowStartIso])

  if (!windowQuery.values || windowQuery.values.length === 0) {
    return // 沒有舊資料需要打包
  }

  // 這裡需要用 TS 重新精確分群，因為 SQLite 的 substr 只是一個粗略的 10 分鐘切割（依賴字串長度）
  // 為了精確，我們直接抓取所有未打包的即時紀錄
  const unPackedQuery = await db.query(`
    SELECT r.id, r.heart_rate, r.hrv, r.sp_o2, r.activity_level, r.recorded_at
    FROM realtime_health_records r
    LEFT JOIN periodic_health_records p ON r.recorded_at >= p.window_start AND r.recorded_at <= p.window_end
    WHERE p.id IS NULL AND r.recorded_at < ?
    ORDER BY r.recorded_at ASC
  `, [currentWindowStartIso])

  if (!unPackedQuery.values || unPackedQuery.values.length === 0) {
    return
  }

  const rawRecords = unPackedQuery.values.map((row: any) => ({
    id: String(row.id),
    heartRate: Number(row.heart_rate),
    hrv: Number(row.hrv),
    spO2: Number(row.sp_o2),
    activityLevel: Number(row.activity_level),
    recordedAt: String(row.recorded_at),
  }))

  // 將資料依據精確的 10 分鐘 TS 分群
  const groups = new Map<number, RawHealthRecord[]>()
  for (const record of rawRecords) {
    const ts = new Date(record.recordedAt).getTime()
    const windowStartTs = Math.floor(ts / WINDOW_SIZE_MS) * WINDOW_SIZE_MS
    if (!groups.has(windowStartTs)) {
      groups.set(windowStartTs, [])
    }
    groups.get(windowStartTs)!.push(record)
  }

  const zstd = await getZstd()

  // 排序視窗 (由舊到新)
  const sortedWindows = Array.from(groups.keys()).sort((a, b) => a - b)

  for (const windowStartTs of sortedWindows) {
    const records = groups.get(windowStartTs)!
    
    // 若樣本數不足 6 筆，暫時略過（保留給未來向後合併邏輯）
    if (records.length < 6) {
      continue
    }

    const windowStart = new Date(windowStartTs)
    const windowEnd = new Date(windowStartTs + WINDOW_SIZE_MS - 1)

    let sumHr = 0, minHr = Infinity, maxHr = -Infinity
    let sumHrv = 0
    let sumSpo2 = 0, minSpo2 = Infinity
    const activities: number[] = []

    // Payload 格式: [[offset_sec, hr, hrv, spo2, act], ...]
    const rawDataArray: any[] = []

    for (const r of records) {
      sumHr += r.heartRate
      if (r.heartRate < minHr) minHr = r.heartRate
      if (r.heartRate > maxHr) maxHr = r.heartRate

      sumHrv += r.hrv
      
      sumSpo2 += r.spO2
      if (r.spO2 < minSpo2) minSpo2 = r.spO2

      activities.push(r.activityLevel)

      const offsetSec = Math.floor((new Date(r.recordedAt).getTime() - windowStartTs) / 1000)
      rawDataArray.push([offsetSec, r.heartRate, r.hrv, r.spO2, r.activityLevel])
    }

    const N = records.length
    const avgHr = Math.round(sumHr / N)
    const avgHrv = Math.round(sumHrv / N)
    const avgSpo2 = Math.round((sumSpo2 / N) * 100) / 100
    const modeAct = calculateMode(activities)

    // MsgPack + ZSTD
    const msgpackBytes = encode(rawDataArray)
    const compressedBytes = zstd.compress(msgpackBytes)

    const recordId = crypto.randomUUID()

    await db.run(
      `INSERT INTO periodic_health_records
         (id, window_start, window_end, avg_hr, min_hr, max_hr, avg_hrv, avg_spo2, min_spo2, dominant_activity_level, sample_count, sync_status, raw_data_payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        recordId,
        windowStart.toISOString(),
        windowEnd.toISOString(),
        avgHr,
        minHr,
        maxHr,
        avgHrv,
        avgSpo2,
        minSpo2,
        modeAct,
        N,
        'pending',
        compressedBytes,
        new Date().toISOString()
      ]
    )
  }

  // 成功完成壓縮打包後，觸發一次隨機延遲的同步作業
  if (sortedWindows.length > 0) {
    scheduleSyncWithJitter().catch((err) => 
      console.error('[health-packer] 觸發同步失敗:', err)
    )
  }
}

