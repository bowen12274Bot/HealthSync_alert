# 同步與伺服器資料保存 Review 問題整理

## 目的

這份文件整理目前同步功能與伺服器資料保存實作中，和設計決議不一致或仍需補強的地方。

目前判斷是：雖然同步主流程已經做起來，健康資料與預警資料可以整批送到伺服器並寫入資料庫；但仍有幾個資料模型與驗證規則是與設計文件有所出入，需要修正避免留下錯誤及潛在風險。

## 主要不一致點

以下是這次 review 找到的具體問題。這些不是「功能還沒優化」，而是目前實作和同步設計決議不一致的地方。

| 不一致點 | 目前實作 | 應符合的設計 | 具體影響 |
| --- | --- | --- | --- |
| 使用者身份來源不一致 | client payload 仍傳 `user_id`，server 也直接寫入 `request.user_id` | 同步資料歸屬一律由 JWT token 決定，client 不再傳 `user_id` | 可能出現 token 是帳號 A，但資料被寫成 `user_id = user_B` 的語意衝突 |
| `device_id` 的角色不清楚 | client 傳 `device_id`，server 保存，但系統沒有裝置綁定設計 | 本階段不支援裝置綁定，`device_id` 只能作為來源記錄 | 若把 `device_id` 當作驗證或歸屬依據，會超出目前系統能力 |
| 時間欄位沒有強制 UTC | server 使用 Pydantic `datetime`，可能接受沒有時區的時間 | 同步時間一律 UTC，沒有時區資訊應回 `400` | 週期窗、預警時間、日統計與長期分析可能因時區語意不同而錯位 |
| 基本資料一致性驗證不足 | 主要只做 schema 型別驗證與 Base64 驗證 | server 應驗證 window、sample_count、status_history 等欄位一致性 | 格式正確但語意錯誤的資料可能進入長期資料庫 |
| 預警歷史與長期預警表邊界需要寫死 | 目前同步流程方向是對的，但文件和責任邊界需要明確化 | `alert_histories` 只存手機端預警歷史，`long_term_alerts` 只存伺服器長期分析結果 | 若未來混用資料表，會造成來源資料與分析結果語意混亂 |
| 同步失敗狀態不符合設計 | 目前會寫入 `sync_record.sync_status = failed` | 同步狀態只能是 `pending / synced`，失敗原因可記錄但不能新增同步狀態 | 破壞原本簡單狀態模型，也會讓後續同步判斷變複雜 |

## 重點摘要

### 1. 使用者身份一律由 JWT token 決定

同步資料屬於哪個使用者，應由伺服器根據 JWT token 判斷。

決議如下：

- client 不再傳入 `user_id`
- 伺服器不再相信 client body 中的使用者身份欄位
- PostgreSQL 內部以 `user_accounts.id` / `user_account_id` 作為主要使用者身份欄位

目前實作的問題是，同步 payload 仍有 `user_id`，後端也會把 client 傳來的 `request.user_id` 寫入資料表。這會造成 token 身份與 body 身份可能不一致。

應調整：

- sync request schema 移除 `user_id`
- client 組 payload 時不再送 `user_id`
- server 寫入資料時改用 token 對應出的帳號身份
- 若資料表中仍保留 `user_id` 欄位，需確認它是否只是歷史欄位或後續移除

### 2. 本階段不支援裝置綁定，`device_id` 只作為來源記錄

目前系統沒有裝置綁定設計，也沒有裝置資料表、裝置註冊流程或 user-device 關聯。

決議如下：

- 本階段不支援裝置綁定
- 同步流程不得實作裝置身份驗證
- `device_id` 不得作為資料歸屬判定依據
- `device_id` 不得作為信任欄位使用
- `device_id` 若保留，只能作為來源裝置記錄欄位

因此，不需要補 `device_id` 合法性驗證。設計文件應改成「本階段暫時保存 `device_id`，但不作為信任、驗證或歸屬依據」。

