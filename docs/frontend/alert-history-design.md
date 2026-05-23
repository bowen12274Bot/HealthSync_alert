# 預警紀錄實作規格

## 1. 目的

定義手機端預警紀錄功能的第一版實作邊界，包含：

- 手機端連線限制
- 歷史列表資料來源
- 手機端暫存方式
- 歷史詳情接線方向
- 後端查詢 API 的基本範圍

本文只保留已確定可實作的規則。

## 2. 現況

- 手機端 [AlertRecordsView.vue](../../mobile-app/src/views/AlertRecordsView.vue) 仍是靜態假資料
- 手機端 [AlertDisplayView.vue](../../mobile-app/src/views/AlertDisplayView.vue) 的 `history` mode 尚未接伺服器資料
- 手機端已有登入 token 機制，來源為 [auth.ts](../../mobile-app/src/stores/auth.ts) 與 [tokenStorage.ts](../../mobile-app/src/services/tokenStorage.ts)
- 手機端已有連線狀態機制，來源為 [useConnectionStatus.ts](../../mobile-app/src/composables/useConnectionStatus.ts)
- 伺服器目前只有同步上傳 API [sync.py](../../server/app/api/sync.py)，尚無歷史查詢 API
- 伺服器歷史資料來源分成兩張表：
  - `alert_histories`
  - `long_term_alerts`

## 3. 第一版範圍

### 3.1 包含

- 預警紀錄列表頁
- 歷史詳情頁資料接線
- 歷史紀錄查詢 API
- 手機端 online only 行為
- 手機端記憶體暫存
- `alert_histories` 與 `long_term_alerts` 的整併回傳

### 3.2 不包含

- 離線瀏覽
- 本地資料庫快取
- 複雜篩選
- 分頁
- 歷史詳情深度分析畫面

## 4. 核心規則

### 4.1 手機端使用限制

- 預警紀錄功能為 `online only`
- 只有 `useConnectionStatus()` 判定為 `online` 時才可發送查詢
- 若為 `offline`，不發 request，頁面顯示「預警紀錄需連線後才能查看」

### 4.2 歷史資料來源

- 即時預警歷史來源：`alert_histories`
- 長期預警歷史來源：`long_term_alerts`
- 手機端不直接處理兩張表原始資料
- 伺服器需先整併成單一 `records` 陣列後回傳

### 4.3 歷史列表頁行為

- 進入 `/alerts` 後檢查連線狀態
- `online` 時帶 Bearer token 呼叫歷史 API
- 請求中顯示 loading
- 成功後渲染 records
- 無資料時顯示空狀態
- 點擊單筆後進入歷史詳情頁

### 4.4 長期預警時間顯示

- `long_term_alerts` 在手機端固定顯示：

```text
window_start ~ window_end
```

## 5. API 規格

### 5.1 Endpoint

第一版新增：

```text
GET /alerts/history
GET /alerts/history/{record_id}
```

### 5.2 驗證

- 使用 Bearer token
- 只允許查詢目前登入使用者自己的資料

### 5.3 第一版查詢參數

只保留：

```text
limit?: number
```

第一版不做：

- `type` 篩選
- 日期區間篩選
- `cursor` 分頁

### 5.4 回傳原則

- 回傳統一的 `records` 陣列
- 每筆 record 需至少可支撐：
  - 歷史列表卡片
  - 歷史詳情導向
  - `realtime` / `long_term` 類型判斷
- 列表 API 只回列表需要欄位
- 詳情 API 回單筆完整欄位

### 5.5 排序規則

API 回傳前先排序：

```text
occurred_at DESC
created_at DESC
```

### 5.6 列表 API

```text
GET /alerts/history?limit=50
```

Response:

```json
{
  "records": [],
  "server_generated_at": "2026-05-24T03:00:00Z"
}
```

### 5.7 單筆詳情 API

```text
GET /alerts/history/{record_id}
```

`record_id` 格式固定為：

```text
alert_history:{id}
long_term_alert:{id}
```

Response:

```json
{
  "detail": {}
}
```

## 6. 欄位規格

## 6.1 歷史列表 record 欄位

每筆 `record` 固定包含以下欄位：

