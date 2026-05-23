# 本地端健康資料生成與劇本模擬規則

## 1. 文件目的

本文定義本地端健康資料模擬與劇本生成規則，作為資料生成模組、模擬 runtime 與本地資料表設計的共同依據。

系統目標如下：

- 模擬智慧手錶或手環，每 5 秒產生一筆健康資料。
- 將資料寫入本地 SQLite。
- 讓後續本地預警分析模組可根據一致的資料生成規則進行判斷。

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

## 11. 完整流程

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
```

## 12. 核心規則摘要

可用以下幾句話總結本設計：

```text
activity_baseline_profile 提供 4 個活動等級的正常目標值。
target_state 是目前 activity_level 對應的 profile。
current_state 是模擬過程中真正會變化的狀態。
current_state 每 5 秒逐步靠近 target_state。
scenario_delta 用來產生劇本中的異常偏移。
```

最簡短版本如下：

> 4 筆 `activity_baseline_profile` 定義不同活動等級下的正常目標，劇本決定 `activity_level` 與異常 `delta`，`current_state` 逐步變化並寫入資料庫，作為後續本地預警分析的輸入資料。
