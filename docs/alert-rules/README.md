# 本地端健康資料生成與預警分析規則

## 1. 文件目的

本文定義本地端健康資料模擬、分析與預警的完整規則，作為資料生成模組、分析模組與 SQLite 資料表設計的共同依據。

系統目標如下：

- 模擬智慧手錶或手環，每 5 秒產生一筆健康資料。
- 將資料寫入本地 SQLite。
- 由本地分析模組根據滑動視窗、活動基準與風險分數判斷是否產生預警。

目前生成資料包含：

```text
HR：心率
HRV：心率變異
SpO2：血氧
activity_level：活動等級
```

其中：

```text
HR、HRV、SpO2 = 生理資料
activity_level = 活動情境資料
```

`activity_level` 不表示具體活動種類，只表示活動強度，用來解釋當下 HR、HRV、SpO2 的變化是否合理。

例如：

```text
高活動時 HR 上升、HRV 下降可能是正常反應。
低活動時 HR 上升、HRV 下降則較可能代表異常。
```

## 2. activity_level 定義

| activity_level | 意義 |
| ---: | --- |
| 0 | 靜止 / 低活動 |
| 1 | 輕度活動 |
| 2 | 中度活動 |
| 3 | 高強度活動 |

核心原則如下：

> `activity_level` 不是健康狀態，而是用來判斷目前生理數值是否符合該活動強度下的合理範圍。

## 3. 活動基準表：activity_baseline_profile

每位使用者有 4 筆 `activity_baseline_profile`，分別對應 `activity_level` 0 到 3。

這 4 筆資料代表：

> 使用者在不同活動等級下，HR、HRV、SpO2 的正常預期值。

範例：

| activity_level | target_hr | target_hrv | target_spo2 |
| ---: | ---: | ---: | ---: |
| 0 | 72 | 55 | 97 |
| 1 | 90 | 45 | 97 |
| 2 | 115 | 35 | 96 |
| 3 | 145 | 25 | 96 |

說明：

- 這些資料是不同活動強度下的正常參考值。
- 它們不是每 5 秒變動一次的即時資料。
- 劇本不直接修改這些基準值。

## 4. target_state 與 current_state

### 4.1 target_state

`target_state` 是目前 `activity_level` 對應的正常目標狀態。

規則：

```text
target_state = activity_baseline_profile[activity_level]
```

例如：

```text
activity_level = 2
```

則：

```text
target_hr = profile[2].target_hr
target_hrv = profile[2].target_hrv
target_spo2 = profile[2].target_spo2
```

### 4.2 current_state

`current_state` 是模擬過程中實際會隨時間變化的當下狀態，包含：

```text
current_hr
current_hrv
current_spo2
current_activity_level
```

更新頻率為每 5 秒一次。

關鍵原則如下：

> `current_state` 不會瞬間等於 `target_state`，而是逐步靠近，以模擬真實生理變化的過渡過程。

## 5. current_state 初始化規則

劇本開始時，根據劇本指定的 `initial_activity_level` 決定初始狀態。

規則：

```text
current_state = activity_baseline_profile[initial_activity_level]
```

範例一：劇本從靜止開始

```text
initial_activity_level = 0
```

則：

```text
current_hr = profile[0].target_hr
current_hrv = profile[0].target_hrv
current_spo2 = profile[0].target_spo2
```

範例二：劇本一開始就在高活動狀態

```text
initial_activity_level = 3
```

則：

```text
current_hr = profile[3].target_hr
current_hrv = profile[3].target_hrv
current_spo2 = profile[3].target_spo2
```

因此：

> 劇本不一定要從休息開始，可以從任意 `activity_level` 啟動。

## 6. 每 5 秒資料生成規則

每 5 秒產生一筆資料，核心公式如下：

```text
current_next =
current_state
+ 朝 target_state 靠近的調整
+ 劇本異常偏移 scenario_delta
+ 正常週期波動 wave
+ 隨機雜訊 noise
```

### 6.1 HR 公式

```text
current_hr_next =
current_hr
+ (target_hr - current_hr) × hr_adapt_rate
+ scenario_hr_delta
+ wave_hr
+ noise_hr
```

### 6.2 HRV 公式

```text
current_hrv_next =
current_hrv
+ (target_hrv - current_hrv) × hrv_adapt_rate
+ scenario_hrv_delta
+ wave_hrv
+ noise_hrv
```

### 6.3 SpO2 公式

```text
current_spo2_next =
current_spo2
+ (target_spo2 - current_spo2) × spo2_adapt_rate
+ scenario_spo2_delta
+ wave_spo2
+ noise_spo2
```

### 6.4 公式要素說明

