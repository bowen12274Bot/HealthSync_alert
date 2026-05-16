# 伺服器同步對接設計

## 1. 文件目的

本文定義手機端單向同步到伺服器端的對接方式，作為：

- 手機同步模組
- 伺服器接收 API
- 伺服器資料寫入邏輯
- 同步成功與失敗回應規則

的共同依據。

本文件只處理：

- 手機端如何送出同步資料
- 伺服器如何接收同步資料
- 伺服器如何驗證、去重與寫入
- 伺服器如何回應同步結果

本文件不處理：

- 本地資料壓縮規則
- 本地預警分析規則
- 伺服器端長期分析規則
- 伺服器反向下發資料

## 2. 對接定位

目前同步先採用：

```text
手機 -> 伺服器
```

的單向同步模式。

同步的目的不是讓伺服器立即重新分析手機資料，而是：

> 讓手機端已整理完成的同步資料，能被伺服器正確接收並保存到長期資料庫。

因此在本階段，伺服器端的主要責任為：

- 接收同步請求
- 驗證請求格式
- 驗證使用者身份
- 檢查資料是否重複
- 將資料寫入伺服器資料庫
- 回傳整批成功或失敗

## 3. 同步資料範圍

目前手機同步到伺服器的資料包含兩類：

```text
1. 週期健康紀錄
2. 完整預警資料
```

### 3.1 週期健康紀錄

手機端先將原始即時健康資料壓縮成：

```text
periodic_health_record
```

再作為同步資料上傳。

伺服器接收後，直接寫入：

```text
週期健康紀錄表
```

### 3.2 完整預警資料

手機端只同步已由預警分析模組判定為完整的預警資料。

這些資料在同步前已完成：

- 預警生命週期整理
- 狀態歷史整理
- 同步 payload 正規化

伺服器接收後，寫入：

```text
預警歷史表
```

說明：

- 手機端同步上來的預警資料屬於來源預警歷史
- 伺服器端的 `長期預警表` 仍由伺服器後端長期分析模組自行產生
- 同步接收流程不直接建立長期預警資料

## 4. API 設計方向

目前建議採用單一批次同步 API：

```text
POST /sync/batch
```

原因：

- 本地同步已定義為整批成功才算成功
- 健康資料與預警資料可在同一個 request 中一起驗證
- 伺服器端可在同一個 transaction 內一起寫入與回滾
- 避免多個 API 造成部分成功、部分失敗的回滾複雜度

## 5. 批次同步 payload

同步 payload 建議至少包含以下結構：

```json
{
  "user_id": "string",
  "device_id": "string",
  "sync_started_at": "datetime",
  "periodic_health_records": [],
  "alerts": []
}
```

各欄位意義如下：

| 欄位 | 意義 |
| --- | --- |
| `user_id` | 本次同步資料所屬使用者 |
| `device_id` | 來源手機裝置識別 |
| `sync_started_at` | 手機端本輪同步開始時間 |
| `periodic_health_records` | 本輪待同步的週期健康紀錄 |
| `alerts` | 本輪待同步的完整預警資料 |

### 5.1 正式 request 範例

建議 request body 採用以下格式：

```json
{
  "user_id": "user_001",
  "device_id": "device_android_001",
  "sync_started_at": "2026-05-16T10:20:15+08:00",
  "periodic_health_records": [
    {
      "window_start": "2026-05-16T10:00:00+08:00",
      "window_end": "2026-05-16T10:09:59+08:00",
      "avg_hr": 82,
      "min_hr": 71,
      "max_hr": 98,
      "avg_hrv": 47,
      "avg_spo2": 97,
      "min_spo2": 95,
      "dominant_activity_level": 1,
      "sample_count": 96
    }
  ],
  "alerts": [
    {
      "alert_id": "alert_20260516_001",
      "alert_type": "spo2_risk",
      "trigger_reason": "SpO2 sustained low",
      "initial_risk_score": 5,
      "max_risk_score": 8,
      "first_occurred_at": "2026-05-16T10:14:20+08:00",
      "resolved_at": "2026-05-16T10:19:35+08:00",
      "status_change_count": 4,
      "status_history": [
        {
          "status": "注意",
          "risk_score": 5,
          "status_time": "2026-05-16T10:14:20+08:00",
          "status_description": "SpO2 持續下降"
        },
        {
          "status": "警戒",
          "risk_score": 8,
          "status_time": "2026-05-16T10:16:40+08:00",
          "status_description": "SpO2 低於安全門檻"
        },
        {
          "status": "已解除",
          "risk_score": 2,
          "status_time": "2026-05-16T10:19:35+08:00",
          "status_description": "數值恢復穩定"
        }
      ]
    }
  ]
}
```

