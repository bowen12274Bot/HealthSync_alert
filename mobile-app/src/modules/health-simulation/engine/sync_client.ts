/* eslint-disable @typescript-eslint/no-explicit-any */
import { Network } from '@capacitor/network'
import { getDatabaseConnection } from '@/db/sqlite'
import { getApiBaseUrl } from '@/services/apiClient'
import { readAuthSession } from '@/services/tokenStorage'
import {
  getPendingCompletedAlerts,
  getAlertStatusesForSync,
  updateAlertsSyncStatus,
} from '@/modules/alert-engine/repository'

// ─── 工具函式 ─────────────────────────────────────────────────────────────────

/** 將 Uint8Array 轉換為 Base64 字串 */
function uint8ArrayToBase64(buffer: Uint8Array): string {
  let binary = ''
  const len = buffer.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i] ?? 0)
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
  // 1. 網路狀態檢查與身分驗證檢查
  const status = await Network.getStatus()
  if (!status.connected) {
    console.log('[SyncClient] 網路離線，放棄本次同步，等待下一週期')
    return
  }

  const { token, user } = await readAuthSession()
  if (!token || !user) {
    console.log('[SyncClient] 使用者尚未登入，取消本次同步作業')
    return
  }

  const db = await getDatabaseConnection()

  // 2. 讀取待同步的週期健康紀錄 (最多 50 筆)
  const healthQuery = await db.query(`
    SELECT * FROM periodic_health_records 
    WHERE sync_status = 'pending'
    ORDER BY window_start ASC
    LIMIT 50
  `)

  // 3. 讀取待同步且已結束的即時預警紀錄
  const pendingAlerts = await getPendingCompletedAlerts()

  const hasRecords = healthQuery.values && healthQuery.values.length > 0
  const hasAlerts = pendingAlerts && pendingAlerts.length > 0

  if (!hasRecords && !hasAlerts) {
    console.log('[SyncClient] 無任何待同步的健康數據與預警紀錄')
    return
  }

  // 4. 準備健康紀錄 Payload
  const payloadRecords = (healthQuery.values || []).map((row: any) => {
    let base64Payload: string | undefined = undefined

    if (row.raw_data_payload) {
      if (typeof row.raw_data_payload === 'string') {
        base64Payload = row.raw_data_payload
      } else if (row.raw_data_payload instanceof Uint8Array || row.raw_data_payload instanceof ArrayBuffer) {
        base64Payload = uint8ArrayToBase64(new Uint8Array(row.raw_data_payload))
      } else if (Array.isArray(row.raw_data_payload)) {
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
      steps: 0, // 對齊後端 steps 欄位規格，預設為 0
      raw_data_payload: base64Payload,
    }
  })

  // 5. 準備預警歷史 Payload
  const payloadAlerts = []
  for (const alert of pendingAlerts) {
    const statuses = await getAlertStatusesForSync(alert.alertId)
    const maxRiskScore = statuses.reduce((max, s) => Math.max(max, s.riskScore), alert.initialRiskScore)

    // 依據最高風險分數映射為對應的文字級別
    let maxSeverityLevel = '無'
    if (maxRiskScore >= 7) {
      maxSeverityLevel = '高度'
    } else if (maxRiskScore >= 5) {
      maxSeverityLevel = '中度'
    } else if (maxRiskScore >= 3) {
      maxSeverityLevel = '低度'
    }

    payloadAlerts.push({
      alert_id: alert.alertId,
      alert_type: alert.alertType,
      trigger_reason: alert.triggerReason,
      initial_risk_score: alert.initialRiskScore,
      max_risk_score: maxRiskScore,
      max_severity_level: maxSeverityLevel,
      first_occurred_at: alert.firstOccurredAt,
      resolved_at: alert.detectionEndTime,
      status_change_count: statuses.length,
      status_history: statuses.map((s) => ({
        status: s.status,
        risk_score: s.riskScore,
        status_time: s.statusTime,
        status_description: s.statusDescription,
      })),
    })
  }

  // 6. 建立同步歷史紀錄 (sync_record)
  const syncId = crypto.randomUUID()
  const syncStartTime = new Date().toISOString()
  const syncDataCount = payloadRecords.length + payloadAlerts.length
  const allTimestamps = [
    ...payloadRecords.map((r) => r.window_start),
    ...payloadAlerts.map((a) => a.first_occurred_at),
  ].sort()
  const syncDataRange = allTimestamps.length > 0
    ? `${allTimestamps[0]} ~ ${allTimestamps[allTimestamps.length - 1]}`
    : 'N/A'

  await db.run(
    `INSERT INTO sync_record (sync_id, sync_start_time, sync_status, sync_data_range, sync_data_count, retry_count)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [syncId, syncStartTime, 'running', syncDataRange, syncDataCount, 0],
  )

  const requestBody = {
    user_id: `user_${user.id}`,
    device_id: 'device_pixel7_001',
    sync_started_at: new Date().toISOString(),
    periodic_health_records: payloadRecords,
    alerts: payloadAlerts,
  }

  // 7. 發送 API 請求
  try {
    const response = await fetch(`${getApiBaseUrl()}/sync/batch`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`, // JWT 認證
      },
      body: JSON.stringify(requestBody),
    })

    if (response.ok) {
      const data = await response.json()
      if (data.success) {
        // 更新本地數據為 synced
        if (payloadRecords.length > 0) {
          const recordIds = (healthQuery.values || []).map((r: any) => `'${r.id}'`).join(',')
          await db.run(`UPDATE periodic_health_records SET sync_status = 'synced' WHERE id IN (${recordIds})`)
        }
        if (payloadAlerts.length > 0) {
          const alertIds = pendingAlerts.map((a) => a.alertId)
          await updateAlertsSyncStatus(alertIds, 'synced')
        }

        // 更新同步紀錄為 success
        await db.run(
          `UPDATE sync_record SET sync_status = 'success', sync_end_time = ? WHERE sync_id = ?`,
          [new Date().toISOString(), syncId],
        )

        console.log(`[SyncClient] 同步成功：已上傳並更新 ${syncDataCount} 筆資料狀態`)
      } else {
        throw new Error(data.message || 'Server rejected request')
      }
    } else {
      const errorText = await response.text()
      console.error(`[SyncClient] API 回傳錯誤碼: ${response.status}`, errorText)
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }
  } catch (error: any) {
    const errorMessage = error?.message || String(error)
    console.error('[SyncClient] HTTP 同步請求失敗:', errorMessage)

    // 更新同步紀錄為 failed 并記錄失敗原因
    await db.run(
      `UPDATE sync_record 
          SET sync_status = 'failed', sync_end_time = ?, failure_reason = ? 
        WHERE sync_id = ?`,
      [new Date().toISOString(), errorMessage, syncId],
    )
  }
}
