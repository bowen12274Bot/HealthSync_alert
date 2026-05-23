# 本地端即時預警分析規則

## 1. 文件目的

本文定義本地端即時預警分析規則，作為分析模組、預警資料表設計與本地預警顯示流程的共同依據。

本文件假設本地健康資料已依一致規則持續生成，並以：

```text
realtime_health_data
activity_baseline_profile
```

作為即時分析輸入。

系統目標如下：

- 根據滑動視窗分析當下健康資料
- 由本地分析模組計算 `risk_score`
- 判斷是否建立、升級、延續、轉移或解除本地預警事件

## 2. 本地預警資料表設計

### 2.1 即時預警表

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

### 2.2 預警狀態表

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
已轉移
```

補充：

- `status` 建議統一使用上述生命週期狀態值
- `建立 / 升級 / 降級` 屬於狀態轉移動作，不作為 `alert_status.status` 的實際值保存
- 例如：`觀察中 -> 注意` 表示升級，`警戒 -> 注意` 可視為降級
- `已解除` 表示該事件自然恢復後結束
- `已轉移` 表示該事件因主因切換而結束，改由新事件承接

## 3. 分析模組原則

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

## 4. 滑動視窗分析規則

每新增一筆資料後，分析模組檢查最近一段時間的資料。

建議設定：

```text
資料預熱期：30 秒 = 6 筆
短視窗初步分析期：31~60 秒 = 6~11 筆
正式分析視窗：60 秒 = 12 筆
```

### 4.1 預熱期

前 30 秒：

```text
status = warming_up
```

此階段只收集資料，不產生預警，原因是資料量不足時，平均值、標準差與趨勢不夠穩定。

### 4.2 短視窗初步分析期

31~60 秒：

```text
status = partial_analysis
```

此階段可做初步分析，也可建立預警，但只保留高優先級安全風險的權重。

設計原則如下：

- 只保留 SpO2 持續過低或明顯下降等高優先級安全條件
- HR、HRV 與相對 target_state 偏離等條件暫不納入正式 `risk_score`
- 目的在於提早處理明顯安全風險，同時避免資料不足造成誤判

### 4.3 正式分析

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

## 5. 視窗指標定義

### 5.1 平均值 mean

表示最近一段時間的整體水準，例如：

```text
HR_mean = 最近 1 分鐘平均心率
```

### 5.2 標準差 std

表示最近一段時間的穩定程度，例如：

```text
SpO2_std 太高
```

可能代表血氧資料不穩，不能直接視為穩定低血氧。

### 5.3 趨勢 trend

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

## 6. 分析判斷的三種證據

分析模組不應只依賴單一條件，建議同時綜合以下三類證據：

```text
1. 絕對安全範圍
2. 相對 target_state 的偏離
3. 短時間趨勢變化
```

### 6.1 絕對安全範圍

例如：

```text
最近 30 秒 SpO2 平均 < 92
```

這類條件屬於高強度訊號，對個人基準的依賴較低。

### 6.2 相對 target_state 的偏離

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

### 6.3 短時間趨勢變化

例如：

```text
HR_trend >= +15
HRV_trend <= -20%
SpO2_trend <= -3
```

表示最近 1 分鐘內 HR 上升、HRV 下降、SpO2 下降，屬於短時間惡化訊號。

## 7. risk_score 設計

分析模組可透過 `risk_score` 統整各種證據。

初始值：

```text
risk_score = 0
```

在不同分析階段，`risk_score` 的啟用範圍不同。

### 7.1 預熱期

前 30 秒：

```text
risk_score = 0
```

此階段不建立預警。

### 7.2 短視窗初步分析期

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

### 7.3 完整滑動視窗分析期

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

完整 `risk_score` 對應活躍狀態建議如下：

| risk_score | 狀態 |
| ---: | --- |
| 0-2 | 正常 |
| 3-4 | 觀察 |
| 5-6 | 注意 |
| 7 以上 | 警戒 |

## 8. 活動切換保護期

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

### 8.1 保護期內規則

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

## 9. 預警成立條件

不建議單次 `risk_score` 超過門檻就立即建立預警。

建議規則：

```text
partial_analysis 階段若高優先級安全風險已達門檻，可直接建立預警
risk_score 連續 2 次達到注意門檻 -> 建立注意狀態
risk_score 連續 3 次達到警戒門檻 -> 建立或將狀態提升為警戒
```

由於系統每 5 秒分析一次，因此：

```text
連續 2 次 = 10 秒
連續 3 次 = 15 秒
```

這可降低短暫波動造成的誤判。

解除規則建議如下：

```text
事件由活躍狀態降到不再達預警門檻 -> 先進入恢復中
最新連續 2 次符合恢復條件 -> 標記為已解除
```

這代表：

- 建立預警與解除預警都採連續判斷，避免短暫波動造成誤建或誤解除
- `已解除` 只用於自然恢復後的事件結束
- 若事件不是自然恢復，而是主因切換，則使用 `已轉移`
- `恢復中` 並不代表事件已結束；若在解除前又重新達到預警門檻，可回到 `觀察中 / 注意 / 警戒`

## 10. 預警類型

### 10.1 血氧風險狀態

判斷例：

```text
最近 30 秒 SpO2 平均 < 92
```

或：

```text
最近 1 分鐘 SpO2 下降 >= 3
且 HR 同時上升
```

### 10.2 生理壓力偏高

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

### 10.3 綜合生理風險升高

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

## 11. 預警類型與事件轉移規則

同一時間只維護一筆主預警事件。

每輪分析時，系統可先根據當前健康指標判斷候選預警類型，但不代表一定直接改變目前事件的 `alert_type`。

設計重點如下：

- `alert_type` 與 `status` 是兩個不同維度
- `status` 反映生命週期狀態
- `alert_type` 反映本次事件的主因類型
- `alert_type` 允許升級，但不允許降級
- 若不同單一路徑主因彼此取代，應視為舊事件結束、新事件開始

### 11.1 預警類型

本階段先定義三種預警類型：

```text
spo2_risk
physiological_stress
combined_physiological_risk
```

語意如下：

- `spo2_risk`：SpO2 持續偏低或明顯下降
- `physiological_stress`：低活動下 HR 上升、HRV 下降，且 SpO2 沒有明顯下降
- `combined_physiological_risk`：HR 上升、HRV 下降、SpO2 下降同時出現

### 11.2 預警類型升級關係

目前只允許和 `combined_physiological_risk` 之間的升級關係。

允許：

```text
physiological_stress -> combined_physiological_risk
spo2_risk -> combined_physiological_risk
```

不允許：

```text
physiological_stress -> spo2_risk
spo2_risk -> physiological_stress
combined_physiological_risk -> physiological_stress
combined_physiological_risk -> spo2_risk
```

也就是：

- `combined_physiological_risk` 是唯一上位型
- `spo2_risk` 與 `physiological_stress` 不直接互轉
- `alert_type` 一旦升級為 `combined_physiological_risk`，後續不再回退為較低階類型

### 11.3 候選預警類型判斷

每輪分析時，系統可先根據當前健康指標判斷候選預警類型，例如：

- 只有 SpO2 異常時，候選類型為 `spo2_risk`
- 低活動下 HR 上升、HRV 下降，且 SpO2 沒有明顯下降時，候選類型為 `physiological_stress`
- HR 上升、HRV 下降、SpO2 下降同時出現時，候選類型為 `combined_physiological_risk`
- 若未達任何預警類型條件，則候選類型為 `null`

此處的候選類型只是本輪分析結果，不代表一定直接修改目前事件的 `alert_type`。

### 11.4 事件轉移規則

當目前不存在進行中的預警事件時：

- 若本輪 `risk_score` 未達預警門檻，則不建立預警
- 若本輪 `risk_score` 已達預警門檻，則建立新事件

當目前已存在進行中的預警事件時，應比較：

```text
current alert_type
本輪候選 alert_type
```

再決定事件如何轉移。

#### 11.4.1 same

下列情況視為同一事件延續：

- 本輪候選類型與目前 `alert_type` 相同
- 目前 `alert_type` 為 `combined_physiological_risk`，而本輪候選類型為較低階單一路徑類型

處理方式：

- 維持同一筆事件
- 不修改 `alert_type`
- 只更新 `status`

#### 11.4.2 upgrade

下列情況視為同一事件升級：

- `physiological_stress -> combined_physiological_risk`
- `spo2_risk -> combined_physiological_risk`

處理方式：

- 維持同一筆事件
- 將 `alert_type` 升級為 `combined_physiological_risk`
- 更新 `status`

#### 11.4.3 replace

下列情況視為不同主因事件的切換：

- `physiological_stress -> spo2_risk`
- `spo2_risk -> physiological_stress`

此時不視為同一筆事件的類型變更，而應視為：

```text
舊事件結束
新事件開始
```

處理方式：

- 將舊事件直接標記為 `已轉移`
- 更新舊事件的 `detection_end_time`
- 建立新的預警事件承接新的主因類型

#### 11.4.4 resolve

若本輪候選類型為 `null`，或整體已不再達到預警成立門檻，則進入自然恢復流程。

處理方式：

- 舊事件先進入 `恢復中`
- 若最新連續 2 次仍符合恢復條件，再標記為 `已解除`
- 更新 `detection_end_time`

### 11.5 status 與 alert_type 的關係

`status` 與 `alert_type` 的意義不同：

- `status` 反映該事件目前的生命週期狀態
- `alert_type` 反映該事件的主因類型

因此：

- `status` 升降級不等於 `alert_type` 升降級
- `status` 仍依 `risk_score` 與事件生命週期規則決定
- `alert_type` 則依健康指標種類與事件轉移規則決定

狀態可再整理成三類：

- 活躍狀態：`觀察中 / 注意 / 警戒`
- 恢復狀態：`恢復中`
- 結束狀態：`已解除 / 已轉移`

最重要的原則如下：

> `combined_physiological_risk` 作為唯一上位型，`spo2_risk` 與 `physiological_stress` 不直接互轉；若兩者彼此取代，應視為舊事件結束、新事件開始，而不是同一筆事件的類型變更；其中自然恢復以 `恢復中 -> 已解除` 表示，主因切換則以 `已轉移` 表示。

## 12. 完整流程

```text
1. 本地資料生成模組每 5 秒寫入一筆 realtime_health_data