| 項目 | 說明 |
| --- | --- |
| `current_state` | 上一筆資料的當下狀態 |
| `target_state` | 目前 `activity_level` 對應的正常目標值 |
| `adapt_rate` | `current_state` 靠近 `target_state` 的速度 |
| `scenario_delta` | 劇本引入的異常偏移 |
| `wave` | 正常的週期性波動 |
| `noise` | 小幅隨機雜訊 |

## 7. activity_level 切換規則

當劇本中的 `activity_level` 發生變化時，系統應切換 `target_state`，但不能讓 `current_state` 瞬間跳變。

規則：

```text
activity_level 改變
=> target_state 切換為新的 profile
=> current_state 依 adapt_rate 逐步靠近新的目標值
```

例如：

```text
activity_level: 0 -> 3
target_state: profile[0] -> profile[3]
```

HR 可能呈現：

```text
72 -> 85 -> 99 -> 113 -> 128 -> 140
```

這表示活動強度提升後，心率會逐步升高，而不是瞬間跳到新目標值。

## 8. scenario 的角色

劇本不直接修改 `activity_baseline_profile`。

劇本只控制以下欄位：

```text
activity_level
scenario_hr_delta
scenario_hrv_delta
scenario_spo2_delta
duration
```

對應作用如下：

| 劇本控制項 | 作用 |
| --- | --- |
| `activity_level` | 控制目前活動等級 |
| `scenario_hr_delta` | 額外讓 HR 上升或下降 |
| `scenario_hrv_delta` | 額外讓 HRV 上升或下降 |
| `scenario_spo2_delta` | 額外讓 SpO2 上升或下降 |
| `duration` | 該劇本段持續時間 |

## 9. 正常與異常劇本範例

### 9.1 正常休息

```text
activity_level = 0
scenario_hr_delta = 0
scenario_hrv_delta = 0
scenario_spo2_delta = 0
```

結果：

```text
current_state 維持接近 profile[0]
```

預期：

```text
不預警
```

### 9.2 正常運動

```text
activity_level = 2 或 3
scenario_hr_delta = 0
scenario_hrv_delta = 0
scenario_spo2_delta = 0
```

結果：

```text
HR 逐漸靠近高活動目標
HRV 逐漸靠近高活動目標
SpO2 大致穩定
```

預期：

```text
不產生危險預警
```

原因是 HR 上升、HRV 下降可被活動等級合理解釋。

### 9.3 低活動生理壓力

```text
activity_level = 0 或 1
scenario_hr_delta > 0
scenario_hrv_delta < 0
scenario_spo2_delta = 0
```

結果：

```text
低活動狀態下 HR 上升
低活動狀態下 HRV 下降
SpO2 穩定
```

預期：

```text
生理壓力偏高
等級：觀察或注意
```

### 9.4 血氧下降風險

```text
activity_level = 0 或 1
scenario_hr_delta > 0
scenario_hrv_delta < 0
scenario_spo2_delta < 0
```

結果：

```text
HR 上升
HRV 下降
SpO2 下降
```

預期：

```text
血氧風險預警
```

### 9.5 綜合生理風險升高

```text
activity_level = 0 或 1
scenario_hr_delta 明顯 > 0
scenario_hrv_delta 明顯 < 0
scenario_spo2_delta 明顯 < 0
```

結果：

```text
低活動狀態下：
HR 明顯上升
HRV 明顯下降
SpO2 明顯下降
```

預期：

```text
綜合生理風險升高
等級：注意或警戒
```

### 9.6 單點雜訊

單筆資料突發異常但迅速恢復，例如：

```text
SpO2: 97, 97, 96, 86, 97, 97
```

預期：

```text
不產生危險預警
```

用途：

> 驗證系統不會因單點噪聲而過度警報。

## 10. 本地資料表設計

### 10.1 即時健康資料表

```text
realtime_health_data
- id
- hr
- hrv
- spo2
- activity_level
- recorded_at
- sync_status
```

### 10.2 使用者活動基準表

```text
activity_baseline_profile
- id
- user_id
- activity_level
- target_hr
- target_hrv
- target_spo2
- updated_at
```

如果本地模擬階段不處理多使用者，可暫時省略 `user_id`。

### 10.3 即時預警表

```text
realtime_alert
- alert_id
- alert_type
- initial_risk_score
- trigger_reason
- detection_start_time
- detection_end_time
- first_occurred_at
- sync_status
```

### 10.4 預警狀態表

```text
alert_status
- status_id
- alert_id
- status
- risk_score
- status_time
- status_description
```

狀態建議包含：

```text
觀察中
注意
警戒
恢復中
已解除
```

## 11. 分析模組原則

分析模組不能讀取劇本名稱，也不能知道當前在跑哪一個劇本。