| 欄位 | 型別 | 用途 |
| --- | --- | --- |
| `record_id` | `string` | 列表 key、詳情查詢 key |
| `source_type` | `'realtime' \| 'long_term'` | 判斷資料來源類型 |
| `source_table` | `'alert_histories' \| 'long_term_alerts'` | 除錯與後端對應 |
| `source_key` | `string` | 原始資料主鍵 |
| `alert_type` | `string` | 系統內部 alert type |
| `alert_type_label` | `string` | 前端顯示用類型名稱 |
| `title` | `string` | 列表卡片主標題 |
| `summary` | `string` | 列表卡片副文案 |
| `history_type_label` | `string` | `即時預警` / `長期預警` |
| `display_severity` | `'mild' \| 'moderate' \| 'high'` | 卡片顏色與等級 |
| `display_severity_label` | `string` | `輕度` / `中度` / `高度` |
| `status` | `string` | 原始狀態值 |
| `status_label` | `string` | 前端顯示狀態 |
| `occurred_at` | `string` | 列表排序主時間 |
| `resolved_at` | `string \| null` | `realtime` 為解除時間，`long_term` 為 `window_end` |
| `time_range_label` | `string` | 列表與詳情顯示時間字串 |
| `created_at` | `string` | 次排序與追蹤 |

## 6.2 列表 record 顯示規則

- `history_type_label`
  - `realtime` -> `即時預警`
  - `long_term` -> `長期預警`
- `time_range_label`
  - `realtime` -> `occurred_at`
  - `long_term` -> `window_start ~ window_end`
- `title`
  - 使用該筆預警最適合給使用者看的主標
  - 例如：`血氧過低`、`心率過高`、`長期生理壓力風險`

## 6.3 歷史詳情 detail 共用欄位

每筆 `detail` 固定包含以下欄位：

| 欄位 | 型別 | 用途 |
| --- | --- | --- |
| `record_id` | `string` | 詳情主鍵 |
| `source_type` | `'realtime' \| 'long_term'` | 判斷詳情模板 |
| `source_table` | `'alert_histories' \| 'long_term_alerts'` | 後端對應 |
| `source_key` | `string` | 原始資料主鍵 |
| `alert_type` | `string` | 系統內部類型 |
| `alert_type_label` | `string` | 顯示用預警類型 |
| `title` | `string` | 詳情頁主標 |
| `summary` | `string` | 詳情頁摘要 |
| `display_severity` | `'mild' \| 'moderate' \| 'high'` | 主題色 |
| `display_severity_label` | `string` | 等級標籤 |
| `status` | `string` | 原始狀態值 |
| `status_label` | `string` | 顯示狀態 |
| `trigger_reason` | `string` | 顯示觸發原因 |
| `occurred_at` | `string` | 主要時間起點 |
| `resolved_at` | `string \| null` | 結束時間 |
| `time_range_label` | `string` | 顯示時間區間 |
| `created_at` | `string` | 建立時間 |

## 6.4 `realtime` 詳情欄位

`source_type = realtime` 時，額外包含：

| 欄位 | 型別 | 用途 |
| --- | --- | --- |
| `alert_id` | `string` | 原始 alert id |
| `max_risk_score` | `number` | 最高風險分數 |
| `max_severity_level` | `string` | 原始最高嚴重度 |
| `first_occurred_at` | `string` | 首次發生時間 |
| `last_abnormal_at` | `string \| null` | 最後異常時間 |
| `resolved_at` | `string \| null` | 解除時間 |
| `duration_seconds` | `number \| null` | 持續秒數 |
| `status_change_count` | `number` | 狀態變化次數 |
| `is_worsened` | `boolean` | 是否曾惡化 |
| `status_history` | `array` | 歷程列表 |

`status_history` item：

| 欄位 | 型別 |
| --- | --- |
| `status` | `string` |
| `status_label` | `string` |
| `risk_score` | `number` |
| `status_time` | `string` |
| `status_description` | `string` |

## 6.5 `long_term` 詳情欄位

`source_type = long_term` 時，額外包含：

| 欄位 | 型別 | 用途 |
| --- | --- | --- |
| `long_term_alert_id` | `number` | 原始 long term alert id |
| `risk_score` | `number` | 長期預警風險分數 |
| `window_start` | `string` | 分析視窗開始 |
| `window_end` | `string` | 分析視窗結束 |
| `updated_at` | `string` | 最後更新時間 |

