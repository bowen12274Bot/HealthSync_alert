# Alert Rules Guide

## 1. 這份文件在說什麼

這份文件用來說明 `docs/alert-rules/` 下面各份文件的用途，幫助組員快速找到本地預警、劇本模擬與伺服器端長期預警的對應規則。

## 2. 文件分工

目前 `docs/alert-rules/` 主要分成三份文件：

- `local-health-simulation-rules.md`
- `local-alert-analysis-rules.md`
- `long-term-alert-analysis.md`

## 3. 建議閱讀順序

建議先用下面順序理解：

1. `local-health-simulation-rules.md`
2. `local-alert-analysis-rules.md`
3. `long-term-alert-analysis.md`

原因如下：

- 先理解本地端健康資料如何生成
- 再理解本地端如何根據這些資料做即時預警
- 最後再理解伺服器端如何根據同步後的歷史資料做長期預警

## 4. 各文件用途

### 4.1 `local-health-simulation-rules.md`

這份文件處理：

- 本地端健康資料生成規則
- 劇本模擬方式
- `activity_level` 與 `activity_baseline_profile` 的角色
- `current_state` / `target_state` 的關係
- 本地即時健康資料的生成流程

可理解為：

```text
本地端資料是怎麼被模擬出來的
```

### 4.2 `local-alert-analysis-rules.md`

這份文件處理：

- 本地端即時預警分析規則
- 滑動視窗分析
- `risk_score` 設計
- 預警成立與解除條件
- `alert_type` 與事件轉移規則
- `realtime_alert` / `alert_status` 的生命週期

可理解為：

```text
本地端如何根據即時資料做預警判斷
```

### 4.3 `long-term-alert-analysis.md`

這份文件處理：

- 伺服器端長期預警定位
- 7 天與 30 天分析週期
- 整體趨勢分析
- 預警歷史模式分析
- 長期風險分數與 `long_term_alerts` 寫入條件

可理解為：

```text
伺服器端如何根據歷史資料產生長期預警
```

## 5. 文件之間的關係

三份文件可用以下方式理解：

```text
local-health-simulation-rules.md
=> 定義資料如何生成

local-alert-analysis-rules.md
=> 定義資料如何在本地端被即時分析

long-term-alert-analysis.md
=> 定義同步後的歷史資料如何在伺服器端被長期分析
```

也就是：

```text
本地模擬
-> 本地即時預警
-> 同步到伺服器
-> 伺服器長期預警
```