分析模組只能使用：

```text
realtime_health_data
activity_baseline_profile
```

也就是：

```text
實際生成的資料
各 activity_level 的正常預期值
```

再根據這些資料自行判斷是否異常。

## 12. 滑動視窗分析規則

每新增一筆資料後，分析模組檢查最近一段時間的資料。

建議設定：

```text
資料預熱期：30 秒 = 6 筆
短視窗初步分析期：31~60 秒 = 6~11 筆
正式分析視窗：60 秒 = 12 筆
```

### 12.1 預熱期

前 30 秒：

```text
status = warming_up
```

此階段只收集資料，不產生預警，原因是資料量不足時，平均值、標準差與趨勢不夠穩定。

### 12.2 短視窗初步分析期

31~60 秒：

```text
status = partial_analysis
```

此階段可做初步分析，也可建立預警，但只保留高優先級安全風險的權重。

設計原則如下：

- 只保留 SpO2 持續過低或明顯下降等高優先級安全條件
- HR、HRV 與相對 target_state 偏離等條件暫不納入正式 `risk_score`
- 目的在於提早處理明顯安全風險，同時避免資料不足造成誤判

### 12.3 正式分析

正式分析時取最近 1 分鐘資料，計算：

```text
HR_mean
HR_std
HR_trend

HRV_mean
HRV_std
HRV_trend

SpO2_mean
SpO2_std
SpO2_trend
```

## 13. 視窗指標定義

### 13.1 平均值 mean

表示最近一段時間的整體水準，例如：

```text
HR_mean = 最近 1 分鐘平均心率
```

### 13.2 標準差 std

表示最近一段時間的穩定程度，例如：

```text
SpO2_std 太高
```

可能代表血氧資料不穩，不能直接視為穩定低血氧。

### 13.3 趨勢 trend

建議定義如下：

```text
trend = 視窗最後一筆 - 視窗第一筆
```

例如：

```text
HR_trend = last_hr - first_hr
HRV_trend = last_hrv - first_hrv
SpO2_trend = last_spo2 - first_spo2
```

用途是判斷短時間內是否持續惡化。

## 14. 分析判斷的三種證據

分析模組不應只依賴單一條件，建議同時綜合以下三類證據：

```text
1. 絕對安全範圍
2. 相對 target_state 的偏離
3. 短時間趨勢變化
```

### 14.1 絕對安全範圍

例如：

```text
最近 30 秒 SpO2 平均 < 92
```

這類條件屬於高強度訊號，對個人基準的依賴較低。

### 14.2 相對 target_state 的偏離

分析模組根據目前 `activity_level` 取得對應 `target_state`：

```text
target_state = activity_baseline_profile[current_activity_level]
```

再比較：

```text
HR_mean 是否高於 target_hr 很多
HRV_mean 是否低於 target_hrv 很多
SpO2_mean 是否低於 target_spo2 很多
```

這代表目前資料是否偏離該活動等級下的正常預期。

### 14.3 短時間趨勢變化

例如：

```text
HR_trend >= +15
HRV_trend <= -20%
SpO2_trend <= -3
```

表示最近 1 分鐘內 HR 上升、HRV 下降、SpO2 下降，屬於短時間惡化訊號。

## 15. risk_score 設計

分析模組可透過 `risk_score` 統整各種證據。

初始值：

```text
risk_score = 0
```

在不同分析階段，`risk_score` 的啟用範圍不同。

### 15.1 預熱期

前 30 秒：

```text
risk_score = 0
```

此階段不建立預警。

### 15.2 短視窗初步分析期

31~60 秒：

```text
risk_score = high_priority_safety_score
```

也就是：

- 只計入高優先級安全風險分數
- 其他需要完整視窗才能穩定判斷的條件，先視為 0 分

建議保留的高優先級條件如下：

| 條件 | 加分 |
| --- | ---: |
| SpO2 最近 30 秒平均 < 92 | +3 |
| SpO2 最近 1 分鐘下降 >= 3 | +2 |

此階段可建立預警，但應以安全風險為主，不宜過早納入 HR、HRV 或 target_state 偏離造成的分數。

### 15.3 完整滑動視窗分析期

60 秒後進入完整滑動視窗分析，才啟用全部風險權重。

建議完整加分規則如下：

| 條件 | 加分 |
| --- | ---: |
| SpO2 最近 30 秒平均 < 92 | +3 |
| SpO2 最近 1 分鐘下降 >= 3 | +2 |
| HR 最近 1 分鐘上升 >= 15 | +1 |
| HRV 最近 1 分鐘下降 >= 20% | +1 |
| HR_mean 明顯高於 target_hr | +1 |
| HRV_mean 明顯低於 target_hrv | +1 |
| HR、HRV、SpO2 同時惡化 | +3 |
| 標準差過大 | 降低信心或暫緩升級 |

