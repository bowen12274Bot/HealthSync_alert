# HealthSync 同步計畫修改紀錄 (Changelog)

此文件用於記錄實作 [本地後端資料同步計畫](./本地後端資料同步計畫.md) 時的各項檔案變更與進度，作為查閱歷史與除錯之依據。

---

## 2026-05-17 (階段一：後端資料表與 API 實作)

### 1. 後端環境配置
- `server/requirements.txt`: 新增 `msgpack==1.1.0` 與 `zstandard==0.23.0`，作為處理「方案 C（MsgPack + ZSTD 二進制打包）」的核心依賴套件。

### 2. 後端資料庫模型 (`server/app/models/periodic_health_record.py`)
- 建立 `PeriodicHealthRecord` SQLAlchemy 模型，對應前端 10 分鐘週期的壓縮健康紀錄。
- **核心欄位映射**：包含 `window_start`, `window_end`, 各項統計值 (`avg_hr`, `min_spo2` 等)，並將核心的 `raw_data_payload` 宣告為 `LargeBinary` (在 PostgreSQL 中為 `BYTEA` 類型) 且允許 `NULL`。
- **冪等性設計**：加入 `UniqueConstraint("user_id", "window_start", "window_end", name="uq_periodic_health_record_window")` 複合唯一約束，確保伺服器在面對重複上傳（如網路逾時重試）時，不會產生重複入庫的資料異常。
- **自動建表**：修改 `server/app/core/database.py`，在 `create_db_tables` 方法中加入 `importlib.import_module("app.models.periodic_health_record")`，確保 FastAPI 啟動時能透過 SQLAlchemy 自動產生此表。

### 3. 後端批次同步 API (`server/app/api/sync.py`)
- **API 路由**：新增 `POST /sync/batch` 端點並掛載至 `server/app/main.py`。
- **Pydantic Schema**：定義 `SyncBatchRequest` 與 `PeriodicHealthRecordSchema`，特別將 `raw_data_payload` 標註為接收 Base64 編碼的字串 (`Optional[str]`)，並保留 `alerts` 陣列作為未來預警資料擴展。
- **Base64 解碼流**：在 API 邏輯中，將前端傳來的 Base64 `raw_data_payload` 字串透過 `base64.b64decode` 解碼為 Python 原生 `bytes`，再存入資料庫。
- **Idempotent 寫入 (Upsert)**：利用 PostgreSQL 方言的 `insert(...).on_conflict_do_nothing(index_elements=['user_id', 'window_start', 'window_end'])` 實作防重複寫入，即使資料重複也視為成功（不拋錯）。
- **交易安全**：全部資料在單一 `DbSession` Transaction 中執行，成功後呼叫 `db.commit()`，若有任何一筆解析錯誤（包含 Base64 格式錯誤）或資料庫異常，則執行 `db.rollback()`，並回傳精確的 HTTP 錯誤狀態碼。

## 2026-05-17 (階段二：前端資料表與壓縮排程器實作)

### 1. 前端環境與資料庫建置
- **套件安裝**：在 `mobile-app` 中執行 `npm install @msgpack/msgpack zstd-codec`，捨棄了無壓縮功能的 fzstd。
- **SQLite 擴充**：修改 `mobile-app/src/db/sqlite.ts`，新增 `CREATE_PERIODIC_HEALTH_RECORDS_TABLE_SQL` 以建立 `periodic_health_records` 表，並設定 `raw_data_payload` 為 `BLOB` 類型。

### 2. 壓縮聚合引擎 (`packer.ts`)
- 建立 `mobile-app/src/modules/health-simulation/engine/packer.ts`，實作極致壓縮演算法 `packPendingWindows()`。
- **遺留視窗合併**：邏輯會動態計算「現在還沒滿的 10 分鐘視窗」，並將 SQLite 中所有早於此視窗且未曾打包過的資料撈出，以精確的時間戳分群。
- **數學聚合**：嚴格依照計畫書實作平均心率、心率變異(僅取平均)、血氧、以及活動等級(眾數計算 `calculateMode`)。
- **二進制打包 (MsgPack + ZSTD)**：計算出相對於視窗起點的 `offsetSec`，轉換為高度緊湊的陣列 `[[offsetSec, hr, hrv, spo2, act], ...]`，使用 MsgPack 序列化後交由 `zstd-codec` 的 WebAssembly 模組壓縮，存入 SQLite 中。

### 3. 排程器整合 (`schedule.ts`)
- 修改 `mobile-app/src/modules/health-simulation/engine/schedule.ts`，將 `packPendingWindows` 綁定在新的 `packIntervalId` (每 10 分鐘觸發)。
- **App 重啟補救 (Boot-up)**：在 `startScheduler` 時，會優先呼叫一次 `packPendingWindows()` 以處理斷線或 App 關閉所遺留的零散資料。

## 2026-05-17 (階段三：前端同步機制與網路對接)

### 1. 同步客戶端 (`sync_client.ts`)
- 建立 `mobile-app/src/modules/health-simulation/engine/sync_client.ts`。
- **BLOB Base64 轉換**：實作 `uint8ArrayToBase64` 工具函式，針對不同環境將 SQLite 讀出的 `raw_data_payload` (無論是原生 Base64, Uint8Array 或一般 Array) 安全轉換成 Base64 字串以放入 JSON Payload。
- **網路離線防禦**：使用 `@capacitor/network` 的 `Network.getStatus()` 檢查連線，斷網時立即終止同步（資料保持 `pending` 狀態，等待下一週期補傳）。
- **隨機偏移與分散流量**：實作 `scheduleSyncWithJitter()`，在執行真正的 HTTP 同步前隨機延遲 `0 ~ 599 秒`，避免伺服器發生定時請求風暴 (Thundering Herd Problem)。
- **SQLite 狀態更新**：若伺服器回傳 API `success=true`，則一次性使用 `UPDATE periodic_health_records SET sync_status = 'synced' WHERE id IN (...)` 將資料標記為已同步。

### 2. 打包與同步的串接
- 修改 `packer.ts`，在順利將原始資料壓縮成 `periodic_health_records` 後，直接觸發 `scheduleSyncWithJitter()`，達成「5 秒收集 -> 10 分鐘打包 -> 隨機 0~10 分鐘內同步」的無縫資料流。
