# Server Setup

## 1. 這份文件在說什麼

這份文件用來說明後端開發環境怎麼準備，以及平常怎麼啟動本專案的後端部分。

## 2. 概念

`server/` 是平常後端開發的主要位置。

可以先把它理解成：接收請求、處理資料、對外提供服務的那一側。

## 3. 前置需求

開始前請先安裝：

- Docker Desktop

## 4. 後端準備步驟

第一次準備後端環境時，統一使用 Docker 啟動資料庫與後端：

```powershell
docker compose up --build
```

啟動後：

- PostgreSQL: `localhost:5433`
- API: `http://localhost:8000`

## 5. 日常使用流程

日常需要進行後端開發或檢查時，統一使用 Docker：

```powershell
docker compose up --build
```

如果需要手動管理伺服器資料庫，可再專案根目錄使用：

```powershell
docker compose exec api python scripts/manage_db.py create
docker compose exec api python scripts/manage_db.py drop
docker compose exec api python scripts/manage_db.py reset
docker compose exec api python scripts/manage_db.py seed
```

其中：

- `create`：建立資料表
- `drop`：刪除資料表
- `reset`：重建資料表
- `seed`：寫入預設測試資料

如果有特殊需求，例如要改成在本機終端機直接啟動後端和操作資料庫，再請 AI 協助處理即可。