時間欄位建議：

- 一律使用 ISO 8601 datetime 字串
- 需包含時區資訊

## 6. 週期健康紀錄格式

每筆週期健康紀錄建議至少包含：

```json
{
  "window_start": "datetime",
  "window_end": "datetime",
  "avg_hr": 0,
  "min_hr": 0,
  "max_hr": 0,
  "avg_hrv": 0,
  "avg_spo2": 0,
  "min_spo2": 0,
  "dominant_activity_level": 0,
  "sample_count": 0
}
```

設計原則：

- 盡量貼近伺服器週期健康紀錄表的欄位語意
- 讓伺服器接收後可直接映射寫入
- 保留 `window_start` 與 `window_end` 作為去重與對帳依據

## 7. 完整預警資料格式

每筆完整預警資料建議至少包含：

```json
{
  "alert_id": "string",
  "alert_type": "string",
  "trigger_reason": "string",
  "initial_risk_score": 0,
  "max_risk_score": 0,
  "first_occurred_at": "datetime",
  "resolved_at": "datetime",
  "status_change_count": 0,
  "status_history": []
}
```

其中 `status_history` 內每筆建議至少包含：

```json
{
  "status": "string",
  "risk_score": 0,
  "status_time": "datetime",
  "status_description": "string"
}
```

設計原則：

- payload 應優先對齊伺服器長期預警資料需求
- 不要求與手機本地資料表一比一對應
- 以伺服器可直接寫入預警歷史表為目標

## 8. 伺服器接收流程

伺服器接收同步資料後，建議固定依以下順序處理：

```text
1. 接收 POST /sync/batch
2. 驗證 request schema
3. 驗證 user_id 與 device_id
4. 驗證時間格式與欄位完整性
5. 驗證 periodic_health_records 與 alerts 資料格式
6. 開啟資料庫 transaction
7. 寫入週期健康紀錄
8. 寫入預警歷史表
9. 全部成功則 commit
10. 任一步驟失敗則 rollback
11. 回傳整批成功或整批失敗
```

## 9. 伺服器驗證原則

伺服器端只做同步接收必要的驗證，不在同步當下重新做長期分析。

建議至少驗證：

- request JSON 結構正確
- `user_id` 有效
- `device_id` 合法
- 時間欄位格式正確
- `window_start < window_end`
- `sample_count >= 0`
- `status_history` 結構完整

本階段不處理：

- 對手機上傳資料重新做風險分析
- 即時重新判斷預警是否成立
- 對週期健康紀錄重新做統計重算

## 10. 去重與冪等

由於同步失敗後本地資料會維持 `pending` 並於下次重送，因此伺服器必須支援冪等寫入。

### 10.1 健康資料去重鍵

健康資料建議以：

```text
user_id + window_start + window_end
```

作為主要去重鍵。

用途：

- 避免同一個 10 分鐘週期健康紀錄重複入庫
- 讓本地重送時伺服器可正確識別已存在資料

### 10.2 預警資料去重鍵

預警資料建議以：

```text
alert_id
```

作為主要去重鍵。

用途：

- 避免同一筆完整預警紀錄重複入庫
- 讓伺服器可對應同一筆來源預警事件

## 11. 寫入策略

### 11.1 週期健康紀錄

伺服器收到 `periodic_health_records` 後：

- 逐筆檢查去重鍵
- 若尚未存在，寫入週期健康紀錄表
- 若已存在，視為重送資料，可略過或視為 idempotent success

### 11.2 完整預警資料

伺服器收到 `alerts` 後：

