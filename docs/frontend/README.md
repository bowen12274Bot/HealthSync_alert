# Frontend Docs

`docs/frontend` 目前包含以下主要文件：

- [frontend-plan.md](./frontend-plan.md): 手機前端整體頁面規劃與主導航說明
- [live-alert-display.md](./live-alert-display.md): 即時預警頁的顯示規則與導向方式
- [alert-history-design.md](./alert-history-design.md): 預警紀錄頁的連線限制、API 與歷史資料整併設計
- [login-flow.md](./login-flow.md): 登入與 baseline 初始化放行流程
- [trends-report-design.md](./trends-report-design.md): 趨勢報表頁的短期/長期展示設計

## 文件分工

### 1. `frontend-plan.md`

說明：

- 前端主導航規劃
- 儀表板、趨勢報表、預警紀錄、設定頁的定位
- 各頁顯示重點與頁面邊界

### 2. `live-alert-display.md`

說明：

- 單筆即時預警頁
- 即時模式與歷史模式入口
- 上下區塊版面結構
- 異常摘要區、摘要說明卡與預警資訊區

### 3. `login-flow.md`

說明：

- 登入頁行為
- baseline 初始化與放行條件
- baseline 初始化失敗時的重試流程

### 4. `alert-history-design.md`

說明：

- 預警紀錄頁定位
- online only 使用限制
- 歷史紀錄查詢 API
- `alert_histories` / `long_term_alerts` 整併方式

### 5. `trends-report-design.md`

說明：

- 短期趨勢報表定位
- 長期趨勢報表定位
- 資料來源與時間範圍
- 頁面共用骨架與第一版展示範圍