2. 分析模組執行
   a. 前 30 秒為 warming_up
   b. 31~60 秒為 partial_analysis
   c. partial_analysis 只保留高優先級安全風險權重
   d. 60 秒後正式分析取最近 1 分鐘資料
   e. 計算 mean、std、trend
   f. 檢查是否處於 activity_grace_period
   g. 計算 risk_score

3. 若 risk_score 持續超過門檻
   建立即時預警或更新預警狀態

4. 若 risk_score 回落並持續穩定
   將預警標記為恢復或解除

5. 完整預警事件在生命週期結束後
   等待後續同步到伺服器
```

## 13. 核心規則摘要

可用以下幾句話總結本設計：

```text
分析模組不讀劇本，只根據滑動視窗、target_state、趨勢與 risk_score 判斷是否形成預警。
正式分析使用最近 1 分鐘資料計算 mean、std、trend。
預警以 risk_score 為核心，並結合活動切換保護期與連續成立條件降低誤判。
同一時間只維護一筆主預警事件，並依 alert_type 與 status 規則決定延續、升級、轉移與解除。
```

最簡短版本如下：

> 本地預警分析模組使用滑動視窗、`activity_baseline_profile` 與 `risk_score` 判斷即時風險，再透過 `realtime_alert` 與 `alert_status` 維護預警生命週期。