完整 `risk_score` 對應狀態建議如下：

| risk_score | 狀態 |
| ---: | --- |
| 0-2 | 正常 |
| 3-4 | 觀察 |
| 5-6 | 注意 |
| 7 以上 | 警戒 |

## 16. 活動切換保護期

當 `activity_level` 剛發生變化時，HR 與 HRV 可能因活動改變而自然波動。

例如：

```text
activity_level 0 -> 3
```

常見現象：

```text
HR 上升
HRV 下降
```

這不一定是異常，因此需要活動切換保護期。

設定建議：

```text
activity_grace_period = 15 秒 = 3 筆
```

但保護期的意義不是停止分析，而是調整風險權重。

### 16.1 保護期內規則

活動切換後 15 秒內：

```text
HR 風險降權
HRV 風險降權
SpO2 風險照常計算
高風險條件仍可觸發
```

建議權重如下：

| 條件 | 正常權重 | 保護期權重 |
| --- | ---: | ---: |
| HR 上升 | +1 | +0.5 |
| HRV 下降 | +1 | +0.5 |
| SpO2 下降 | +2 | +2 |
| SpO2 持續過低 | +3 | +3 |
| 多指標同時惡化 | +3 | +2 |

原因如下：

```text
活動切換可以解釋 HR / HRV 變化，
但不能完全解釋 SpO2 持續下降。
```

## 17. 預警成立條件

不建議單次 `risk_score` 超過門檻就立即建立預警。

建議規則：

```text
partial_analysis 階段若高優先級安全風險已達門檻，可直接建立預警
risk_score 連續 2 次達到注意門檻 -> 建立注意狀態
risk_score 連續 3 次達到警戒門檻 -> 建立或升級為警戒
```

由於系統每 5 秒分析一次，因此：

```text
連續 2 次 = 10 秒
連續 3 次 = 15 秒
```

這可降低短暫波動造成的誤判。

## 18. 預警類型

### 18.1 血氧風險狀態

判斷例：

```text
最近 30 秒 SpO2 平均 < 92
```

或：

```text
最近 1 分鐘 SpO2 下降 >= 3
且 HR 同時上升
```

### 18.2 生理壓力偏高

判斷例：

```text
activity_level <= 1
且 HR 上升
且 HRV 下降
且 SpO2 沒有明顯下降
```

等級通常為：

```text
觀察或注意
```

### 18.3 綜合生理風險升高

判斷例：

```text
HR 上升
HRV 下降
SpO2 下降
且多個條件持續成立
```

等級通常為：

```text
注意或警戒
```

## 19. 完整流程

```text
1. 建立 activity_baseline_profile
   每位使用者有 4 筆，對應 activity_level 0~3。

2. 選擇劇本
   劇本指定 initial_activity_level。

3. 初始化 current_state
   current_state = activity_baseline_profile[initial_activity_level]。

4. 每 5 秒產生資料
   a. 讀取劇本目前 activity_level
   b. target_state = activity_baseline_profile[activity_level]
   c. current_state 朝 target_state 靠近
   d. 加上 scenario_delta
   e. 加上 wave 與 noise
   f. 寫入 realtime_health_data

5. 分析模組執行
   a. 前 30 秒為 warming_up
   b. 31~60 秒為 partial_analysis
   c. partial_analysis 只保留高優先級安全風險權重
   d. 60 秒後正式分析取最近 1 分鐘資料
   e. 計算 mean、std、trend
   f. 檢查是否處於 activity_grace_period
   g. 計算 risk_score

6. 若 risk_score 持續超過門檻
   建立即時預警或更新預警狀態。

7. 若 risk_score 回落並持續穩定
   將預警標記為恢復或解除。

8. 等待後續同步到雲端
```

## 20. 核心規則摘要

可用以下幾句話總結本設計：

```text
activity_baseline_profile 提供 4 個活動等級的正常目標值。
target_state 是目前 activity_level 對應的 profile。
current_state 是模擬過程中真正會變化的狀態。
current_state 每 5 秒逐步靠近 target_state。
scenario_delta 用來產生劇本中的異常偏移。
分析模組不讀劇本，只根據滑動視窗、target_state、趨勢與 risk_score 判斷是否形成預警。
```

最簡短版本如下：

> 4 筆 `activity_baseline_profile` 定義不同活動等級下的正常目標，劇本決定 `activity_level` 與異常 `delta`，`current_state` 逐步變化並寫入資料庫，分析模組再以滑動視窗與 `risk_score` 判斷是否形成預警。
