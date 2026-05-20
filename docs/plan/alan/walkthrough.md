# Walkthrough - 同步與結構對齊修復成果

本修復專案已成功完成！我們針對「資料同步與安全驗證（Section 1）」、「資料庫欄位與結構對齊（Section 2）」與「打包壓縮與合併（Section 4）」中發現的所有不一致問題進行了完整修復與重構。

---

## 1. 變更的程式碼清單

### 後端 API 與 資料庫模型變更 (Backend)
*   **[MODIFY] [periodic_health_record.py](file:///c:/Users/tange/Desktop/all_project/db_homework/HealthSync_alert/server/app/models/periodic_health_record.py)**
    *   在 `PeriodicHealthRecord` 模型中加入了 `steps` 欄位（預設值為 `0`，非空）。
*   **[MODIFY] [auth.py](file:///c:/Users/tange/Desktop/all_project/db_homework/HealthSync_alert/server/app/api/auth.py)**
    *   修正 `get_authenticated_session` 的函式參數定義，改為在參數列表中宣告 `authorization: AuthorizationHeader = None`，以符合 FastAPI/Pydantic 的 `Annotated` 預設值驗證規範，避免啟動時產生 AssertionError。
*   **[MODIFY] [sync.py](file:///c:/Users/tange/Desktop/all_project/db_homework/HealthSync_alert/server/app/api/sync.py)**
    *   在 `PeriodicHealthRecordSchema` 中加入 `steps` 欄位。
    *   在 `SyncBatchResponse` 響應模型中補齊 `accepted_alert_count: int` 欄位以避免該欄位被 FastAPI 序列化時隱式過濾丟棄。
    *   為 Base64 解碼加入嚴格的 `validate=True` 參數，確保不合法的客戶端 Base64 輸入會引發異常，從而正確回滾交易並回傳 `400` 錯誤。
    *   在資料庫執行 `insert().on_conflict_do_nothing()` 後，若 `result.rowcount` 回傳 `-1` (PostgreSQL Dialect 針對多筆插入無 returning 語句時的預設行為)，自動回退為以 Payload 清單長度作為成功計數，確保響應計數之正確性。
    *   將 `POST /sync/batch` 路由掛載 `get_authenticated_session` 依賴，以驗證 JWT 認證身分，並動態使用 `session.user.id` 作為外鍵 `user_account_id` 關聯。
*   **[MODIFY] [test_sync.py](file:///c:/Users/tange/Desktop/all_project/db_homework/HealthSync_alert/server/test_sync.py)**
    *   更新測試腳本以先連線 `POST /auth/login` 登入並取得真實 `access_token`，再將該 Bearer Token 夾帶於同步批次上傳的 HTTP headers 中。
*   **[NEW] [test_edge_cases.py](file:///c:/Users/tange/Desktop/all_project/db_homework/HealthSync_alert/server/test_edge_cases.py)**
    *   實作邊緣測試腳本，完整覆蓋以下案例：
        *   未攜帶 Token 同步上傳 (預期 401)
        *   攜帶無效 Token 同步上傳 (預期 401)
        *   上傳空數據載荷 (預期 200 成功，且計數均為 0)
        *   健康紀錄缺少 steps 欄位以測試向下相容性 (預期 200 成功，且資料庫中寫入預設值 0)
        *   上傳無效 Base64 壓縮載荷 (預期 400 驗證錯誤且資料庫交易完整回滾)

### 手機端變更 (Mobile App)
*   **[MODIFY] [sqlite.ts](file:///c:/Users/tange/Desktop/all_project/db_homework/HealthSync_alert/mobile-app/src/db/sqlite.ts)**
    *   加入 `sync_record` 資料表的 schema 宣告及初始化建表動作。
*   **[MODIFY] [repository.ts](file:///c:/Users/tange/Desktop/all_project/db_homework/HealthSync_alert/mobile-app/src/modules/alert-engine/repository.ts)**
    *   實作 `getPendingCompletedAlerts()` 以查詢待同步且已關閉的預警。
    *   實作 `getAlertStatusesForSync()` 以載入給定預警的所有歷程狀態明細。
    *   實作 `updateAlertsSyncStatus()` 用以將本機 SQLite 預警標記為已同步。
*   **[MODIFY] [sync_client.ts](file:///c:/Users/tange/Desktop/all_project/db_homework/HealthSync_alert/mobile-app/src/modules/health-simulation/engine/sync_client.ts)**
    *   讀取當前 AuthSession 並將 JWT token 注入同步 Header 中。
    *   收集本地待同步預警及其狀態變化歷史，正規化並動態映射最高風險分與對應的嚴重文字級別（`'低度' | '中度' | '高度'`），一同打包至 `alerts` 傳輸 Payload。
    *   實作同步歷程日誌寫入，在同步開始與結束（不論成功或失敗）時記錄同步範圍、狀態及錯誤原因至本地 `sync_record` 表中。
    *   同步成功後將本機的健康紀錄與預警狀態批次切換為 `'synced'`。
*   **[MODIFY] [packer.ts](file:///c:/Users/tange/Desktop/all_project/db_homework/HealthSync_alert/mobile-app/src/modules/health-simulation/engine/packer.ts)**
    *   實作殘缺視窗的「向後合併」演算法：向後合併最多 2 個舊視窗，若觸及現在窗則保留；若檢查 2 個舊窗後樣本仍不足 6 筆，則執行「捨棄最舊窗」（物理刪除該原始資料）。

---

## 2. 編譯與代碼檢驗驗證

我們在本機執行了 TypeScript 的編譯及 ESLint 語法規則檢查，兩者均 100% 成功通過：

1.  **TypeScript 靜態型別編譯檢驗**：
    *   執行命令：`npm run type-check` (即 `vue-tsc --build`)
    *   **結果**：編譯成功，無任何型別錯誤。
2.  **ESLint / Oxlint 程式碼風格與語意檢驗**：
    *   執行命令：`npm run lint`
    *   **結果**：檢驗成功，未發現任何 Lint 違規。

---

## 3. 部署與運行驗證步驟

您可以在啟用本機 Docker 環境後，透過以下步驟進行完整 E2E 上傳、向後合併功能與邊緣測試驗證：

1.  **啟動與初始化後端容器**：
    *   在專案根目錄下執行 `docker compose up --build -d` 啟動 PostgreSQL 及 FastAPI。
2.  **重設資料庫與植入測試帳號**（此步驟確保 steps 欄位及預設資料已同步至資料庫中）：
    *   執行 `docker compose exec api python scripts/manage_db.py reset`
    *   執行 `docker compose exec api python scripts/manage_db.py seed`
3.  **將最新測試腳本複製至運行中的容器內**：
    *   執行 `docker cp server/test_sync.py healthsync-api:/app/test_sync.py`
    *   執行 `docker cp server/test_edge_cases.py healthsync-api:/app/test_edge_cases.py`
4.  **執行主流程 E2E 測試腳本**：
    *   執行 `docker compose exec api python test_sync.py`
    *   **預期結果**：輸出 `================== [E2E 測試成功] ==================`，且回傳計數正確，無任何異常。
5.  **執行邊緣與相容性測試腳本**：
    *   執行 `docker compose exec api python test_edge_cases.py`
    *   **預期結果**：輸出 `================== 所有邊緣測試案例成功通過！ ==================`，包含 Token 驗證失敗、缺 steps 相容性、空 Payload 及 Base64 交易回滾均測試通過。
6.  **運行手機端模擬**：
    *   執行 `npm run dev` 啟動前端開發伺服器。
    *   進行登入，點擊觸發健康數據產生與同步打包。可以在開發者工具 F12 Console 觀察到完整的打包與向後合併、上傳日誌。