## 6.6 手機端型別

```ts
type AlertHistorySourceType = 'realtime' | 'long_term'

type AlertDisplaySeverity = 'mild' | 'moderate' | 'high'

interface AlertHistoryRecord {
  recordId: string
  sourceType: AlertHistorySourceType
  sourceTable: 'alert_histories' | 'long_term_alerts'
  sourceKey: string
  alertType: string
  alertTypeLabel: string
  title: string
  summary: string
  historyTypeLabel: string
  displaySeverity: AlertDisplaySeverity
  displaySeverityLabel: string
  status: string
  statusLabel: string
  occurredAt: string
  resolvedAt: string | null
  timeRangeLabel: string
  createdAt: string
}

interface RealtimeStatusHistoryItem {
  status: string
  statusLabel: string
  riskScore: number
  statusTime: string
  statusDescription: string
}

interface AlertHistoryDetailBase extends AlertHistoryRecord {
  triggerReason: string
}

interface RealtimeAlertHistoryDetail extends AlertHistoryDetailBase {
  sourceType: 'realtime'
  alertId: string
  maxRiskScore: number
  maxSeverityLevel: string
  firstOccurredAt: string
  lastAbnormalAt: string | null
  durationSeconds: number | null
  statusChangeCount: number
  isWorsened: boolean
  statusHistory: RealtimeStatusHistoryItem[]
}

interface LongTermAlertHistoryDetail extends AlertHistoryDetailBase {
  sourceType: 'long_term'
  longTermAlertId: number
  riskScore: number
  windowStart: string
  windowEnd: string
  updatedAt: string
}

type AlertHistoryDetail =
  | RealtimeAlertHistoryDetail
  | LongTermAlertHistoryDetail
```

## 7. 後端整併規則

### 7.1 `alert_histories`

整併為 `source_type = realtime` 的 record。

補充：

- `source_key` 使用 `alert_id`
- `record_id` 使用 `alert_history:{id}`
- `summary` 使用 `trigger_reason`
- `status_history` 由 `status_history_payload` 解析

### 7.2 `long_term_alerts`

整併為 `source_type = long_term` 的 record。

補充規則：

- `source_key` 使用 `id`
- `record_id` 使用 `long_term_alert:{id}`
- `occurred_at` 使用 `window_start`
- 時間顯示範圍使用 `window_start ~ window_end`

## 8. 手機端暫存規則

### 8.1 暫存方式

第一版採：

```text
in-memory cache
```

不寫入：

- SQLite
- localStorage
- secure storage

### 8.2 暫存內容

建議保存：

- `records`
- `detailMap`
- `lastFetchedAt`
- `lastLimit`

### 8.3 暫存用途

- 同一次 app session 內，避免列表頁重複請求
- 列表進詳情時，可直接重用已拿到的 record
- 若後續補單筆詳情 API，可先查 `detailMap`

### 8.4 暫存失效

- 登出時清掉
- 重新登入時清掉
- 使用短 TTL 重新抓取

建議 TTL：

```text
2 分鐘
```

## 9. 歷史詳情頁方向

- `AlertDisplayView.vue` 的 `history` mode 不再共用即時預警資料
- `live mode` 仍使用本地即時預警資料
- `history mode` 改用伺服器歷史資料
- `history mode` 依 `source_type` 切換詳情欄位模板

## 10. 錯誤處理

- `401`：視為登入失效，清 session，導回登入頁
- network error：顯示無法連線訊息
- `5xx`：顯示伺服器忙碌訊息
- 離線時不送 request

## 11. 實作順序

1. 後端新增 `GET /alerts/history`
2. 後端新增 `GET /alerts/history/{record_id}`
3. 後端完成 `alert_histories` + `long_term_alerts` 整併查詢
4. 後端完成單筆詳情查詢與 DTO
5. 手機端新增 alert history service 與型別
6. 手機端將 `AlertRecordsView.vue` 改為呼叫列表 API
7. 手機端補 loading / empty / offline / error state
8. 手機端新增 in-memory cache
9. 手機端將歷史詳情頁接到伺服器歷史資料