- 先檢查 `alert_id` 是否已存在
- 若尚未存在，寫入預警歷史表
- 若 `alert_id` 已存在，視為重送資料，應避免重複建立同一筆來源預警歷史
- 伺服器端 `長期預警表` 仍由後端分析模組依預警歷史與長期資料另外產生

## 12. 交易與回滾

同步以整批成功為準。

因此伺服器端應使用單一 transaction 處理本輪批次資料：

- 健康資料寫入成功
- 預警歷史寫入成功

以上全部成立，才可 commit。

若任一步驟失敗，則：

- rollback 整個 transaction
- 不保留部分成功結果
- 回傳本輪同步失敗

## 13. 成功與失敗回應

### 13.1 成功回應

成功回應建議至少包含：

```json
{
  "success": true,
  "accepted_health_record_count": 0,
  "accepted_alert_count": 0,
  "server_received_at": "datetime"
}
```

用途：

- 讓手機端確認本輪同步已被伺服器接受
- 作為本地資料由 `pending` 改為 `synced` 的依據

正式範例：

```json
{
  "success": true,
  "accepted_health_record_count": 1,
  "accepted_alert_count": 1,
  "server_received_at": "2026-05-16T10:20:17+08:00"
}
```

### 13.2 失敗回應

失敗回應建議至少包含：

```json
{
  "success": false,
  "error_code": "string",
  "message": "string"
}
```

用途：

- 讓手機端知道本輪不可視為成功
- 本地資料維持 `pending`
- 後續交由下一輪同步重新補傳

正式範例：

```json
{
  "success": false,
  "error_code": "SYNC_VALIDATION_FAILED",
  "message": "window_start must be earlier than window_end"
}
```

## 14. 手機端與伺服器端責任切分

### 14.1 手機端責任

- 產生原始健康資料
- 壓縮成週期健康紀錄
- 將預警資料整理成完整同步 payload
- 只送出 `pending` 資料
- 收到成功回應後才改 `synced`

### 14.2 伺服器端責任

- 接收同步請求
- 驗證 payload
- 檢查去重鍵
- 使用 transaction 寫入資料庫
- 將手機端預警資料保存為預警歷史
- 回傳整批成功或整批失敗

### 14.3 伺服器端本階段不負責

- 對同步資料立即重新分析
- 即時重新計算風險
- 取代手機端本地預警分析模組

伺服器端的長期分析功能仍可存在，但不屬於本同步接收流程的工作。

## 15. 完整對接流程

```text
1. 手機端整理本輪待同步資料
   - periodic_health_records
   - alerts

2. 手機端送出 POST /sync/batch

3. 伺服器驗證 request schema 與使用者資訊

4. 伺服器開啟 transaction

5. 伺服器寫入週期健康紀錄表

6. 伺服器寫入預警歷史表

7. 若全部成功
   - commit
   - 回傳 success = true

8. 若任一步驟失敗
   - rollback
   - 回傳 success = false

9. 手機端收到成功回應後
   - 將本輪資料改為 synced

10. 手機端收到失敗回應後
   - 保持 pending
   - 等下一輪重新補傳
```

## 16. 核心規則摘要

```text
手機端目前只做單向同步到伺服器。
同步資料包含週期健康紀錄與完整預警資料。
伺服器端只負責接收、驗證、去重與寫入，不在同步當下重新分析。
手機端預警資料只寫入預警歷史表。
長期預警表仍由伺服器後端分析模組自行產生。
同步對接採用單一 POST /sync/batch。
伺服器以單一 transaction 處理整批資料，任一步驟失敗即整批 rollback。
手機端只有在收到成功回應後，才將本地資料改為 synced。
```

最簡短版本如下：

> 單向同步由手機端將週期健康紀錄與完整預警資料整批送至 `POST /sync/batch`，伺服器只做驗證、去重與資料庫寫入，不做立即分析；其中手機端預警資料只寫入預警歷史表，長期預警表仍由伺服器後端分析模組產生；整批資料以單一 transaction 處理，全部成功才 commit，手機端收到成功回應後才將本地資料標記為 `synced`。
