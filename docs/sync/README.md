# Sync Docs

`docs/sync` 目前分為兩份主要文件：

- [sync-design.md](E:/bowen.code/project/HealthSync_Alert/docs/sync/sync-design.md): 本地同步流程與資料整理規則
- [server-sync-integration.md](E:/bowen.code/project/HealthSync_Alert/docs/sync/server-sync-integration.md): 手機端單向同步到伺服器的對接方式

## 文件分工

### 1. `sync-design.md`

說明：

- 本地端何時壓縮
- 本地端何時同步
- 週期健康紀錄如何形成
- 預警資料何時可同步
- `pending / synced` 狀態規則

### 2. `server-sync-integration.md`

說明：

- 手機端同步 payload
- 伺服器接收 API
- 去重與 transaction 規則
- 伺服器如何寫入長期資料表
- 同步成功與失敗回應格式
