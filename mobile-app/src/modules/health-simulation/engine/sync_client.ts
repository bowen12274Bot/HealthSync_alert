import { Network } from '@capacitor/network'
import { getDatabaseConnection } from '@/db/sqlite'
import { getApiBaseUrl } from '@/services/apiClient'

// ─── 工具函式 ─────────────────────────────────────────────────────────────────

/** 將 Uint8Array 轉換為 Base64 字串 */
function uint8ArrayToBase64(buffer: Uint8Array): string {
  let binary = ''
  const len = buffer.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i])
  }
  return btoa(binary)
}

// ─── 核心同步邏輯 ─────────────────────────────────────────────────────────────

/**
 * 排程執行同步作業，自動帶入 0 ~ 599 秒的隨機延遲 (Jitter) 以分散伺服器壓力
 */
export async function scheduleSyncWithJitter(): Promise<void> {
  const jitterMs = Math.floor(Math.random() * 600 * 1000)
  console.log(`[SyncClient] 準備同步，隨機延遲 ${Math.round(jitterMs / 1000)} 秒...`)

  setTimeout(() => {
    executeSync().catch((err) => console.error('[SyncClient] 同步發生非預期錯誤:', err))
  }, jitterMs)
}

/**
 * 實際執行同步上傳作業
 */
async function executeSync(): Promise<void> {
  // 1. 網路狀態檢查
  const status = await Network.getStatus()
  if (!status.connected) {
    console.log('[SyncClient] 網路離線，放棄本次同步，等待下一週期')
    return
  }

  const db = await getDatabaseConnection()

  // 2. 讀取未同步的週期資料 (pending)
  const query = await db.query(`
    SELECT * FROM periodic_health_records 
    WHERE sync_status = 'pending'
    ORDER BY window_start ASC
    LIMIT 50
  `)

  if (!query.values || query.values.length === 0) {
    return
  }

  // 3. 準備 Payload，處理 BLOB -> Base64
  const payloadRecords = query.values.map((row: any) => {
    let base64Payload: string | undefined = undefined

    if (row.raw_data_payload) {
      if (typeof row.raw_data_payload === 'string') {
        // Capacitor SQLite 有時候會直接將 BLOB 回傳為 Base64 字串
        base64Payload = row.raw_data_payload
      } else if (row.raw_data_payload instanceof Uint8Array || row.raw_data_payload instanceof ArrayBuffer) {
        base64Payload = uint8ArrayToBase64(new Uint8Array(row.raw_data_payload))
      } else if (Array.isArray(row.raw_data_payload)) {
        // 部分環境會轉成一般陣列
        base64Payload = uint8ArrayToBase64(new Uint8Array(row.raw_data_payload))
      }
    }

    return {
      window_start: row.window_start,
      window_end: row.window_end,
      avg_hr: Number(row.avg_hr),
      min_hr: Number(row.min_hr),
      max_hr: Number(row.max_hr),
      avg_hrv: Number(row.avg_hrv),
      avg_spo2: Number(row.avg_spo2),
      min_spo2: Number(row.min_spo2),
      dominant_activity_level: Number(row.dominant_activity_level),
      sample_count: Number(row.sample_count),
      raw_data_payload: base64Payload,
    }
  })

  const requestBody = {
    user_id: 'user_123', // TODO: 未來從 AuthStore 或 Capacitor Preferences 取得
    device_id: 'device_pixel7_001',
    sync_started_at: new Date().toISOString(),
    periodic_health_records: payloadRecords,
    alerts: [],
  }

  // 4. 發送 API 請求
  try {
    const response = await fetch(`${getApiBaseUrl()}/sync/batch`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (response.ok) {
      const data = await response.json()
      if (data.success) {
        // 5. 更新本地狀態為 synced
        const recordIds = query.values.map((r: any) => `'${r.id}'`).join(',')
        await db.run(`UPDATE periodic_health_records SET sync_status = 'synced' WHERE id IN (${recordIds})`)
        console.log(`[SyncClient] 同步成功：已上傳並更新 ${payloadRecords.length} 筆資料狀態`)
      }
    } else {
      console.error(`[SyncClient] API 回傳錯誤碼: ${response.status}`, await response.text())
    }
  } catch (error) {
    console.error('[SyncClient] HTTP 請求失敗 (可能是斷網或伺服器異常):', error)
  }
}