### 3. 時間欄位一律使用 UTC，未帶時區視為錯誤

同步流程中的所有時間欄位都應使用 UTC 的 ISO 8601 格式。

決議如下：

- 伺服器不得接受沒有時區的 datetime
- 沒有時區資訊的時間欄位視為無效 payload
- 無效時間欄位應回傳 `400`

需要套用的欄位至少包含：

- `sync_started_at`
- `window_start`
- `window_end`
- `first_occurred_at`
- `resolved_at`
- `status_history[].status_time`

目前實作只使用 Pydantic `datetime`，可能接受沒有時區的 naive datetime，這需要補驗證。

### 4. 伺服器需要補基本資料一致性驗證

伺服器不需要重新分析預警是否成立，但需要確認同步資料本身是合法且一致的。

應補齊的驗證包含：

- `window_start < window_end`
- `sample_count >= 0`
- `status_history` 不可為空
- `status_change_count == len(status_history)`
- `max_risk_score >= max(status_history[].risk_score)`
- `first_occurred_at <= status_history[].status_time`
- 若 `resolved_at` 存在，應有解除狀態或符合已完成預警規則

這些驗證不是在重做預警分析，而是在避免格式正確但語意錯誤的資料進入長期資料庫。

### 5. `alert_histories` 與 `long_term_alerts` 的責任邊界要寫死

資料表責任邊界已決議如下：

- `alert_histories` 只保存手機端同步上來的完整預警歷史
- `long_term_alerts` 只保存伺服器長期分析模組產生的長期預警結果
- 同步接收流程不得直接寫入 `long_term_alerts`

若之後將手機端預警直接寫入 `long_term_alerts`，或將伺服器長期分析結果寫入 `alert_histories`，都視為違反資料表語意邊界。

### 6. 同步失敗時不得新增 `failed` 同步狀態

目前設計中：

- 資料同步狀態只有 `pending / synced`
- 全域連線狀態只有 `online / offline`

目前實作會將 `sync_record.sync_status` 寫成 `failed`，這和原本同步狀態設計不一致。

決議如下：

- 同步失敗時，本輪資料維持 `pending`
- 不得把 `failed` 作為資料同步狀態
- 失敗原因可以記錄，但不應擴充同步狀態枚舉
- 若同步失敗後需要確認是否為網路問題，應接既有 ping 機制
- ping 失敗才切全域連線狀態為 `offline`
- ping 成功則不切 `offline`

這裡要處理的是「是否切換連線狀態」，不是新增同步狀態。

## 測試缺口

目前測試有覆蓋無 token、無效 token、空 payload、缺少 `steps`、無效 Base64。

仍需要補測：

- client 不再傳 `user_id`
- server 以 JWT token 對應的使用者身份寫入資料
- 沒有時區的 datetime 會被拒絕
- `window_start >= window_end` 會被拒絕
- `sample_count < 0` 會被拒絕
- `status_history` 空陣列會被拒絕
- `status_change_count` 與 `status_history.length` 不一致會被拒絕
- 同步失敗時不會產生 `failed` 同步狀態

不需要補測：

- `device_id` 是否屬於某個 user
- `raw_data_payload` 是否能解壓成 MsgPack + ZSTD

原因是本階段決議不支援裝置綁定，且 `raw_data_payload` 目前只需能作為 Base64 bytes 保存。

## 結論

同步主流程已完成，但目前還不能說完整符合設計。

主要需要修正的是：

- 使用者身份改由 JWT token 單一決定
- `device_id` 降級為來源記錄欄位
- 所有同步時間欄位統一 UTC 並拒絕 naive datetime
- 補齊週期健康資料與預警歷史的基本一致性驗證
- 寫死 `alert_histories` 與 `long_term_alerts` 的資料表責任邊界
- 移除 `failed` 作為同步狀態的實作

簡短結論：

```text
同步主流程已打通，但身份來源、時間規則、資料一致性驗證與同步狀態模型仍需依設計決議修正。
```
